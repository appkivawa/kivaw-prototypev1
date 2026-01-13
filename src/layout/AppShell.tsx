import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import TopNav from "../ui/TopNav";
import PostAuthRedirect from "../auth/PostAuthRedirect";
import { ToastContainer } from "../components/ui/Toast";
import { useSession } from "../auth/useSession";
import { getMyProfile, type Profile } from "../data/profileApi";
import OnboardingModal from "../components/auth/OnboardingModal";
import { usePendingActions } from "../hooks/usePendingActions";

export default function AppShell() {
  const location = useLocation();
  const { isAuthed, loading } = useSession();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Process pending actions after login
  usePendingActions();

  // Fetch and cache profile once on session load
  useEffect(() => {
    if (!loading && isAuthed && !profileLoaded) {
      setProfileLoaded(true);
      getMyProfile()
        .then((p) => {
          setProfile(p);
          // Check if onboarding is needed: onboarded is false OR interests is empty
          if (p) {
            const needsOnboarding = p.onboarded !== true || !p.interests || p.interests.length === 0;
            if (needsOnboarding) {
              setShowOnboarding(true);
            }
          } else {
            // No profile = needs onboarding
            setShowOnboarding(true);
          }
        })
        .catch((e) => {
          console.error("Error fetching profile:", e);
          // On error, assume needs onboarding
          setShowOnboarding(true);
        });
    } else if (!isAuthed) {
      // Reset when logged out
      setProfile(null);
      setProfileLoaded(false);
      setShowOnboarding(false);
    }
  }, [isAuthed, loading, profileLoaded]);

  function handleOnboardingComplete(savedInterests?: string[]) {
    // Update local profile state immediately to prevent reopening
    setProfile((prev) => {
      if (prev) {
        return {
          ...prev,
          onboarded: true,
          interests: savedInterests || prev.interests || [],
        };
      }
      // If no profile exists, create a minimal one in state
      return {
        id: "", // Will be set on next fetch
        email: null,
        onboarded: true,
        interests: savedInterests || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });
    setShowOnboarding(false);
    
    // Refetch profile in background to ensure consistency
    getMyProfile()
      .then((p) => {
        if (p) setProfile(p);
      })
      .catch((e) => {
        console.error("Error refetching profile after onboarding:", e);
      });
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
      <OnboardingModal
        isOpen={showOnboarding}
        onComplete={handleOnboardingComplete}
        initialInterests={profile?.interests || []}
      />
    </div>
  );
}





