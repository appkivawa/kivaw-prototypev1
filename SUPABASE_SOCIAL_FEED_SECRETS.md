# Supabase Edge Function Secrets - `social_feed`

## Auto-Provided Secrets (No Action Needed)

The following environment variables are **automatically provided by Supabase** when your Edge Function runs. You do NOT need to set them manually:

1. **`SUPABASE_URL`**
   - ✅ Automatically provided
   - Your Supabase project URL
   - Example: `https://your-project-id.supabase.co`

2. **`SUPABASE_ANON_KEY`**
   - ✅ Automatically provided
   - Your Supabase anonymous/public API key
   - Used for RLS-aware queries

**Important**: Supabase CLI will reject attempts to set secrets starting with `SUPABASE_` - this is expected behavior. These are automatically injected by the Supabase runtime.

## Optional Secrets

### `ALLOWED_ORIGINS` (Optional)

- **Description**: Comma-separated list of allowed CORS origins
- **Example**: `https://yourdomain.com,https://www.yourdomain.com,http://localhost:5173`
- **Default**: `*` (allows all origins)
- **When to set**: For production, restrict to your domain for security
- **How to set**:
  ```bash
  supabase secrets set ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
  ```

## How to Set Optional Secrets

### Via Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Edge Functions** → **social_feed**
3. Click on **Settings** or **Secrets**
4. Add `ALLOWED_ORIGINS` if needed

### Via Supabase CLI

```bash
# Set optional CORS origins
supabase secrets set ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# List all secrets
supabase secrets list

# Unset a secret
supabase secrets unset ALLOWED_ORIGINS
```

## Production Deployment Checklist

- [ ] Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` are available (auto-provided)
- [ ] Set `ALLOWED_ORIGINS` to your production domain(s) for security
- [ ] Test the function with both authenticated and unauthenticated requests
- [ ] Verify CORS works for your frontend origin
- [ ] Check Edge Function logs for any errors

## Function Behavior

The `social_feed` function:
- ✅ Uses `SUPABASE_ANON_KEY` with user auth headers (respects RLS)
- ✅ Works for both logged-in and logged-out users
- ✅ Has per-query error isolation using `Promise.allSettled` (one failing query doesn't break everything)
- ✅ Has timeout protection:
  - 5 seconds for request body parsing
  - 10 seconds for main feed_items query
  - 5 seconds for RSS sources query
- ✅ Always returns proper JSON responses with status codes (never "no-status")
- ✅ Handles CORS for both localhost and production origins
- ✅ Isolates auth errors (non-fatal, continues as logged-out user)
- ✅ Isolates user preference/source/action query errors (non-fatal, uses defaults)

## Architecture Notes

**Why ANON_KEY instead of SERVICE_ROLE_KEY?**

The function uses `SUPABASE_ANON_KEY` with user authentication headers because:
- It respects Row Level Security (RLS) policies
- User-specific queries (preferences, sources, actions) are automatically scoped to the authenticated user
- Public queries (feed_items) work for both authenticated and anonymous users
- This is more secure than bypassing RLS with SERVICE_ROLE_KEY

If you need to bypass RLS (not recommended), you would:
1. Add `SUPABASE_SERVICE_ROLE_KEY` to secrets
2. Use it instead of `SUPABASE_ANON_KEY` in `createClient`
3. Remove user auth header passing

## Troubleshooting

### Error: "Missing required environment variables"

- **Cause**: `SUPABASE_URL` or `SUPABASE_ANON_KEY` is not available
- **Solution**: 
  - In deployed Supabase: These should be auto-provided - check Edge Function logs
  - In local development: Make sure you're running `supabase start`
  - **Do NOT try to set these manually** - Supabase CLI will reject them

### Error: CORS issues

- **Cause**: Origin not allowed
- **Solution**: 
  - Set `ALLOWED_ORIGINS` to include your domain
  - Or leave unset to allow all origins (development only)

### Error: "Database query timeout"

- **Cause**: Query took longer than 10 seconds
- **Solution**: 
  - Check database performance
  - Verify indexes exist on `feed_items` table
  - Consider reducing the query limit

### Error: "Request body parsing timeout"

- **Cause**: Request body is too large or malformed
- **Solution**: 
  - Check request payload size
  - Verify JSON is valid

