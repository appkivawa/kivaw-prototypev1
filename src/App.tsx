import { Routes, Route } from "react-router-dom";
import QuizResult from "./pages/quiz/QuizResult";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<QuizResult />} />
    </Routes>
  );
}
