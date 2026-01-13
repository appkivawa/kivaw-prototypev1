import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import TopNav from "../ui/TopNav";
import PostAuthRedirect from "../auth/PostAuthRedirect";
import { ToastContainer } from "../components/ui/Toast";
import { useSession } from "../auth/useSession";
import { needsOnboarding } from "../data/profileApi";
import OnboardingModal from "../components/auth/OnboardingModal";
import { usePendingActions } from "../hooks/usePendingActions";

export default function AppShell() {
  const location = useLocation();
  const { isAuthed, loading } = useSession();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(false);

  // Process pending actions after login
  usePendingActions();

  // Check onboarding status after login
  useEffect(() => {
    if (!loading && isAuthed && !checkingOnboarding) {
      setCheckingOnboarding(true);
      needsOnboarding()
        .then((needs) => {
          if (needs) {
            setShowOnboarding(true);
          }
        })
        .catch((e) => {
          console.error("Error checking onboarding:", e);
        })
        .finally(() => {
          setCheckingOnboarding(false);
        });
    }
  }, [isAuthed, loading, checkingOnboarding]);

  function handleOnboardingComplete() {
    setShowOnboarding(false);
  }

  // Coral theme is now applied globally via .coral-app class

  return (
    <div className="app coral-app">
      <PostAuthRedirect />
      <TopNav />
      <main className="main">
        <Outlet />
      </main>
      <ToastContainer />
      <OnboardingModal isOpen={showOnboarding} onComplete={handleOnboardingComplete} />
    </div>
  );
}





