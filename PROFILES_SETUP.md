# Profiles Table Setup Guide

The admin page needs a `profiles` table to display user information. This table mirrors `auth.users` data and is automatically kept in sync via database triggers.

## Quick Setup

1. Go to your Supabase project dashboard
2. Navigate to the **SQL Editor** section
3. Copy the entire content of `supabase/migrations/create_profiles_table.sql`
4. Paste it into the SQL Editor and click "Run"

## What This Migration Does

- ✅ Creates the `profiles` table with user data (id, email, created_at, last_sign_in_at)
- ✅ Sets up automatic triggers to sync data from `auth.users`
- ✅ Enables Row Level Security (RLS) with policies:
  - Users can read their own profile
  - Admins can read all profiles (for admin dashboard)
- ✅ Backfills existing users into the profiles table
- ✅ Creates indexes for faster queries

## How It Works

1. **Automatic Profile Creation**: When a new user signs up, a trigger automatically creates their profile
2. **Sign-in Tracking**: When a user signs in, their `last_sign_in_at` is automatically updated
3. **Admin Access**: Admins (users in the `admin_users` table) can view all profiles

## Verify It Works

After running the migration:

1. Sign in to your app
2. Go to `/admin` → Users tab
3. You should see a list of users with their emails and sign-in dates
4. If you see an error, check:
   - The migration ran successfully
   - Your user is in the `admin_users` table
   - RLS policies are enabled

## Troubleshooting

### "Could not find the table 'public.profiles'"
- Run the migration SQL in Supabase SQL Editor
- Verify the table was created (check Table Editor)

### "Permission denied" error
- Check that RLS policies were created
- Verify your user is in the `admin_users` table
- Check the policy: "Admins can read all profiles"

### No users showing up
- Check if users exist in `auth.users`
- Verify the backfill query ran (it should have inserted existing users)
- Check if RLS is blocking access

## Manual Backfill (if needed)

If you need to manually backfill users after the migration:

```sql
INSERT INTO public.profiles (id, email, created_at, last_sign_in_at)
SELECT 
  id,
  email,
  created_at,
  last_sign_in_at
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;
```

