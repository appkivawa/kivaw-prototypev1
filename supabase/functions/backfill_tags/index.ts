import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  return null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Normalize a tag: lowercase, trim, replace spaces with hyphens
 */
function normalizeTag(tag: string | null | undefined): string | null {
  if (!tag || typeof tag !== "string") return null;
  let normalized = tag.trim().toLowerCase();
  if (!normalized) return null;
  normalized = normalized.replace(/[\s_]+/g, "-");
  normalized = normalized.replace(/[^a-z0-9\-\.]/g, "");
  normalized = normalized.replace(/^[\-\.]+|[\-\.]+$/g, "");
  if (normalized.length < 2 || normalized.length > 50) return null;
  return normalized;
}

function normalizeTags(tags: (string | null | undefined)[]): string[] {
  const normalized = tags.map(normalizeTag).filter((tag): tag is string => tag !== null);
  return Array.from(new Set(normalized));
}

/**
 * Extract keywords from text
 */
function extractKeywordsFromText(text: string | null | undefined, maxKeywords = 5): string[] {
  if (!text || typeof text !== "string") return [];
  const clean = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const stopWords = new Set(["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "from", "as", "is", "was", "are", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "must", "can", "this", "that", "these", "those", "it", "its", "they", "them", "their", "what", "which", "who", "when", "where", "why", "how", "all", "each", "every", "some", "any", "no", "not", "only", "just", "more", "most", "very", "too", "so", "than", "then", "there", "here", "up", "down", "out", "off", "over", "under", "again", "further", "once", "twice"]);
  const words = clean.toLowerCase().split(/\s+/).map((w) => w.replace(/[^a-z0-9]/g, "")).filter((w) => w.length >= 3 && !stopWords.has(w));
  const freq = new Map<string, number>();
  for (const word of words) freq.set(word, (freq.get(word) || 0) + 1);
  const sorted = Array.from(freq.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  }).slice(0, maxKeywords).map(([word]) => word);
  return normalizeTags(sorted);
}

/**
 * Derive tags from feed_item metadata
 */
function deriveTagsForFeedItem(item: {
  source?: string | null;
  metadata?: Record<string, unknown> | null;
  title?: string | null;
  summary?: string | null;
}): string[] {
  const tags: string[] = [];
  
  // Try to extract from metadata (genres, categories, subjects)
  if (item.metadata) {
    const meta = item.metadata;
    
    // TMDB genres
    if (Array.isArray(meta.genres)) {
      tags.push(...normalizeTags(meta.genres.map((g: any) => g?.name || g)));
    }
    
    // Categories/subjects
    if (Array.isArray(meta.categories)) {
      tags.push(...normalizeTags(meta.categories));
    }
    if (Array.isArray(meta.subjects)) {
      tags.push(...normalizeTags(meta.subjects));
    }
    
    // Direct tags in metadata
    if (Array.isArray(meta.tags)) {
      tags.push(...normalizeTags(meta.tags));
    }
  }
  
  // Fallback: keyword extraction from title + summary
  if (tags.length < 3) {
    const text = [item.title, item.summary].filter(Boolean).join(" ");
    const keywords = extractKeywordsFromText(text, 5);
    tags.push(...keywords);
  }
  
  // Ensure at least one tag
  if (tags.length === 0) {
    tags.push(item.source || "unknown");
  }
  
  return Array.from(new Set(tags)).slice(0, 10);
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, 500);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const batchSize = typeof body.batchSize === "number" ? Math.min(Math.max(body.batchSize, 100), 1000) : 500;
    const maxBatches = typeof body.maxBatches === "number" ? Math.max(1, body.maxBatches) : null;

    console.log(`[backfill_tags] Starting backfill (batchSize=${batchSize}, maxBatches=${maxBatches ?? "unlimited"})`);

    let totalUpdated = 0;
    let batchCount = 0;
    let hasMore = true;

    while (hasMore && (maxBatches === null || batchCount < maxBatches)) {
      // Fetch items with null/empty tags
      const { data: items, error: fetchError } = await supabase
        .from("feed_items")
        .select("id, source, title, summary, metadata, tags")
        .or("tags.is.null,tags.eq.{}")
        .limit(batchSize);

      if (fetchError) {
        console.error("[backfill_tags] Error fetching items:", fetchError);
        return json({ error: fetchError.message }, 500);
      }

      if (!items || items.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`[backfill_tags] Batch ${batchCount + 1}: Processing ${items.length} items`);

      // Generate tags for each item
      const updates = items.map((item) => ({
        id: item.id,
        tags: deriveTagsForFeedItem(item),
      }));

      // Batch update
      const updatePromises = updates.map((update) =>
        supabase
          .from("feed_items")
          .update({ tags: update.tags })
          .eq("id", update.id)
      );

      const results = await Promise.allSettled(updatePromises);
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      totalUpdated += succeeded;
      batchCount++;

      console.log(`[backfill_tags] Batch ${batchCount}: Updated ${succeeded} items, ${failed} failed`);

      if (items.length < batchSize) {
        hasMore = false;
      }

      // Small delay to avoid overwhelming the database
      if (hasMore) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    console.log(`[backfill_tags] Complete: ${totalUpdated} items updated in ${batchCount} batches`);

    return json({
      ok: true,
      totalUpdated,
      batches: batchCount,
      message: `Backfilled tags for ${totalUpdated} items in ${batchCount} batches`,
    });
  } catch (e: any) {
    console.error("[backfill_tags] Error:", e);
    return json({ error: e?.message ?? String(e) }, 500);
  }
});

