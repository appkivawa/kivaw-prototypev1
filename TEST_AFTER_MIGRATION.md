# Test After Migration

## Step 1: Hard Refresh Browser
- Press `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows/Linux)
- This clears cached queries

## Step 2: Go to Debug Page
- Navigate to `/admin-debug`
- Check the following:

### ✅ Expected Results:
1. **Direct Query Test** - Should show `data` with your roles (no recursion error)
2. **useRoles Hook Results** - Should show roles from database (not "dev-failsafe-immediate")
3. **RPC is_admin() Test** - Should still return `true`
4. **admin_allowlist Test** - Should still show your user_id

### ❌ If Still Broken:
- Check if "Direct Query Test" still shows recursion error
- Check if roles are loading from database
- Share the debug page output

## Step 3: Test Admin Access
- Go to `/admin`
- Should work without any bypass warnings
- Check browser console - should see roles loading from database

## Step 4: Once Confirmed Working
- We'll remove the temporary bypasses from code
- Clean up hardcoded emails
- Remove emergency bypass in RequireAdmin

