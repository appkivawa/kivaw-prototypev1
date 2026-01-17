import React, { useState } from "react";
import { createEcho } from "../../data/echoApi";
import { useSession } from "../../auth/useSession";
import { showToast } from "../ui/Toast";
import LoginModal from "../auth/LoginModal";

type EchoComposerProps = {
  contentId?: string | null;
  onClose: () => void;
  onSaved?: () => void;
  inline?: boolean; // New prop for inline mode
};

export default function EchoComposer({ contentId, onClose, onSaved, inline = false }: EchoComposerProps) {
  const { isAuthed } = useSession();
  const [text, setText] = useState("");
  const [shareToWaves, setShareToWaves] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);

  if (!isAuthed) {
    if (inline) {
      return (
        <>
          <div
            style={{
              padding: "16px",
              borderRadius: "8px",
              backgroundColor: "var(--border)",
              border: "1px solid var(--border-strong)",
            }}
          >
            <p style={{ margin: "0 0 12px 0", fontSize: "14px", color: "var(--ink-muted)" }}>
              Please sign in to create an Echo reflection.
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => setShowLoginModal(true)}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "none",
                  background: "var(--accent-gradient)",
                  color: "#ffffff",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "13px",
                }}
              >
                Sign in
              </button>
              <button
                onClick={onClose}
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid var(--border-strong)",
                  background: "var(--control-bg)",
                  cursor: "pointer",
                  fontWeight: 500,
                  fontSize: "13px",
                }}
              >
                Close
              </button>
            </div>
          </div>
          <LoginModal
            isOpen={showLoginModal}
            onClose={() => setShowLoginModal(false)}
            title="Sign in to Echo"
            message="We'll send you a magic link to sign in."
            pendingAction={contentId ? { type: "echo", contentId, note: text, shareToWaves } : undefined}
          />
        </>
      );
    }
    return (
      <>
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
          }}
        >
          <div
            style={{
              backgroundColor: "var(--surface)",
              borderRadius: "8px",
              padding: "24px",
              maxWidth: "500px",
              width: "90%",
              boxShadow: "var(--shadow)",
            }}
          >
            <h3 style={{ margin: "0 0 12px 0", fontSize: "18px", fontWeight: 600 }}>
              Sign in to Echo
            </h3>
            <p style={{ margin: "0 0 16px 0", fontSize: "14px", color: "var(--ink-muted)" }}>
              Please sign in to create an Echo reflection.
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => setShowLoginModal(true)}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  borderRadius: "6px",
                  border: "none",
                  background: "var(--accent-gradient)",
                  color: "#ffffff",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "14px",
                }}
              >
                Sign in
              </button>
              <button
                onClick={onClose}
                style={{
                  padding: "10px 16px",
                  borderRadius: "6px",
                  border: "1px solid var(--border-strong)",
                  background: "var(--control-bg)",
                  cursor: "pointer",
                  fontWeight: 500,
                  fontSize: "14px",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
        <LoginModal
          isOpen={showLoginModal}
          onClose={() => {
            setShowLoginModal(false);
            onClose();
          }}
          title="Sign in to Echo"
          message="We'll send you a magic link to sign in."
          pendingAction={contentId ? { type: "echo", contentId } : undefined}
        />
      </>
    );
  }

  async function handleSave() {
    if (!text.trim()) {
      setError("Please write your reflection");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await createEcho({
        contentId: contentId ?? null,
        note: text.trim(),
        shareToWaves,
      });
      setText("");
      setShareToWaves(false);
      showToast("Saved to Timeline");
      if (onSaved) onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.message || "Failed to save Echo");
    } finally {
      setSaving(false);
    }
  }

  const content = (
    <div
      style={{
        backgroundColor: inline ? "transparent" : "var(--surface)",
        borderRadius: "8px",
        padding: inline ? "0" : "24px",
        maxWidth: inline ? "100%" : "600px",
        width: "100%",
        maxHeight: inline ? "none" : "80vh",
        overflow: inline ? "visible" : "auto",
        boxShadow: inline ? "none" : "0 4px 12px var(--shadow-black-15)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {!inline && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ margin: 0, fontSize: "20px", fontWeight: 600 }}>Echo</h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "24px",
              cursor: "pointer",
              color: "var(--ink-tertiary)",
              padding: "4px 8px",
            }}
          >
            ×
          </button>
        </div>
      )}

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What are your thoughts?"
          style={{
            width: "100%",
            minHeight: "120px",
            padding: 0,
            borderRadius: 0,
            border: "none",
            borderBottom: "1px solid var(--border)",
            fontSize: "16px",
            lineHeight: 1.7,
            fontFamily: "inherit",
            resize: "vertical",
            marginBottom: "16px",
            backgroundColor: "transparent",
            fontStyle: "italic",
          }}
          autoFocus
        />

        <div style={{ marginBottom: "16px", display: "flex", gap: "16px", alignItems: "center" }}>
          <button
            onClick={() => setShareToWaves(false)}
            style={{
              padding: 0,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: !shareToWaves ? 600 : 400,
              color: !shareToWaves ? "var(--ink)" : "var(--ink-muted)",
              textDecoration: !shareToWaves ? "underline" : "none",
              textUnderlineOffset: "3px",
              transition: "all 0.2s",
            }}
          >
            Private
          </button>
          <span style={{ color: "var(--ink-tertiary)", fontSize: "11px" }}>/</span>
          <button
            onClick={() => setShareToWaves(true)}
            style={{
              padding: 0,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: shareToWaves ? 600 : 400,
              color: shareToWaves ? "var(--ink)" : "var(--ink-muted)",
              textDecoration: shareToWaves ? "underline" : "none",
              textUnderlineOffset: "3px",
              transition: "all 0.2s",
            }}
          >
            Share to Waves
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: "12px",
              borderRadius: "6px",
              backgroundColor: "var(--danger)",
              color: "var(--danger-text)",
              marginBottom: "16px",
              fontSize: "14px",
            }}
          >
            {error}
          </div>
        )}

      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
        {inline && (
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid var(--border-strong)",
              background: "var(--control-bg)",
              cursor: saving ? "not-allowed" : "pointer",
              fontWeight: 500,
              fontSize: "13px",
            }}
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={saving || !text.trim()}
          style={{
            padding: 0,
            borderRadius: 0,
            border: "none",
            background: "transparent",
            color: saving || !text.trim() ? "var(--ink-tertiary)" : "var(--ink)",
            cursor: saving || !text.trim() ? "not-allowed" : "pointer",
            fontWeight: 600,
            fontSize: "13px",
            textDecoration: saving || !text.trim() ? "none" : "underline",
            textUnderlineOffset: "3px",
          }}
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );

  if (inline) {
    return content;
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
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
      {content}
    </div>
  );
}

