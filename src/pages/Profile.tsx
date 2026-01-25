import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../auth/useSession";
import { getMyProfile } from "../data/profileApi";
import { supabase } from "../lib/supabaseClient";
import LoginModal from "../components/auth/LoginModal";
import OnboardingModal from "../components/auth/OnboardingModal";
import Container from "../ui/Container";
import Card from "../ui/Card";
import Button from "../ui/Button";
import SectionHeader from "../ui/SectionHeader";
import Tag from "../ui/Tag";
import EmptyState from "../ui/EmptyState";
import "../styles/studio.css";

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
      <div className="studio-page" data-theme="light">
        <Container maxWidth="xl" style={{ paddingTop: "96px", paddingBottom: "40px", paddingLeft: "20px", paddingRight: "20px", textAlign: "center" }}>
          <p style={{ color: "var(--studio-text-muted)" }}>Loading...</p>
        </Container>
      </div>
    );
  }

  if (!isAuthed || !session?.user) {
    return (
      <div className="studio-page" data-theme="light">
        <Container maxWidth="md" style={{ paddingTop: "96px", paddingBottom: "40px", paddingLeft: "20px", paddingRight: "20px" }}>
          <h1 style={{ fontSize: "32px", fontWeight: 700, color: "var(--studio-text)", marginBottom: "24px" }}>Profile</h1>
          <Card style={{ padding: "40px 24px", textAlign: "center", borderRadius: "12px", border: "1px solid var(--studio-border)", backgroundColor: "var(--studio-white)" }}>
            <p style={{ color: "var(--studio-text-secondary)", marginBottom: "24px", fontSize: "15px" }}>
              Please sign in to view your profile.
            </p>
            <Button 
              onClick={() => setShowLoginModal(true)} 
              variant="primary" 
              size="md"
              style={{
                backgroundColor: "var(--studio-coral)",
                color: "white",
                border: "none",
                padding: "12px 24px",
                borderRadius: "8px",
                fontSize: "15px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Sign In
            </Button>
          </Card>
          <LoginModal
            isOpen={showLoginModal}
            onClose={() => setShowLoginModal(false)}
            title="Sign in to view profile"
            message="We'll send you a magic link to sign in."
          />
        </Container>
      </div>
    );
  }

  const user = session.user;
  const interests = profile?.interests || [];
  const userInitial = user.email?.charAt(0).toUpperCase() || "?";

  return (
    <div className="studio-page" data-theme="light">
      <Container maxWidth="xl" style={{ paddingTop: "96px", paddingBottom: "48px" }}>
        {/* Profile Header - Editorial Style */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "24px", marginBottom: "40px", paddingBottom: "32px", borderBottom: "1px solid var(--studio-border)" }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{
              width: "120px",
              height: "120px",
              borderRadius: "50%",
              background: "var(--studio-gray-100)",
              border: "2px solid var(--studio-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "48px",
              fontWeight: 600,
              color: "var(--studio-text)",
            }}>
              {userInitial}
            </div>
            <div style={{
              position: "absolute",
              bottom: "4px",
              right: "4px",
              width: "24px",
              height: "24px",
              borderRadius: "50%",
              background: "var(--studio-coral)",
              border: "3px solid var(--studio-white)",
            }} />
          </div>
          
          <div style={{ flex: 1 }}>
            <div style={{
              display: "inline-block",
              padding: "4px 12px",
              borderRadius: "4px",
              background: "var(--studio-coral-light)",
              color: "var(--studio-coral)",
              fontSize: "11px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "12px",
            }}>
              PRO MEMBER
            </div>
            <h1 style={{ fontSize: "32px", fontWeight: 700, color: "var(--studio-text)", margin: "0 0 16px 0" }}>
              {user.email?.split("@")[0] || "User"}
            </h1>
            <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
              <div style={{ fontSize: "14px", color: "var(--studio-text-secondary)" }}>
                <strong style={{ color: "var(--studio-text)", display: "block", fontSize: "18px", marginBottom: "4px" }}>{stats.echoesCount}</strong> Echoes
              </div>
              <div style={{ fontSize: "14px", color: "var(--studio-text-secondary)" }}>
                <strong style={{ color: "var(--studio-text)", display: "block", fontSize: "18px", marginBottom: "4px" }}>{stats.savedCount}</strong> Saved
              </div>
              <div style={{ fontSize: "14px", color: "var(--studio-text-secondary)" }}>
                <strong style={{ color: "var(--studio-text)", display: "block", fontSize: "18px", marginBottom: "4px" }}>{interests.length}</strong> Interests
              </div>
            </div>
          </div>

          <div>
            <Button 
              onClick={handleEditInterests} 
              variant="primary" 
              size="md"
              style={{
                backgroundColor: "var(--studio-coral)",
                color: "white",
                border: "none",
                padding: "12px 24px",
                borderRadius: "8px",
                fontSize: "15px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Edit Profile
            </Button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="studio-nav__links" style={{ marginBottom: "40px" }}>
          <button className="studio-nav__link studio-nav__link--active">
            Overview
          </button>
          <button className="studio-nav__link">
            Collections
          </button>
          <button className="studio-nav__link">
            Liked Media
          </button>
          <button className="studio-nav__link">
            Reviews
          </button>
          <button className="studio-nav__link">
            Settings
          </button>
        </nav>

        {/* Main Content Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "48px", alignItems: "start" }}>
          {/* Left Column - Featured Collections */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "24px" }}>
              <h2 style={{ fontSize: "24px", fontWeight: 700, color: "var(--studio-text)", margin: 0 }}>Featured Collections</h2>
              <a href="#" style={{ fontSize: "14px", color: "var(--studio-coral)", textDecoration: "none", fontWeight: 500 }}>View All</a>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "20px" }}>
              {/* Collection cards */}
              <Card style={{ padding: 0, borderRadius: "12px", border: "1px solid var(--studio-border)", backgroundColor: "var(--studio-white)", overflow: "hidden", cursor: "pointer", transition: "transform 0.2s ease, box-shadow 0.2s ease" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div style={{ width: "100%", height: "120px", background: "var(--studio-gray-100)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "48px" }}>
                  📚
                </div>
                <div style={{ padding: "16px" }}>
                  <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--studio-text)", margin: "0 0 8px 0" }}>My Echoes</h3>
                  <p style={{ fontSize: "13px", color: "var(--studio-text-muted)", margin: 0 }}>{stats.echoesCount} Items • Echoes</p>
                </div>
              </Card>
              
              <Card style={{ padding: 0, borderRadius: "12px", border: "1px solid var(--studio-border)", backgroundColor: "var(--studio-white)", overflow: "hidden", cursor: "pointer", transition: "transform 0.2s ease, box-shadow 0.2s ease" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div style={{ width: "100%", height: "120px", background: "var(--studio-gray-100)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "48px" }}>
                  💾
                </div>
                <div style={{ padding: "16px" }}>
                  <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--studio-text)", margin: "0 0 8px 0" }}>Saved Items</h3>
                  <p style={{ fontSize: "13px", color: "var(--studio-text-muted)", margin: 0 }}>{stats.savedCount} Items • Saved</p>
                </div>
              </Card>

              <Card style={{ padding: 0, borderRadius: "12px", border: "2px dashed var(--studio-border)", backgroundColor: "var(--studio-gray-50)", overflow: "hidden", cursor: "pointer", transition: "transform 0.2s ease, border-color 0.2s ease" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.borderColor = "var(--studio-coral)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.borderColor = "var(--studio-border)";
                }}
              >
                <div style={{ width: "100%", height: "120px", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "48px", color: "var(--studio-text-muted)" }}>
                  +
                </div>
                <div style={{ padding: "16px" }}>
                  <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--studio-text)", margin: "0 0 8px 0" }}>New Collection</h3>
                  <p style={{ fontSize: "13px", color: "var(--studio-text-muted)", margin: 0 }}>Create custom list</p>
                </div>
              </Card>
            </div>
          </div>

          {/* Right Column - Sidebar */}
          <aside>
            {/* Recently Played */}
            <div style={{ marginBottom: "32px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: 600, color: "var(--studio-text)", marginBottom: "16px" }}>Recently Played</h3>
              <div>
                {stats.echoesCount > 0 ? (
                  <div style={{ display: "flex", gap: "12px", padding: "12px", borderRadius: "8px", backgroundColor: "var(--studio-gray-50)" }}>
                    <div style={{ fontSize: "32px", flexShrink: 0 }}>🎵</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--studio-text)", marginBottom: "4px" }}>Your Echoes</div>
                      <div style={{ fontSize: "12px", color: "var(--studio-text-muted)", marginBottom: "4px" }}>Echoes • {stats.echoesCount} items</div>
                      <div style={{ fontSize: "12px", color: "var(--studio-text-muted)" }}>Recently</div>
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: "14px", color: "var(--studio-text-muted)" }}>No recent activity</p>
                )}
              </div>
            </div>

            {/* Saved for Later */}
            <div style={{ marginBottom: "32px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: 600, color: "var(--studio-text)", marginBottom: "16px" }}>Saved for Later</h3>
              <Card style={{ padding: "20px", borderRadius: "12px", border: "1px solid var(--studio-border)", backgroundColor: "var(--studio-white)" }}>
                <div style={{ display: "flex", gap: "16px" }}>
                  <div style={{ fontSize: "32px", flexShrink: 0 }}>📌</div>
                  <div style={{ flex: 1 }}>
                    <strong style={{ display: "block", fontSize: "16px", fontWeight: 600, color: "var(--studio-text)", marginBottom: "8px" }}>{stats.savedCount} Items Saved</strong>
                    <p style={{ fontSize: "14px", color: "var(--studio-text-secondary)", marginBottom: "16px" }}>Catch up on your saved content</p>
                    <Button 
                      onClick={() => navigate("/saved")} 
                      variant="primary" 
                      size="sm"
                      style={{
                        backgroundColor: "var(--studio-coral)",
                        color: "white",
                        border: "none",
                        padding: "8px 16px",
                        borderRadius: "6px",
                        fontSize: "14px",
                        fontWeight: 500,
                        cursor: "pointer",
                      }}
                    >
                      View Watchlist
                    </Button>
                  </div>
                </div>
              </Card>
            </div>

            {/* Interests */}
            <div>
              <h3 style={{ fontSize: "18px", fontWeight: 600, color: "var(--studio-text)", marginBottom: "16px" }}>Interests</h3>
              {interests.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {interests.map((interest) => (
                    <Tag key={interest} label={interest} variant="subtle" />
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: "14px", color: "var(--studio-text-muted)" }}>
                  No interests selected.{" "}
                  <button 
                    onClick={handleEditInterests} 
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--studio-coral)",
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
          </aside>
        </div>

        {/* Error Section */}
        {error && (
          <Card style={{
            padding: "24px",
            marginTop: "32px",
            background: "#FEE2E2",
            border: "1px solid #DC2626",
            borderRadius: "8px",
          }}>
            <strong style={{ color: "#DC2626", display: "block", marginBottom: "8px" }}>Error:</strong>
            <div style={{ color: "#991B1B", fontSize: "14px" }}>{error}</div>
          </Card>
        )}
      </Container>

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
