// src/components/auth/LoginModal.tsx
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { isValidEmail } from "../../utils/security";

type LoginModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  title?: string;
  message?: string;
  pendingAction?: { type: "save" | "echo"; contentId: string | null; [key: string]: unknown };
};

export default function LoginModal({
  isOpen,
  onClose,
  onSuccess,
  title = "Sign in to continue",
  message = "We'll send you a magic link to sign in.",
  pendingAction,
}: LoginModalProps) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setEmail("");
      setSent(false);
      setErr("");
    }
  }, [isOpen]);

  async function sendLink() {
    setErr("");
    const clean = email.trim();
    if (!clean) return setErr("Add your email first.");
    if (!isValidEmail(clean)) return setErr("Please enter a valid email address.");

    setBusy(true);
    try {
      // Use current page as redirect target
      const currentPath = window.location.pathname + window.location.search;
      // Store pending action if provided
      if (pendingAction) {
        const { storePendingAction } = await import("../../utils/pendingActions");
        storePendingAction(pendingAction as any);
      }
      const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(currentPath)}`;

      const { error } = await supabase.auth.signInWithOtp({
        email: clean,
        options: { emailRedirectTo },
      });

      if (error) throw error;
      setSent(true);
    } catch (e: any) {
      setErr(e?.message || "Could not send magic link.");
    } finally {
      setBusy(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "var(--overlay)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: "var(--surface)",
          borderRadius: "12px",
          padding: "32px",
          maxWidth: "480px",
          width: "100%",
          boxShadow: "var(--shadow)",
          border: "1px solid var(--border-strong)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {err ? (
          <div
            style={{
              padding: "12px 16px",
              background: "var(--danger)",
              border: "1px solid var(--danger-border)",
              borderRadius: "8px",
              color: "var(--ink)",
              marginBottom: "24px",
              fontSize: "14px",
            }}
          >
            {err}
          </div>
        ) : null}

        {!sent ? (
          <>
            <h2
              style={{
                fontSize: "24px",
                fontWeight: 600,
                margin: "0 0 8px",
                color: "var(--ink)",
                textAlign: "center",
              }}
            >
              {title}
            </h2>
            <p
              style={{
                fontSize: "15px",
                color: "var(--ink-muted)",
                margin: "0 0 24px",
                textAlign: "center",
              }}
            >
              {message}
            </p>

            <div style={{ marginBottom: "16px" }}>
              <input
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  background: "var(--control-bg)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: "8px",
                  color: "var(--ink)",
                  fontSize: "16px",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                type="email"
                onKeyDown={(e) => e.key === "Enter" && !busy && sendLink()}
                autoFocus
              />
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={onClose}
                disabled={busy}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-strong)",
                  background: "var(--control-bg)",
                  color: "var(--ink-muted)",
                  cursor: busy ? "not-allowed" : "pointer",
                  fontWeight: 500,
                  fontSize: "14px",
                }}
              >
                Cancel
              </button>
              <button
                onClick={sendLink}
                disabled={busy}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  borderRadius: "8px",
                  border: "none",
                  background: busy ? "var(--border-strong)" : "var(--accent-gradient)",
                  color: busy ? "var(--text-muted)" : "#ffffff",
                  cursor: busy ? "not-allowed" : "pointer",
                  fontWeight: 600,
                  fontSize: "14px",
                }}
              >
                {busy ? "Sending…" : "Send magic link"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              <h2
                style={{
                  fontSize: "24px",
                  fontWeight: 600,
                  margin: "0 0 8px",
                  color: "var(--ink)",
                }}
              >
                Check your email
              </h2>
              <p
                style={{
                  fontSize: "15px",
                  color: "var(--ink-muted)",
                  margin: 0,
                }}
              >
                We sent a magic link to{" "}
                <strong style={{ color: "var(--ink)" }}>{email}</strong>. Click it to sign in.
              </p>
            </div>

            <button
              onClick={() => {
                setSent(false);
                setEmail("");
              }}
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: "8px",
                border: "1px solid var(--border-strong)",
                background: "var(--control-bg)",
                color: "var(--ink-muted)",
                cursor: "pointer",
                fontWeight: 500,
                fontSize: "14px",
              }}
            >
              Use a different email
            </button>
          </>
        )}
      </div>
    </div>
  );
}

