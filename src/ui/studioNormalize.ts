// src/ui/studioNormalize.ts
// Shared helpers to keep Studio content + cards consistent.

export function toText(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(toText).filter(Boolean).join(" ").trim();

  if (typeof v === "object") {
    const candidate =
      (v as any).content ??
      (v as any).text ??
      (v as any).value ??
      (v as any).summary ??
      (v as any).description ??
      (v as any).title ??
      (v as any).name ??
      (v as any).label ??
      (v as any).url ??
      "";

    return toText(candidate);
  }

  return String(v).trim();
}

export function normalizeTags(input: any): string[] {
  if (!input) return [];
  const arr = Array.isArray(input) ? input : [input];

  const tags = arr
    .flatMap((t) => {
      if (t == null) return [];
      if (Array.isArray(t)) return t;
      return [t];
    })
    .map((t) => {
      if (typeof t === "string") return t.trim();
      if (typeof t === "number") return String(t);
      if (typeof t === "object") return toText((t as any)?.name ?? (t as any)?.label ?? (t as any)?.value ?? t);
      return toText(t);
    })
    .map((t) => t.trim())
    .filter(Boolean);

  return Array.from(new Set(tags));
}

export function formatProviderName(provider?: string | null): string {
  const p = (provider || "").toLowerCase();
  if (!p) return "KIVAW";
  if (p.includes("open")) return "Open Library";
  if (p.includes("tmdb")) return "TMDB";
  if (p.includes("youtube")) return "YouTube";
  if (p.includes("rss")) return "RSS";
  if (p.includes("google")) return "Google";
  if (p.includes("spotify")) return "Spotify";
  return provider || "KIVAW";
}

export function formatShortDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function inferSignal(kind: string, provider?: string) {
  const k = (kind || "").toLowerCase();
  const p = (provider || "").toLowerCase();
  const hay = `${k} ${p}`;

  if (hay.includes("podcast")) return "podcast";
  if (hay.includes("music") || hay.includes("spotify") || hay.includes("listen")) return "music";
  if (hay.includes("video") || hay.includes("youtube")) return "video";
  if (hay.includes("watch") || hay.includes("movie") || hay.includes("tv") || hay.includes("tmdb"))
    return "watch";
  if (hay.includes("read") || hay.includes("book") || hay.includes("open") || hay.includes("article"))
    return "read";
  if (hay.includes("reddit") || hay.includes("social")) return "social";
  if (hay.includes("creator")) return "creator";
  return "news";
}


