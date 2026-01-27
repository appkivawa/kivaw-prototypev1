import { useState, useEffect } from "react";
import Card from "../../ui/Card";
import { supabase } from "../../lib/supabaseClient";

type HealthCheckResult = {
  supabase_connection: {
    status: "healthy" | "unhealthy";
    message: string;
    response_time_ms?: number;
  };
  error_count: {
    status: "healthy" | "warning" | "unhealthy";
    total_errors: number;
    unresolved_errors: number;
    message: string;
  };
};

type CronJobHealth = {
  job_name: string;
  ran_at: string;
  status: "ok" | "fail";
  duration_ms: number | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
};

export default function Health() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<HealthCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cronJobs, setCronJobs] = useState<CronJobHealth[]>([]);
  const [cronLoading, setCronLoading] = useState(true);

  // Load cron job health on mount and refresh
  useEffect(() => {
    loadCronHealth();
  }, []);

  async function loadCronHealth() {
    setCronLoading(true);
    try {
      const { data, error: cronError } = await supabase
        .from("system_health_latest")
        .select("*")
        .order("job_name");

      if (cronError) {
        console.error("Error loading cron health:", cronError);
        setCronJobs([]);
      } else {
        setCronJobs((data || []) as CronJobHealth[]);
      }
    } catch (e: any) {
      console.error("Exception loading cron health:", e);
      setCronJobs([]);
    } finally {
      setCronLoading(false);
    }
  }

  async function runHealthCheck() {
    setLoading(true);
    setError(null);
    setResults(null);

    const healthResults: HealthCheckResult = {
      supabase_connection: {
        status: "unhealthy",
        message: "Not checked",
      },
      error_count: {
        status: "unhealthy",
        total_errors: 0,
        unresolved_errors: 0,
        message: "Not checked",
      },
    };

    try {
      // Check 1: Supabase connection
      const connectionStart = Date.now();
      try {
        const { error: queryError } = await supabase
          .from("profiles")
          .select("count")
          .limit(1)
          .single();

        const connectionEnd = Date.now();
        const responseTime = connectionEnd - connectionStart;

        if (queryError) {
          // Even if there's an error, if we got a response, connection is working
          // (might be RLS or table doesn't exist, but connection is fine)
          healthResults.supabase_connection = {
            status: "healthy",
            message: "Connection successful (query returned error, but connection works)",
            response_time_ms: responseTime,
          };
        } else {
          healthResults.supabase_connection = {
            status: "healthy",
            message: "Connection successful",
            response_time_ms: responseTime,
          };
        }
      } catch (connError: any) {
        healthResults.supabase_connection = {
          status: "unhealthy",
          message: `Connection failed: ${connError?.message || "Unknown error"}`,
        };
      }

      // Check 2: Error count from app_errors table
      try {
        const { data: errorsData, error: errorsError } = await supabase
          .from("app_errors")
          .select("id, resolved");

        if (errorsError) {
          // Table might not exist
          if (errorsError.code === "42P01" || errorsError.message?.includes("does not exist")) {
            healthResults.error_count = {
              status: "warning",
              total_errors: 0,
              unresolved_errors: 0,
              message: "app_errors table does not exist. Run create_app_errors_table.sql to create it.",
            };
          } else {
            healthResults.error_count = {
              status: "unhealthy",
              total_errors: 0,
              unresolved_errors: 0,
              message: `Error querying app_errors: ${errorsError.message || errorsError.code}`,
            };
          }
        } else {
          const totalErrors = errorsData?.length || 0;
          const unresolvedErrors = errorsData?.filter((e) => !e.resolved).length || 0;

          let status: "healthy" | "warning" | "unhealthy" = "healthy";
          let message = `Total: ${totalErrors}, Unresolved: ${unresolvedErrors}`;

          if (unresolvedErrors > 100) {
            status = "unhealthy";
            message += " (High number of unresolved errors)";
          } else if (unresolvedErrors > 10) {
            status = "warning";
            message += " (Moderate number of unresolved errors)";
          } else if (totalErrors === 0) {
            message = "No errors recorded";
          }

          healthResults.error_count = {
            status,
            total_errors: totalErrors,
            unresolved_errors: unresolvedErrors,
            message,
          };
        }
      } catch (errCountError: any) {
        healthResults.error_count = {
          status: "unhealthy",
          total_errors: 0,
          unresolved_errors: 0,
          message: `Failed to check error count: ${errCountError?.message || "Unknown error"}`,
        };
      }

      setResults(healthResults);
      // Refresh cron health after manual check
      await loadCronHealth();
    } catch (e: any) {
      console.error("Error running health check:", e);
      setError(e?.message || "Failed to run health check");
    } finally {
      setLoading(false);
    }
  }

  function formatTimeAgo(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }

  function getCronStatusColor(status: "ok" | "fail"): string {
    return status === "ok" ? "#10b981" : "#ef4444";
  }

  function getStatusColor(status: "healthy" | "warning" | "unhealthy"): string {
    switch (status) {
      case "healthy":
        return "#10b981"; // green
      case "warning":
        return "#f59e0b"; // amber
      case "unhealthy":
        return "#ef4444"; // red
      default:
        return "#6b7280"; // gray
    }
  }

  return (
    <div className="admin-system-health">
      <div className="admin-section-header">
        <h3 className="admin-section-title">System Health</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn"
            type="button"
            onClick={loadCronHealth}
            disabled={cronLoading}
          >
            {cronLoading ? "Loading…" : "🔄 Refresh Cron Status"}
          </button>
          <button
            className="btn"
            type="button"
            onClick={runHealthCheck}
            disabled={loading}
          >
            {loading ? "Running…" : "🔍 Run Health Check"}
          </button>
        </div>
      </div>

      {error && (
        <div className="echo-alert" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {results && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Supabase Connection Check */}
          <Card className="admin-section-card">
            <h4 className="admin-subsection-title">
              <span className="admin-section-icon">🔌</span>
              Supabase Connection
            </h4>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  backgroundColor: getStatusColor(results.supabase_connection.status),
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, marginBottom: 4 }}>
                  {results.supabase_connection.status === "healthy" ? "✓ Healthy" : "✗ Unhealthy"}
                </div>
                <div style={{ fontSize: 13, color: "var(--textSecondary)" }}>
                  {results.supabase_connection.message}
                  {results.supabase_connection.response_time_ms !== undefined && (
                    <span style={{ marginLeft: 8 }}>
                      ({results.supabase_connection.response_time_ms}ms)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Error Count Check */}
          <Card className="admin-section-card">
            <h4 className="admin-subsection-title">
              <span className="admin-section-icon">⚠️</span>
              Error Count
            </h4>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  backgroundColor: getStatusColor(results.error_count.status),
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, marginBottom: 4 }}>
                  {results.error_count.status === "healthy"
                    ? "✓ Healthy"
                    : results.error_count.status === "warning"
                      ? "⚠ Warning"
                      : "✗ Unhealthy"}
                </div>
                <div style={{ fontSize: 13, color: "var(--textSecondary)" }}>
                  {results.error_count.message}
                </div>
                {results.error_count.total_errors > 0 && (
                  <div style={{ marginTop: 8, fontSize: 12, color: "var(--textSecondary)" }}>
                    <strong>Total Errors:</strong> {results.error_count.total_errors} |{" "}
                    <strong>Unresolved:</strong> {results.error_count.unresolved_errors}
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Cron Jobs Health */}
      <div style={{ marginTop: 24 }}>
        <h4 className="admin-subsection-title" style={{ marginBottom: 16 }}>
          <span className="admin-section-icon">⏰</span>
          Cron Jobs & Ingest Health
        </h4>
        {cronLoading ? (
          <Card className="admin-section-card">
            <p className="muted" style={{ textAlign: "center", padding: 24 }}>
              Loading cron job status…
            </p>
          </Card>
        ) : cronJobs.length === 0 ? (
          <Card className="admin-section-card">
            <p className="muted" style={{ textAlign: "center", padding: 24 }}>
              No cron job health data found. Jobs may not have run yet.
            </p>
          </Card>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {cronJobs.map((job) => (
              <Card key={job.job_name} className="admin-section-card">
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      backgroundColor: getCronStatusColor(job.status),
                      marginTop: 4,
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>
                          {job.job_name}
                        </div>
                        <div style={{ fontSize: 13, color: "var(--textSecondary)" }}>
                          Last run: {formatTimeAgo(job.ran_at)} ({new Date(job.ran_at).toLocaleString()})
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 12, color: "var(--textSecondary)", marginBottom: 4 }}>
                          {job.status === "ok" ? "✓ OK" : "✗ FAILED"}
                        </div>
                        {job.duration_ms !== null && (
                          <div style={{ fontSize: 11, color: "var(--textSecondary)" }}>
                            {job.duration_ms}ms
                          </div>
                        )}
                      </div>
                    </div>
                    {job.error_message && (
                      <div
                        style={{
                          marginTop: 8,
                          padding: 8,
                          background: "var(--surface-2)",
                          borderRadius: 4,
                          fontSize: 12,
                          color: "var(--textSecondary)",
                          fontFamily: "monospace",
                          wordBreak: "break-word",
                        }}
                      >
                        <strong>Error:</strong> {job.error_message}
                      </div>
                    )}
                    {job.metadata && Object.keys(job.metadata).length > 0 && (
                      <details style={{ marginTop: 8 }}>
                        <summary style={{ cursor: "pointer", fontSize: 12, color: "var(--textSecondary)" }}>
                          Metadata
                        </summary>
                        <pre
                          style={{
                            marginTop: 8,
                            padding: 8,
                            background: "var(--surface-2)",
                            borderRadius: 4,
                            fontSize: 11,
                            overflow: "auto",
                            maxHeight: 200,
                          }}
                        >
                          {JSON.stringify(job.metadata, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {!results && !loading && (
        <Card className="admin-section-card">
          <p className="muted" style={{ textAlign: "center", padding: 24 }}>
            Click "Run Health Check" to check system health status
          </p>
        </Card>
      )}
    </div>
  );
}

