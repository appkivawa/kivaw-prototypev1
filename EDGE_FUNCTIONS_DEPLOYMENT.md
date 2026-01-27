# Edge Functions Deployment Guide

## Deployment Methods

### Method 1: Supabase Dashboard (Recommended for Production)

1. **Go to Supabase Dashboard** → **Edge Functions**
2. **Click "Deploy Function"** or select existing function
3. **Upload function folder** (e.g., `supabase/functions/explore_feed_v2`)
4. **Set environment variables** (if needed):
   - Go to **Settings** → **Edge Functions** → **Secrets**
   - Add secrets: `CRON_SECRET`, `INGEST_SECRET`, `TMDB_API_KEY`, etc.
5. **Deploy**

**Pros**: Easy, visual, good for one-off deployments  
**Cons**: Manual, no version control integration

---

### Method 2: Supabase CLI (Recommended for Development)

**Prerequisites**:
```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref your-project-ref
```

**Deploy Single Function**:
```bash
supabase functions deploy explore_feed_v2
```

**Deploy All Functions**:
```bash
supabase functions deploy
```

**Deploy with Secrets**:
```bash
# Set secrets
supabase secrets set CRON_SECRET=your-secret
supabase secrets set INGEST_SECRET=your-secret

# Deploy
supabase functions deploy explore_feed_v2
```

**Pros**: Automated, version controlled, CI/CD friendly  
**Cons**: Requires CLI setup

---

## Deployment Checklist

### Pre-Deployment

- [ ] **Verify function code**:
  - [ ] All imports are correct
  - [ ] Error handling is in place
  - [ ] Structured logging is added
  - [ ] CORS is configured

- [ ] **Check environment variables**:
  - [ ] `SUPABASE_URL` (auto-provided)
  - [ ] `SUPABASE_ANON_KEY` (auto-provided)
  - [ ] `SUPABASE_SERVICE_ROLE_KEY` (auto-provided)
  - [ ] `CRON_SECRET` (if using cron_runner)
  - [ ] `INGEST_SECRET` (if using ingest_rss)
  - [ ] `TMDB_API_KEY` (if using fetch-tmdb)
  - [ ] `GOOGLE_BOOKS_API_KEY` (if using fetch-google-books)

- [ ] **Verify database dependencies**:
  - [ ] Required tables exist
  - [ ] Required views exist (e.g., `explore_items_v2`)
  - [ ] RLS policies are configured

### Deployment Steps

1. **Deploy function**:
   ```bash
   supabase functions deploy <function-name>
   ```

2. **Verify deployment**:
   ```bash
   curl -X GET https://your-project.supabase.co/functions/v1/<function-name> \
     -H "apikey: $SUPABASE_ANON_KEY"
   ```
   Expected: `{"ok": true, "fn": "<function-name>"}`

3. **Test with real request**:
   ```bash
   curl -X POST https://your-project.supabase.co/functions/v1/<function-name> \
     -H "Content-Type: application/json" \
     -H "apikey: $SUPABASE_ANON_KEY" \
     -d '{"limit": 10}'
   ```

4. **Check logs**:
   - Go to **Supabase Dashboard** → **Edge Functions** → **Logs**
   - Look for structured log entries with correlation IDs

### Post-Deployment

- [ ] **Run smoke test**:
  ```bash
  ./test_edge_functions.sh
  ```

- [ ] **Verify frontend**:
  - [ ] Visit page that uses the function
  - [ ] Check browser console for errors
  - [ ] Verify data loads correctly

- [ ] **Monitor logs**:
  - [ ] Check for error patterns
  - [ ] Verify correlation IDs are present
  - [ ] Check response times

---

## Function-Specific Deployment

### explore_feed_v2

**Dependencies**:
- `explore_items_v2` view must exist

**Deploy**:
```bash
supabase functions deploy explore_feed_v2
```

**Test**:
```bash
curl -X POST https://your-project.supabase.co/functions/v1/explore_feed_v2 \
  -H "Content-Type: application/json" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -d '{"limit": 20, "kinds": ["watch", "read"]}'
```

**Expected Response**:
```json
{
  "items": [...],
  "nextCursor": "...",
  "hasMore": true
}
```

---

### social_feed

**Dependencies**:
- `feed_items` table must exist
- `user_preferences` table (optional, for personalization)
- `sources` table (optional, for followed sources)
- `user_item_actions` table (optional, for user actions)
- `rss_sources` table (optional, for RSS weights)

**Deploy**:
```bash
supabase functions deploy social_feed
```

**Test**:
```bash
curl -X POST https://your-project.supabase.co/functions/v1/social_feed \
  -H "Content-Type: application/json" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -d '{"limit": 60, "days": 21}'
```

**Expected Response**:
```json
{
  "feed": [...],
  "fresh": [...],
  "today": [...],
  "debug": {...}
}
```

---

### ingest_rss

**Dependencies**:
- `feed_items` table must exist
- `rss_sources` table must exist

**Secrets Required**:
- `INGEST_SECRET` (or `CRON_SECRET`)

**Deploy**:
```bash
supabase secrets set INGEST_SECRET=your-secret
supabase functions deploy ingest_rss
```

**Test** (requires secret):
```bash
curl -X POST https://your-project.supabase.co/functions/v1/ingest_rss \
  -H "Content-Type: application/json" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "x-ingest-secret: $INGEST_SECRET" \
  -d '{"maxFeeds": 5, "perFeedLimit": 50}'
```

**Expected Response**:
```json
{
  "ingested": 42,
  "feeds": [...],
  "newestPublishedAt": "...",
  "oldestPublishedAt": "...",
  "counts": {...}
}
```

---

### cron_runner

**Dependencies**:
- `system_health` table must exist

**Secrets Required**:
- `CRON_SECRET`

**Deploy**:
```bash
supabase secrets set CRON_SECRET=your-secret
supabase functions deploy cron_runner
```

**Test** (requires secret):
```bash
curl -X POST https://your-project.supabase.co/functions/v1/cron_runner \
  -H "Content-Type: application/json" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "x-cron-secret: $CRON_SECRET" \
  -d '{"job": "hourly"}'
```

**Expected Response**:
```json
{
  "ok": true,
  "job": "hourly",
  "results": {...},
  "ranAt": "..."
}
```

---

## Troubleshooting

### Function Not Found (404)

**Cause**: Function not deployed or wrong URL

**Fix**:
1. Verify function is deployed: `supabase functions list`
2. Check URL: Should be `/functions/v1/<function-name>`
3. Redeploy: `supabase functions deploy <function-name>`

### Missing Authorization (401)

**Cause**: Missing or invalid `Authorization` header

**Fix**:
1. For anonymous functions: Include `apikey` header
2. For authenticated functions: Include `Authorization: Bearer <jwt>` header
3. For service role functions: Use `SUPABASE_SERVICE_ROLE_KEY`

### Forbidden (403)

**Cause**: Missing or invalid secret header

**Fix**:
1. Check secret is set: `supabase secrets list`
2. Include header: `x-cron-secret` or `x-ingest-secret`
3. Verify secret value matches

### Internal Server Error (500)

**Cause**: Missing env vars, database error, or unhandled exception

**Fix**:
1. Check logs: **Supabase Dashboard** → **Edge Functions** → **Logs**
2. Look for correlation ID in logs
3. Verify required tables/views exist
4. Check environment variables are set

### Empty Results

**Cause**: No data in database, or query filters too restrictive

**Fix**:
1. Verify data exists: Check tables directly
2. Check query filters: Remove filters to test
3. Verify RLS policies: May be blocking data

---

## Monitoring

### View Logs

**Supabase Dashboard**:
1. Go to **Edge Functions** → **Logs**
2. Filter by function name
3. Look for structured log entries

**CLI**:
```bash
supabase functions logs explore_feed_v2 --follow
```

### Log Format

Structured logs include:
- `timestamp`: ISO timestamp
- `level`: `info`, `warn`, or `error`
- `fn`: Function name
- `correlationId`: Unique request ID
- `message`: Log message
- `userId`: User ID or "anonymous"
- Additional metadata (counts, timings, etc.)

### Example Log Entry

```json
{
  "timestamp": "2025-01-27T12:34:56.789Z",
  "level": "info",
  "fn": "explore_feed_v2",
  "correlationId": "explore_1706366096789_abc123",
  "message": "Request completed",
  "userId": "anonymous",
  "itemCount": 20,
  "hasMore": true,
  "durationMs": 234
}
```

---

**Last Updated**: 2025-01-27
