# Manual Route Test Script

## Instructions

Test these 12 routes in order. For each route, verify:
1. ✅ Page loads (no white screen)
2. ✅ Loading state appears while fetching
3. ✅ Error state appears on failure (with retry button)
4. ✅ Empty state appears when no data
5. ✅ Content appears when data is available

---

## Test Routes

### 1. `/studio` (Home)
**Expected**: Homepage loads, shows navigation and content
**Test**: 
- Navigate to `/studio`
- Should see homepage without errors

---

### 2. `/studio/explore` (Explore)
**Expected**: Explore page loads, shows content or empty state
**Test**:
- Navigate to `/studio/explore`
- Should see loading spinner briefly
- Should see explore items OR empty state
- If error, should see error state with "Try Again" button

---

### 3. `/studio/feed` (Feed - requires auth)
**Expected**: Feed page loads if logged in, redirects if not
**Test**:
- If not logged in: Should redirect to login
- If logged in: Should show feed items OR empty state
- If error, should see error state with "Try Again" button

---

### 4. `/timeline` (Timeline)
**Expected**: Timeline page loads with feed tab active
**Test**:
- Navigate to `/timeline`
- Should see "My Feed" tab active
- Should see sidebar with channels
- Should see feed content OR empty state

---

### 5. `/timeline/explore` (Timeline Explore)
**Expected**: Timeline page with explore tab active
**Test**:
- Navigate to `/timeline/explore`
- Should see "Explore" tab active
- Should see explore content OR empty state
- Should see sidebar and widgets

---

### 6. `/timeline/feed` (Timeline Feed)
**Expected**: Timeline page with feed tab active
**Test**:
- Navigate to `/timeline/feed`
- Should see "My Feed" tab active
- Should see feed content OR empty state
- Should see sidebar and widgets

---

### 7. `/collection` (Collection - requires auth)
**Expected**: Collection page loads if logged in
**Test**:
- If not logged in: Should redirect to login
- If logged in: Should show echoes and saved items
- Should show empty states if no data
- Should show error states on failure

---

### 8. `/admin` (Admin - requires admin)
**Expected**: Admin overview loads if admin, redirects if not
**Test**:
- If not admin: Should redirect to home
- If admin: Should show Overview tab
- Should load stats without errors
- Should show error state if query fails

---

### 9. `/admin/users` (Admin Users)
**Expected**: Users tab loads with user list
**Test**:
- Navigate to `/admin/users`
- Should show user list OR empty state
- Should show error state if permission denied
- Should show error state if query fails

---

### 10. `/admin/content` (Admin Content)
**Expected**: Content tab loads with content items
**Test**:
- Navigate to `/admin/content`
- Should show content items OR empty state
- Should show error state if query fails
- Should show loading state while fetching

---

### 11. `/item/:id` (Item Detail)
**Expected**: Item detail page loads
**Test**:
- Navigate to `/item/[some-id]`
- Should show loading state while fetching
- Should show item details OR error state
- Should show error state if item not found

---

### 12. `/recs` (Recommendations)
**Expected**: Recommendations page loads
**Test**:
- Navigate to `/recs`
- Should show recommendations OR empty state
- Should show error state if RPC fails
- Should show loading state while fetching

---

## Error Scenarios to Test

### Network Failure
1. Disable network (DevTools → Network → Offline)
2. Navigate to any data-fetching page
3. **Expected**: Error state appears with "Try Again" button

### Invalid Route
1. Navigate to `/invalid-route`
2. **Expected**: Redirects to `/studio` (catch-all)

### Missing Data
1. Navigate to page that requires data
2. If no data exists, **Expected**: Empty state appears

### Permission Denied
1. Navigate to `/admin` as non-admin user
2. **Expected**: Redirects to home (not white screen)

---

## Success Criteria

✅ **No white screens** - Every route shows something
✅ **Consistent loading states** - All pages show spinner while fetching
✅ **Consistent error states** - All errors show retry button
✅ **Consistent empty states** - All empty data shows friendly message
✅ **No silent failures** - All errors are visible to user

---

**Last Updated**: 2025-01-27
