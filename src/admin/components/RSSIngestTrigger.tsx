// src/admin/components/RSSIngestTrigger.tsx
import { useState } from "react";
import Card from "../../ui/Card";
import { supabase } from "../../lib/supabaseClient";

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

export default function RSSIngestTrigger() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function triggerIngest() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Get the session to ensure user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      // Call the ingest_rss edge function
      // Note: If INGEST_SECRET is set in the edge function, this will fail with 403
      // In that case, either set INGEST_SECRET to empty or create a backend proxy
      const { data, error: invokeError } = await supabase.functions.invoke("ingest_rss", {
        body: {
          maxFeeds: 50, // Process up to 50 feeds
          perFeedLimit: 100, // Fetch up to 100 items per feed
        },
      });

      if (invokeError) {
        // If we get a 403, it likely means INGEST_SECRET is set
        if (invokeError.message?.includes("403") || invokeError.message?.includes("Forbidden")) {
          throw new Error(
            "Access forbidden. The RSS ingest function may require an INGEST_SECRET. " +
            "Either set INGEST_SECRET to empty in the edge function environment, or contact an administrator."
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
  // Note: The edge function uses upsert, so "ingested" includes both inserts and updates
  const summary = result
    ? {
        sourcesProcessed: result.feeds || 0,
        itemsFetched: result.results?.reduce((sum, r) => sum + (r.fetched || 0), 0) || 0,
        itemsInserted: result.ingested || 0, // This is total upserted (inserts + updates)
        errorsCount: result.results?.filter((r) => !r.ok).length || 0,
      }
    : null;

  return (
    <Card className="admin-section-card" style={{ marginBottom: 24 }}>
      <div className="admin-section-header">
        <h4 className="admin-subsection-title">RSS Ingest</h4>
        <button
          className="btn"
          type="button"
          onClick={triggerIngest}
          disabled={loading}
          style={{ fontSize: 14, padding: "8px 16px" }}
        >
          {loading ? "⏳ Running..." : "🚀 Trigger RSS Ingest"}
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: 12,
            background: "var(--danger)",
            color: "var(--ink)",
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 14,
          }}
        >
          ❌ Error: {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 16 }}>
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
                marginBottom: 16,
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
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text)" }}>
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
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text)" }}>
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
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text)" }}>
                  {summary.itemsInserted}
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
                  padding: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--text)",
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
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: feed.ok ? "var(--text)" : "var(--ink)",
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
        <p className="muted" style={{ marginTop: 12, fontSize: 14 }}>
          Click the button above to manually trigger RSS ingestion. This will process all active RSS sources
          and fetch the latest items.
        </p>
      )}
    </Card>
  );
}

