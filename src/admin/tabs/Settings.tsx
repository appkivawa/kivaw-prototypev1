import { useEffect, useState } from "react";
import Card from "../../ui/Card";
import { supabase } from "../../lib/supabaseClient";
import { logAdminAction } from "../auditLog";

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

  useEffect(() => {
    loadSettings();
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
    </div>
  );
}
