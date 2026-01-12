import React, { useEffect, useState } from "react";
import { listWaves, type WaveEcho } from "../data/echoApi";

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
    <article
      style={{
        maxWidth: "680px",
        width: "100%",
        margin: "0 auto 24px",
        padding: "20px",
        borderRadius: "8px",
        border: "1px solid var(--border-strong)",
        backgroundColor: "var(--surface)",
        boxShadow: "var(--shadow-soft)",
        animation: `fadeInUp 0.4s ease-out ${Math.random() * 0.2}s both`,
      }}
    >
      {/* Header with user info */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "16px",
        }}
      >
        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={profile.username || "User"}
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              backgroundColor: "var(--border-strong)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
            }}
          >
            {profile?.username?.[0]?.toUpperCase() || "?"}
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--ink)",
              marginBottom: "2px",
            }}
          >
            {profile?.username || "Anonymous"}
          </div>
          <div
            style={{
              fontSize: "12px",
              color: "var(--ink-tertiary)",
            }}
          >
            {timeAgo(wave.created_at)}
          </div>
        </div>
      </div>

      {/* Reflection (primary) */}
      <div
        style={{
          fontSize: "16px",
          lineHeight: 1.6,
          color: "rgba(0,0,0,0.9)",
          marginBottom: content ? "20px" : "0",
        }}
      >
        {wave.note}
      </div>

      {/* Content (secondary) */}
      {content && (
        <div
          style={{
            padding: "16px",
            borderRadius: "6px",
            backgroundColor: "var(--border)",
            border: "1px solid var(--border)",
          }}
        >
          <div style={{ display: "flex", gap: "12px" }}>
            {content.image_url && (
              <img
                src={content.image_url}
                alt={content.title}
                style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "6px",
                  objectFit: "cover",
                  flexShrink: 0,
                }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: "15px",
                  fontWeight: 600,
                  color: "var(--ink)",
                  marginBottom: "4px",
                }}
              >
                {content.title}
              </div>
              {content.kind && (
                <div
                  style={{
                    fontSize: "13px",
                    color: "var(--ink-muted)",
                  }}
                >
                  {content.kind}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </article>
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
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--bg)",
        padding: "24px 16px",
      }}
    >
      <div style={{ maxWidth: "680px", margin: "0 auto" }}>
        <div style={{ marginBottom: "32px" }}>
          <h1
            style={{
              fontSize: "clamp(24px, 4vw, 32px)",
              fontWeight: 700,
              margin: 0,
              marginBottom: "8px",
              color: "var(--ink)",
            }}
          >
            Waves
          </h1>
          <p
            style={{
              fontSize: "15px",
              color: "rgba(0,0,0,0.6)",
              margin: 0,
            }}
          >
            Shared reflections from the community
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "48px", color: "var(--ink-tertiary)" }}>
            Loading...
          </div>
        ) : error ? (
          <div
            style={{
              padding: "16px",
              borderRadius: "8px",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              backgroundColor: "rgba(239, 68, 68, 0.05)",
              color: "rgba(239, 68, 68, 0.9)",
              marginBottom: "24px",
            }}
          >
            {error}
          </div>
        ) : waves.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px", color: "var(--ink-tertiary)" }}>
            <p style={{ fontSize: "16px", marginBottom: "8px" }}>No Waves yet</p>
            <p style={{ fontSize: "14px" }}>Shared reflections will appear here.</p>
          </div>
        ) : (
          <div>
            {waves.map((wave, index) => (
              <WaveCard key={wave.id} wave={wave} />
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
