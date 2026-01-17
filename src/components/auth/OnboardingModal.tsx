// src/components/auth/OnboardingModal.tsx
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { showToast } from "../ui/Toast";
import Button from "../../ui/Button";
import Tag from "../../ui/Tag";
import Card from "../../ui/Card";
import "../../ui/ui.css";

type OnboardingModalProps = {
  isOpen: boolean;
  onComplete: (savedInterests: string[]) => void;
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
      const interestsArray = selectedTags.length > 0 ? selectedTags : [];
      const { error: upsertError } = await supabase
        .from("profiles")
        .upsert(
          {
            id: session.user.id,
            email: session.user.email || null,
            interests: interestsArray, // text[] array
            onboarded: true, // boolean: true when user completes onboarding
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );

      if (upsertError) {
        console.error("Error upserting profile:", upsertError);
        throw upsertError;
      }

      // Verification read: ensure the values we saved match what's in the database
      const { data: verifyData, error: verifyError } = await supabase
        .from("profiles")
        .select("interests, onboarded")
        .eq("id", session.user.id)
        .single();

      if (verifyError) {
        // If read fails due to RLS, it's a security/permission issue
        if (verifyError.code === "42501" || verifyError.message?.includes("permission") || verifyError.message?.includes("RLS")) {
          throw new Error(
            "Could not verify saved preferences due to permission restrictions. " +
            "Please refresh the page and try again, or contact support if this persists."
          );
        }
        console.error("Error verifying profile save:", verifyError);
        throw new Error("Failed to verify saved preferences. Please try again.");
      }

      // Verify the saved values match what we tried to save
      if (!verifyData) {
        throw new Error("Profile not found after save. Please refresh and try again.");
      }

      const savedInterests = Array.isArray(verifyData.interests) ? verifyData.interests : [];
      const savedOnboarded = verifyData.onboarded === true;

      // Check if interests match (compare arrays)
      const interestsMatch = 
        savedInterests.length === interestsArray.length &&
        savedInterests.every((tag) => interestsArray.includes(tag));

      if (!savedOnboarded || !interestsMatch) {
        console.warn("Saved values don't match expected:", {
          expected: { interests: interestsArray, onboarded: true },
          actual: { interests: savedInterests, onboarded: savedOnboarded },
        });
        throw new Error(
          "Preferences saved but verification failed. Please refresh and try again, " +
          "or contact support if this persists."
        );
      }

      showToast(initialInterests.length > 0 ? "Interests updated!" : "Welcome to Kivaw!");
      // Call onComplete with saved interests to update local state immediately
      onComplete(interestsArray);
    } catch (e: any) {
      console.error("Error saving onboarding:", e);
      showToast(e?.message || "Failed to save preferences");
      // Keep modal open on error so user can retry
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="onboarding-modal-overlay">
      <Card className="onboarding-modal-content" variant="elevated">
        <div className="onboarding-modal-header">
          <h2 className="onboarding-modal-title">
            {initialInterests.length > 0 ? "Edit Interests" : "Welcome to Kivaw!"}
          </h2>
          {onClose && (
            <button 
              onClick={onClose} 
              className="onboarding-modal-close" 
              aria-label="Close" 
              type="button"
            >
              ×
            </button>
          )}
        </div>
        
        <p className="onboarding-modal-subtitle">
          Select your interests to personalize your experience
        </p>

        <div className="onboarding-modal-tags">
          {INTEREST_TAGS.map((tag) => (
            <Tag
              key={tag}
              label={tag}
              selected={selectedTags.includes(tag)}
              onClick={() => toggleTag(tag)}
            />
          ))}
        </div>

        <div className="onboarding-modal-footer">
          {onClose && (
            <Button onClick={onClose} variant="secondary" type="button" size="md">
              Cancel
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={saving || selectedTags.length === 0}
            variant="primary"
            fullWidth={!onClose}
            type="button"
            size="md"
          >
            {saving ? "Saving…" : initialInterests.length > 0 ? "Save" : "Continue"}
          </Button>
        </div>

        <p className="onboarding-modal-note">
          You can change these later in your preferences
        </p>
      </Card>
    </div>
  );
}

