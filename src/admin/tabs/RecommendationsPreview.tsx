import { useState } from "react";
import Card from "../../ui/Card";
import { getExternalRecommendations, type RecommendationContext } from "../../data/externalRecommendations";
import { fetchMovies, fetchBooks } from "../../data/providers/externalProviders";
import RequireRole from "../../auth/RequireRole";

type State = "blank" | "destructive" | "expansive" | "minimize";
type Mode = "reset" | "beauty" | "logic" | "faith" | "reflect" | "comfort";
type Focus = "watch" | "read" | "create" | "move" | "music" | "reflect" | "reset";

function RecommendationsPreviewContent() {
  const [state, setState] = useState<State>("blank");
  const [mode, setMode] = useState<Mode>("comfort");
  const [focus, setFocus] = useState<Focus>("watch");
  const [query, setQuery] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Array<{
    id: string;
    provider: string;
    title: string;
    score: number;
    scoreBreakdown: {
      modeMatch: number;
      focusMatch: number;
      stateWeight: number;
      freshness: number;
      popularity: number;
      total: number;
    };
  }>>([]);
  const [error, setError] = useState<string | null>(null);

  async function handlePreview() {
    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const context: RecommendationContext = { state, mode, focus };
      
      // If query is provided, fetch fresh content first
      if (query.trim().length > 0) {
        try {
          if (focus === "watch") {
            await fetchMovies({ query: query.trim(), limit: 20 });
          } else if (focus === "read") {
            await fetchBooks({ query: query.trim(), limit: 20 });
          }
        } catch (fetchErr) {
          console.warn("Error fetching fresh content:", fetchErr);
          // Continue with cache query even if fresh fetch fails
        }
      }
      
      // Get recommendations from cache (with fresh content if query was provided)
      const recommendations = await getExternalRecommendations(context, 20, false);

      setResults(
        recommendations.map((item) => ({
          id: item.id,
          provider: item.provider,
          title: item.title,
          score: item.score,
          scoreBreakdown: item.scoreBreakdown,
        }))
      );
    } catch (e: any) {
      console.error("Error fetching recommendations:", e);
      setError(e?.message || "Failed to fetch recommendations");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-recommendations-preview">
      <div className="admin-section-header">
        <h3 className="admin-section-title">Recommendations Preview</h3>
        <p className="muted" style={{ fontSize: 14, marginTop: 4 }}>
          Test the scoring system with different state/mode/focus combinations
        </p>
      </div>

      <Card className="admin-section-card" style={{ marginBottom: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 16 }}>
          <div>
            <label className="admin-filter-label">State</label>
            <select
              className="admin-filter-input"
              value={state}
              onChange={(e) => setState(e.target.value as State)}
            >
              <option value="blank">Blank</option>
              <option value="destructive">Destructive</option>
              <option value="expansive">Expansive</option>
              <option value="minimize">Minimize</option>
            </select>
          </div>

          <div>
            <label className="admin-filter-label">Mode</label>
            <select
              className="admin-filter-input"
              value={mode}
              onChange={(e) => setMode(e.target.value as Mode)}
            >
              <option value="reset">Reset</option>
              <option value="beauty">Beauty</option>
              <option value="logic">Logic</option>
              <option value="faith">Faith</option>
              <option value="reflect">Reflect</option>
              <option value="comfort">Comfort</option>
            </select>
          </div>

          <div>
            <label className="admin-filter-label">Focus</label>
            <select
              className="admin-filter-input"
              value={focus}
              onChange={(e) => setFocus(e.target.value as Focus)}
            >
              <option value="watch">Watch</option>
              <option value="read">Read</option>
              <option value="create">Create</option>
              <option value="move">Move</option>
              <option value="music">Music</option>
              <option value="reflect">Reflect</option>
              <option value="reset">Reset</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label className="admin-filter-label">Query (optional)</label>
          <input
            type="text"
            className="admin-filter-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search query (e.g., 'meditation', 'inception')"
            style={{ width: "100%" }}
          />
          <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            If provided, will fetch fresh content from providers before showing recommendations
          </p>
        </div>

        <button
          className="btn"
          type="button"
          onClick={handlePreview}
          disabled={loading}
          style={{ width: "100%" }}
        >
          {loading ? "Loading…" : "Preview Recommendations"}
        </button>
      </Card>

      {error && (
        <div className="echo-alert" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {results.length > 0 && (
        <Card className="admin-section-card">
          <h4 className="admin-subsection-title" style={{ marginBottom: 16 }}>
            Results ({results.length})
          </h4>
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Title</th>
                  <th>Total Score</th>
                  <th>Mode Match</th>
                  <th>Focus Match</th>
                  <th>State Weight</th>
                  <th>Freshness</th>
                  <th>Popularity</th>
                </tr>
              </thead>
              <tbody>
                {results.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className="admin-badge">
                        {item.provider === "tmdb" ? "🎬 TMDB" : item.provider === "google_books" ? "📚 Books" : item.provider}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500, color: "var(--ink)", maxWidth: "300px" }}>
                      {item.title}
                    </td>
                    <td style={{ fontWeight: 600, color: "var(--ink)" }}>
                      {item.scoreBreakdown.total}
                    </td>
                    <td style={{ color: item.scoreBreakdown.modeMatch > 0 ? "var(--success)" : "var(--ink-tertiary)" }}>
                      {item.scoreBreakdown.modeMatch > 0 ? `+${item.scoreBreakdown.modeMatch}` : "0"}
                    </td>
                    <td style={{ color: item.scoreBreakdown.focusMatch > 0 ? "var(--success)" : "var(--ink-tertiary)" }}>
                      {item.scoreBreakdown.focusMatch > 0 ? `+${item.scoreBreakdown.focusMatch}` : "0"}
                    </td>
                    <td style={{ color: "var(--ink-muted)" }}>
                      {item.scoreBreakdown.stateWeight > 0 ? `+${item.scoreBreakdown.stateWeight}` : "0"}
                    </td>
                    <td style={{ color: "var(--ink-muted)" }}>
                      {item.scoreBreakdown.freshness > 0 ? `+${item.scoreBreakdown.freshness}` : "0"}
                    </td>
                    <td style={{ color: "var(--ink-muted)" }}>
                      {item.scoreBreakdown.popularity > 0 ? `+${item.scoreBreakdown.popularity}` : "0"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!loading && results.length === 0 && !error && (
        <Card className="admin-section-card">
          <div className="admin-empty-state">
            <div className="admin-empty-state-icon">🔍</div>
            <div className="admin-empty-state-title">No results yet</div>
            <div className="admin-empty-state-desc">
              Select state, mode, and focus, then click "Preview Recommendations" to see scored results.
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

export default function RecommendationsPreview() {
  return (
    <RequireRole allow={["admin"]}>
      <RecommendationsPreviewContent />
    </RequireRole>
  );
}

