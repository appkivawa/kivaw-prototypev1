import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Card from "../ui/Card";
import { useSession } from "./useSession";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthed, loading } = useSession();
  const nav = useNavigate();
  const loc = useLocation();

  if (loading) {
    return (
      <div className="page">
        <div className="center-wrap">
          <div className="quiz-shell" style={{ maxWidth: 560 }}>
            <Card className="quiz-card">
              <div style={{ color: "var(--soft)" }}>Loading…</div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthed) {
    return (
      <div className="page">
        <div className="center-wrap">
          <div className="quiz-shell" style={{ maxWidth: 560 }}>
            <h1 className="quiz-title">Sign in to continue</h1>
            <div className="quiz-subline">
              You can browse as a guest, but saving Echoes requires an account.
            </div>

            <Card className="quiz-card">
              <div style={{ display: "grid", gap: 12 }}>
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={() => nav("/login", { state: { from: loc.pathname } })}
                >
                  Log in
                </button>

                <button className="btn-ghost" type="button" onClick={() => nav("/")}>
                  Back to Home
                </button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
