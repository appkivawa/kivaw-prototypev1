# KIVAW Recommendation Engine - Setup Instructions

## Overview
This MVP recommendation engine provides mood-based activity recommendations with filtering, saving, and feedback features.

## Files Created

### Database
- `supabase/migrations/create_activity_recommendations.sql` - Complete schema, RLS policies, and seed data (40 activities)

### TypeScript Types
- `src/types/recommendations.ts` - All TypeScript interfaces and types

### Core Logic
- `src/lib/recommend.ts` - Scoring algorithm and recommendation logic
- `src/lib/activityApi.ts` - Supabase API functions for activities, saves, and feedback

### UI Components
- `src/components/ActivityCard.tsx` - Individual activity card with save/like/skip actions
- `src/components/FiltersBar.tsx` - Filter controls (time, energy, social, budget)

### Pages
- `src/pages/MatchPage.tsx` - Main recommendation page (`/match`)
- `src/pages/SavedActivitiesPage.tsx` - Saved activities page (`/saved-activities`)

## Setup Steps

### 1. Run Database Migration

In your Supabase dashboard or via CLI:

```bash
# Option A: Via Supabase CLI
supabase migration up

# Option B: Via Dashboard
# Go to SQL Editor in Supabase dashboard
# Copy and paste contents of: supabase/migrations/create_activity_recommendations.sql
# Run the migration
```

**Important Notes:**
- The migration creates 3 tables: `activities`, `saved_activities`, `feedback_events`
- RLS (Row Level Security) is enabled with policies for both authenticated and anonymous users
- 40 seed activities are inserted (10 per mood: destructive, blank, expansive, minimize)

### 2. Verify Environment Variables

Ensure these are set in your `.env` or `.env.local`:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### 3. Routes Added

The following routes are now available:
- `/match` - Main recommendation page (accepts `?mood=destructive|blank|expansive|minimize`)
- `/saved-activities` - View saved activities

### 4. RLS Policy Notes

The RLS policies support both authenticated and anonymous users:
- **Authenticated users**: Uses `auth.uid()` to identify rows (secure)
- **Anonymous users**: Uses `session_id` stored in localStorage as `kivaw_session_id`

**Important**: The RLS policies for anonymous users allow any `session_id` to be inserted/selected. The application code (`activityApi.ts`) ensures that only the current user's session_id is used in queries. This is acceptable for MVP but should be tightened for production.

**For Production**: Consider:
1. Using Supabase Edge Functions to validate session_id
2. Adding a service role function that validates session_id before inserts
3. Using a more restrictive RLS policy that validates session_id format

**Current MVP Behavior**: 
- Authenticated users: Fully secured via `auth.uid()`
- Anonymous users: Application code filters by session_id, RLS allows session_id-based access

### 5. Testing

1. Navigate to `/match` or `/match?mood=destructive`
2. Select mood, adjust filters
3. View recommendations (top 12 scored activities)
4. Click "Show why this matched" to see scoring reasons
5. Save activities, like/skip them
6. Navigate to `/saved-activities` to view saved items

## Scoring Algorithm

Each activity is scored based on:
- **+50 points**: Mood match
- **+10 points**: Each matching tag (energy, social, budget)
- **+10 points**: Duration fits (within 15 min buffer)
- **+10 points**: Cost level fits budget
- **+10 points**: Intensity matches energy level

Top 12 activities are returned, sorted by score.

## Features

✅ Mood-based filtering (4 moods)
✅ Quick filters (time, energy, social, budget)
✅ Activity cards with full details
✅ Save/unsave functionality
✅ Feedback tracking (like, skip, complete, dismiss)
✅ "Why this matched" explanations
✅ Shuffle button to refresh recommendations
✅ Saved activities page
✅ Anonymous user support via session_id
✅ Authenticated user support via auth.uid()

## Next Steps (Optional Enhancements)

- Add pagination for recommendations
- Add activity detail modal/page
- Add completion tracking
- Add recommendation history
- Add "similar activities" suggestions
- Add user preferences persistence
- Add recommendation analytics

