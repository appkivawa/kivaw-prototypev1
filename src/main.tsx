import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";

// global styles
import "./index.css"; /* Design token system */
import "./styles/theme.css"; /* Legacy theme (kept for backward compatibility) */
import "./styles/coral.css";
import "./ui/ui.css";
import "./ui/polish.css";

// ✅ correct path based on your folder: src/theme/ThemeContext.tsx
import { ThemeProvider } from "./theme/ThemeContext";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);









