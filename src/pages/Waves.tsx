import React, { useEffect, useState } from "react";
import { listWaves, type WaveEcho } from "../data/echoApi";
import Container from "../ui/Container";
import Card from "../ui/Card";
import SectionHeader from "../ui/SectionHeader";
import EmptyState from "../ui/EmptyState";
import "../styles/waves.css";

function timeAgo(iso: string): string {
  const date = new Date(iso);
  const now = Date.now();
  const diff = now - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w`;
  return `${Math.floor(days / 30)}mo`;
}

function WaveCard({ wave }: { wave: WaveEcho }) {
  const content = wave.content_items;
  const profile = wave.profiles;

  return (
    <Card className="wave-card">
      {/* Header with user info */}
      <div className="wave-header">
        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={profile.username || "User"}
            className="wave-avatar"
          />
        ) : (
          <div className="wave-avatar-placeholder">
            {profile?.username?.[0]?.toUpperCase() || "?"}
          </div>
        )}
        <div className="wave-user-info">
          <div className="wave-username">{profile?.username || "Anonymous"}</div>
          <div className="wave-time">{timeAgo(wave.created_at)}</div>
        </div>
      </div>

      {/* Reflection (primary) */}
      <div className="wave-note">
        {wave.note}
      </div>

      {/* Content (secondary) */}
      {content && (
        <div className="wave-content">
          <div className="wave-content-inner">
            {content.image_url && (
              <img
                src={content.image_url}
                alt={content.title}
                className="wave-content-image"
              />
            )}
            <div className="wave-content-text">
              <div className="wave-content-title">{content.title}</div>
              {content.kind && (
                <div className="wave-content-kind">{content.kind}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function Waves() {
  const [waves, setWaves] = useState<WaveEcho[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadWaves() {
    setLoading(true);
    setError(null);
    try {
      const data = await listWaves(100);
      setWaves(data || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load Waves");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWaves();
  }, []);

  return (
    <div className="waves-page">
      <Container maxWidth="md" className="waves-container">
        <SectionHeader
          title="Waves"
          subtitle="Shared reflections from the community"
          level={1}
        />

        {loading ? (
          <div className="waves-loading">Loading...</div>
        ) : error ? (
          <Card variant="danger" className="waves-error">
            {error}
          </Card>
        ) : waves.length === 0 ? (
          <EmptyState
            title="No Waves yet"
            message="Shared reflections will appear here."
          />
        ) : (
          <div className="waves-list">
            {waves.map((wave) => (
              <WaveCard key={wave.id} wave={wave} />
            ))}
          </div>
        )}
      </Container>
    </div>
  );
}
