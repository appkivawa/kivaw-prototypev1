import { useEffect, useState } from "react";
import Card from "../../ui/Card";
import { supabase } from "../../lib/supabaseClient";
import { logAdminAction } from "../auditLog";
import { getUserId } from "../../data/savesApi";

type AppSettings = {
  maintenance_mode: boolean;
  home_trending_enabled: boolean;
  max_waves: number;
};

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings>({
    maintenance_mode: false,
    home_trending_enabled: true,
    max_waves: 100,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Manual Overrides
  const [overrides, setOverrides] = useState<any[]>([]);
  const [loadingOverrides, setLoadingOverrides] = useState(false);
  const [newOverride, setNewOverride] = useState({
    type: "force_state" as "force_state" | "pin_content" | "suppress_category",
    value: "",
    expiresAt: "",
    notes: "",
  });

  async function loadSettings() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("setting_key, setting_value");

      if (error) {
        // If table doesn't exist, show helpful message
        if (error.code === "42P01" || error.message?.includes("does not exist")) {
          setError(
            "The app_settings table does not exist. Please run the SQL migration: supabase/migrations/create_app_settings.sql"
          );
          return;
        }
        throw error;
      }

      // Parse settings from database
      const loadedSettings: AppSettings = {
        maintenance_mode: false,
        home_trending_enabled: true,
        max_waves: 100,
      };

      (data || []).forEach((row) => {
        const key = row.setting_key;
        const value = row.setting_value;

        if (key === "maintenance_mode") {
          loadedSettings.maintenance_mode = value === true || value === "true";
        } else if (key === "home_trending_enabled") {
          loadedSettings.home_trending_enabled = value === true || value === "true";
        } else if (key === "max_waves") {
          loadedSettings.max_waves = typeof value === "number" ? value : parseInt(String(value), 10) || 100;
        }
      });

      setSettings(loadedSettings);
    } catch (e: any) {
      console.error("Error loading settings:", e);
      setError(e?.message || "Could not load settings.");
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      // Update each setting
      const updates = [
        {
          setting_key: "maintenance_mode",
          setting_value: settings.maintenance_mode,
          updated_at: new Date().toISOString(),
        },
        {
          setting_key: "home_trending_enabled",
          setting_value: settings.home_trending_enabled,
          updated_at: new Date().toISOString(),
        },
        {
          setting_key: "max_waves",
          setting_value: settings.max_waves,
          updated_at: new Date().toISOString(),
        },
      ];

      const { error } = await supabase.from("app_settings").upsert(updates, {
        onConflict: "setting_key",
      });

      if (error) throw error;

      // Log the action
      await logAdminAction("settings_update", null, {
        maintenance_mode: settings.maintenance_mode,
        home_trending_enabled: settings.home_trending_enabled,
        max_waves: settings.max_waves,
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) {
      console.error("Error saving settings:", e);
      setError(e?.message || "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  async function loadOverrides() {
    setLoadingOverrides(true);
    try {
      const { data, error } = await supabase
        .from("home_overrides")
        .select("*")
        .eq("active", true)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        if (error.code === "42P01") {
          // Table doesn't exist - that's okay
          setOverrides([]);
          return;
        }
        throw error;
      }

      setOverrides(data || []);
    } catch (e: any) {
      console.error("Error loading overrides:", e);
    } finally {
      setLoadingOverrides(false);
    }
  }

  async function addOverride() {
    if (!newOverride.value.trim()) {
      alert("Please enter a value");
      return;
    }

    try {
      const userId = await getUserId();
      const expiresAt = newOverride.expiresAt
        ? new Date(newOverride.expiresAt).toISOString()
        : null;

      const { error } = await supabase.from("home_overrides").insert({
        override_type: newOverride.type,
        target_value: newOverride.value,
        expires_at: expiresAt,
        notes: newOverride.notes || null,
        created_by: userId,
        active: true,
      });

      if (error) throw error;

      await logAdminAction("home_override_add", null, {
        type: newOverride.type,
        value: newOverride.value,
      });

      setNewOverride({
        type: "force_state",
        value: "",
        expiresAt: "",
        notes: "",
      });
      await loadOverrides();
    } catch (e: any) {
      console.error("Error adding override:", e);
      alert("Error: " + (e?.message || "Could not add override."));
    }
  }

  async function toggleOverride(id: string, currentActive: boolean) {
    try {
      const { error } = await supabase
        .from("home_overrides")
        .update({ active: !currentActive })
        .eq("id", id);

      if (error) throw error;

      await logAdminAction("home_override_toggle", id, {
        active: !currentActive,
      });

      await loadOverrides();
    } catch (e: any) {
      console.error("Error toggling override:", e);
      alert("Error: " + (e?.message || "Could not update override."));
    }
  }

  async function deleteOverride(id: string) {
    if (!confirm("Delete this override?")) return;

    try {
      const { error } = await supabase.from("home_overrides").delete().eq("id", id);

      if (error) throw error;

      await logAdminAction("home_override_delete", id, {});
      await loadOverrides();
    } catch (e: any) {
      console.error("Error deleting override:", e);
      alert("Error: " + (e?.message || "Could not delete override."));
    }
  }

  useEffect(() => {
    loadSettings();
    loadOverrides();
  }, []);

  if (loading) {
    return <p className="muted">Loading settings…</p>;
  }

  return (
    <div className="admin-settings-page">
      <div className="admin-section-header">
        <h3 className="admin-section-title">Settings & Configuration</h3>
        <button className="btn btn-ghost" type="button" onClick={loadSettings}>
          🔄 Refresh
        </button>
      </div>

      {error && (
        <div className="echo-alert" style={{ marginBottom: 16 }}>
          {error}
          {error.includes("does not exist") && (
            <div style={{ marginTop: 12, fontSize: 12, lineHeight: 1.5 }}>
              <strong>Setup Required:</strong> Run the SQL migration in{" "}
              <code style={{ background: "var(--white-75)", padding: "2px 6px", borderRadius: 4 }}>
                supabase/migrations/create_app_settings.sql
              </code>
            </div>
          )}
        </div>
      )}

      {success && (
        <div className="echo-alert" style={{ marginBottom: 16, background: "#10b981", color: "white" }}>
          ✓ Settings saved successfully!
        </div>
      )}

      <Card className="admin-section-card">
        <h4 className="admin-subsection-title">
          <span className="admin-section-icon">⚙️</span>
          Application Settings
        </h4>

        <div className="admin-settings-list">
          {/* Maintenance Mode */}
          <div className="admin-setting-item">
            <div className="admin-setting-info">
              <div className="admin-setting-label">Maintenance Mode</div>
              <div className="admin-setting-desc">
                Enable maintenance mode to disable public access to the platform
              </div>
            </div>
            <label className="admin-toggle">
              <input
                type="checkbox"
                checked={settings.maintenance_mode}
                onChange={(e) => setSettings({ ...settings, maintenance_mode: e.target.checked })}
              />
              <span className="admin-toggle-slider" />
            </label>
          </div>

          {/* Home Trending Enabled */}
          <div className="admin-setting-item">
            <div className="admin-setting-info">
              <div className="admin-setting-label">Home Trending Enabled</div>
              <div className="admin-setting-desc">
                Enable trending items to appear on the home page
              </div>
            </div>
            <label className="admin-toggle">
              <input
                type="checkbox"
                checked={settings.home_trending_enabled}
                onChange={(e) =>
                  setSettings({ ...settings, home_trending_enabled: e.target.checked })
                }
              />
              <span className="admin-toggle-slider" />
            </label>
          </div>

          {/* Max Waves */}
          <div className="admin-setting-item">
            <div className="admin-setting-info">
              <div className="admin-setting-label">Max Waves</div>
              <div className="admin-setting-desc">
                Maximum number of waves to display (integer)
              </div>
            </div>
            <input
              type="number"
              className="admin-setting-input"
              value={settings.max_waves}
              onChange={(e) =>
                setSettings({ ...settings, max_waves: parseInt(e.target.value, 10) || 0 })
              }
              min="0"
              step="1"
            />
          </div>
        </div>

        <div className="admin-settings-actions">
          <button className="btn" type="button" onClick={saveSettings} disabled={saving}>
            {saving ? "Saving…" : "💾 Save Settings"}
          </button>
          <button className="btn btn-ghost" type="button" onClick={loadSettings} disabled={saving}>
            Reset
          </button>
        </div>
      </Card>

      {/* Manual Overrides */}
      <div style={{ marginTop: 24 }}>
        <Card className="admin-section-card">
        <h4 className="admin-subsection-title">
          <span className="admin-section-icon">🎛️</span>
          Manual Overrides for Home
        </h4>

        <div style={{ marginTop: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
            <div>
              <label className="admin-filter-label">Override Type</label>
              <select
                className="admin-filter-input"
                value={newOverride.type}
                onChange={(e) =>
                  setNewOverride({ ...newOverride, type: e.target.value as any })
                }
              >
                <option value="force_state">Force State to Top</option>
                <option value="pin_content">Pin Content to Explore</option>
                <option value="suppress_category">Suppress Category</option>
              </select>
            </div>

            <div>
              <label className="admin-filter-label">
                {newOverride.type === "force_state"
                  ? "State Name"
                  : newOverride.type === "pin_content"
                    ? "Content ID"
                    : "Category Name"}
              </label>
              <input
                type="text"
                className="admin-filter-input"
                placeholder={
                  newOverride.type === "force_state"
                    ? "e.g., Destructive"
                    : newOverride.type === "pin_content"
                      ? "Content item UUID"
                      : "e.g., Mindfulness"
                }
                value={newOverride.value}
                onChange={(e) => setNewOverride({ ...newOverride, value: e.target.value })}
              />
            </div>

            <div>
              <label className="admin-filter-label">Expires At (optional)</label>
              <input
                type="datetime-local"
                className="admin-filter-input"
                value={newOverride.expiresAt}
                onChange={(e) => setNewOverride({ ...newOverride, expiresAt: e.target.value })}
              />
            </div>

            <div>
              <label className="admin-filter-label">Notes (optional)</label>
              <input
                type="text"
                className="admin-filter-input"
                placeholder="Why this override?"
                value={newOverride.notes}
                onChange={(e) => setNewOverride({ ...newOverride, notes: e.target.value })}
              />
            </div>

            <button className="btn" type="button" onClick={addOverride}>
              ➕ Add Override
            </button>
          </div>

          {loadingOverrides ? (
            <p className="muted">Loading overrides…</p>
          ) : overrides.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {overrides.map((override) => (
                <div
                  key={override.id}
                  style={{
                    padding: 12,
                    background: "var(--white-75)",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span className="admin-badge">
                        {override.override_type === "force_state"
                          ? "🎯 Force State"
                          : override.override_type === "pin_content"
                            ? "📌 Pin Content"
                            : "🚫 Suppress"}
                      </span>
                      <span style={{ fontWeight: 700, color: "var(--text)" }}>
                        {override.target_value}
                      </span>
                    </div>
                    {override.notes && (
                      <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 4 }}>
                        {override.notes}
                      </div>
                    )}
                    {override.expires_at && (
                      <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>
                        Expires: {new Date(override.expires_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="admin-action-btn"
                      type="button"
                      onClick={() => toggleOverride(override.id, override.active)}
                    >
                      {override.active ? "✅ Active" : "⏸️ Paused"}
                    </button>
                    <button
                      className="admin-action-btn"
                      type="button"
                      onClick={() => deleteOverride(override.id)}
                      style={{ color: "#ef4444" }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="admin-empty-state">
              <div className="admin-empty-state-icon">🎛️</div>
              <div className="admin-empty-state-title">No Overrides</div>
              <div className="admin-empty-state-desc">
                Add overrides to manually control what appears on the home page and explore.
              </div>
            </div>
          )}
        </div>
        </Card>
      </div>
    </div>
  );
}
