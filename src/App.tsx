import { useEffect } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import AppShell from "./layout/AppShell";

import Home from "./pages/Home";
import Explore from "./pages/Explore";
import Saved from "./pages/Saved";
import Echo from "./pages/Echo";
import Waves from "./pages/Waves";
import Events from "./pages/Events";
import ItemDetail from "./pages/ItemDetail";

import QuizState from "./pages/quiz/QuizState";
import QuizFocus from "./pages/quiz/QuizFocus";
import QuizResult from "./pages/quiz/QuizResult";

import Login from "./pages/Login";
import AuthCallback from "./auth/AuthCallback";
import FAQPage from "./pages/FAQ";
import AdminDebug from "./pages/AdminDebug";
import RequireAdmin from "./admin/RequireAdmin";
import RequirePermission from "./admin/RequirePermission";
import AdminLayout from "./admin/AdminLayout";
import Overview from "./admin/tabs/Overview";
import Users from "./admin/tabs/Users";
import Content from "./admin/tabs/Content";
import Analytics from "./admin/tabs/Analytics";
import Operations from "./admin/tabs/Operations";
import Settings from "./admin/tabs/Settings";
import Support from "./admin/tabs/Support";
import Health from "./admin/tabs/Health";
import Security from "./admin/tabs/Security";
import Finance from "./admin/tabs/Finance";
import Experiments from "./admin/tabs/Experiments";

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
      {/* TEMPORARY: Admin debug page - remove after fixing admin access */}
      {import.meta.env.DEV && (
        <Route path="/admin-debug" element={<AdminDebug />} />
      )}

      {/* Admin routes with nested tabs */}
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route
          index
          element={
            <RequirePermission tabName="overview">
              <Overview />
            </RequirePermission>
          }
        />
        <Route
          path="users"
          element={
            <RequirePermission tabName="users">
              <Users />
            </RequirePermission>
          }
        />
        <Route
          path="content"
          element={
            <RequirePermission tabName="content">
              <Content />
            </RequirePermission>
          }
        />
        <Route
          path="analytics"
          element={
            <RequirePermission tabName="analytics">
              <Analytics />
            </RequirePermission>
          }
        />
        <Route
          path="operations"
          element={
            <RequirePermission tabName="operations">
              <Operations />
            </RequirePermission>
          }
        />
        <Route
          path="settings"
          element={
            <RequirePermission tabName="settings">
              <Settings />
            </RequirePermission>
          }
        />
        <Route
          path="support"
          element={
            <RequirePermission tabName="support">
              <Support />
            </RequirePermission>
          }
        />
        <Route
          path="health"
          element={
            <RequirePermission tabName="health">
              <Health />
            </RequirePermission>
          }
        />
        <Route
          path="security"
          element={
            <RequirePermission tabName="security">
              <Security />
            </RequirePermission>
          }
        />
        <Route
          path="finance"
          element={
            <RequirePermission tabName="finance">
              <Finance />
            </RequirePermission>
          }
        />
        <Route
          path="experiments"
          element={
            <RequirePermission tabName="experiments">
              <Experiments />
            </RequirePermission>
          }
        />
      </Route>

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
        <Route index element={<Home />} />
        <Route path="explore" element={<Explore />} />
        <Route path="waves" element={<Waves />} />
        <Route path="echo" element={<Echo />} />
        <Route path="saved" element={<Saved />} />
        <Route path="events" element={<Events />} />
        <Route path="item/:id" element={<ItemDetail />} />

        <Route path="quiz/state" element={<QuizState />} />
        <Route path="quiz/focus" element={<QuizFocus />} />
        <Route path="quiz/result" element={<QuizResult />} />

        <Route path="guide" element={<FAQPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}






