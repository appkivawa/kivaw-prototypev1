// supabase/functions/fetch-google-books/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logHealthEvent } from "./_shared/logHealthEvent.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function handleCors(req: Request) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return null;
}

function cleanText(s?: string | null) {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

function withTimeout(ms: number) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  return { ac, done: () => clearTimeout(t) };
}

function pickCover(volumeInfo: any): string | null {
  const links = volumeInfo?.imageLinks;
  if (!links) return null;

  // prefer larger first, then fallback
  return (
    links.extraLarge ||
    links.large ||
    links.medium ||
    links.small ||
    links.thumbnail ||
    links.smallThumbnail ||
    null
  );
}

type GoogleBookCard = {
  id: string;
  kind: "book";
  title: string;
  byline?: string | null;
  meta?: string | null;
  image_url?: string | null;
  url?: string | null;
  source: "googlebooks";
  tags?: string[] | null;

  headline?: string | null;
  story?: string | null;
  prompts?: string[] | null;
  opener?: string | null;
  bio?: string | null;
};

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  // Smoke test
  if (req.method === "GET") {
    return json({ ok: true, fn: "fetch-google-books", version: "2026-01-27" });
  }

  const startTime = Date.now();
  let supabase: ReturnType<typeof createClient> | null = null;

  try {
    // Initialize supabase for health logging
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (supabaseUrl && supabaseServiceKey) {
      supabase = createClient(supabaseUrl, supabaseServiceKey);
    }
    // Check CRON_SECRET if set (for internal cron calls)
    const CRON_SECRET = (Deno.env.get("CRON_SECRET") ?? "").trim();
    if (CRON_SECRET) {
      const got = (req.headers.get("x-cron-secret") ?? "").trim();
      if (got !== CRON_SECRET) {
        // Allow service role key as fallback (for direct calls)
        const authHeader = req.headers.get("Authorization");
        if (!authHeader || !authHeader.includes("Bearer")) {
          return json({ error: "Forbidden: Missing or invalid x-cron-secret" }, 403);
        }
      }
    }

    // Support GET with query params too (handy for testing)
    let q = "";
    let maxResults = 20;
    let lang = "en";
    let printType: "books" | "all" = "books";

    if (req.method === "GET") {
      const url = new URL(req.url);
      q = cleanText(url.searchParams.get("q"));
      maxResults = Number(url.searchParams.get("maxResults") ?? "20");
      lang = cleanText(url.searchParams.get("lang")) || "en";
      const pt = cleanText(url.searchParams.get("printType")) || "books";
      printType = pt === "all" ? "all" : "books";
    } else if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      q = cleanText(body?.q);
      maxResults = Number(body?.maxResults ?? 20);
      lang = cleanText(body?.lang) || "en";
      const pt = cleanText(body?.printType) || "books";
      printType = pt === "all" ? "all" : "books";
    } else {
      return json({ error: "Method not allowed" }, 405);
    }

    if (!q) return json({ error: "Missing `q` (search query)" }, 400);

    maxResults = Number.isFinite(maxResults) ? Math.max(1, Math.min(40, maxResults)) : 20;

    const apiKey = Deno.env.get("GOOGLE_BOOKS_API_KEY") ?? "";
    // API key is optional for low-volume usage, but recommended
    const params = new URLSearchParams({
      q,
      maxResults: String(maxResults),
      langRestrict: lang,
      printType,
      orderBy: "relevance",
    });

    if (apiKey) params.set("key", apiKey);

    const endpoint = `https://www.googleapis.com/books/v1/volumes?${params.toString()}`;

    const { ac, done } = withTimeout(9000);
    const res = await fetch(endpoint, {
      signal: ac.signal,
      headers: { "User-Agent": "kivaw/1.0" },
    }).finally(done);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return json(
        {
          error: `Google Books request failed: ${res.status} ${res.statusText}`,
          details: text?.slice(0, 400) || null,
        },
        502
      );
    }

    const data = await res.json().catch(() => null);
    const items: any[] = Array.isArray(data?.items) ? data.items : [];

    const feed: GoogleBookCard[] = items
      .map((it) => {
        const id = cleanText(it?.id);
        const v = it?.volumeInfo ?? {};
        const title = cleanText(v?.title);
        if (!id || !title) return null;

        const authors: string[] = Array.isArray(v?.authors) ? v.authors.map(cleanText).filter(Boolean) : [];
        const byline = authors.length ? authors.join(", ") : null;

        const publishedDate = cleanText(v?.publishedDate);
        const meta = publishedDate ? (publishedDate.length === 4 ? `Published: ${publishedDate}` : `Published: ${publishedDate}`) : null;

        const image_url = pickCover(v);
        const url = cleanText(v?.infoLink || v?.canonicalVolumeLink || it?.selfLink) || null;

        const categories: string[] = Array.isArray(v?.categories) ? v.categories.map(cleanText).filter(Boolean) : [];
        const tags = categories.length ? categories.slice(0, 8) : null;

        const description = cleanText(v?.description);
        const bio = description ? (description.length > 380 ? description.slice(0, 380).trimEnd() + "…" : description) : null;

        return {
          id: `gb_${id}`,
          kind: "book",
          title,
          byline,
          meta,
          image_url,
          url,
          source: "googlebooks",
          tags,
          bio,
        } as GoogleBookCard;
      })
      .filter(Boolean) as GoogleBookCard[];

    const durationMs = Date.now() - startTime;
    if (supabase) {
      await logHealthEvent(supabase, {
        jobName: "fetch-google-books",
        status: "ok",
        durationMs,
        metadata: {
          returned: feed.length,
          totalItems: data?.totalItems ?? null,
        },
      });
    }
    
    return json({ feed, debug: { q, returned: feed.length, totalItems: data?.totalItems ?? null } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const durationMs = Date.now() - startTime;
    
    if (supabase) {
      await logHealthEvent(supabase, {
        jobName: "fetch-google-books",
        status: "fail",
        durationMs,
        errorMessage: msg,
      });
    }
    
    // AbortError is common on timeouts
    return json({ error: msg }, 500);
  }
});










