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
                  background: "var(--ink)",
                  color: "var(--bg)",
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
            backgroundColor: "rgba(0, 0, 0, 0.5)",
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
                  background: "var(--ink)",
                  color: "var(--bg)",
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
        backgroundColor: inline ? "transparent" : "rgba(255,255,255,0.95)",
        borderRadius: "8px",
        padding: inline ? "0" : "24px",
        maxWidth: inline ? "100%" : "600px",
        width: "100%",
        maxHeight: inline ? "none" : "80vh",
        overflow: inline ? "visible" : "auto",
        boxShadow: inline ? "none" : "0 4px 12px rgba(0,0,0,0.15)",
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
            minHeight: "200px",
            padding: "12px",
            borderRadius: "6px",
            border: "1px solid var(--border-strong)",
            fontSize: "15px",
            lineHeight: 1.6,
            fontFamily: "inherit",
            resize: "vertical",
            marginBottom: "16px",
          }}
          autoFocus
        />

        <div style={{ marginBottom: "16px" }}>
          <div
            style={{
              display: "flex",
              gap: "8px",
              padding: "4px",
              borderRadius: "6px",
              border: "1px solid var(--border-strong)",
              backgroundColor: "var(--border)",
            }}
          >
            <button
              onClick={() => setShareToWaves(false)}
              style={{
                flex: 1,
                padding: "6px 12px",
                borderRadius: "4px",
                border: "none",
                background: !shareToWaves ? "var(--surface)" : "transparent",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: !shareToWaves ? 600 : 500,
                color: "var(--ink-muted)",
                transition: "all 0.2s",
              }}
            >
              Private
            </button>
            <button
              onClick={() => setShareToWaves(true)}
              style={{
                flex: 1,
                padding: "6px 12px",
                borderRadius: "4px",
                border: "none",
                background: shareToWaves ? "var(--surface)" : "transparent",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: shareToWaves ? 600 : 500,
                color: "var(--ink-muted)",
                transition: "all 0.2s",
              }}
            >
              Share to Waves
            </button>
          </div>
          <p style={{ margin: "8px 0 0 0", fontSize: "12px", color: "var(--ink-tertiary)" }}>
            {shareToWaves
              ? "This reflection will appear in the Waves feed"
              : "Only you can see this reflection"}
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: "12px",
              borderRadius: "6px",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              color: "rgba(239, 68, 68, 0.9)",
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
            padding: inline ? "8px 12px" : "10px 16px",
            borderRadius: "6px",
            border: "none",
            background: saving || !text.trim() ? "var(--border-strong)" : "var(--ink)",
            color: saving || !text.trim() ? "var(--ink-tertiary)" : "var(--bg)",
            cursor: saving || !text.trim() ? "not-allowed" : "pointer",
            fontWeight: 600,
            fontSize: inline ? "13px" : "14px",
          }}
        >
          {saving ? "Saving..." : "Save Echo"}
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

