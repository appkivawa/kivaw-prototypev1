# Supabase Edge Function Secrets

## Required Secrets for `social_feed` Function

The following environment variables/secrets must be configured in your Supabase project for the `social_feed` Edge Function to work correctly.

### Auto-Provided Secrets (No Action Needed)

1. **`SUPABASE_URL`**
   - **Description**: Your Supabase project URL
   - **Status**: ✅ **Automatically provided by Supabase** - You do NOT need to set this
   - **Note**: Supabase CLI will reject attempts to set secrets starting with `SUPABASE_` - this is expected behavior

2. **`SUPABASE_ANON_KEY`**
   - **Description**: Your Supabase anonymous/public API key
   - **Status**: ✅ **Automatically provided by Supabase** - You do NOT need to set this
   - **Note**: Supabase CLI will reject attempts to set secrets starting with `SUPABASE_` - this is expected behavior

**Important**: These environment variables are automatically injected by Supabase when your Edge Functions run. You cannot and should not try to set them manually via `supabase secrets set`.

### Optional Secrets

3. **`INGEST_SECRET`** (Optional - for `ingest_rss` function only)
   - **Description**: Secret key to protect RSS ingest endpoint
   - **Example**: `your-secret-key-here`
   - **Default**: Not set (endpoint is open)
   - **Note**: If set, requests must include `x-ingest-secret` header with matching value
   - **How to set**: `supabase secrets set INGEST_SECRET=your-secret-here`

4. **`ALLOWED_ORIGINS`** (Optional - for `social_feed` function)
   - **Description**: Comma-separated list of allowed CORS origins
   - **Example**: `https://yourdomain.com,https://www.yourdomain.com`
   - **Default**: `*` (allows all origins)
   - **Note**: For production, consider restricting to your domain for security
   - **How to set**: `supabase secrets set ALLOWED_ORIGINS=https://yourdomain.com`

## How to Set Secrets in Supabase

### Via Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Edge Functions** → **social_feed**
3. Click on **Settings** or **Secrets**
4. Add the required secrets listed above

### Via Supabase CLI

**Note**: You cannot set secrets that start with `SUPABASE_` - these are automatically provided.

```bash
# Set optional secrets (if needed)
supabase secrets set INGEST_SECRET=your-secret-here
supabase secrets set ALLOWED_ORIGINS=https://yourdomain.com

# List all secrets
supabase secrets list

# Unset a secret
supabase secrets unset SECRET_NAME
```

### Via Supabase Dashboard (Project Settings)

1. Go to **Project Settings** → **Edge Functions**
2. Click on **Secrets** tab
3. Add secrets for the `social_feed` function

## Verification

After setting secrets, test the function:

```bash
# Test locally (if using Supabase CLI)
supabase functions serve social_feed

# Test deployed function
curl -X POST https://your-project-id.supabase.co/functions/v1/social_feed \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}'
```

## Troubleshooting

### Error: "Missing required environment variables"

- **Cause**: `SUPABASE_URL` or `SUPABASE_ANON_KEY` is not available (should never happen in deployed functions)
- **Solution**: 
  - In deployed Supabase: These are automatically provided - if you see this error, check Supabase Edge Function logs
  - In local development: Make sure you're running `supabase start` or have the correct local environment
  - **Do NOT try to set these manually** - Supabase CLI will reject them

### Error: "non-2xx" or "no-status"

- **Cause**: Function is crashing or returning an error without proper status code
- **Solution**: 
  1. Check Supabase Edge Function logs in the dashboard
  2. Verify all required secrets are set
  3. Check that the `feed_items` table exists and is accessible
  4. Review the function logs for detailed error messages

### Error: CORS issues

- **Cause**: Origin not allowed or CORS headers not set correctly
- **Solution**: 
  1. Verify `ALLOWED_ORIGINS` is set correctly (or use `*` for development)
  2. Check that the function returns proper CORS headers
  3. Ensure OPTIONS requests are handled correctly

## Notes

- Secrets are automatically available to Edge Functions via `Deno.env.get()`
- Secrets are encrypted and only accessible within the Edge Function runtime
- Never commit secrets to version control
- Use different secrets for development and production environments

