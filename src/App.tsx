import { useEffect } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import AppShell from "./layout/AppShell";

import Home from "./pages/Home";
import HomePage from "./pages/HomePage";
import ExploreFeed from "./pages/ExploreFeed";
import ForYou from "./pages/ForYou";
import MatchPage from "./pages/MatchPage";
import ItemDetail from "./pages/ItemDetail";

import QuizState from "./pages/quiz/QuizState";
import QuizFocus from "./pages/quiz/QuizFocus";
import QuizResult from "./pages/quiz/QuizResult";

import Login from "./pages/Login";
import AuthCallback from "./auth/AuthCallback";
import FAQPage from "./pages/FAQ";
import AdminDebug from "./pages/AdminDebug";
import Creator from "./pages/Creator";
import Creators from "./pages/Creators";
import Team from "./pages/Team";
import CreatorsApply from "./pages/CreatorsApply";
import CreatorsDashboard from "./pages/CreatorsDashboard";

import RequireAdmin from "./admin/RequireAdmin";
import RequirePermission from "./admin/RequirePermission";
import RequireCreator from "./auth/RequireCreator";
import RequireAuth from "./auth/RequireAuth";

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
import CreatorRequests from "./admin/tabs/CreatorRequests";
import Integrations from "./admin/tabs/Integrations";
import RecommendationsPreview from "./admin/tabs/RecommendationsPreview";
import PublishToExplore from "./admin/tabs/PublishToExplore";

import RecommendationsPage from "./pages/RecommendationsPage";
import Preferences from "./pages/preferences";
import Timeline from "./pages/Timeline";
import Waves from "./pages/Waves";
import Saved from "./pages/Saved";

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
      {/* --------- PUBLIC / STANDALONE ROUTES (NO SHELL) --------- */}
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />

      {/* Optional convenience route: logged-in landing */}
      <Route path="/app" element={<Navigate to="/feed" replace />} />

      {/* Creator pages */}
      <Route
        path="/creator"
        element={
          <RequireAuth title="Creator Portal" message="Please log in to continue">
            <Creator />
          </RequireAuth>
        }
      />
      <Route path="/creators" element={<Creators />} />
      <Route path="/creators/apply" element={<CreatorsApply />} />
      <Route
        path="/creators/dashboard"
        element={
          <RequireCreator>
            <CreatorsDashboard />
          </RequireCreator>
        }
      />

      {/* Team */}
      <Route
        path="/team"
        element={
          <RequireAuth title="Team Portal" message="Please log in to continue">
            <Team />
          </RequireAuth>
        }
      />

      {/* TEMP: admin debug */}
      {import.meta.env.DEV && <Route path="/admin-debug" element={<AdminDebug />} />}

      {/* ✅ Admin (FIX: removed RequireEmployee gate) */}
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
        <Route
          path="creator-requests"
          element={
            <RequirePermission tabName="creator_requests">
              <CreatorRequests />
            </RequirePermission>
          }
        />
        <Route
          path="integrations"
          element={
            <RequirePermission tabName="integrations">
              <Integrations />
            </RequirePermission>
          }
        />
        <Route
          path="recommendations-preview"
          element={
            <RequirePermission tabName="recommendations_preview">
              <RecommendationsPreview />
            </RequirePermission>
          }
        />
        <Route
          path="publish-to-explore"
          element={
            <RequirePermission tabName="publish_to_explore">
              <PublishToExplore />
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
        <Route index element={<HomePage />} />
        <Route path="home" element={<Home />} />
        <Route path="explore" element={<ExploreFeed />} />
        <Route path="feed" element={<ExploreFeed />} />

        {/* Preferences (requires auth) */}
        <Route
          path="preferences"
          element={
            <RequireAuth title="Preferences" message="Please log in to edit preferences">
              <Preferences />
            </RequireAuth>
          }
        />

        {/* Saved (requires auth) */}
        <Route
          path="saved"
          element={
            <RequireAuth title="Saved" message="Please log in to view saved items">
              <Saved />
            </RequireAuth>
          }
        />

        <Route path="for-you" element={<ForYou />} />
        <Route path="recs" element={<RecommendationsPage />} />

        <Route path="waves" element={<Waves />} />
        <Route path="timeline" element={<Timeline />} />
        <Route path="echo" element={<Navigate to="/timeline" replace />} />
        <Route path="save-echo" element={<Navigate to="/timeline" replace />} />
        <Route path="match" element={<MatchPage />} />
        <Route path="events" element={<Navigate to="/explore" replace />} />
        <Route path="item/:id" element={<ItemDetail />} />

        <Route path="quiz/state" element={<QuizState />} />
        <Route path="quiz/focus" element={<QuizFocus />} />
        <Route path="quiz/result" element={<QuizResult />} />

        <Route path="guide" element={<FAQPage />} />

        {/* shell catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>

      {/* global catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}










