import { useEffect, useState } from "react";
import Card from "../../ui/Card";
import { supabase } from "../../lib/supabaseClient";
import { getUserId } from "../../data/savesApi";
import { logAdminAction } from "../auditLog";

type AdminNote = {
  id: string;
  note_type: "content_item" | "state" | "experiment" | "user";
  target_id: string;
  note_text: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  created_by_email?: string | null;
};

type AdminNotesProps = {
  noteType: "content_item" | "state" | "experiment" | "user";
  targetId: string;
  targetName?: string;
  onClose?: () => void;
};

export default function AdminNotes({ noteType, targetId, targetName, onClose }: AdminNotesProps) {
  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadNotes() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("admin_notes")
        .select("id, note_type, target_id, note_text, created_by, created_at, updated_at")
        .eq("note_type", noteType)
        .eq("target_id", targetId)
        .order("created_at", { ascending: false });

      if (error) {
        if (error.code === "42P01") {
          // Table doesn't exist
          setNotes([]);
          return;
        }
        throw error;
      }

      // Get creator emails
      const creatorIds = [...new Set((data || []).map((n) => n.created_by).filter(Boolean))];
      let creatorEmails: Record<string, string> = {};
      if (creatorIds.length > 0) {
        const { data: creators } = await supabase
          .from("profiles")
          .select("id, email")
          .in("id", creatorIds);

        creators?.forEach((c) => {
          if (c.email) creatorEmails[c.id] = c.email;
        });
      }

      const notesWithEmails = (data || []).map((note) => ({
        ...note,
        created_by_email: note.created_by ? creatorEmails[note.created_by] || null : null,
      }));

      setNotes(notesWithEmails);
    } catch (e: any) {
      console.error("Error loading notes:", e);
    } finally {
      setLoading(false);
    }
  }

  async function addNote() {
    if (!newNote.trim()) return;

    setSaving(true);
    try {
      const userId = await getUserId();
      const { error } = await supabase.from("admin_notes").insert({
        note_type: noteType,
        target_id: targetId,
        note_text: newNote.trim(),
        created_by: userId,
      });

      if (error) throw error;

      await logAdminAction("admin_note_add", targetId, {
        note_type: noteType,
      });

      setNewNote("");
      await loadNotes();
    } catch (e: any) {
      console.error("Error adding note:", e);
      alert("Error: " + (e?.message || "Could not add note."));
    } finally {
      setSaving(false);
    }
  }

  async function deleteNote(noteId: string) {
    if (!confirm("Delete this note?")) return;

    try {
      const { error } = await supabase.from("admin_notes").delete().eq("id", noteId);

      if (error) throw error;

      await logAdminAction("admin_note_delete", targetId, {
        note_type: noteType,
      });

      await loadNotes();
    } catch (e: any) {
      console.error("Error deleting note:", e);
      alert("Error: " + (e?.message || "Could not delete note."));
    }
  }

  useEffect(() => {
    loadNotes();
  }, [noteType, targetId]);

  return (
    <Card className="admin-section-card">
      <div className="admin-section-header">
        <h4 className="admin-subsection-title">
          <span className="admin-section-icon">📝</span>
          Admin Notes {targetName && `- ${targetName}`}
        </h4>
        {onClose && (
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            ✕
          </button>
        )}
      </div>

      {/* Add Note */}
      <div style={{ marginBottom: 16 }}>
        <textarea
          className="admin-filter-input"
          placeholder="Add an internal note..."
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          rows={3}
          style={{ width: "100%", resize: "vertical" }}
        />
        <button
          className="btn"
          type="button"
          onClick={addNote}
          disabled={saving || !newNote.trim()}
          style={{ marginTop: 8 }}
        >
          {saving ? "Saving…" : "➕ Add Note"}
        </button>
      </div>

      {/* Notes List */}
      {loading ? (
        <p className="muted">Loading notes…</p>
      ) : notes.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {notes.map((note) => (
            <div
              key={note.id}
              style={{
                padding: 12,
                background: "var(--white-75)",
                borderRadius: 8,
                border: "1px solid var(--border)",
              }}
            >
              <div style={{ fontSize: 13, color: "var(--text)", marginBottom: 8, lineHeight: 1.5 }}>
                {note.note_text}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 11, color: "var(--text3)" }}>
                  {note.created_by_email || "Admin"} • {new Date(note.created_at).toLocaleString()}
                </div>
                <button
                  className="admin-action-btn"
                  type="button"
                  onClick={() => deleteNote(note.id)}
                  style={{ fontSize: 11, padding: "4px 8px" }}
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="admin-empty-state">
          <div className="admin-empty-state-icon">📝</div>
          <div className="admin-empty-state-title">No Notes</div>
          <div className="admin-empty-state-desc">
            Add internal notes for future reference. These are only visible to admins.
          </div>
        </div>
      )}
    </Card>
  );
}

