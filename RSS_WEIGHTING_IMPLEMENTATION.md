# RSS Source Weighting Implementation

## Overview

RSS source weighting has been implemented to influence feed item ranking. Higher-weighted sources (1-5 scale) receive a small boost in the scoring algorithm, nudging their items higher in the feed without dominating other ranking factors.

## Changes Made

### 1. Schema Update

**File:** `supabase/migrations/20250120000003_create_rss_sources.sql`

- Updated `weight` column default from `3` to `1`
- Weight range: 1-5 (1 = lowest priority, 5 = highest priority)
- All existing seed sources already have explicit weights set

### 2. Scoring Logic Update

**File:** `supabase/functions/social_feed/index.ts`

#### Weight Lookup
- Fetches all active RSS sources with their weights at feed load time
- Builds a `Map<feed_url, weight>` for O(1) lookup
- Matches `feed_items.metadata.feed_url` to `rss_sources.url` to get weight

#### Score Calculation
- **RSS Weight Multiplier:** `0.2` per weight point
- **Boost Range:** 0.2 (weight=1) to 1.0 (weight=5)
- Formula: `final_score = base_score + (weight * 0.2)`

#### For Logged-Out Users
```typescript
score = (recency * 1.8) + (sourceWeight * 0.9) + (rssWeight * 0.2)
```

#### For Logged-In Users
```typescript
score = (recency * 1.8) + (topicMatch * 1.2) + (sourceWeight * 0.9) + 
        (actionWeights) + (followBoost) - (blockedPenalty) + (rssWeight * 0.2)
```

### 3. Query Ordering

**File:** `supabase/functions/social_feed/index.ts`

- Feed items are sorted by `score` (descending) after all scoring factors are applied
- RSS weight boost is included in the final score, so ordering automatically reflects it
- No separate ordering query needed - the scoring handles it

## How It Works

1. **Feed Load:** When `social_feed` function is called, it:
   - Fetches active RSS sources from `rss_sources` table
   - Builds a weight map: `feed_url → weight`

2. **Item Processing:** For each `feed_item`:
   - If source is "rss", extracts `metadata.feed_url`
   - Looks up weight in the map (defaults to 1 if not found)
   - Stores weight in `metadata._rss_weight` for scoring

3. **Scoring:** During score calculation:
   - Multiplies weight by `0.2` to get boost value
   - Adds boost to base score
   - Items are sorted by final score (descending)

## Weight Impact

The multiplier of `0.2` ensures weight is a **nudge**, not a dominant factor:

- **Weight 1:** +0.2 boost (minimal)
- **Weight 3:** +0.6 boost (moderate)
- **Weight 5:** +1.0 boost (maximum)

Compared to other factors:
- Recency: up to ~1.8 points
- Topic match: up to ~1.2 points
- Source weight: up to ~0.9 points
- **RSS weight: up to ~1.0 points** (comparable to source weight)

This means weight can meaningfully influence ranking, especially when combined with other factors, but won't override strong recency or personalization signals.

## Example

**Scenario:** Two RSS items published at the same time:
- Item A: From "Hacker News" (weight=5) → boost = +1.0
- Item B: From "Random Blog" (weight=1) → boost = +0.2

**Result:** Item A will rank ~0.8 points higher, making it more likely to appear first, but other factors (recency, topic match, user actions) still matter.

## Testing

To verify weighting is working:

1. **Check weights in database:**
   ```sql
   SELECT title, url, weight FROM rss_sources WHERE active = true ORDER BY weight DESC;
   ```

2. **Check feed items have feed_url:**
   ```sql
   SELECT id, source, metadata->>'feed_url' as feed_url 
   FROM feed_items 
   WHERE source = 'rss' 
   LIMIT 10;
   ```

3. **Monitor scoring in debug output:**
   - The `social_feed` function returns debug info including scores
   - Higher-weighted sources should show higher scores for similar items

## Updating Weights

To change a source's weight:

```sql
UPDATE rss_sources 
SET weight = 5, updated_at = NOW() 
WHERE url = 'https://example.com/feed';
```

Changes take effect on the next feed load (no cache invalidation needed).

## Notes

- **Default weight:** 1 (lowest priority)
- **Weight range:** 1-5 (enforced by CHECK constraint)
- **Non-RSS sources:** Weight boost is 0 (only applies to RSS items)
- **Missing feed_url:** Defaults to weight 1 if `metadata.feed_url` is missing
- **Inactive sources:** Not included in weight map (treated as weight 1)





