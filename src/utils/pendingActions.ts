// Utility to store and resume pending actions after login
// Actions are stored in sessionStorage (cleared on tab close)

type PendingAction = 
  | { type: "save"; contentId: string; shouldSave: boolean }
  | { type: "echo"; contentId: string | null; note?: string; shareToWaves?: boolean };

const STORAGE_KEY = "kivaw_pending_actions";

export function storePendingAction(action: PendingAction): void {
  try {
    const existing = getPendingActions();
    existing.push(action);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch (e) {
    console.warn("[pendingActions] Failed to store action:", e);
  }
}

export function getPendingActions(): PendingAction[] {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as PendingAction[];
  } catch {
    return [];
  }
}

export function clearPendingActions(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function clearPendingAction(action: PendingAction): void {
  try {
    const existing = getPendingActions();
    const filtered = existing.filter((a) => {
      if (a.type !== action.type) return true;
      if (a.type === "save" && action.type === "save") {
        return a.contentId !== action.contentId || a.shouldSave !== action.shouldSave;
      }
      if (a.type === "echo" && action.type === "echo") {
        return a.contentId !== action.contentId;
      }
      return true;
    });
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch {
    // ignore
  }
}

