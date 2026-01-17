# Recommendation Engine

A comprehensive recommendation system for Kivaw that personalizes content based on user state, focus, time, and energy.

## Architecture

### Database Schema

- **`content_items`**: Unified content across all sources (TMDB, Open Library, manual)
- **`user_preferences`**: User preferences for tags, genres, intensity, and novelty tolerance
- **`interaction_events`**: Tracks user interactions (view, save, skip, dismiss)
- **`internal_actions`**: Move/Create/Reset actions (not from external APIs)

### TypeScript Engine

Located in `src/recs/`:
- **`types.ts`**: Type definitions
- **`normalize.ts`**: Normalizes TMDB and Open Library data into unified format
- **`stateProfiles.ts`**: State profiles and focus multipliers
- **`scoring.ts`**: Scoring function with weighted factors
- **`diversity.ts`**: Diversity re-ranking to avoid monotony
- **`explain.ts`**: Generate "why" explanations
- **`recommend.ts`**: Main recommendation engine

### Edge Functions

- **`get-recommendations`**: POST endpoint for getting recommendations
- **`log-interaction`**: POST endpoint for logging user interactions

## Setup

### 1. Run Database Migrations

```bash
# Apply the schema migration
supabase db push

# Or run in Supabase SQL Editor:
# supabase/migrations/create_recommendation_engine.sql
```

### 2. Seed Internal Actions

```bash
# Run seed data
supabase db push

# Or run in Supabase SQL Editor:
# supabase/migrations/seed_internal_actions.sql
```

### 3. Deploy Edge Functions

```bash
# Deploy both functions
supabase functions deploy get-recommendations
supabase functions deploy log-interaction
```

## Usage

### Get Recommendations

**Endpoint:** `POST /functions/v1/get-recommendations`

**Headers:**
```
Authorization: Bearer <user_jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "state": "blank",
  "focus": "watch",
  "timeAvailableMin": 60,
  "energyLevel": 3,
  "intent": "relax",
  "noHeavy": false
}
```

**Response:**
```json
{
  "recommendations": [
    {
      "id": "tmdb_movie_123",
      "type": "watch",
      "title": "Movie Title",
      "link": "https://...",
      "score": 85.5,
      "why": "Gentle + fits your 60-min window + low-stakes.",
      "tags": ["comfort", "light"],
      "source": "tmdb",
      "description": "...",
      "image_url": "..."
    }
  ],
  "metadata": {
    "totalCandidates": 150,
    "state": "blank",
    "focus": "watch"
  }
}
```

### Log Interaction

**Endpoint:** `POST /functions/v1/log-interaction`

**Headers:**
```
Authorization: Bearer <user_jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "contentId": "tmdb_movie_123",
  "action": "save",
  "state": "blank",
  "focus": "watch"
}
```

**Response:**
```json
{
  "success": true,
  "interaction": {
    "id": "...",
    "user_id": "...",
    "content_id": "...",
    "action": "save",
    "created_at": "..."
  }
}
```

## Testing

### Quick Test Script

```typescript
// test-recommendations.ts
const SUPABASE_URL = "https://your-project.supabase.co";
const SUPABASE_ANON_KEY = "your-anon-key";
const USER_TOKEN = "your-user-jwt-token";

async function testRecommendations() {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/get-recommendations`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${USER_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      state: "blank",
      focus: "watch",
      timeAvailableMin: 60,
      energyLevel: 3,
    }),
  });

  const data = await response.json();
  console.log("Recommendations:", JSON.stringify(data, null, 2));
}

testRecommendations();
```

### Expected Behavior

1. **State: blank, Focus: watch**
   - Should return low-intensity content (0.05-0.35)
   - Prefers comedy, family, romance
   - Avoids horror, thriller, action

2. **State: destructive, Focus: move**
   - Should return high-intensity actions (0.45-0.90)
   - Prefers energetic movement
   - If `noHeavy: true`, should avoid very high intensity

3. **State: expansive, Focus: read**
   - Should return medium-high novelty content
   - Prefers science fiction, documentary, mystery
   - Higher quality and novelty weights

4. **State: minimize, Focus: reset**
   - Should return very low intensity (0.0-0.25)
   - Prefers calm, minimal, simple actions
   - Penalizes high-stimulation content

## Data Normalization

The engine normalizes content from:
- **TMDB**: Movies and TV shows → `watch` type
- **Open Library**: Books → `read` type
- **Internal Actions**: Move/Create/Reset actions

All content is normalized to a unified `ContentItem` format with:
- `intensity` (0-1): How intense/stimulating
- `cognitive_load` (0-1): Mental effort required
- `novelty` (0-1): How new/unfamiliar
- `tags`: Semantic tags (comfort, cathartic, etc.)
- `genres`: Genre classifications

## Scoring Factors

The scoring function uses weighted factors:

1. **Mood Fit** (35% for blank/minimize): Intensity range, genre boosts/penalties, tag alignment
2. **Time Fit** (20-25%): Duration vs available time
3. **Energy Fit** (15-25%): Intensity vs energy level
4. **Preference Fit** (15%): Liked/disliked tags and genres
5. **Quality** (10-15%): Rating and popularity
6. **Novelty Fit** (varies): Matches state's novelty preference

Then applies **Focus Multiplier** (1.5x for matching focus, 0.6-0.9x for others).

## Diversity

After scoring, results are re-ranked to ensure:
- Max 2 items per genre in top 10
- Max 2 items with identical tag clusters
- Includes wildcards (different tag clusters) when possible

## Next Steps

1. **Populate `content_items`**: Use normalization functions to import TMDB and Open Library data
2. **User Preferences**: Allow users to set preferences via UI
3. **Learning**: Use `interaction_events` to improve recommendations over time
4. **A/B Testing**: Test different scoring weights and state profiles









