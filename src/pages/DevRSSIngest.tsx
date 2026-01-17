// src/pages/DevRSSIngest.tsx
// Local dev-only page for triggering RSS ingest
// Production: Admin-only button to trigger RSS ingest
import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useRoles } from "../auth/useRoles";
import { useSession } from "../auth/useSession";

type IngestResult = {
  ok: boolean;
  feeds: number;
  ingested: number;
  results?: Array<{
    feedUrl: string;
    ok: boolean;
    fetched?: number;
    upserted?: number;
    error?: string;
    ms?: number;
  }>;
  error?: string;
  note?: string;
};

export default function DevRSSIngest() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { session, isAuthed } = useSession();
  const { isAdmin, loading: rolesLoading } = useRoles();

  // In production, only show to admins
  if (import.meta.env.PROD) {
    if (rolesLoading) {
      return (
        <div style={{ padding: 40, textAlign: "center" }}>
          <p>Loading...</p>
        </div>
      );
    }
    if (!isAuthed || !isAdmin) {
      return (
        <div style={{ padding: 40, textAlign: "center" }}>
          <p>This page is only available to administrators.</p>
        </div>
      );
    }
  }

  async function triggerIngest() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Get user ID from session if available
      const userId = session?.user?.id || null;

      // Use Supabase client to call the Edge Function (works in both dev and production)
      const { data, error: invokeError } = await supabase.functions.invoke<IngestResult>("ingest_rss", {
        body: {
          ...(userId && { user_id: userId }),
          maxFeeds: 50,
          perFeedLimit: 100,
        },
      });

      if (invokeError) {
        if (invokeError.message?.includes("403") || invokeError.message?.includes("Forbidden")) {
          throw new Error(
            "Access forbidden. The RSS ingest function may require admin access. " +
            "Please ensure you are logged in as an administrator."
          );
        }
        throw invokeError;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setResult(data as IngestResult);
    } catch (e: any) {
      console.error("Error triggering RSS ingest:", e);
      setError(e?.message || "Failed to trigger RSS ingest");
    } finally {
      setLoading(false);
    }
  }

  // Calculate summary stats
  const summary = result
    ? {
        sourcesProcessed: result.feeds || 0,
        itemsFetched: result.results?.reduce((sum, r) => sum + (r.fetched || 0), 0) || 0,
        itemsUpserted: result.ingested || 0,
        errorsCount: result.results?.filter((r) => !r.ok).length || 0,
      }
    : null;

  return (
    <div style={{ padding: 40, maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>
          RSS Ingest {import.meta.env.PROD ? "(Admin Only)" : "(Dev Only)"}
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
          {import.meta.env.PROD
            ? "Manually trigger RSS ingestion. This will process all active RSS sources and fetch the latest items."
            : "Trigger RSS ingestion locally. This page is only available in development mode."}
        </p>
      </div>

      <div
        style={{
          padding: 24,
          background: "var(--bg-secondary)",
          borderRadius: 12,
          border: "1px solid var(--border)",
          marginBottom: 24,
        }}
      >
        <button
          onClick={triggerIngest}
          disabled={loading}
          style={{
            padding: "12px 24px",
            fontSize: 16,
            fontWeight: 600,
            background: loading ? "var(--border)" : "var(--text-primary)",
            color: loading ? "var(--text-muted)" : "var(--bg-primary)",
            border: "none",
            borderRadius: 8,
            cursor: loading ? "not-allowed" : "pointer",
            transition: "all 0.2s",
          }}
        >
          {loading ? "⏳ Running..." : "🚀 Trigger RSS Ingest"}
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: 16,
            background: "var(--danger)",
            color: "var(--ink)",
            borderRadius: 8,
            marginBottom: 24,
            fontSize: 14,
          }}
        >
          ❌ Error: {error}
        </div>
      )}

      {result && (
        <div>
          {result.note && (
            <div
              style={{
                padding: 12,
                background: "var(--surface-2)",
                borderRadius: 8,
                marginBottom: 16,
                fontSize: 14,
                color: "var(--text-muted)",
              }}
            >
              ℹ️ {result.note}
            </div>
          )}

          {summary && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 12,
                marginBottom: 24,
              }}
            >
              <div
                style={{
                  padding: 16,
                  background: "var(--surface-2)",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>
                  {summary.sourcesProcessed}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                  Sources Processed
                </div>
              </div>

              <div
                style={{
                  padding: 16,
                  background: "var(--surface-2)",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>
                  {summary.itemsFetched}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                  Items Fetched
                </div>
              </div>

              <div
                style={{
                  padding: 16,
                  background: "var(--surface-2)",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>
                  {summary.itemsUpserted}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                  Items Upserted
                </div>
              </div>

              {summary.errorsCount > 0 && (
                <div
                  style={{
                    padding: 16,
                    background: "var(--danger)",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                  }}
                >
                  <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)" }}>
                    {summary.errorsCount}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 4 }}>
                    Errors
                  </div>
                </div>
              )}
            </div>
          )}

          {result.results && result.results.length > 0 && (
            <details style={{ marginTop: 16 }}>
              <summary
                style={{
                  cursor: "pointer",
                  padding: 12,
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  background: "var(--surface-2)",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                }}
              >
                View Feed Details ({result.results.length} feeds)
              </summary>
              <div
                style={{
                  marginTop: 12,
                  maxHeight: "400px",
                  overflowY: "auto",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: 12,
                  background: "var(--bg-primary)",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {result.results.map((feed, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: 12,
                        background: feed.ok ? "var(--surface-2)" : "var(--danger)",
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "start",
                          gap: 12,
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: feed.ok ? "var(--text-primary)" : "var(--ink)",
                              marginBottom: 4,
                              wordBreak: "break-all",
                            }}
                          >
                            {feed.feedUrl}
                          </div>
                          {feed.ok ? (
                            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                              ✅ Fetched: {feed.fetched || 0} | Upserted: {feed.upserted || 0} | Time:{" "}
                              {feed.ms ? `${feed.ms}ms` : "N/A"}
                            </div>
                          ) : (
                            <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                              ❌ Error: {feed.error || "Unknown error"}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          )}
        </div>
      )}

      {!result && !error && !loading && (
        <p style={{ marginTop: 12, fontSize: 14, color: "var(--text-muted)" }}>
          Click the button above to manually trigger RSS ingestion. This will process all active RSS
          sources and fetch the latest items.
        </p>
      )}
    </div>
  );
}


