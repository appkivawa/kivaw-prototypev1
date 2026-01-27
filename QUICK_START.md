# Quick Start - Run Commands Correctly

## ⚠️ IMPORTANT: Don't Include Comments in Commands

**WRONG** (causes errors):
```bash
npm run typecheck  # Should show fewer errors now
```

**CORRECT** (run commands separately):
```bash
npm run typecheck
npm run lint
npm run build
```

## Why This Happens

When you include `# comment` in a command, the shell parses everything after `#` as separate arguments. TypeScript/Vite then tries to read files named `#`, `Should`, `show`, etc., which don't exist.

## Correct Command Sequence

Run these commands **one at a time**, **without comments**:

```bash
# Step 1: Type check
npm run typecheck

# Step 2: Lint
npm run lint

# Step 3: Build
npm run build
```

Or run them all in sequence (still no inline comments):
```bash
npm run typecheck && npm run lint && npm run build
```

## Expected Output

- **typecheck**: Should show TypeScript errors/warnings (non-blocking)
- **lint**: Should show ESLint errors/warnings (non-blocking)
- **build**: Should complete successfully with `✓ built in X.XXs`

---

**Note**: Comments in shell scripts (`.sh` files) work fine. The issue is only when typing commands directly in the terminal with inline comments.
