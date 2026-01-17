import { useEffect, useState, useRef } from "react";
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
  const [profileFetchAttempts, setProfileFetchAttempts] = useState(0);
  const onboardingCompletedRef = useRef(false); // Session-level guard

  // Process pending actions after login
  usePendingActions();

  // Fetch and cache profile once on session load with retry logic
  useEffect(() => {
    if (!loading && isAuthed && !profileLoaded) {
      setProfileLoaded(true);
      
      // Retry profile fetch up to 3 times with exponential backoff
      let attemptCount = 0;
      const maxAttempts = 3;
      
      const fetchProfileWithRetry = async (): Promise<void> => {
        attemptCount++;
        setProfileFetchAttempts(attemptCount);
        
        try {
          const p = await getMyProfile();
          
          // Only set onboarding if we successfully fetched a profile
          if (p) {
            setProfile(p);
            // Only show onboarding if session guard allows AND profile needs it
            if (!onboardingCompletedRef.current) {
              const needsOnboarding = p.onboarded !== true || !p.interests || p.interests.length === 0;
              if (needsOnboarding) {
                setShowOnboarding(true);
              }
            }
          } else {
            // No profile = needs onboarding (only if guard allows)
            if (!onboardingCompletedRef.current) {
              setShowOnboarding(true);
            }
          }
        } catch (e) {
          console.error(`Error fetching profile (attempt ${attemptCount}/${maxAttempts}):`, e);
          
          // Retry with exponential backoff
          if (attemptCount < maxAttempts) {
            const delayMs = Math.min(1000 * Math.pow(2, attemptCount - 1), 5000); // 1s, 2s, 4s max
            setTimeout(() => {
              fetchProfileWithRetry();
            }, delayMs);
          } else {
            // Max attempts reached - don't show onboarding on error
            console.error("Max profile fetch attempts reached. Not showing onboarding to prevent loop.");
            setProfile(null);
          }
        }
      };
      
      fetchProfileWithRetry();
    } else if (!isAuthed) {
      // Reset when logged out
      setProfile(null);
      setProfileLoaded(false);
      setShowOnboarding(false);
      setProfileFetchAttempts(0);
      onboardingCompletedRef.current = false; // Reset guard on logout
    }
  }, [isAuthed, loading, profileLoaded]);

  function handleOnboardingComplete(savedInterests: string[]) {
    // Set session guard to prevent modal from reopening until page refresh
    onboardingCompletedRef.current = true;
    
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

          return (
            <div className="app">
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





