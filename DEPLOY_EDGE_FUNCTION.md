# Deploy Edge Function

To deploy the `admin-users` edge function with the updated JWT validation code:

## Option 1: Using Supabase CLI (Recommended)

```bash
cd /Users/mauvekiara/kivaw-web

# Make sure you're logged in
npx supabase login

# Deploy the function
npx supabase functions deploy admin-users
```

## Option 2: Using Supabase Dashboard

1. Go to your Supabase Dashboard
2. Navigate to **Edge Functions** → **admin-users**
3. Click **Deploy** or **Update**
4. The function will be redeployed with the latest code

## After Deployment

1. Sign out from the admin dashboard
2. Sign back in to get a fresh JWT token
3. Try loading users again

## Verify Deployment

Check the edge function logs in Supabase Dashboard to see:
- "Received auth header: Bearer ..."
- "Extracted token length: ..."
- "User auth check: { ... }"

If you still see "Invalid JWT" errors, check:
- The token expiration time in browser console
- Edge function logs for detailed error messages
- That you're signed in with a valid session

