# Mailpit Login Guide

When running Supabase locally (`supabase start`), magic link emails are captured by **Mailpit** instead of being sent to your real email.

## Quick Solution: Access Mailpit

1. **Open Mailpit in your browser:**
   ```
   http://localhost:8025
   ```

2. **Find your magic link email:**
   - You should see an email from Supabase
   - Click on it to open
   - Look for the magic link button or URL
   - Click the link to sign in

3. **That's it!** You'll be redirected back to the app and signed in.

## Why This Happens

When you run `supabase start`, Supabase automatically starts Mailpit to catch all emails sent by the local instance. This is useful for development because:
- You don't need to configure SMTP
- You can test email flows without sending real emails
- All emails are captured in one place

## Alternative: Configure Real Email (Production)

If you want emails to go to your real inbox in local development, you can configure SMTP in `supabase/config.toml`:

```toml
[auth.email]
enable_signup = true
double_confirm_changes = true
enable_confirmations = false

# Add SMTP configuration
[auth.email.smtp]
host = "smtp.gmail.com"
port = 587
user = "your-email@gmail.com"
pass = "your-app-password"
admin_email = "your-email@gmail.com"
sender_name = "Kivaw"
```

However, **using Mailpit is recommended for local development** because:
- It's faster
- No risk of sending test emails to real users
- Easy to see all emails in one place

## Production Deployment

When deployed to production (Supabase Cloud), emails will be sent to real email addresses automatically. You don't need to configure anything - Supabase handles it.

## Troubleshooting

### Mailpit not accessible?

1. Make sure Supabase is running:
   ```bash
   supabase status
   ```

2. Check if Mailpit is running:
   ```bash
   # Should show mailpit service
   supabase status
   ```

3. Restart Supabase if needed:
   ```bash
   supabase stop
   supabase start
   ```

### Can't find the email in Mailpit?

1. Make sure you entered the correct email address
2. Check the Mailpit inbox - emails appear immediately
3. Try sending the magic link again
4. Check the browser console for any errors




