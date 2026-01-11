import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function handleCors(req: Request) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function cleanText(s?: string | null) {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

function stripHtml(s?: string | null) {
  return (s ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchWithTimeout(url: string, timeoutMs = 8000, init: RequestInit = {}) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ac.signal, headers: { "User-Agent": "kivaw/1.0", ...(init.headers ?? {}) } });
  } finally {
    clearTimeout(t);
  }
}

function safeDate(s?: string | null): string | null {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

// Minimal XML parsing using DOMParser (works in Deno)
function parseXml(xml: string) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  return doc;
}

function getText(el: Element | null | undefined) {
  return el?.textContent?.trim() ?? "";
}

function firstN(s: string, n = 300) {
  const t = cleanText(s);
  if (t.length <= n) return t;
  return t.slice(0, n).trimEnd() + "…";
}

type SourceRow = {
  id: string;
  type: "rss" | "youtube" | "reddit" | "podcast" | "eventbrite";
  title: string;
  url: string;
  enabled: boolean;
  meta: Record<string, unknown>;
};

// Normalize into feed_items shape
type FeedItemUpsert = {
  source_type: SourceRow["type"];
  source_id: string | null;
  source_item_id: string;
  url: string;
  title: string;
  summary: string | null;
  author: string | null;
  image_url: string | null;
  published_at: string | null;
  tags: string[] | null;
  raw: Record<string, unknown>;
};

async function upsertItems(supabase: any, items: FeedItemUpsert[]) {
  if (!items.length) return { upserted: 0 };
  // Dedupe in-memory first
  const map = new Map<string, FeedItemUpsert>();
  for (const it of items) map.set(`${it.source_type}:${it.source_item_id}`, it);
  const unique = [...map.values()];

  const { error } = await supabase
    .from("feed_items")
    .upsert(unique, { onConflict: "source_type,source_item_id" });

  if (error) throw new Error(error.message);
  return { upserted: unique.length };
}

// --------------------------
// RSS ingester
// --------------------------
async function ingestRss(source: SourceRow): Promise<FeedItemUpsert[]> {
  const res = await fetchWithTimeout(source.url);
  if (!res.ok) throw new Error(`RSS fetch failed: ${res.status} ${res.statusText}`);
  const xml = await res.text();
  const doc = parseXml(xml);

  // RSS <item> OR Atom <entry>
  const items = [...doc.getElementsByTagName("item")];
  const entries = items.length ? [] : [...doc.getElementsByTagName("entry")];

  const out: FeedItemUpsert[] = [];

  if (items.length) {
    for (const it of items.slice(0, 40)) {
      const title = cleanText(getText(it.querySelector("title")));
      const link = cleanText(getText(it.querySelector("link")));
      const guid = cleanText(getText(it.querySelector("guid"))) || link || title;
      const pubDate = safeDate(getText(it.querySelector("pubDate")));
      const desc = stripHtml(getText(it.querySelector("description")));
      const author = cleanText(getText(it.querySelector("author"))) || null;

      if (!title || !link || !guid) continue;

      out.push({
        source_type: "rss",
        source_id: source.id,
        source_item_id: guid,
        url: link,
        title,
        summary: desc ? firstN(desc, 340) : null,
        author,
        image_url: null,
        published_at: pubDate,
        tags: null,
        raw: { sourceTitle: source.title },
      });
    }
  } else {
    // Atom
    for (const en of entries.slice(0, 40)) {
      const title = cleanText(getText(en.querySelector("title")));
      const linkEl = en.querySelector("link");
      const link = cleanText(linkEl?.getAttribute("href") ?? "") || cleanText(getText(linkEl));
      const id = cleanText(getText(en.querySelector("id"))) || link || title;
      const updated = safeDate(getText(en.querySelector("updated"))) || safeDate(getText(en.querySelector("published")));
      const summary = stripHtml(getText(en.querySelector("summary"))) || stripHtml(getText(en.querySelector("content")));
      const author = cleanText(getText(en.querySelector("author > name"))) || null;

      if (!title || !link || !id) continue;

      out.push({
        source_type: "rss",
        source_id: source.id,
        source_item_id: id,
        url: link,
        title,
        summary: summary ? firstN(summary, 340) : null,
        author,
        image_url: null,
        published_at: updated,
        tags: null,
        raw: { sourceTitle: source.title },
      });
    }
  }

  return out;
}

// --------------------------
// YouTube ingester (RSS feed)
// --------------------------
async function ingestYouTube(source: SourceRow): Promise<FeedItemUpsert[]> {
  const res = await fetchWithTimeout(source.url);
  if (!res.ok) throw new Error(`YouTube feed fetch failed: ${res.status} ${res.statusText}`);
  const xml = await res.text();
  const doc = parseXml(xml);

  const entries = [...doc.getElementsByTagName("entry")];
  const out: FeedItemUpsert[] = [];

  for (const en of entries.slice(0, 30)) {
    const title = cleanText(getText(en.querySelector("title")));
    const linkEl = en.querySelector("link");
    const url = cleanText(linkEl?.getAttribute("href") ?? "");
    const videoId = cleanText(getText(en.querySelector("yt\\:videoId"))) || cleanText(getText(en.querySelector("videoId"))) || url;
    const published = safeDate(getText(en.querySelector("published")));
    const author = cleanText(getText(en.querySelector("author > name"))) || null;

    // thumbnail
    const thumbEl = en.querySelector("media\\:thumbnail") || en.querySelector("thumbnail");
    const image_url = cleanText(thumbEl?.getAttribute("url") ?? "") || null;

    if (!title || !url || !videoId) continue;

    out.push({
      source_type: "youtube",
      source_id: source.id,
      source_item_id: videoId,
      url,
      title,
      summary: null,
      author,
      image_url,
      published_at: published,
      tags: null,
      raw: { sourceTitle: source.title },
    });
  }

  return out;
}

// --------------------------
// Reddit ingester (JSON)
// --------------------------
async function ingestReddit(source: SourceRow): Promise<FeedItemUpsert[]> {
  const res = await fetchWithTimeout(source.url);
  if (!res.ok) throw new Error(`Reddit fetch failed: ${res.status} ${res.statusText}`);
  const data = await res.json();

  const children = data?.data?.children ?? [];
  const out: FeedItemUpsert[] = [];

  for (const c of children.slice(0, 40)) {
    const p = c?.data;
    if (!p) continue;

    const title = cleanText(p.title);
    const permalink = p.permalink ? `https://www.reddit.com${p.permalink}` : null;
    const url = cleanText(p.url_overridden_by_dest || permalink || "");
    const id = cleanText(p.name || p.id || url);
    const author = p.author ? String(p.author) : null;

    const created = p.created_utc ? new Date(p.created_utc * 1000).toISOString() : null;
    const summary = p.selftext ? firstN(stripHtml(p.selftext), 340) : null;

    const image_url =
      (p.preview?.images?.[0]?.source?.url ? String(p.preview.images[0].source.url).replace(/&amp;/g, "&") : null) ||
      null;

    const subreddit = p.subreddit ? `r/${p.subreddit}` : null;
    const tags = subreddit ? [subreddit] : null;

    if (!title || !url || !id) continue;

    out.push({
      source_type: "reddit",
      source_id: source.id,
      source_item_id: id,
      url,
      title,
      summary,
      author,
      image_url,
      published_at: created,
      tags,
      raw: {
        score: p.score ?? null,
        num_comments: p.num_comments ?? null,
        subreddit: p.subreddit ?? null,
        sourceTitle: source.title,
      },
    });
  }

  return out;
}

// --------------------------
// Podcast ingester (RSS)
// --------------------------
async function ingestPodcast(source: SourceRow): Promise<FeedItemUpsert[]> {
  const res = await fetchWithTimeout(source.url);
  if (!res.ok) throw new Error(`Podcast RSS fetch failed: ${res.status} ${res.statusText}`);
  const xml = await res.text();
  const doc = parseXml(xml);

  const items = [...doc.getElementsByTagName("item")];
  const out: FeedItemUpsert[] = [];

  for (const it of items.slice(0, 40)) {
    const title = cleanText(getText(it.querySelector("title")));
    const guid = cleanText(getText(it.querySelector("guid"))) || cleanText(getText(it.querySelector("link"))) || title;
    const link = cleanText(getText(it.querySelector("link")));
    const pubDate = safeDate(getText(it.querySelector("pubDate")));
    const desc = stripHtml(getText(it.querySelector("description"))) || stripHtml(getText(it.querySelector("content\\:encoded")));
    const author = cleanText(getText(it.querySelector("itunes\\:author"))) || null;

    // itunes:image
    const imgEl = it.querySelector("itunes\\:image");
    const image_url = cleanText(imgEl?.getAttribute("href") ?? "") || null;

    // enclosure
    const enclosure = it.querySelector("enclosure");
    const audioUrl = cleanText(enclosure?.getAttribute("url") ?? "");

    const url = audioUrl || link;
    if (!title || !url || !guid) continue;

    out.push({
      source_type: "podcast",
      source_id: source.id,
      source_item_id: guid,
      url,
      title,
      summary: desc ? firstN(desc, 340) : null,
      author,
      image_url,
      published_at: pubDate,
      tags: ["Podcast"],
      raw: { sourceTitle: source.title },
    });
  }

  return out;
}

async function ingestOne(source: SourceRow) {
  if (!source.enabled) return { source: source.title, type: source.type, upserted: 0 };

  let items: FeedItemUpsert[] = [];
  if (source.type === "rss") items = await ingestRss(source);
  if (source.type === "youtube") items = await ingestYouTube(source);
  if (source.type === "reddit") items = await ingestReddit(source);
  if (source.type === "podcast") items = await ingestPodcast(source);
  if (source.type === "eventbrite") items = []; // stub later

  return { items };
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, 500);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // optional body: { onlyTypes: ['rss','reddit'] }
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const onlyTypes: string[] = Array.isArray(body?.onlyTypes) ? body.onlyTypes : [];
    const limitSources = Number.isFinite(body?.limitSources) ? Math.max(1, Math.min(60, body.limitSources)) : 60;

    const { data: sources, error } = await supabase
      .from("sources")
      .select("*")
      .eq("enabled", true)
      .limit(limitSources);

    if (error) throw new Error(error.message);

    const filteredSources = (sources as SourceRow[]).filter((s) => !onlyTypes.length || onlyTypes.includes(s.type));

    // run sequential-ish to avoid rate limit chaos
    const results: any[] = [];
    let totalUpserted = 0;

    for (const s of filteredSources) {
      try {
        const { items } = await ingestOne(s);
        const { upserted } = await upsertItems(supabase, items);
        totalUpserted += upserted;
        results.push({ source: s.title, type: s.type, upserted });
      } catch (e) {
        results.push({ source: s.title, type: s.type, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return json({ ok: true, totalUpserted, results });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
