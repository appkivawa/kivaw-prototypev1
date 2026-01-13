// src/components/auth/OnboardingModal.tsx
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { showToast } from "../ui/Toast";

type OnboardingModalProps = {
  isOpen: boolean;
  onComplete: () => void;
  onClose?: () => void;
  initialInterests?: string[];
};

// Predefined interest tags
const INTEREST_TAGS = [
  "Movies",
  "TV Shows",
  "Books",
  "Podcasts",
  "Music",
  "Art",
  "Technology",
  "Science",
  "Philosophy",
  "History",
  "Travel",
  "Food",
  "Fitness",
  "Gaming",
  "Design",
  "Writing",
  "Photography",
  "Business",
  "Psychology",
  "Nature",
];

export default function OnboardingModal({
  isOpen,
  onComplete,
  onClose,
  initialInterests = [],
}: OnboardingModalProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>(initialInterests);
  const [saving, setSaving] = useState(false);

  // Update selectedTags when initialInterests changes
  useEffect(() => {
    if (isOpen && initialInterests.length > 0) {
      setSelectedTags(initialInterests);
    }
  }, [isOpen, initialInterests]);

  if (!isOpen) return null;

  function toggleTag(tag: string) {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  async function handleSave() {
    if (saving) return;

    setSaving(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        throw new Error("Not authenticated");
      }

      // Upsert profile with interests and set onboarded=true
      // Use upsert to handle case where profile might not exist yet
      // Ensure interests is a proper array (text[]) and onboarded is boolean
      const { error } = await supabase
        .from("profiles")
        .upsert(
          {
            id: session.user.id,
            email: session.user.email || null,
            interests: selectedTags.length > 0 ? selectedTags : [], // Ensure it's always an array
            onboarded: true, // Set to true when user completes onboarding
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );

      if (error) throw error;

      showToast(initialInterests.length > 0 ? "Interests updated!" : "Welcome to Kivaw!");
      onComplete();
    } catch (e: any) {
      console.error("Error saving onboarding:", e);
      showToast(e?.message || "Failed to save preferences");
    } finally {
      setSaving(false);
    }
  }

  return (
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
        zIndex: 1001,
        padding: "20px",
      }}
    >
      <div
        style={{
          backgroundColor: "var(--surface)",
          borderRadius: "12px",
          padding: "32px",
          maxWidth: "600px",
          width: "100%",
          maxHeight: "80vh",
          overflowY: "auto",
          boxShadow: "var(--shadow)",
          border: "1px solid var(--border-strong)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <h2
            style={{
              fontSize: "28px",
              fontWeight: 600,
              margin: 0,
              color: "var(--ink)",
            }}
          >
            {initialInterests.length > 0 ? "Edit Interests" : "Welcome to Kivaw!"}
          </h2>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                fontSize: "24px",
                color: "var(--ink-muted)",
                cursor: "pointer",
                padding: "4px 8px",
                lineHeight: 1,
              }}
              aria-label="Close"
            >
              ×
            </button>
          )}
        </div>
        <p
          style={{
            fontSize: "16px",
            color: "var(--ink-muted)",
            margin: "0 0 32px",
            textAlign: "center",
          }}
        >
          Select your interests to personalize your experience
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            marginBottom: "32px",
          }}
        >
          {INTEREST_TAGS.map((tag) => {
            const isSelected = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "20px",
                  border: `1px solid ${isSelected ? "var(--ink)" : "var(--border-strong)"}`,
                  background: isSelected ? "var(--ink)" : "var(--control-bg)",
                  color: isSelected ? "var(--bg)" : "var(--ink-muted)",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: isSelected ? 600 : 400,
                  transition: "all 0.2s",
                }}
              >
                {tag}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: "12px" }}>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                padding: "12px 16px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--control-bg)",
                color: "var(--ink)",
                cursor: "pointer",
                fontWeight: 500,
                fontSize: "14px",
              }}
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || selectedTags.length === 0}
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: "8px",
              border: "none",
              background: saving || selectedTags.length === 0 ? "var(--border-strong)" : "var(--ink)",
              color: saving || selectedTags.length === 0 ? "var(--ink-tertiary)" : "var(--bg)",
              cursor: saving || selectedTags.length === 0 ? "not-allowed" : "pointer",
              fontWeight: 600,
              fontSize: "14px",
            }}
          >
            {saving ? "Saving…" : initialInterests.length > 0 ? "Save" : "Continue"}
          </button>
        </div>

        <p
          style={{
            fontSize: "13px",
            color: "var(--ink-tertiary)",
            margin: "16px 0 0",
            textAlign: "center",
          }}
        >
          You can change these later in your preferences
        </p>
      </div>
    </div>
  );
}

