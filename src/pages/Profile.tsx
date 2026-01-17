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
import "../styles/profile.css";

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
      <Container maxWidth="xl" className="profile-loading">
        <p className="meta-text">Loading...</p>
      </Container>
    );
  }

  if (!isAuthed || !session?.user) {
    return (
      <Container maxWidth="md" className="profile-unauth">
        <SectionHeader title="Profile" level={1} />
        <Card>
          <p className="meta-text" style={{ marginBottom: "16px" }}>
            Please sign in to view your profile.
          </p>
          <Button onClick={() => setShowLoginModal(true)} variant="primary" size="md">
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
    );
  }

  const user = session.user;
  const interests = profile?.interests || [];
  const userInitial = user.email?.charAt(0).toUpperCase() || "?";

  return (
    <div className="profile-page">
      <Container maxWidth="xl" className="profile-container">
        {/* Profile Header - Editorial Style */}
        <div className="profile-header">
          <div className="profile-avatar-wrapper">
            <div className="profile-avatar">
              {userInitial}
            </div>
            <div className="profile-status-indicator" />
          </div>
          
          <div className="profile-header-content">
            <div className="profile-badge">PRO MEMBER</div>
            <h1 className="profile-name">{user.email?.split("@")[0] || "User"}</h1>
            <div className="profile-stats">
              <div className="profile-stat">
                <strong>{stats.echoesCount}</strong> Echoes
              </div>
              <div className="profile-stat">
                <strong>{stats.savedCount}</strong> Saved
              </div>
              <div className="profile-stat">
                <strong>{interests.length}</strong> Interests
              </div>
            </div>
          </div>

          <div className="profile-header-actions">
            <Button onClick={handleEditInterests} variant="primary" size="md">
              Edit Profile
            </Button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="profile-tabs">
          <button className="profile-tab active">Overview</button>
          <button className="profile-tab">Collections</button>
          <button className="profile-tab">Liked Media</button>
          <button className="profile-tab">Reviews</button>
          <button className="profile-tab">Settings</button>
        </nav>

        {/* Main Content Grid */}
        <div className="profile-content-grid">
          {/* Left Column - Featured Collections */}
          <div className="profile-main-content">
            <SectionHeader
              title="Featured Collections"
              actions={<a href="#" className="profile-view-all">View All</a>}
              level={2}
            />
            
            <div className="profile-collections-grid">
              {/* Collection cards would go here - placeholder for now */}
              <Card className="profile-collection-card">
                <div className="profile-collection-image">
                  <div className="profile-collection-placeholder">📚</div>
                </div>
                <h3 className="profile-collection-title">My Echoes</h3>
                <p className="profile-collection-meta">{stats.echoesCount} Items • Echoes</p>
              </Card>
              
              <Card className="profile-collection-card">
                <div className="profile-collection-image">
                  <div className="profile-collection-placeholder">💾</div>
                </div>
                <h3 className="profile-collection-title">Saved Items</h3>
                <p className="profile-collection-meta">{stats.savedCount} Items • Saved</p>
              </Card>

              <Card className="profile-collection-card profile-collection-new">
                <div className="profile-collection-image">
                  <div className="profile-collection-placeholder">+</div>
                </div>
                <h3 className="profile-collection-title">New Collection</h3>
                <p className="profile-collection-meta">Create custom list</p>
              </Card>
            </div>
          </div>

          {/* Right Column - Sidebar */}
          <aside className="profile-sidebar">
            {/* Recently Played */}
            <SectionHeader title="Recently Played" level={3} />
            <div className="profile-recent-list">
              {stats.echoesCount > 0 ? (
                <div className="profile-recent-item">
                  <div className="profile-recent-thumbnail">🎵</div>
                  <div className="profile-recent-content">
                    <div className="profile-recent-title">Your Echoes</div>
                    <div className="profile-recent-meta">Echoes • {stats.echoesCount} items</div>
                    <div className="profile-recent-time">Recently</div>
                  </div>
                </div>
              ) : (
                <p className="meta-text">No recent activity</p>
              )}
            </div>

            {/* Saved for Later */}
            <SectionHeader title="Saved for Later" level={3} />
            <Card className="profile-saved-card">
              <div className="profile-saved-icon">📌</div>
              <div className="profile-saved-content">
                <strong>{stats.savedCount} Items Saved</strong>
                <p className="meta-text">Catch up on your saved content</p>
                <Button onClick={() => navigate("/saved")} variant="primary" size="sm" className="profile-saved-button">
                  View Watchlist
                </Button>
              </div>
            </Card>

            {/* Interests */}
            <SectionHeader title="Interests" level={3} />
            {interests.length > 0 ? (
              <div className="profile-interests">
                {interests.map((interest) => (
                  <Tag key={interest} label={interest} variant="subtle" />
                ))}
              </div>
            ) : (
              <p className="meta-text">No interests selected. <button onClick={handleEditInterests} className="profile-link">Add some</button></p>
            )}
          </aside>
        </div>

        {/* Error Section */}
        {error && (
          <Card variant="danger" className="profile-error">
            <strong>Error:</strong> {error}
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
