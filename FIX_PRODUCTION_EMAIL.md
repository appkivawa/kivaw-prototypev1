# Fix Production Email (Mailpit Issue)

If magic link emails are going to Mailpit instead of real email addresses on your deployed site, you need to configure email settings in your Supabase dashboard.

## The Problem

When Supabase is configured for local development, it uses Mailpit to catch emails. In production, you need to configure real email sending.

## Solution: Configure Email in Supabase Dashboard

### Step 1: Go to Supabase Dashboard

1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to **Authentication** → **Email Templates**

### Step 2: Configure Email Provider

Supabase uses **Resend** by default for sending emails. You have two options:

#### Option A: Use Supabase's Built-in Email (Recommended for Testing)

1. Go to **Project Settings** → **Auth**
2. Scroll to **SMTP Settings**
3. **Enable email confirmations** if not already enabled
4. Supabase will use its default email service (Resend) automatically

#### Option B: Configure Custom SMTP (For Production)

1. Go to **Project Settings** → **Auth** → **SMTP Settings**
2. Enable **Custom SMTP**
3. Enter your SMTP credentials:
   - **Host**: `smtp.gmail.com` (for Gmail) or your email provider's SMTP
   - **Port**: `587` (TLS) or `465` (SSL)
   - **Username**: Your email address
   - **Password**: Your email password or app-specific password
   - **Sender email**: The email address that will send magic links
   - **Sender name**: "Kivaw" (or your app name)

### Step 3: Configure Redirect URLs

1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL** to your production domain:
   ```
   https://yourdomain.com
   ```
3. Add **Redirect URLs**:
   ```
   https://yourdomain.com/**
   https://yourdomain.com/auth/callback
   ```

### Step 4: Test Email Sending

1. Try logging in on your production site
2. Check your email inbox (not Mailpit)
3. The magic link should arrive in your real email

## Troubleshooting

### Emails Still Going to Mailpit?

**Check 1: Verify you're using production Supabase**
- Make sure `VITE_SUPABASE_URL` in your Vercel environment variables points to your production Supabase project (not localhost)
- Production URL format: `https://xxxxx.supabase.co`

**Check 2: Verify Email is Enabled**
- Go to **Authentication** → **Providers** → **Email**
- Make sure **Enable email provider** is checked
- Make sure **Confirm email** is enabled (or disabled if you want instant login)

**Check 3: Check Auth Logs**
- Go to **Authentication** → **Logs**
- Look for email sending errors
- Check if emails are being sent but not delivered

### Still Not Working?

1. **Check Vercel Environment Variables:**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Verify `VITE_SUPABASE_URL` is set to your production Supabase URL
   - Verify `VITE_SUPABASE_ANON_KEY` is set correctly

2. **Check Supabase Auth Settings:**
   - Go to **Authentication** → **Settings**
   - Verify **Site URL** matches your production domain
   - Verify **Redirect URLs** include your production domain

3. **Test with a Different Email:**
   - Try a different email address to rule out email provider issues

## Quick Checklist

- [ ] `VITE_SUPABASE_URL` in Vercel points to production (not localhost)
- [ ] Email provider is enabled in Supabase dashboard
- [ ] Site URL in Supabase is set to production domain
- [ ] Redirect URLs include production domain
- [ ] SMTP is configured (if using custom SMTP)
- [ ] Tested login on production site
- [ ] Checked email inbox (not Mailpit)

## Important Notes

- **Mailpit is ONLY for local development** (`supabase start`)
- **Production Supabase projects** should send emails to real addresses
- If emails are going to Mailpit in production, it means the Supabase project is misconfigured or you're accidentally using a local Supabase instance




