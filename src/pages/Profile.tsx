import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../auth/useSession";
import { getMyProfile } from "../data/profileApi";
import { supabase } from "../lib/supabaseClient";
import LoginModal from "../components/auth/LoginModal";
import OnboardingModal from "../components/auth/OnboardingModal";

type ProfileData = {
  id: string;
  email: string | null;
  onboarded: boolean | null;
  interests: string[] | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
};

type Stats = {
  echoesCount: number;
  savedCount: number;
};

export default function Profile() {
  const navigate = useNavigate();
  const { session, loading: sessionLoading, isAuthed } = useSession();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [stats, setStats] = useState<Stats>({ echoesCount: 0, savedCount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);

  useEffect(() => {
    if (sessionLoading) return;

    if (!isAuthed || !session?.user) {
      setLoading(false);
      return;
    }

    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        // Get profile from profiles table
        const profileData = await getMyProfile();

        if (!mounted) return;

        if (profileData) {
          setProfile(profileData);
        } else {
          setError("Profile not found. It may be created on first login.");
        }

        // Get counts
        const userId = session.user.id;

        // Count echoes
        const { count: echoesCount, error: echoesError } = await supabase
          .from("echoes")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId);

        if (echoesError) {
          console.warn("[Profile] Error counting echoes:", echoesError);
        }

        // Count saved items (try saved_items first, then saves_v2 as fallback)
        let savedCount = 0;
        const { count: savedItemsCount, error: savedItemsError } = await supabase
          .from("saved_items")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId);

        if (!savedItemsError && savedItemsCount !== null) {
          savedCount = savedItemsCount;
        } else {
          // Fallback to saves_v2
          const { count: savesV2Count, error: savesV2Error } = await supabase
            .from("saves_v2")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId);

          if (!savesV2Error && savesV2Count !== null) {
            savedCount = savesV2Count;
          }
        }

        if (mounted) {
          setStats({
            echoesCount: echoesCount || 0,
            savedCount: savedCount,
          });
        }
      } catch (err) {
        if (!mounted) return;
        console.error("[Profile] Error loading profile:", err);
        setError(err instanceof Error ? err.message : "Failed to load profile");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [session, isAuthed, sessionLoading]);

  const handleEditInterests = () => {
    setShowOnboardingModal(true);
  };

  const handleOnboardingComplete = () => {
    setShowOnboardingModal(false);
    // Reload profile to show updated interests
    if (isAuthed && session?.user) {
      getMyProfile()
        .then((profileData) => {
          if (profileData) {
            setProfile(profileData);
          }
        })
        .catch((err) => {
          console.error("[Profile] Error reloading profile:", err);
        });
    }
  };

  if (sessionLoading || loading) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center" }}>
        <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
      </div>
    );
  }

  if (!isAuthed || !session?.user) {
    return (
      <div style={{ padding: "40px 20px", maxWidth: "600px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 600, marginBottom: "16px", color: "var(--ink)" }}>
          Profile
        </h1>
        <div
          style={{
            padding: "24px",
            borderRadius: "12px",
            border: "1px solid var(--border)",
            backgroundColor: "var(--surface)",
          }}
        >
          <p style={{ marginBottom: "16px", color: "var(--ink-muted)" }}>
            Please sign in to view your profile.
          </p>
          <button
            onClick={() => setShowLoginModal(true)}
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: "var(--accent)",
              color: "var(--bg)",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: 500,
            }}
          >
            Sign In
          </button>
        </div>
        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          title="Sign in to view profile"
          message="We'll send you a magic link to sign in."
        />
      </div>
    );
  }

  const user = session.user;
  const interests = profile?.interests || [];

  return (
    <div style={{ padding: "40px 20px", maxWidth: "800px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "28px", fontWeight: 600, marginBottom: "24px", color: "var(--ink)" }}>
        Profile
      </h1>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        {/* User Info Section */}
        <div
          style={{
            padding: "24px",
            borderRadius: "12px",
            border: "1px solid var(--border)",
            backgroundColor: "var(--surface)",
          }}
        >
          <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "16px", color: "var(--ink)" }}>
            Account
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <strong style={{ display: "inline-block", width: "80px", color: "var(--ink-muted)" }}>
                Email:
              </strong>
              <span style={{ color: "var(--ink)" }}>{user.email || "(no email)"}</span>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div
          style={{
            padding: "24px",
            borderRadius: "12px",
            border: "1px solid var(--border)",
            backgroundColor: "var(--surface)",
          }}
        >
          <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "16px", color: "var(--ink)" }}>
            Activity
          </h2>
          <div
            style={{
              display: "flex",
              gap: "24px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--ink)" }}>
                {stats.echoesCount}
              </div>
              <div style={{ fontSize: "14px", color: "var(--ink-muted)", marginTop: "4px" }}>
                Echoes
              </div>
            </div>
            <div>
              <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--ink)" }}>
                {stats.savedCount}
              </div>
              <div style={{ fontSize: "14px", color: "var(--ink-muted)", marginTop: "4px" }}>
                Saved
              </div>
            </div>
          </div>
        </div>

        {/* Interests Section */}
        <div
          style={{
            padding: "24px",
            borderRadius: "12px",
            border: "1px solid var(--border)",
            backgroundColor: "var(--surface)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <h2 style={{ fontSize: "18px", fontWeight: 600, color: "var(--ink)" }}>Interests</h2>
            <button
              onClick={handleEditInterests}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid var(--border)",
                backgroundColor: "var(--control-bg)",
                color: "var(--ink)",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: 500,
              }}
            >
              Edit
            </button>
          </div>
          {interests.length > 0 ? (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
              }}
            >
              {interests.map((interest) => (
                <span
                  key={interest}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "16px",
                    backgroundColor: "var(--control-bg)",
                    color: "var(--ink)",
                    fontSize: "13px",
                    fontWeight: 500,
                    border: "1px solid var(--border)",
                  }}
                >
                  {interest}
                </span>
              ))}
            </div>
          ) : (
            <p style={{ color: "var(--ink-muted)", fontSize: "14px" }}>
              No interests selected.{" "}
              <button
                onClick={handleEditInterests}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--accent)",
                  cursor: "pointer",
                  textDecoration: "underline",
                  fontSize: "14px",
                  padding: 0,
                }}
              >
                Add some
              </button>
            </p>
          )}
        </div>

        {/* Error Section */}
        {error && (
          <div
            style={{
              padding: "24px",
              borderRadius: "12px",
              border: "1px solid var(--border-strong)",
              backgroundColor: "var(--surface)",
            }}
          >
            <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "12px", color: "var(--ink)" }}>
              Error
            </h2>
            <p style={{ color: "var(--ink-muted)" }}>{error}</p>
          </div>
        )}
      </div>

      {/* Modals */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        title="Sign in to view profile"
        message="We'll send you a magic link to sign in."
      />
      <OnboardingModal
        isOpen={showOnboardingModal}
        onClose={() => setShowOnboardingModal(false)}
        onComplete={handleOnboardingComplete}
        initialInterests={interests}
      />
    </div>
  );
}
