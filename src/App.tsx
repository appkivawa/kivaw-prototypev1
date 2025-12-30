import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./layout/AppShell";
import Home from "./pages/Home";
import Explore from "./pages/Explore";
import Saved from "./pages/Saved";
import QuizState from "./pages/quiz/QuizState";
import QuizFocus from "./pages/quiz/QuizFocus";
import QuizResult from "./pages/quiz/QuizResult";
import FAQPage from "./pages/FAQ";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Home />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/saved" element={<Saved />} />

        {/* Quiz flow */}
        <Route path="/quiz/state" element={<QuizState />} />
        <Route path="/quiz/focus" element={<QuizFocus />} />
        <Route path="/quiz/result" element={<QuizResult />} />

        {/* Guide (was /faq) */}
        <Route path="/guide" element={<FAQPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}


