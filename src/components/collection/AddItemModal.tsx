// src/components/collection/AddItemModal.tsx
// Modal for adding new items to collection

import React, { useState } from "react";
import { saveItem } from "../../data/savesApi";
import { showToast } from "../ui/Toast";

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
      showToast("Title is required", "error");
      return;
    }

    setLoading(true);
    try {
      // For now, we'll create a placeholder item
      // In a real implementation, this would:
      // 1. Fetch metadata from URL if provided
      // 2. Create a content_item in the database
      // 3. Save it to saved_items
      
      // Since we don't have a content_item ID yet, we'll show a message
      showToast("Add item functionality coming soon. Use the Save button on items in your feed.", "info");
      onClose();
      setUrl("");
      setTitle("");
    } catch (error: any) {
      showToast(error?.message || "Failed to add item", "error");
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
