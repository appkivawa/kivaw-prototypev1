export type SoftAction = "match" | "pass" | "save";

export type SoftMatchEvent = {
  itemId: string;
  action: SoftAction;
  ts: number;
  mood?: string;
  intent?: string;
  energy?: number;
};

const KEY = "kivaw_session_actions_v1";

export function readSoftQueue(): SoftMatchEvent[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SoftMatchEvent[]) : [];
  } catch {
    return [];
  }
}

export function writeSoftQueue(events: SoftMatchEvent[]) {
  localStorage.setItem(KEY, JSON.stringify(events));
}

export function enqueueSoftAction(evt: SoftMatchEvent) {
  const q = readSoftQueue();
  // avoid spamming duplicates in a single session: keep latest action per item
  const filtered = q.filter((e) => e.itemId !== evt.itemId);
  filtered.push(evt);
  writeSoftQueue(filtered);
}

export function clearSoftQueue() {
  localStorage.removeItem(KEY);
}
