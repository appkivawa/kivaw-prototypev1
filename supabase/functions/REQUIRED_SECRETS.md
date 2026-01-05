# Required Supabase Secrets for Edge Functions

These secrets must be set in your Supabase project for the admin Edge Functions to work.

## Setting Secrets

### Via Supabase Dashboard:
1. Go to **Project Settings** → **Edge Functions** → **Secrets**
2. Add each secret with its value

### Via Supabase CLI:
```bash
supabase secrets set SUPABASE_URL=your-url
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
supabase secrets set SUPABASE_ANON_KEY=your-anon-key
```

## Required Secrets

### 1. `SUPABASE_URL`
- **Description:** Your Supabase project URL
- **Example:** `https://abcdefghijklmnop.supabase.co`
- **Where to find:** Project Settings → API → Project URL
- **Required by:** All Edge Functions

### 2. `SUPABASE_SERVICE_ROLE_KEY`
- **Description:** Service role key with full database access (bypasses RLS)
- **Example:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Where to find:** Project Settings → API → service_role key (⚠️ **Keep secret!**)
- **Required by:** All admin Edge Functions (for admin operations)
- **⚠️ Security Warning:** Never expose this key to the client. It has full database access.

### 3. `SUPABASE_ANON_KEY` (Optional but recommended)
- **Description:** Anon key for creating authenticated clients
- **Example:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Where to find:** Project Settings → API → anon public key
- **Required by:** Currently not used, but may be needed for future features
- **Note:** The Edge Functions currently use the JWT from the Authorization header directly

## Verification

After setting secrets, verify they're accessible:

```bash
# Test in Edge Function
supabase functions serve admin-list-users
# Check logs for "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" errors
```

## Security Best Practices

1. **Never commit secrets to git** - Use environment variables or Supabase secrets
2. **Rotate service role key** if it's ever exposed
3. **Use service role key only in Edge Functions** - Never in client code
4. **Monitor Edge Function logs** for unauthorized access attempts

## Troubleshooting

**Error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"**
- Ensure secrets are set in Supabase project
- Verify secret names match exactly (case-sensitive)
- Check Edge Function logs for detailed error messages

**Error: "Forbidden: Admin access required"**
- User is not an admin (not in `admin_allowlist` or doesn't have `admin` role)
- Verify `is_admin()` function works: `SELECT public.is_admin('user-id');`

