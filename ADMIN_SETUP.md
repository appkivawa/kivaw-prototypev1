# Admin Setup Guide

## Security Setup

### 1. Create Admin Users Table

Run the SQL migration in `supabase/migrations/create_admin_users.sql` in your Supabase SQL editor.

This creates:
- `admin_users` table to store admin user IDs
- Row Level Security (RLS) policies
- Proper indexes for performance

### 2. Add Your First Admin

**Option A: Via Supabase Dashboard**
1. Go to your Supabase dashboard
2. Navigate to Table Editor
3. Open the `admin_users` table
4. Click "Insert row"
5. Add your user ID (found in Authentication > Users)
6. Save

**Option B: Via SQL**
```sql
-- Replace 'YOUR_USER_ID_HERE' with your actual user ID
INSERT INTO admin_users (user_id, notes)
VALUES ('YOUR_USER_ID_HERE', 'Initial admin user');
```

### 3. Verify Admin Access

1. Sign in to your account
2. Navigate to `/admin`
3. You should see the admin dashboard
4. If you see an error, check:
   - Your user ID is in the `admin_users` table
   - RLS policies are enabled
   - You're signed in with the correct account

## Admin Features

### Overview Tab
- View platform statistics
- Total users, content items, saves, echoes, waves
- Refresh stats button

### Users Tab
- View user list
- User management (coming soon)
- View user details

### Content Tab
- View all content items
- Content management
- Edit/delete content (coming soon)

### Analytics Tab
- Growth metrics
- Search functionality
- System settings

## Security Best Practices

1. **Never commit admin user IDs to git**
2. **Use environment variables for sensitive data**
3. **Regularly audit admin_users table**
4. **Use strong passwords for admin accounts**
5. **Enable 2FA for admin accounts (if available)**
6. **Monitor admin access logs**

## Adding More Admins

Only existing admins can add new admins (via RLS policies). To add a new admin:

1. Sign in as an existing admin
2. Go to `/admin`
3. Navigate to Users tab (when implemented)
4. Or manually add via SQL:

```sql
INSERT INTO admin_users (user_id, notes, created_by)
VALUES ('NEW_USER_ID', 'Admin notes', 'YOUR_ADMIN_USER_ID');
```

## Troubleshooting

### "Admin access required" error
- Check that your user ID exists in `admin_users` table
- Verify you're signed in with the correct account
- Check RLS policies are correctly set up

### Can't see stats
- Check Supabase edge function `admin-stats` is deployed
- Verify database permissions
- Check browser console for errors

### Table doesn't exist
- Run the migration SQL in Supabase SQL editor
- Verify table was created successfully
- Check table name matches exactly: `admin_users`

