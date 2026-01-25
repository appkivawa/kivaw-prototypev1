# Theme Toggle Implementation Documentation

## Current Theme Toggle System (BEFORE Coral Changes)

### How It Works:
1. **Theme Context Provider** (`src/theme/ThemeContext.tsx`):
   - Manages theme state ("light" | "dark")
   - Stores preference in localStorage with key "kivaw_theme"
   - Defaults to "light" if no saved preference
   - Sets `data-theme` attribute on `<html>` element (document.documentElement)

2. **Implementation Details**:
   - **File**: `src/theme/ThemeContext.tsx`
   - **Line 21**: `document.documentElement.setAttribute("data-theme", theme);`
   - **Method**: Uses `data-theme` attribute on the root HTML element
   - **NOT using**: Tailwind dark mode, CSS classes on wrapper, or body classes

3. **CSS Theme Switching** (`src/styles/theme.css`):
   - **Line 111**: `:root[data-theme="dark"] { ... }`
   - Dark mode styles are applied when `<html data-theme="dark">` exists
   - Light mode is the default `:root` styles

4. **Toggle Button** (`src/ui/TopNav.tsx`):
   - **Line 9**: `const { theme, toggle } = useTheme();`
   - **Line 130**: Moon/sun icon button calls `toggle()` function
   - Button text changes based on current theme

### Theme Toggle Flow:
1. User clicks moon/sun button in TopNav
2. `toggle()` function in ThemeContext switches theme state
3. `useEffect` in ThemeContext sets `data-theme` attribute on `<html>`
4. CSS selector `:root[data-theme="dark"]` activates dark mode styles
5. Preference saved to localStorage for persistence









