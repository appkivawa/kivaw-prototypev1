import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase, SUPABASE_URL } from "../lib/supabaseClient";
import { saveLocal, unsaveLocal, isLocallySaved } from "../data/savedLocal";

// ============================================================
// Types
// ============================================================
type FeedCard = {
  id: string;
  kind: "movie" | "book" | "podcast" | "music" | "creator" | "event" | "other";
  title: string;
  byline?: string | null;
  meta?: string | null;
  image_url?: string | null;
  url?: string | null;
  source: string;
  tags?: string[] | null;

  // legacy optional fields (server may still send these)
  headline?: string | null;
  story?: string | null;
  prompts?: string[] | null;
  opener?: string | null;
  bio?: string | null;
  blurb?: string | null;
};

type FeedResponse = { feed: FeedCard[]; debug?: Record<string, unknown> };
type SwipeDir = "left" | "right";
type Tone = "playful" | "mysterious" | "cozy";
type SwipeAction = { id: string; kind: string; ts: number };
type Mode = "swipe" | "browse";
type KindFilter = "all" | FeedCard["kind"];

// ============================================================
// Helpers
// ============================================================
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function cleanText(s?: string | null) {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

function dedupeById(items: FeedCard[]) {
  const seen = new Set<string>();
  return items.filter((x) => {
    if (!x?.id) return false;
    if (seen.has(x.id)) return false;
    seen.add(x.id);
    return true;
  });
}

function getSessionTone(): Tone {
  const stored = sessionStorage.getItem("kivaw_tone_v1");
  if (stored === "playful" || stored === "mysterious" || stored === "cozy") return stored;
  const tones: Tone[] = ["playful", "mysterious", "cozy"];
  const tone = tones[Math.floor(Math.random() * tones.length)];
  sessionStorage.setItem("kivaw_tone_v1", tone);
  return tone;
}

function getLocalStorageActions(key: string): SwipeAction[] {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function saveLocalStorageAction(key: string, action: SwipeAction) {
  try {
    const existing = getLocalStorageActions(key);
    const filtered = existing.filter((a) => a.id !== action.id);
    localStorage.setItem(key, JSON.stringify([...filtered, action]));
  } catch {
    // ignore
  }
}

function clearLocalStorageActions(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function getMatchCount(): number {
  return getLocalStorageActions("kivaw_matches_v1").length;
}
function getPassCount(): number {
  return getLocalStorageActions("kivaw_passes_v1").length;
}

function kindEmoji(kind: string) {
  switch (kind) {
    case "movie":
      return "🎬";
    case "book":
      return "📚";
    case "podcast":
      return "🎧";
    case "music":
      return "🎵";
    case "creator":
      return "🧑‍🎨";
    case "event":
      return "📍";
    default:
      return "✨";
  }
}

function kindLabel(kind: string) {
  switch (kind) {
    case "movie":
      return "Movie";
    case "book":
      return "Book";
    case "podcast":
      return "Podcast";
    case "music":
      return "Music";
    case "creator":
      return "Creator";
    case "event":
      return "Event";
    default:
      return "Pick";
  }
}

function formatMeta(kind: string, meta?: string | null) {
  const m = cleanText(meta);
  if (!m) return null;

  // keep book published formatting if it already comes like that
  if (kind === "book") {
    if (/^published\s*:/i.test(m)) return m;
    if (/^\d{4}$/.test(m)) return `Published: ${m}`;
  }
  return m;
}

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function matchesQuery(card: FeedCard, q: string) {
  if (!q) return true;
  const query = q.toLowerCase();
  const hay = [
    card.title,
    card.byline,
    card.meta,
    ...(card.tags ?? []),
    card.source,
    card.kind,
    card.blurb,
    card.bio,
    card.story,
    card.opener,
    card.headline,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return hay.includes(query);
}

function getTextBlob(c: FeedCard): string {
  return [
    c.title,
    c.byline,
    c.meta,
    c.source,
    c.kind,
    ...(c.tags ?? []),
    c.blurb,
    c.bio,
    c.story,
    c.opener,
    c.headline,
  ]
    .filter(Boolean)
    .map((x) => String(x))
    .join(" ")
    .toLowerCase();
}

function hasAny(text: string, keywords: string[]) {
  return keywords.some((k) => text.includes(k));
}

function topNStrings(arr: string[], n: number) {
  const counts = new Map<string, number>();
  for (const a of arr) {
    const v = cleanText(a).toLowerCase();
    if (!v || v.length < 3) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).map((x) => x[0]);
  return sorted.slice(0, n);
}

// ============================================================
// ✅ AUTH TOKEN RETRY (Fix B)
// ============================================================
async function getAccessTokenWithRetry(opts?: { tries?: number; delayMs?: number }) {
  const tries = opts?.tries ?? 10;
  const delayMs = opts?.delayMs ?? 120;

  for (let i = 0; i < tries; i++) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) return token;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

// ============================================================
// Optional server reset (safe/no-op if you don’t have the table)
// ============================================================
async function clearServerHistory() {
  try {
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user) return { ok: false as const, reason: "guest" as const };

    const { error } = await supabase.from("user_events").delete().eq("user_id", user.id);
    if (error) return { ok: false as const, reason: "error" as const, error };
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, reason: "error" as const, error: e };
  }
}

// ============================================================
// Saved sync helpers (Option B local-first)
// ============================================================
async function getUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function syncSaveToAccount(contentId: string, shouldSave: boolean) {
  const uid = await getUserId();
  if (!uid) return;

  if (shouldSave) {
    await supabase.from("saved_items").upsert([{ user_id: uid, content_id: contentId }], {
      onConflict: "user_id,content_id",
    });
  } else {
    await supabase.from("saved_items").delete().eq("user_id", uid).eq("content_id", contentId);
  }
}

// ============================================================
// Shelves
// ============================================================
type Shelf = {
  id: string;
  title: string;
  subtitle?: string;
  emoji?: string;
  predicate: (c: FeedCard) => boolean;
  limit?: number;
};

function buildShelves(args: { kindFilter: KindFilter; likedSignals: string[] }): Shelf[] {
  const { kindFilter, likedSignals } = args;

  const kindGate = (c: FeedCard) => (kindFilter === "all" ? true : c.kind === kindFilter);

  const kw = {
    thriller: ["thriller", "mystery", "crime", "detective", "suspense", "noir", "serial", "killer"],
    romance: ["romance", "love", "dating", "relationship", "heartbreak", "marriage", "affair"],
    fantasy: ["fantasy", "magic", "myth", "dragon", "witch", "sorcery", "fae"],
    scifi: ["science fiction", "sci-fi", "sci fi", "space", "dystopia", "future", "android", "alien"],
    horror: ["horror", "ghost", "haunted", "vampire", "zombie", "demon", "creepy", "terrifying"],
    cozy: ["cozy", "comfort", "feel-good", "feel good", "slice of life", "warm", "healing"],
    weird: ["surreal", "absurd", "weird", "strange", "experimental", "dark comedy", "offbeat"],
    anime: ["anime", "manga", "light novel", "isekai", "shonen", "shojo", "manhwa", "webtoon"],
  };

  const because = (c: FeedCard) => {
    if (!kindGate(c)) return false;
    if (!likedSignals.length) return false;
    const blob = getTextBlob(c);
    return likedSignals.some((s) => blob.includes(s));
  };

  return [
    {
      id: "tonight",
      emoji: "🌙",
      title: "Tonight’s picks",
      subtitle: "Fast, interesting, and not a homework assignment.",
      predicate: (c) => kindGate(c),
      limit: 14,
    },
    {
      id: "because",
      emoji: "🧠",
      title: likedSignals.length ? `Because you liked “${likedSignals[0]}”` : "Because you liked…",
      subtitle: likedSignals.length ? "Your taste is starting to show 👀" : "Like a few things first, then I’ll personalize.",
      predicate: because,
      limit: 14,
    },
    {
      id: "thriller",
      emoji: "🕵️",
      title: "Mystery & thrill",
      subtitle: "Side-eye energy only.",
      predicate: (c) => kindGate(c) && hasAny(getTextBlob(c), kw.thriller),
      limit: 14,
    },
    {
      id: "romance",
      emoji: "💌",
      title: "Romance",
      subtitle: "Feelings. Unfortunately.",
      predicate: (c) => kindGate(c) && hasAny(getTextBlob(c), kw.romance),
      limit: 14,
    },
    {
      id: "fantasy_scifi",
      emoji: "✨",
      title: "Fantasy & sci-fi",
      subtitle: "Reality is optional here.",
      predicate: (c) => kindGate(c) && (hasAny(getTextBlob(c), kw.fantasy) || hasAny(getTextBlob(c), kw.scifi)),
      limit: 14,
    },
    {
      id: "cozy",
      emoji: "☕",
      title: "Cozy / comfort",
      subtitle: "Soft landings only.",
      predicate: (c) => kindGate(c) && hasAny(getTextBlob(c), kw.cozy),
      limit: 14,
    },
    {
      id: "horror",
      emoji: "🩸",
      title: "Horror",
      subtitle: "Sleep is a privilege.",
      predicate: (c) => kindGate(c) && hasAny(getTextBlob(c), kw.horror),
      limit: 14,
    },
    {
      id: "weird",
      emoji: "🌀",
      title: "Weird & offbeat",
      subtitle: "For when you want ‘what did I just watch/read?’",
      predicate: (c) => kindGate(c) && hasAny(getTextBlob(c), kw.weird),
      limit: 14,
    },
  ];
}

// ============================================================
// UI atoms
// ============================================================
function PillButton(props: { active?: boolean; children: React.ReactNode; onClick: () => void; title?: string }) {
  return (
    <button
      type="button"
      title={props.title}
      onClick={props.onClick}
      style={{
        fontSize: 12,
        fontWeight: 800,
        padding: "8px 12px",
        borderRadius: 999,
        border: "1px solid rgba(0,0,0,0.10)",
        cursor: "pointer",
        background: props.active ? "rgba(0,0,0,0.86)" : "rgba(255,255,255,0.75)",
        color: props.active ? "white" : "rgba(0,0,0,0.76)",
        boxShadow: props.active ? "0 10px 24px rgba(0,0,0,0.14)" : "none",
      }}
    >
      {props.children}
    </button>
  );
}

function SmallStat(props: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: "8px 10px",
        borderRadius: 14,
        border: "1px solid rgba(0,0,0,0.08)",
        background: "rgba(255,255,255,0.65)",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 900, opacity: 0.55, letterSpacing: "0.6px" }}>{props.label}</div>
      <div style={{ fontSize: 14, fontWeight: 950, marginTop: 2 }}>{props.value}</div>
    </div>
  );
}

function ImageFrame(props: { title: string; kind: string; imageUrl?: string | null }) {
  // One size fits all. Cohesion over “but book covers are skinny 🥺”
  return (
    <div
      style={{
        height: 160,
        background: "rgba(0,0,0,0.06)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {props.imageUrl ? (
        <img
          src={props.imageUrl}
          alt={props.title}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <div style={{ height: "100%", display: "grid", placeItems: "center", fontSize: 34 }}>
          {kindEmoji(props.kind)}
        </div>
      )}

      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          fontSize: 10,
          fontWeight: 950,
          padding: "4px 8px",
          borderRadius: 999,
          background: "rgba(255,255,255,0.72)",
          border: "1px solid rgba(0,0,0,0.12)",
          color: "rgba(0,0,0,0.72)",
          backdropFilter: "blur(4px)",
          display: "flex",
          gap: 6,
          alignItems: "center",
        }}
      >
        <span>{kindEmoji(props.kind)}</span>
        <span>{kindLabel(props.kind)}</span>
      </div>
    </div>
  );
}

// ============================================================
// Component
// ============================================================
export default function Explore() {
  const [cards, setCards] = useState<FeedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [mode, setMode] = useState<Mode>("browse");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [query, setQuery] = useState("");

  const [cursor, setCursor] = useState(0);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animDir, setAnimDir] = useState<SwipeDir>("right");

  const [tone] = useState<Tone>(getSessionTone());
  const [matchCount, setMatchCount] = useState(getMatchCount());
  const [passCount, setPassCount] = useState(getPassCount());

  const [resetting, setResetting] = useState(false);

  const safeMode = false;
  const loadingRef = useRef(false);

  async function loadFeed(opts?: { shuffleOnLoad?: boolean }) {
    if (loadingRef.current) return;
    loadingRef.current = true;

    setLoading(true);
    setErr("");

    try {
      // Try to get auth token, but don't require it (feed function should work without auth)
      let token: string | null = null;
      try {
        token = await getAccessTokenWithRetry({ tries: 2, delayMs: 50 });
      } catch {
        // No session available - that's ok for the feed function
        token = null;
      }

      // Prepare headers - include auth if available, but don't require it
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const { data, error } = await supabase.functions.invoke<FeedResponse>("feed", {
        method: "POST",
        headers,
        body: { tone, safeMode },
      });

      if (error) {
        // Log full error details for debugging
        console.error("[Explore] Edge Function error:", error);
        
        // Handle 401 specifically - auth might be required
        const statusCode = (error as any).status || (error as any).code;
        if (statusCode === 401 || (error as any).message?.includes("401")) {
          throw new Error(
            "Authentication required. The feed function may need to be deployed with --no-verify-jwt flag to allow anonymous access. " +
            "Please try signing in, or contact support if this persists."
          );
        }
        
        const errorMsg = error.message || "Failed to load feed";
        // Include status code if available
        const statusMsg = statusCode ? ` (Status: ${statusCode})` : "";
        throw new Error(`${errorMsg}${statusMsg}. Check console for details.`);
      }
      
      // Handle case where feed might be empty but valid
      if (!data || !Array.isArray(data.feed)) {
        console.error("[Explore] Invalid response:", data);
        throw new Error("Invalid response from feed function - expected array");
      }

      const sanitized = (data.feed ?? [])
        .filter(Boolean)
        .filter((c) => typeof (c as any).id === "string" && typeof (c as any).title === "string")
        .map((c) => {
          const kindRaw = (c.kind ?? "other") as FeedCard["kind"];
          const kind =
            kindRaw === "movie" ||
            kindRaw === "book" ||
            kindRaw === "podcast" ||
            kindRaw === "music" ||
            kindRaw === "creator" ||
            kindRaw === "event" ||
            kindRaw === "other"
              ? kindRaw
              : "other";

          return {
            ...c,
            kind,
            title: cleanText(c.title),
            byline: c.byline ? cleanText(c.byline) : c.byline,
            meta: c.meta ? cleanText(c.meta) : c.meta,
            headline: c.headline ? cleanText(c.headline) : c.headline,
            opener: c.opener ? cleanText(c.opener) : c.opener,
            story: c.story ? cleanText(c.story) : c.story,
            bio: c.bio ? cleanText(c.bio) : c.bio,
            blurb: c.blurb ? cleanText(c.blurb) : c.blurb,
            tags: Array.isArray(c.tags) ? c.tags.map((t) => cleanText(String(t))).filter(Boolean) : c.tags,
            source: String(c.source ?? "unknown"),
          } as FeedCard;
        });

      const unique = dedupeById(sanitized);
      const final = opts?.shuffleOnLoad ? shuffle(unique) : unique;

      setCards(final);
      setCursor(0);

      if (data.debug) console.log("[feed debug]", data.debug);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load feed.");
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }

  async function handleReset(opts?: { resetTone?: boolean }) {
    if (resetting) return;
    setResetting(true);

    try {
      clearLocalStorageActions("kivaw_matches_v1");
      clearLocalStorageActions("kivaw_passes_v1");
      setMatchCount(0);
      setPassCount(0);

      setMode("browse");
      setKindFilter("all");
      setQuery("");
      setCursor(0);

      const server = await clearServerHistory();
      if (!server.ok && server.reason !== "guest") {
        console.warn("[reset] server history not cleared (ok if you don’t have user_events):", server);
      }

      if (opts?.resetTone) {
        try {
          sessionStorage.removeItem("kivaw_tone_v1");
        } catch {
          // ignore
        }
        window.location.reload();
        return;
      }

      await loadFeed({ shuffleOnLoad: true });
    } finally {
      setResetting(false);
    }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!alive) return;
      await loadFeed({ shuffleOnLoad: true });
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tone, safeMode]);

  // -----------------------------
  // Derived list (filters + search)
  // -----------------------------
  const filtered = useMemo(() => {
    const q = cleanText(query);
    return cards
      .filter((c) => (kindFilter === "all" ? true : c.kind === kindFilter))
      .filter((c) => matchesQuery(c, q));
  }, [cards, kindFilter, query]);

  useEffect(() => {
    setCursor((c) => Math.max(0, Math.min(c, Math.max(0, filtered.length - 1))));
  }, [filtered.length]);

  const current = filtered[cursor] ?? null;
  const nextUp = filtered.slice(cursor + 1, cursor + 7);

  const progressText = useMemo(() => {
    if (!filtered.length) return "";
    return `${Math.min(cursor + 1, filtered.length)} / ${filtered.length}`;
  }, [cursor, filtered.length]);

  // -----------------------------
  // Personalization signals from likes
  // -----------------------------
  const likedActions = useMemo(() => getLocalStorageActions("kivaw_matches_v1"), [matchCount]);
  const likedIds = useMemo(() => new Set(likedActions.map((a) => a.id)), [likedActions]);

  const likedSignals = useMemo(() => {
    const likedCards = cards.filter((c) => likedIds.has(c.id));
    const tags = likedCards.flatMap((c) => (c.tags ?? []).map((t) => cleanText(t).toLowerCase()));
    const titleWords = likedCards
      .flatMap((c) => cleanText(c.title).toLowerCase().split(/\s+/g))
      .filter((w) => w.length >= 5)
      .slice(0, 50);

    const top = topNStrings([...tags, ...titleWords], 6);
    const ban = new Set(["published", "movie", "books", "book", "novel", "story", "series"]);
    return top.filter((t) => !ban.has(t)).slice(0, 5);
  }, [cards, likedIds]);

  // -----------------------------
  // Shelves
  // -----------------------------
  const shelves = useMemo(() => buildShelves({ kindFilter, likedSignals }), [kindFilter, likedSignals]);

  // -----------------------------
  // Swipe
  // -----------------------------
  function nextCard() {
    setCursor((c) => {
      const next = c + 1;
      return next >= filtered.length ? c : next;
    });
  }

  function doSwipe(dir: SwipeDir) {
    if (!current || isAnimating) return;

    const action: SwipeAction = { id: current.id, kind: current.kind, ts: Date.now() };

    if (dir === "right") {
      saveLocalStorageAction("kivaw_matches_v1", action);
      setMatchCount(getMatchCount());

      // ✅ Saved (Option B local-first)
      saveLocal(current.id);
      syncSaveToAccount(current.id, true).catch(console.warn);
    } else {
      saveLocalStorageAction("kivaw_passes_v1", action);
      setPassCount(getPassCount());
    }

    setIsDragging(false);
    setDragOffset(0);
    setDragStartX(0);

    setAnimDir(dir);
    setIsAnimating(true);

    window.setTimeout(() => {
      nextCard();
      setIsAnimating(false);
    }, 240);
  }

  function handlePass() {
    doSwipe("left");
  }
  function handleMatch() {
    doSwipe("right");
  }

  // -----------------------------
  // Keyboard shortcuts
  // -----------------------------
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      )
        return;

      if (mode === "swipe") {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          handlePass();
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          handleMatch();
        }
      }

      if (e.key.toLowerCase() === "r") {
        e.preventDefault();
        loadFeed({ shuffleOnLoad: true });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, current, isAnimating]);

  // -----------------------------
  // Drag gesture
  // -----------------------------
  const SWIPE_THRESHOLD = 110;

  function getClientX(e: MouseEvent | TouchEvent): number {
    if ("touches" in e) return e.touches[0]?.clientX ?? 0;
    return e.clientX;
  }

  function handleDragStart(e: React.MouseEvent | React.TouchEvent) {
    if (!current || isAnimating) return;
    const clientX = getClientX(e.nativeEvent);
    setIsDragging(true);
    setDragStartX(clientX);
    setDragOffset(0);
  }

  useEffect(() => {
    if (!isDragging || !current) return;

    function handleMove(e: MouseEvent | TouchEvent) {
      if ("touches" in e) e.preventDefault();
      const clientX = getClientX(e);
      setDragOffset(clientX - dragStartX);
    }

    function handleEnd() {
      const abs = Math.abs(dragOffset);
      if (abs >= SWIPE_THRESHOLD) {
        dragOffset < 0 ? handlePass() : handleMatch();
        return;
      }
      setIsDragging(false);
      setDragOffset(0);
      setDragStartX(0);
    }

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleEnd);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging, dragStartX, dragOffset, current, isAnimating]);

  // -----------------------------
  // Visual behavior (swipe)
  // -----------------------------
  const rotation = dragOffset * 0.06;
  const opacity = clamp(1 - Math.abs(dragOffset) / 320, 0.35, 1);
  const swipeLabel = dragOffset > 40 ? "LIKE" : dragOffset < -40 ? "NOPE" : "";
  const swipeLabelOpacity = clamp(Math.abs(dragOffset) / 140, 0, 1);

  const animX = animDir === "right" ? 420 : -420;
  const transform = isAnimating
    ? `translateX(${animX}px) rotate(${animDir === "right" ? 8 : -8}deg)`
    : `translateX(${dragOffset}px) rotate(${rotation}deg)`;

  const transition = isDragging ? "none" : "transform 240ms ease, opacity 240ms ease";

  const toneLabels: Record<Tone, string> = {
    playful: "✨ Playful",
    mysterious: "🌙 Mysterious",
    cozy: "☕ Cozy",
  };

  // unified description field (prefer blurb, then legacy)
  const desc =
    cleanText(current?.blurb) ||
    cleanText(current?.bio) ||
    cleanText(current?.story) ||
    cleanText(current?.opener) ||
    "";
  const shortDesc = desc.length > 190 ? desc.slice(0, 190).trimEnd() + "…" : desc;

  // ============================================================
  // ShelfRow (FIXED: no nested <button>)
  // ============================================================
  function ShelfRow(props: { shelf: Shelf }) {
    const { shelf } = props;

    const items = useMemo(() => {
      const gated = filtered.filter((c) => shelf.predicate(c));
      const base = shelf.id === "tonight" ? shuffle(gated) : gated;
      const cap = shelf.limit ?? 14;
      return base.slice(0, cap);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filtered, shelf]);

    if (!items.length) return null;

    return (
      <div style={{ marginTop: 18 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 950 }}>
              {shelf.emoji ? <span style={{ marginRight: 8 }}>{shelf.emoji}</span> : null}
              {shelf.title}
            </div>
            {shelf.subtitle ? <div style={{ marginTop: 4, fontSize: 13, opacity: 0.7 }}>{shelf.subtitle}</div> : null}
          </div>

          <button
            type="button"
            onClick={() => {
              const first = items[0];
              const idx = filtered.findIndex((x) => x.id === first.id);
              if (idx >= 0) {
                setMode("swipe");
                setCursor(idx);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "rgba(255,255,255,0.75)",
              cursor: "pointer",
              fontWeight: 900,
              opacity: 0.9,
              whiteSpace: "nowrap",
            }}
            title="Start swiping from this shelf"
          >
            Swipe this →
          </button>
        </div>

        <div
          style={{
            marginTop: 12,
            display: "flex",
            gap: 12,
            overflowX: "auto",
            paddingBottom: 8,
            scrollSnapType: "x mandatory",
          }}
        >
          {items.map((c) => {
            const m = formatMeta(c.kind, c.meta);
            const d =
              cleanText(c.blurb) || cleanText(c.bio) || cleanText(c.story) || cleanText(c.opener) || "";
            const d2 = d.length > 96 ? d.slice(0, 96).trimEnd() + "…" : d;

            const saved = isLocallySaved(c.id);

            return (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  const idx = filtered.findIndex((x) => x.id === c.id);
                  if (idx >= 0) {
                    setMode("swipe");
                    setCursor(idx);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    const idx = filtered.findIndex((x) => x.id === c.id);
                    if (idx >= 0) {
                      setMode("swipe");
                      setCursor(idx);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }
                  }
                }}
                style={{
                  width: 240,
                  flex: "0 0 auto",
                  borderRadius: 18,
                  border: "1px solid rgba(0,0,0,0.10)",
                  overflow: "hidden",
                  background: "rgba(255,255,255,0.65)",
                  boxShadow: "0 10px 26px rgba(0,0,0,0.08)",
                  cursor: "pointer",
                  textAlign: "left",
                  scrollSnapAlign: "start",
                  outline: "none",
                }}
                title="Open in Swipe mode"
              >
                <ImageFrame title={c.title} kind={c.kind} imageUrl={c.image_url} />

                <div style={{ padding: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ marginTop: 2, fontSize: 14, fontWeight: 950, lineHeight: 1.2 }}>
                        {cleanText(c.title)}
                      </div>
                      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.72 }}>
                        {c.byline ? (
                          <>
                            <span style={{ fontWeight: 800 }}>{cleanText(c.byline).slice(0, 36)}</span>
                            {m ? <span style={{ opacity: 0.6 }}> • </span> : null}
                            {m ? <span style={{ opacity: 0.75 }}>{m}</span> : null}
                          </>
                        ) : (
                          <>
                            {m ? <span style={{ opacity: 0.75 }}>{m}</span> : <span style={{ opacity: 0.65 }}>{c.source}</span>}
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        // keep personalization likes (optional)
                        const action: SwipeAction = { id: c.id, kind: c.kind, ts: Date.now() };
                        saveLocalStorageAction("kivaw_matches_v1", action);
                        setMatchCount(getMatchCount());

                        // toggle Saved (local-first)
                        if (saved) {
                          unsaveLocal(c.id);
                          syncSaveToAccount(c.id, false).catch(console.warn);
                        } else {
                          saveLocal(c.id);
                          syncSaveToAccount(c.id, true).catch(console.warn);
                        }
                      }}
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 12,
                        border: "1px solid rgba(0,0,0,0.12)",
                        background: "rgba(255,255,255,0.80)",
                        cursor: "pointer",
                        fontWeight: 950,
                        flexShrink: 0,
                      }}
                      title={saved ? "Unsave" : "Save"}
                      aria-label={saved ? "Unsave" : "Save"}
                    >
                      {saved ? "♥" : "♡"}
                    </button>
                  </div>

                  {d2 ? (
                    <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.45, opacity: 0.82 }}>{d2}</div>
                  ) : (
                    <div style={{ marginTop: 10, fontSize: 12, opacity: 0.6 }}>No description yet.</div>
                  )}

                  <div style={{ marginTop: 10, fontSize: 11, opacity: 0.55 }}>
                    Source: <b>{c.source}</b>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ============================================================
  // UI
  // ============================================================
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0 }}>Explore</h2>
          <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 900,
                padding: "5px 10px",
                borderRadius: 999,
                background: "rgba(0,0,0,0.06)",
                color: "rgba(0,0,0,0.65)",
              }}
            >
              {toneLabels[tone]}
            </span>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <SmallStat label="Matches" value={String(matchCount)} />
              <SmallStat label="Passes" value={String(passCount)} />
              <SmallStat label="In view" value={filtered.length ? progressText : "0"} />
            </div>

            {likedSignals.length ? (
              <div style={{ marginLeft: 6, fontSize: 12, opacity: 0.75 }}>
                Your vibe: <b>{likedSignals.join(", ")}</b>
              </div>
            ) : (
              <div style={{ marginLeft: 6, fontSize: 12, opacity: 0.65 }}>
                Like a few things and I’ll start tailoring shelves 👀
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search titles, authors, tags…"
            style={{
              width: 260,
              maxWidth: "72vw",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.12)",
              outline: "none",
              background: "rgba(255,255,255,0.75)",
            }}
          />

          <PillButton active={kindFilter === "all"} onClick={() => setKindFilter("all")}>
            All
          </PillButton>
          <PillButton active={kindFilter === "movie"} onClick={() => setKindFilter("movie")}>
            🎬 Movies
          </PillButton>
          <PillButton active={kindFilter === "book"} onClick={() => setKindFilter("book")}>
            📚 Books
          </PillButton>

          <button
            type="button"
            onClick={() => {
              setCards((c) => shuffle(c));
              setCursor(0);
            }}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "rgba(255,255,255,0.75)",
              cursor: "pointer",
              fontWeight: 950,
            }}
            title="Shuffle what you already have"
          >
            Shuffle
          </button>

          <button
            type="button"
            onClick={() => loadFeed({ shuffleOnLoad: true })}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "rgba(255,255,255,0.75)",
              cursor: "pointer",
              fontWeight: 950,
            }}
            title="Refresh the feed (shortcut: R)"
          >
            Refresh
          </button>

          <button
            type="button"
            onClick={() => {
              const yes = window.confirm(
                "Reset your Explore?\n\nThis clears Likes/Passes (and server personalization if you’re logged in)."
              );
              if (yes) handleReset();
            }}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "rgba(255,255,255,0.75)",
              cursor: resetting ? "not-allowed" : "pointer",
              fontWeight: 950,
              opacity: resetting ? 0.6 : 1,
            }}
            disabled={resetting}
            title="Clear likes/passes and personalization"
          >
            {resetting ? "Resetting…" : "Reset"}
          </button>

          <button
            type="button"
            onClick={() => {
              const yes = window.confirm(
                "Hard reset?\n\nClears Likes/Passes + server personalization AND resets your tone.\nThis will reload the page."
              );
              if (yes) handleReset({ resetTone: true });
            }}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "rgba(255,255,255,0.75)",
              cursor: resetting ? "not-allowed" : "pointer",
              fontWeight: 950,
              opacity: resetting ? 0.6 : 1,
            }}
            disabled={resetting}
            title="Full reset (also resets tone)"
          >
            Hard reset
          </button>
        </div>
      </div>

      {/* Mode switch */}
      <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <PillButton active={mode === "browse"} onClick={() => setMode("browse")}>
          🧺 Browse
        </PillButton>
        <PillButton active={mode === "swipe"} onClick={() => setMode("swipe")}>
          💘 Swipe
        </PillButton>

        <div style={{ marginLeft: "auto", opacity: 0.65, fontSize: 13 }}>
          Tip: Browse for shelves • Swipe for decisions • Press <b>R</b> to refresh
        </div>
      </div>

      {/* States */}
      {err ? (
        <div style={{ padding: 12, border: "1px solid red", borderRadius: 12, marginTop: 12 }}>
          <b>Error:</b> {err}
        </div>
      ) : null}

      {loading ? <div style={{ marginTop: 14, opacity: 0.7 }}>Loading…</div> : null}

      {!loading && !err && filtered.length === 0 ? (
        <div
          style={{
            marginTop: 16,
            padding: 14,
            borderRadius: 14,
            border: "1px solid rgba(0,0,0,0.10)",
            background: "rgba(255,255,255,0.65)",
            opacity: 0.9,
          }}
        >
          Nothing matches your filters/search. Try clearing search or switching filters.
        </div>
      ) : null}

      {/* BROWSE MODE (SHELVES) */}
      {!loading && mode === "browse" && filtered.length > 0 ? (
        <div style={{ marginTop: 6 }}>
          {shelves.map((s) => (
            <ShelfRow key={s.id} shelf={s} />
          ))}

          <div style={{ marginTop: 22, opacity: 0.7, fontSize: 13 }}>
            If this still feels “meh”, it’s not the UI — it’s the data quality (descriptions/genres). We’ll fix that on the API layer next.
          </div>
        </div>
      ) : null}

      {/* SWIPE MODE */}
      {!loading && mode === "swipe" && current ? (
        <div
          style={{
            marginTop: 18,
            display: "grid",
            gridTemplateColumns: "1fr minmax(360px, 520px) 1fr",
            gap: 18,
            alignItems: "start",
          }}
        >
          {/* Left rail */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, position: "sticky", top: 18, alignSelf: "start" }}>
            <div style={{ padding: 14, borderRadius: 18, border: "1px solid rgba(0,0,0,0.10)", background: "rgba(255,255,255,0.65)" }}>
              <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.6px", opacity: 0.6 }}>UP NEXT</div>

              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                {nextUp.length ? (
                  nextUp.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        const idx = filtered.findIndex((x) => x.id === c.id);
                        if (idx >= 0) setCursor(idx);
                      }}
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                        padding: 10,
                        borderRadius: 14,
                        border: "1px solid rgba(0,0,0,0.08)",
                        background: "rgba(255,255,255,0.70)",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                      title="Jump to this card"
                    >
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 12,
                          overflow: "hidden",
                          background: "rgba(0,0,0,0.06)",
                          display: "grid",
                          placeItems: "center",
                          flexShrink: 0,
                        }}
                      >
                        {c.image_url ? (
                          <img src={c.image_url} alt={c.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <div style={{ fontSize: 18 }}>{kindEmoji(c.kind)}</div>
                        )}
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 950, lineHeight: 1.2 }}>
                          {cleanText(c.title).slice(0, 50)}
                          {cleanText(c.title).length > 50 ? "…" : ""}
                        </div>
                        <div style={{ marginTop: 2, fontSize: 12, opacity: 0.65 }}>
                          {kindEmoji(c.kind)} {kindLabel(c.kind)}
                          {c.byline ? ` • ${cleanText(c.byline).slice(0, 34)}` : ""}
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div style={{ opacity: 0.65, fontSize: 13 }}>You’re at the end. Refresh to get more.</div>
                )}
              </div>

              <div style={{ marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => {
                    setMode("browse");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.12)",
                    background: "rgba(255,255,255,0.75)",
                    cursor: "pointer",
                    fontWeight: 950,
                  }}
                >
                  Back to shelves
                </button>
              </div>
            </div>
          </div>

          {/* Main card */}
          <div style={{ display: "grid", placeItems: "center" }}>
            <div
              style={{
                width: "min(520px, 92vw)",
                borderRadius: 22,
                overflow: "hidden",
                border: "1px solid rgba(0,0,0,0.12)",
                background: "rgba(255,255,255,0.55)",
                cursor: isDragging ? "grabbing" : "grab",
                userSelect: "none",
                touchAction: "pan-y pinch-zoom",
                WebkitUserSelect: "none",
                transform,
                opacity: isAnimating ? 0 : opacity,
                transition,
                position: "relative",
                boxShadow: "0 14px 40px rgba(0,0,0,0.10)",
                backdropFilter: "blur(6px)",
              }}
              onMouseDown={handleDragStart}
              onTouchStart={handleDragStart}
            >
              {swipeLabel ? (
                <div
                  style={{
                    position: "absolute",
                    top: 16,
                    left: swipeLabel === "LIKE" ? 16 : "auto",
                    right: swipeLabel === "NOPE" ? 16 : "auto",
                    zIndex: 5,
                    padding: "8px 12px",
                    borderRadius: 12,
                    border: "2px solid rgba(0,0,0,0.22)",
                    background: "rgba(255,255,255,0.72)",
                    fontWeight: 950,
                    letterSpacing: "1px",
                    opacity: swipeLabelOpacity,
                    transform: `rotate(${swipeLabel === "LIKE" ? -10 : 10}deg)`,
                  }}
                >
                  {swipeLabel}
                </div>
              ) : null}

              {/* Cohesive image block */}
              <div style={{ height: 320, background: "rgba(0,0,0,0.06)", position: "relative" }}>
                {current.image_url ? (
                  <img src={current.image_url} alt={current.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                ) : (
                  <div style={{ height: "100%", display: "grid", placeItems: "center" }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 54 }}>{kindEmoji(current.kind)}</div>
                      <div style={{ fontSize: 12, opacity: 0.55, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        {kindLabel(current.kind)}
                      </div>
                    </div>
                  </div>
                )}

                <div
                  style={{
                    position: "absolute",
                    left: 14,
                    bottom: 14,
                    padding: "6px 10px",
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.72)",
                    border: "1px solid rgba(0,0,0,0.12)",
                    fontSize: 11,
                    fontWeight: 950,
                    color: "rgba(0,0,0,0.72)",
                    backdropFilter: "blur(4px)",
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                  }}
                >
                  <span>{kindEmoji(current.kind)}</span>
                  <span>{kindLabel(current.kind)}</span>
                  <span style={{ opacity: 0.55 }}>•</span>
                  <span style={{ opacity: 0.75 }}>{current.source}</span>
                </div>
              </div>

              {/* Content */}
              <div style={{ padding: 18 }}>
                <h3 style={{ fontSize: 18, fontWeight: 950, margin: 0, lineHeight: 1.25 }}>{current.title}</h3>

                <div style={{ marginTop: 8, fontSize: 14, color: "rgba(0,0,0,0.72)" }}>
                  {current.byline ? <span style={{ fontWeight: 800 }}>{cleanText(current.byline)}</span> : null}
                  {current.byline && formatMeta(current.kind, current.meta) ? <span style={{ opacity: 0.6 }}> • </span> : null}
                  {formatMeta(current.kind, current.meta) ? <span style={{ opacity: 0.7 }}>{formatMeta(current.kind, current.meta)}</span> : null}
                </div>

                {shortDesc ? (
                  <div style={{ marginTop: 12, fontSize: 14, lineHeight: 1.55, color: "rgba(0,0,0,0.82)" }}>{shortDesc}</div>
                ) : (
                  <div style={{ marginTop: 12, fontSize: 13, opacity: 0.65 }}>No description yet.</div>
                )}

                {(current.tags ?? []).length ? (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
                    {(current.tags ?? []).slice(0, 6).map((tag, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: 11,
                          padding: "4px 10px",
                          borderRadius: 999,
                          background: "rgba(0,0,0,0.04)",
                          border: "1px solid rgba(0,0,0,0.08)",
                          color: "rgba(0,0,0,0.62)",
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}

                {current.url ? (
                  <div style={{ marginTop: 14 }}>
                    <a
                      href={current.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "inline-block",
                        fontSize: 12,
                        color: "rgba(0,0,0,0.70)",
                        textDecoration: "none",
                        opacity: 0.85,
                        fontWeight: 900,
                      }}
                    >
                      Open details ↗
                    </a>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <button
                  onClick={handlePass}
                  title="Pass (←)"
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: 999,
                    border: "1px solid rgba(0,0,0,0.12)",
                    cursor: "pointer",
                    background: "rgba(255,255,255,0.75)",
                    fontWeight: 950,
                  }}
                >
                  ✕
                </button>
                <span style={{ fontSize: 12, opacity: 0.65, color: "rgba(0,0,0,0.65)" }}>Not my vibe</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <button
                  onClick={handleMatch}
                  title="Match (→)"
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: 999,
                    border: "1px solid rgba(0,0,0,0.12)",
                    cursor: "pointer",
                    background: "rgba(255,255,255,0.75)",
                    fontWeight: 950,
                  }}
                >
                  ♥
                </button>
                <span style={{ fontSize: 12, opacity: 0.65, color: "rgba(0,0,0,0.65)" }}>This feels like a yes</span>
              </div>
            </div>
          </div>

          {/* Right rail */}
          <div style={{ position: "sticky", top: 18, alignSelf: "start" }}>
            <div style={{ padding: 14, borderRadius: 18, border: "1px solid rgba(0,0,0,0.10)", background: "rgba(255,255,255,0.65)" }}>
              <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.6px", opacity: 0.6 }}>QUICK JUMPS</div>

              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {filtered.slice(cursor, cursor + 6).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      const idx = filtered.findIndex((x) => x.id === c.id);
                      if (idx >= 0) setCursor(idx);
                    }}
                    style={{
                      padding: 10,
                      borderRadius: 14,
                      border: "1px solid rgba(0,0,0,0.08)",
                      background: "rgba(255,255,255,0.70)",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                    title="Jump to this card"
                  >
                    <div style={{ fontSize: 12, fontWeight: 950, lineHeight: 1.2 }}>
                      {kindEmoji(c.kind)} {cleanText(c.title).slice(0, 34)}
                      {cleanText(c.title).length > 34 ? "…" : ""}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 11, opacity: 0.65 }}>{c.byline ? cleanText(c.byline).slice(0, 30) : c.source}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}






















