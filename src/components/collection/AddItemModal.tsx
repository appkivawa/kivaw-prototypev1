// src/components/collection/AddItemModal.tsx
// Modal for adding new items to collection

import React, { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { saveLocal } from "../../data/savedLocal";
import { showToast } from "../ui/Toast";

// Generate unique ID for manual items
function generateId(): string {
  return `manual_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onItemAdded: () => void;
}

export default function AddItemModal({ isOpen, onClose, onItemAdded }: AddItemModalProps) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      showToast("Title is required");
      return;
    }

    setLoading(true);
    try {
      // Get user ID if logged in
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;

      if (userId) {
        // For logged-in users, try to create a content_item first, then save it
        // Generate a unique external_id
        const externalId = generateId();
        
        // Try to insert into content_items (may fail due to RLS, that's ok)
        const { data: contentItem, error: contentError } = await supabase
          .from("content_items")
          .insert({
            external_id: externalId,
            kind: "manual",
            title: title.trim(),
            byline: null,
            meta: url ? { url } : null,
            image_url: null,
            url: url || null,
            source: "manual",
            state_tags: [],
            focus_tags: [],
            usage_tags: [],
          })
          .select("id")
          .single();

        if (contentItem?.id) {
          // Successfully created content_item, now save it
          const { error: saveError } = await supabase
            .from("saves_v2")
            .insert({
              user_id: userId,
              content_item_id: contentItem.id,
            });

          if (saveError) {
            console.warn("Failed to save item:", saveError);
            showToast("Item created but couldn't be saved. Please try again.");
            return;
          }
        } else if (contentError) {
          // If content_items insert fails (RLS), save to saved_items with metadata
          const { error: savedError } = await supabase
            .from("saved_items")
            .insert({
              user_id: userId,
              content_id: externalId, // Use external_id as content_id
              metadata: {
                title: title.trim(),
                url: url || null,
                source: "manual",
                kind: "manual",
                created_at: new Date().toISOString(),
              },
            });

          if (savedError) {
            console.error("Failed to save item:", savedError);
            showToast("Failed to add item. Please try again.");
            return;
          }
        }
      } else {
        // For non-logged-in users, save to local storage
        const itemId = generateId();
        saveLocal(itemId);
        
        // Also store item details in a separate local storage key
        try {
          const manualItemsKey = "kivaw_manual_items_v1";
          const existing = JSON.parse(localStorage.getItem(manualItemsKey) || "[]");
          existing.push({
            id: itemId,
            title: title.trim(),
            url: url || null,
            source: "manual",
            kind: "manual",
            created_at: new Date().toISOString(),
          });
          localStorage.setItem(manualItemsKey, JSON.stringify(existing));
        } catch (e) {
          console.warn("Failed to store manual item details:", e);
        }
      }

      showToast("Item added to your collection");
      onClose();
      setUrl("");
      setTitle("");
      onItemAdded(); // Refresh the collection list
    } catch (error: any) {
      console.error("Error adding item:", error);
      showToast(error?.message || "Failed to add item");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.4)",
          backdropFilter: "blur(4px)",
          zIndex: 1000,
        }}
        onClick={onClose}
      />
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          background: "var(--studio-white)",
          borderRadius: "12px",
          padding: "32px",
          maxWidth: "500px",
          width: "90%",
          zIndex: 1001,
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            fontSize: "24px",
            fontWeight: 700,
            color: "var(--studio-text)",
            marginBottom: "24px",
          }}
        >
          Add Item
        </h2>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "20px" }}>
            <label
              style={{
                display: "block",
                fontSize: "14px",
                fontWeight: 500,
                color: "var(--studio-text)",
                marginBottom: "8px",
              }}
            >
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter item title"
              required
              style={{
                width: "100%",
                padding: "12px 16px",
                fontSize: "15px",
                border: "1px solid var(--studio-border)",
                borderRadius: "8px",
                background: "var(--studio-white)",
                color: "var(--studio-text)",
                fontFamily: "inherit",
              }}
            />
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label
              style={{
                display: "block",
                fontSize: "14px",
                fontWeight: 500,
                color: "var(--studio-text)",
                marginBottom: "8px",
              }}
            >
              URL (optional)
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              style={{
                width: "100%",
                padding: "12px 16px",
                fontSize: "15px",
                border: "1px solid var(--studio-border)",
                borderRadius: "8px",
                background: "var(--studio-white)",
                color: "var(--studio-text)",
                fontFamily: "inherit",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "12px 24px",
                borderRadius: "8px",
                border: "1px solid var(--studio-border)",
                background: "var(--studio-white)",
                color: "var(--studio-text)",
                fontSize: "14px",
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "12px 24px",
                borderRadius: "8px",
                border: "none",
                background: "var(--studio-coral)",
                color: "white",
                fontSize: "14px",
                fontWeight: 500,
                cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "Adding..." : "Add Item"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
