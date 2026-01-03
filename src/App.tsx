import { useEffect } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import AppShell from "./layout/AppShell";

import Home from "./pages/Home";
import Explore from "./pages/Explore";
import Saved from "./pages/Saved";
import Echo from "./pages/Echo";
import Waves from "./pages/Waves";
import ItemDetail from "./pages/ItemDetail";

import QuizState from "./pages/quiz/QuizState";
import QuizFocus from "./pages/quiz/QuizFocus";
import QuizResult from "./pages/quiz/QuizResult";

import Login from "./pages/Login";
import AuthCallback from "./auth/AuthCallback";
import FAQPage from "./pages/FAQ";

/**
 * ✅ Supabase magic links sometimes return tokens in the URL hash:
 *   /#access_token=...
 * With BrowserRouter, that loads "/" (Home) unless we forward it.
 * This forwards hash-auth to /auth/callback so AuthCallback can finish sign-in,
 * then it returns the user to the saved "kivaw_post_auth_path".
 */
function HashAuthRedirect() {
  const nav = useNavigate();

  useEffect(() => {
    const h = window.location.hash || "";
    if (h.includes("access_token=") || h.includes("refresh_token=") || h.includes("type=recovery")) {
      nav("/auth/callback" + h, { replace: true });
    }
  }, [nav]);

  return null;
}

export default function App() {
  return (
    <Routes>
      {/* --------- PUBLIC / STANDALONE ROUTES (NO LAYOUT) --------- */}
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />

      {/* --------- APP WITH SHELL --------- */}
      <Route
        path="/"
        element={
          <>
            <HashAuthRedirect />
            <AppShell />
          </>
        }
      >
        {/* Home */}
        <Route index element={<Home />} />

        {/* Main */}
        <Route path="explore" element={<Explore />} />
        <Route path="waves" element={<Waves />} />
        <Route path="echo" element={<Echo />} />
        <Route path="saved" element={<Saved />} />

        {/* Item detail */}
        <Route path="item/:id" element={<ItemDetail />} />

        {/* Quiz flow */}
        <Route path="quiz/state" element={<QuizState />} />
        <Route path="quiz/focus" element={<QuizFocus />} />
        <Route path="quiz/result" element={<QuizResult />} />

        {/* Guide */}
        <Route path="guide" element={<FAQPage />} />

        {/* Catch-all INSIDE layout */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>

      {/* Final safety net */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}




