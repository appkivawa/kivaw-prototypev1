import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../auth/useSession";
import { useRoles } from "../auth/useRoles";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Tag from "../ui/Tag";
import Container from "../ui/Container";
import "../styles/homepage.css";

export default function HomePage() {
  const navigate = useNavigate();
  const { isAuthed, loading: sessionLoading } = useSession();
  const { isAdmin, isSuperAdmin, loading: rolesLoading } = useRoles();
  const loading = sessionLoading || rolesLoading;

  function handleGetStarted() {
    navigate("/feed");
  }

  function handleSeeSample() {
    navigate("/feed");
  }

  if (loading) {
    return (
      <div className="homepage-page">
        <Container>
          <div className="homepage-loading">
            <p className="homepage-loading-text">Loading…</p>
          </div>
        </Container>
      </div>
    );
  }

  const categories = ["News", "Social", "Podcasts", "Music", "Video"];

  return (
    <div className="homepage-page">
      <Container maxWidth="xl">
        <div className="homepage-grid">
          {/* Left Column - Main Content */}
          <div className="homepage-main">
            <p className="homepage-label">
              STUDIO MEDIA FEED
            </p>

            <h1 className="homepage-title">
              Match your <span className="homepage-title-highlight">signal</span> not the noise.
            </h1>

            <p className="homepage-description">
              A quiet, clean home for the news, socials, podcasts, music and videos that actually fit your headspace.
            </p>

            <div className="homepage-actions">
              <Button onClick={handleGetStarted} variant="primary" size="lg">
                Get started
              </Button>
              <Button onClick={handleSeeSample} variant="secondary" size="lg">
                See a sample feed
              </Button>
            </div>

            <div className="homepage-tags">
              <p className="homepage-tags-label">All signals · one studio</p>
              <p className="homepage-tags-categories">
                {categories.join(" - ")}
              </p>
            </div>

            <p className="homepage-footer">
              Built for people who want a calm, studio-grade view of their media universe.
            </p>
            
            <div style={{ marginTop: "24px", fontSize: "14px" }}>
              <button
                type="button"
                onClick={() => navigate("/studio")}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  font: "inherit",
                  color: "var(--coral-text-muted, #6B7280)",
                  textDecoration: "underline",
                }}
              >
                Try Studio →
              </button>
            </div>
          </div>

          {/* Right Column - Tune Your Mix Card */}
          <div className="homepage-sidebar">
            <Card variant="default" className="homepage-tune-card">
              <div className="homepage-tune-header">
                <h2 className="homepage-tune-title">
                  Tune your mix
                </h2>
                <Tag label="Profile: Deep work" variant="subtle" />
              </div>

              <p className="homepage-tune-description">
                Tell us what you care about. We do the quiet curation.
              </p>

              <div className="homepage-tune-grid">
                <div className="homepage-tune-item homepage-tune-item-active">
                  <div className="homepage-tune-icon">📰</div>
                  <div className="homepage-tune-item-title">News</div>
                  <div className="homepage-tune-item-desc">Long-form only</div>
                </div>
                <div className="homepage-tune-item homepage-tune-item-active">
                  <div className="homepage-tune-icon">💬</div>
                  <div className="homepage-tune-item-title">Social</div>
                  <div className="homepage-tune-item-desc">Threads, not noise</div>
                </div>
                <div className="homepage-tune-item">
                  <div className="homepage-tune-icon">🎧</div>
                  <div className="homepage-tune-item-title">Podcasts</div>
                  <div className="homepage-tune-item-desc">Weekly picks</div>
                </div>
                <div className="homepage-tune-item">
                  <div className="homepage-tune-icon">🎵</div>
                  <div className="homepage-tune-item-title">Music + Video</div>
                  <div className="homepage-tune-item-desc">Background only</div>
                </div>
              </div>

              <p className="homepage-tune-energy">
                We surface what matches your energy across the last 48 hours.
              </p>

              <button
                type="button"
                onClick={() => navigate("/feed")}
                className="homepage-tune-preview"
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  font: "inherit",
                  color: "inherit",
                  textAlign: "left",
                }}
              >
                ▷ Preview echo
              </button>
            </Card>
          </div>
        </div>
      </Container>
    </div>
  );
}
