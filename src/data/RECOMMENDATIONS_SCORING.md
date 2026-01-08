# Recommendations Scoring System v1

## Overview

The scoring system provides intelligent recommendations by combining:
- Internal database content (`content_items`)
- External cached content (`external_content_cache` + `content_tags`)

## Scoring Algorithm

### Score Components

1. **Mode Match** (+50 points)
   - Content has the selected mode tag (reset, beauty, logic, faith, reflect, comfort)

2. **Focus Match** (+25 points)
   - Content focus matches selected focus (watch, read, create, etc.)

3. **State Weight** (variable points)
   - Based on state->mode compatibility table
   - Editable weights in `STATE_MODE_WEIGHTS` constant

4. **Freshness Bonus** (0-10 points)
   - Content fetched in last 7 days: +10
   - Content fetched in last 30 days: +5
   - Content fetched in last 90 days: +2
   - Older: +0

5. **Popularity Bonus** (0-15 points)
   - TMDB: Based on `vote_average` (0-10) + `vote_count` bonus
   - Google Books: Based on `averageRating` (0-5) + `ratingsCount` bonus
   - Normalized to 0-15 points

### Total Score Calculation

```
total = modeMatch + focusMatch + stateWeight + freshness + popularity
```

## Usage

### Basic Recommendations

```typescript
import { getExternalRecommendations } from "./data/externalRecommendations";

const recommendations = await getExternalRecommendations(
  {
    state: "blank",
    mode: "comfort",
    focus: "watch",
  },
  12 // limit
);
```

### Unified Recommendations (Internal + External)

```typescript
import { getUnifiedRecommendations } from "./data/unifiedRecommendations";

const recommendations = await getUnifiedRecommendations(
  "blank",  // state
  "watch",  // focus
  "comfort", // mode
  12        // limit
);
```

### With Score Breakdown (for admin/debugging)

```typescript
import { getUnifiedRecommendationsWithScores } from "./data/unifiedRecommendations";

const recommendations = await getUnifiedRecommendationsWithScores(
  "blank",
  "watch",
  "comfort",
  12
);

// Each item has:
// - _score: total score
// - _scoreBreakdown: { modeMatch, focusMatch, stateWeight, freshness, popularity, total }
```

## State->Mode Compatibility Table

Edit `STATE_MODE_WEIGHTS` in `externalRecommendations.ts` to adjust compatibility:

```typescript
const STATE_MODE_WEIGHTS = {
  blank: {
    reset: 20,
    comfort: 15,
    reflect: 10,
    beauty: 5,
  },
  destructive: {
    reflect: 20,
    reset: 15,
    comfort: 10,
    logic: 5,
  },
  expansive: {
    beauty: 20,
    logic: 15,
    reflect: 10,
    faith: 5,
  },
  minimize: {
    reset: 20,
    comfort: 15,
    reflect: 10,
    beauty: 5,
  },
};
```

## Integration Points

### Quiz Results Page

The scoring system can be integrated into `QuizResult.tsx`:

```typescript
import { getUnifiedRecommendations } from "../../data/unifiedRecommendations";

// Replace existing recommendation logic
const recommendations = await getUnifiedRecommendations(
  stateKey,
  focusRaw,
  modeRaw, // Need to extract mode from context
  12
);
```

### Explore Page

Can be used to enhance the "Perfect for you right now" section:

```typescript
import { getExternalRecommendations } from "../data/externalRecommendations";

// Get scored recommendations based on user's current state/mode/focus
const scoredRecs = await getExternalRecommendations(context, 3);
```

## Files

- `src/data/externalRecommendations.ts` - Core scoring system for external content
- `src/data/unifiedRecommendations.ts` - Combines internal + external recommendations
- `src/data/RECOMMENDATIONS_SCORING.md` - This documentation

## Score Breakdown Example

```typescript
{
  modeMatch: 50,      // Content has "comfort" mode tag
  focusMatch: 25,     // Content has "watch" focus tag
  stateWeight: 15,    // State "blank" + mode "comfort" = 15 points
  freshness: 10,      // Fetched 3 days ago
  popularity: 12,      // TMDB vote_average: 8.5, vote_count: 1500
  total: 112          // Sum of all components
}
```

## Notes

- Scores are calculated per item and sorted descending
- External content must be cached (via edge functions) before scoring
- Tags must exist in `content_tags` table for scoring to work
- Fallback: If no mode/focus match, falls back to focus-only matching
- Deduplication: Unified recommendations remove duplicates by ID


