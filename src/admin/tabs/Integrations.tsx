import { useEffect, useState } from "react";
import Card from "../../ui/Card";
import { supabase } from "../../lib/supabaseClient";
import RequireRole from "../../auth/RequireRole";

type ProviderSetting = {
  provider: string;
  enabled: boolean;
  config: Record<string, unknown>;
  updated_at: string;
};

function IntegrationsContent() {
  const [providers, setProviders] = useState<ProviderSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingConfig, setEditingConfig] = useState<string | null>(null);
  const [configValue, setConfigValue] = useState<string>("");

  async function loadProviders() {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("provider_settings")
        .select("provider, enabled, config, updated_at")
        .order("provider");

      if (fetchError) throw fetchError;
      setProviders(data || []);
    } catch (e: any) {
      console.error("Error loading providers:", e);
      setError(e?.message || "Failed to load provider settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProviders();
  }, []);

  async function toggleProvider(provider: string, enabled: boolean) {
    setSaving(provider);
    setError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        "admin-update-provider-settings",
        {
          body: { provider, enabled },
        }
      );

      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);

      await loadProviders();
    } catch (e: any) {
      console.error("Error updating provider:", e);
      setError(e?.message || "Failed to update provider");
    } finally {
      setSaving(null);
    }
  }

  async function saveConfig(provider: string) {
    setSaving(provider);
    setError(null);
    try {
      let parsedConfig: Record<string, unknown>;
      try {
        parsedConfig = JSON.parse(configValue);
      } catch {
        throw new Error("Invalid JSON format");
      }

      const { data, error: invokeError } = await supabase.functions.invoke(
        "admin-update-provider-settings",
        {
          body: { provider, config: parsedConfig },
        }
      );

      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);

      setEditingConfig(null);
      setConfigValue("");
      await loadProviders();
    } catch (e: any) {
      console.error("Error updating provider config:", e);
      setError(e?.message || "Failed to update provider config");
    } finally {
      setSaving(null);
    }
  }

  function startEditingConfig(provider: string, currentConfig: Record<string, unknown>) {
    setEditingConfig(provider);
    setConfigValue(JSON.stringify(currentConfig, null, 2));
  }

  return (
    <div className="admin-integrations">
      <div className="admin-section-header">
        <h3 className="admin-section-title">Provider Integrations</h3>
        <button className="btn btn-ghost" type="button" onClick={loadProviders}>
          🔄 Refresh
        </button>
      </div>

      {error && (
        <div className="echo-alert" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading ? (
        <p className="muted">Loading providers…</p>
      ) : providers.length === 0 ? (
        <Card className="admin-section-card">
          <p className="muted">No provider settings found.</p>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {providers.map((provider) => (
            <Card key={provider.provider} className="admin-section-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <h4 className="admin-subsection-title" style={{ margin: 0 }}>
                    {provider.provider === "tmdb" ? "🎬 TMDB" : provider.provider === "google_books" ? "📚 Google Books" : provider.provider}
                  </h4>
                  <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    Last updated: {new Date(provider.updated_at).toLocaleString()}
                  </p>
                </div>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: saving === provider.provider ? "not-allowed" : "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={provider.enabled}
                    onChange={(e) => toggleProvider(provider.provider, e.target.checked)}
                    disabled={saving === provider.provider}
                    style={{ cursor: saving === provider.provider ? "not-allowed" : "pointer", width: 18, height: 18 }}
                  />
                  <span style={{ color: "var(--ink)", fontWeight: 500 }}>
                    {provider.enabled ? "Enabled" : "Disabled"}
                  </span>
                </label>
              </div>

              <div style={{ marginTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <label className="admin-filter-label" style={{ margin: 0 }}>
                    Configuration (JSON)
                  </label>
                  {editingConfig !== provider.provider && (
                    <button
                      className="admin-action-btn"
                      type="button"
                      onClick={() => startEditingConfig(provider.provider, provider.config)}
                      style={{ fontSize: 12, padding: "4px 8px" }}
                    >
                      Edit
                    </button>
                  )}
                </div>

                {editingConfig === provider.provider ? (
                  <div>
                    <textarea
                      className="admin-filter-input"
                      value={configValue}
                      onChange={(e) => setConfigValue(e.target.value)}
                      rows={8}
                      style={{
                        fontFamily: "monospace",
                        fontSize: 12,
                        width: "100%",
                        resize: "vertical",
                      }}
                      placeholder='{"key": "value"}'
                    />
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button
                        className="btn"
                        type="button"
                        onClick={() => saveConfig(provider.provider)}
                        disabled={saving === provider.provider}
                      >
                        {saving === provider.provider ? "Saving…" : "Save"}
                      </button>
                      <button
                        className="btn btn-ghost"
                        type="button"
                        onClick={() => {
                          setEditingConfig(null);
                          setConfigValue("");
                        }}
                        disabled={saving === provider.provider}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <pre
                    style={{
                      background: "var(--surface-2)",
                      padding: 12,
                      borderRadius: 8,
                      fontSize: 12,
                      fontFamily: "monospace",
                      color: "var(--ink-muted)",
                      overflow: "auto",
                      margin: 0,
                    }}
                  >
                    {JSON.stringify(provider.config, null, 2)}
                  </pre>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Integrations() {
  return (
    <RequireRole allow={["admin"]}>
      <IntegrationsContent />
    </RequireRole>
  );
}

