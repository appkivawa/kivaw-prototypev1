# Admin Users Edge Function Deployment

This edge function provides secure access to user data for admin users only.

## Prerequisites

1. Supabase CLI installed: `npm install -g supabase`
2. Logged in to Supabase: `supabase login`
3. Linked to your project: `supabase link --project-ref your-project-ref`

## Deployment Steps

1. **Deploy the function:**
   ```bash
   supabase functions deploy admin-users
   ```

2. **Set environment variables (if not already set):**
   The function automatically uses:
   - `SUPABASE_URL` (from project settings)
   - `SUPABASE_ANON_KEY` (from project settings)
   - `SUPABASE_SERVICE_ROLE_KEY` (from project settings)

   These are automatically available in edge functions - no manual configuration needed.

3. **Verify deployment:**
   ```bash
   supabase functions list
   ```

## Testing

You can test the function locally:
```bash
supabase functions serve admin-users
```

Then call it with:
```bash
curl -i --location --request POST 'http://localhost:54321/functions/v1/admin-users' \
  --header 'Authorization: Bearer YOUR_ACCESS_TOKEN'
```

## Security Notes

- The function verifies admin status via `profiles.is_admin` or email allowlist
- Uses service role key server-side only (never exposed to client)
- Returns user data only to verified admins
- CORS is enabled for cross-origin requests

## Troubleshooting

- **401 Unauthorized**: Check that you're passing a valid auth token
- **403 Forbidden**: Verify your user has `is_admin = true` in profiles table or is in allowlist
- **500 Error**: Check that profiles table exists and has the required columns

