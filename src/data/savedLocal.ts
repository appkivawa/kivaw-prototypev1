// src/data/savedLocal.ts
type LocalSavedItem = {
  id: string;
  ts: number;
};

const KEY = "kivaw_saved_v1";

function safeRead(): LocalSavedItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x) => ({
        id: String(x?.id ?? ""),
        ts: typeof x?.ts === "number" ? x.ts : Date.now(),
      }))
      .filter((x) => x.id);
  } catch {
    return [];
  }
}

function safeWrite(items: LocalSavedItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

export function getLocalSaved(): LocalSavedItem[] {
  // newest-first
  return safeRead().sort((a, b) => b.ts - a.ts);
}

export function getLocalSavedIds(): string[] {
  return getLocalSaved().map((x) => x.id);
}

export function isLocallySaved(id: string): boolean {
  return getLocalSavedIds().includes(id);
}

export function saveLocal(id: string) {
  const items = safeRead();
  const filtered = items.filter((x) => x.id !== id);
  safeWrite([{ id, ts: Date.now() }, ...filtered]);
}

export function unsaveLocal(id: string) {
  const items = safeRead().filter((x) => x.id !== id);
  safeWrite(items);
}

export function clearLocalSaved() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

