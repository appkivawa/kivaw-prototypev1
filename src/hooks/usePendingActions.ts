// Hook to process pending actions after login
import { useEffect } from "react";
import { useSession } from "../auth/useSession";
import { getPendingActions, clearPendingAction } from "../utils/pendingActions";
import { supabase } from "../lib/supabaseClient";
import { saveLocal } from "../data/savedLocal";
import { createEcho } from "../data/echoApi";
import { showToast } from "../components/ui/Toast";

async function syncSaveToAccount(contentId: string, shouldSave: boolean) {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) return;
  if (shouldSave) {
    await supabase.from("saved_items").upsert([{ user_id: uid, content_id: contentId }], {
      onConflict: "user_id,content_id",
    });
  } else {
    await supabase.from("saved_items").delete().eq("user_id", uid).eq("content_id", contentId);
  }
}

export function usePendingActions() {
  const { isAuthed, session } = useSession();

  useEffect(() => {
    if (!isAuthed || !session?.user?.id) return;

    // Process pending actions after login
    const pending = getPendingActions();
    if (pending.length === 0) return;

    (async () => {
      for (const action of pending) {
        try {
          if (action.type === "save") {
            // Execute save action
            await syncSaveToAccount(action.contentId, action.shouldSave);
            saveLocal(action.contentId);
            clearPendingAction(action);
            showToast(action.shouldSave ? "Saved!" : "Removed from saved");
          } else if (action.type === "echo") {
            // Execute echo action
            await createEcho({
              contentId: action.contentId,
              note: action.note || "",
              shareToWaves: action.shareToWaves || false,
            });
            clearPendingAction(action);
            showToast("Echo saved!");
          }
        } catch (error) {
          console.error("[usePendingActions] Failed to process action:", error);
          // Don't clear on error - let user retry
        }
      }
    })();
  }, [isAuthed, session]);
}

