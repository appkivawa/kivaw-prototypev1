import { Navigate, Route, Routes } from "react-router-dom";
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

export default function App() {
  return (
    <Routes>
      {/* --------- PUBLIC / STANDALONE ROUTES (NO LAYOUT) --------- */}
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />

      {/* --------- APP WITH SHELL --------- */}
      <Route path="/" element={<AppShell />}>
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



