import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../ui/Card";
import { supabase } from "../lib/supabaseClient";

type Stats = { users: number; saves: number; echoes: number; waves: number };

export default function Admin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [userId, setUserId] = useState<string>("");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setErr("");
        setLoading(true);

        const { data: sessData, error: sessErr } = await supabase.auth.getSession();
        if (sessErr) throw sessErr;

        const session = sessData.session;

        if (!session) {
          navigate("/login", { state: { from: "/admin" }, replace: true });
          return;
        }

        const uid = session.user?.id || "";
        const token = session.access_token || "";

        if (!uid || !token) {
          setErr("Session exists but token/user missing. Sign out and sign back in.");
          return;
        }

        if (!alive) return;
        setUserId(uid);

        const { data, error } = await supabase.functions.invoke("admin-stats", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!alive) return;

        if (error) {
          setErr(error.message || "Admin stats request failed.");
        } else if ((data as any)?.error) {
          setErr((data as any).error);
        } else {
          setStats(((data as any)?.stats || null) as Stats | null);
        }
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Admin load failed.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [navigate]);

  async function hardResetAuth() {
    await supabase.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = "/admin";
  }

  return (
    <div className="page">
      <div className="center-wrap">
        <Card className="center card-pad">
          <h1 className="h1">Admin</h1>
          <p className="kivaw-sub">Private dashboard.</p>

          <div style={{ height: 10 }} />

          {/* ✅ Always show who you are (so we can match admin_users) */}
          {userId ? (
            <div className="muted" style={{ fontSize: 12 }}>
              Signed in as: <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{userId}</span>
            </div>
          ) : null}

          <div style={{ height: 12 }} />

          {loading ? (
            <p className="muted">Loading…</p>
          ) : err ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div className="echo-alert">{err}</div>

              <button className="btn" type="button" onClick={() => window.location.reload()}>
                Retry
              </button>

              <button className="btn btn-ghost" type="button" onClick={hardResetAuth}>
                Sign out + reset auth
              </button>

              <button className="btn btn-ghost" type="button" onClick={() => navigate("/")}>
                Go home →
              </button>
            </div>
          ) : stats ? (
            <div className="kivaw-rec-grid">
              <div className="kivaw-rec-card kivaw-rec-row">
                <div className="kivaw-rec-icon">👥</div>
                <div className="kivaw-rec-content">
                  <div className="kivaw-rec-card__title">{stats.users}</div>
                  <div className="kivaw-rec-card__by muted">Users</div>
                </div>
              </div>

              <div className="kivaw-rec-card kivaw-rec-row">
                <div className="kivaw-rec-icon">♥</div>
                <div className="kivaw-rec-content">
                  <div className="kivaw-rec-card__title">{stats.saves}</div>
                  <div className="kivaw-rec-card__by muted">Saves</div>
                </div>
              </div>

              <div className="kivaw-rec-card kivaw-rec-row">
                <div className="kivaw-rec-icon">🫧</div>
                <div className="kivaw-rec-content">
                  <div className="kivaw-rec-card__title">{stats.echoes}</div>
                  <div className="kivaw-rec-card__by muted">Echoes</div>
                </div>
              </div>

              <div className="kivaw-rec-card kivaw-rec-row">
                <div className="kivaw-rec-icon">🌊</div>
                <div className="kivaw-rec-content">
                  <div className="kivaw-rec-card__title">{stats.waves}</div>
                  <div className="kivaw-rec-card__by muted">Waves</div>
                </div>
              </div>
            </div>
          ) : (
            <p className="muted">No stats yet.</p>
          )}
        </Card>
      </div>
    </div>
  );
}





