import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logHealthEvent } from "./_shared/logHealthEvent.ts";

// ============================================================
// CORS Headers
// ============================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ============================================================
// Types
// ============================================================

type OpenLibraryRequest = {
  query?: string;
  limit?: number;
};

type OpenLibraryDoc = {
  key?: string;
  title?: string;
  first_sentence?: string | string[];
  cover_i?: number;
  edition_key?: string[];
  first_publish_year?: number;
  [key: string]: unknown;
};

type OpenLibraryResponse = {
  docs?: OpenLibraryDoc[];
  numFound?: number;
  start?: number;
  [key: string]: unknown;
};

type NormalizedContent = {
  provider: string;
  provider_id: string;
  type: "watch" | "read" | "listen" | "event";
  title: string;
  description: string | null;
  image_url: string | null;
  url: string | null;
  raw: Record<string, unknown>;
};

// ============================================================
// Open Library API Integration
// ============================================================

async function fetchOpenLibrary(
  query?: string,
  limit = 20
): Promise<OpenLibraryDoc[]> {
  const baseUrl = "https://openlibrary.org/search.json";
  const params = new URLSearchParams();
  
  // Build query - default to popular books if no query provided
  const searchQuery = query || "popular";
  params.append("q", searchQuery);
  params.append("limit", String(Math.min(limit * 3, 100))); // Fetch more to filter by year
  params.append("sort", "new"); // Sort by newest first when available

  const url = `${baseUrl}?${params.toString()}`;
  
  // DEV-only debug logging
  if (Deno.env.get("ENVIRONMENT") === "development" || Deno.env.get("DENO_ENV") === "development") {
    console.log("[DEV] Open Library API URL:", url);
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Accept": "application/json",
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error(`Open Library API error: ${response.status} ${response.statusText}`, errorText);
    throw new Error(`Open Library API error: ${response.status} ${response.statusText}. ${errorText}`);
  }

  const data: OpenLibraryResponse = await response.json();
  const allDocs = data.docs || [];
  
  // Filter to modern books (2000+), exclude obvious classics (< 1950)
  // Prioritize very recent (2020+), then 2010+, then 2000+
  const veryRecent = allDocs.filter((doc) => {
    const year = doc.first_publish_year;
    return year && typeof year === "number" && year >= 2020 && year >= 1950;
  });
  
  // Sort by year descending (newest first)
  veryRecent.sort((a, b) => {
    const yearA = (a.first_publish_year as number) || 0;
    const yearB = (b.first_publish_year as number) || 0;
    return yearB - yearA;
  });
  
  if (veryRecent.length >= limit) {
    return veryRecent.slice(0, limit);
  }
  
  // Fallback to 2010+ if not enough 2020+ books
  const modern2010 = allDocs.filter((doc) => {
    const year = doc.first_publish_year;
    return year && typeof year === "number" && year >= 2010 && year >= 1950;
  });
  
  // Sort by year descending
  modern2010.sort((a, b) => {
    const yearA = (a.first_publish_year as number) || 0;
    const yearB = (b.first_publish_year as number) || 0;
    return yearB - yearA;
  });
  
  if (modern2010.length >= limit) {
    return modern2010.slice(0, limit);
  }
  
  // Final fallback to 2000+ if still not enough (but still exclude < 1950)
  const modern2000 = allDocs.filter((doc) => {
    const year = doc.first_publish_year;
    return year && typeof year === "number" && year >= 2000 && year >= 1950;
  });
  
  modern2000.sort((a, b) => {
    const yearA = (a.first_publish_year as number) || 0;
    const yearB = (b.first_publish_year as number) || 0;
    return yearB - yearA;
  });
  
  return modern2000.slice(0, limit);
}

// Fetch Work or Edition details for description
async function fetchOpenLibraryDetails(workKey: string): Promise<{ description?: string | { value?: string } } | null> {
  try {
    // Try Work endpoint first (e.g., /works/OL27448W.json)
    const workUrl = `https://openlibrary.org${workKey.startsWith("/") ? workKey : `/${workKey}`}.json`;
    const response = await fetch(workUrl, {
      headers: { "Accept": "application/json" },
    });
    
    if (response.ok) {
      const data = await response.json();
      return data;
    }
  } catch (e) {
    // Fail silently
  }
  return null;
}

function normalizeOpenLibraryBook(doc: OpenLibraryDoc): NormalizedContent {
  // Get provider_id: use doc.key if available, otherwise use first edition_key
  const providerId = doc.key || (doc.edition_key && doc.edition_key[0] ? doc.edition_key[0] : null);
  
  if (!providerId) {
    throw new Error("Open Library doc missing both key and edition_key");
  }

  // Get title
  const title = doc.title || "Untitled";

  // Get description from first_sentence
  let description: string | null = null;
  if (doc.first_sentence) {
    if (Array.isArray(doc.first_sentence)) {
      description = doc.first_sentence.join(" ");
    } else {
      description = String(doc.first_sentence);
    }
  }

  // Get image_url from cover_i
  const imageUrl = doc.cover_i 
    ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
    : null;

  // Get url from key
  const url = doc.key 
    ? `https://openlibrary.org${doc.key}`
    : null;

  // Extract first_publish_year from raw doc
  const firstPublishYear = (doc as any).first_publish_year;

  return {
    provider: "open_library",
    provider_id: providerId,
    type: "read",
    title: title,
    description: description,
    image_url: imageUrl,
    url: url,
    raw: {
      ...(doc as Record<string, unknown>),
      first_publish_year: firstPublishYear,
    },
  };
}

// ============================================================
// Tagging Logic (shared module)
// ============================================================

import {
  computeTagsForContent,
  storeTagsForCache,
} from "../_shared/tagging.ts";

// ============================================================
// Main Handler
// ============================================================

serve(async (req) => {
  // Handle OPTIONS preflight
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Smoke test
  if (req.method === "GET") {
    return jsonResponse({ ok: true, fn: "fetch-open-library", version: "2026-01-27" });
  }

  const startTime = Date.now();
  let supabase: ReturnType<typeof createClient> | null = null;

  try {
    // Check CRON_SECRET if set (for internal cron calls)
    const CRON_SECRET = (Deno.env.get("CRON_SECRET") ?? "").trim();
    if (CRON_SECRET) {
      const got = (req.headers.get("x-cron-secret") ?? "").trim();
      if (got !== CRON_SECRET) {
        // Allow service role key as fallback (for direct calls)
        const authHeader = req.headers.get("Authorization");
        if (!authHeader || !authHeader.includes("Bearer")) {
          return jsonResponse({ error: "Forbidden: Missing or invalid x-cron-secret" }, 403);
        }
      }
    }

    // Get Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body: OpenLibraryRequest = await req.json().catch(() => ({}));
    const query = body.query;
    const limit = body.limit || 20;

    // Check if Open Library provider is enabled
    const { data: providerSettings, error: settingsError } = await supabase
      .from("provider_settings")
      .select("enabled")
      .eq("provider", "open_library")
      .maybeSingle();

    if (settingsError) {
      console.error("Error checking provider settings:", settingsError);
      return jsonResponse({ error: "Failed to check provider settings" }, 500);
    }

    if (!providerSettings || !providerSettings.enabled) {
      return jsonResponse({ disabled: true, items: [] }, 200);
    }

    // Fetch books from Open Library
    const books = await fetchOpenLibrary(query, limit);

    // Normalize first (without descriptions from detail endpoints)
    let normalizedContent = books
      .map((doc) => {
        try {
          return normalizeOpenLibraryBook(doc);
        } catch (error) {
          console.error("Error normalizing Open Library doc:", error, doc);
          return null;
        }
      })
      .filter((item): item is NormalizedContent => item !== null);

    // For selected items, fetch Work details to get descriptions
    // Only fetch for final selected set (not all results)
    for (const content of normalizedContent) {
      const workKey = content.raw?.key as string | undefined;
      if (workKey && !content.description) {
        try {
          const details = await fetchOpenLibraryDetails(workKey);
          if (details?.description) {
            // Extract description - can be string or {value: string}
            let desc: string | null = null;
            if (typeof details.description === "string") {
              desc = details.description;
            } else if (details.description && typeof details.description === "object" && "value" in details.description) {
              desc = String(details.description.value || "");
            }
            
            if (desc) {
              content.description = desc;
              // Also update raw
              content.raw = {
                ...content.raw,
                description: desc,
              };
            }
          }
        } catch (e) {
          // Fail silently - continue with existing description or null
        }
      }
    }
    
    const cacheInserts = normalizedContent.map((content) => ({
      provider: content.provider,
      provider_id: content.provider_id,
      type: content.type,
      title: content.title,
      description: content.description,
      image_url: content.image_url,
      url: content.url,
      raw: content.raw,
      fetched_at: new Date().toISOString(),
    }));

    // Upsert to external_content_cache and get cache IDs
    // Conflict key is (provider, provider_id) - type is included but not in conflict
    const { data: cachedData, error: upsertError } = await supabase
      .from("external_content_cache")
      .upsert(cacheInserts, {
        onConflict: "provider,provider_id",
        ignoreDuplicates: false,
      })
      .select("id, provider, provider_id");

    if (upsertError) {
      console.error("Error upserting to cache:", upsertError);
      // Continue anyway - return results even if cache update fails
    }

    // Compute and store tags for each cached item
    if (cachedData && cachedData.length > 0) {
      for (const cachedItem of cachedData) {
        try {
          const content = normalizedContent.find(
            (c) => c.provider === cachedItem.provider && c.provider_id === cachedItem.provider_id
          );
          
          if (content) {
            // Extract subjects/genres from raw Open Library data
            const subjects: string[] = [];
            if (content.raw?.subject && Array.isArray(content.raw.subject)) {
              subjects.push(...content.raw.subject.map(String).slice(0, 5)); // Limit to first 5
            }

            // Compute tags (auto-tags + overrides merged)
            const tags = await computeTagsForContent(
              supabase,
              content.provider,
              content.provider_id,
              content.type,
              content.title,
              content.description,
              [], // No genres for books
              subjects // Open Library subjects
            );
            
            // Store tags in content_tags table
            await storeTagsForCache(supabase, cachedItem.id, tags);
          }
        } catch (tagError) {
          console.error(`Error tagging content ${cachedItem.id}:`, tagError);
          // Continue with other items even if one fails
        }
      }
    }

    // Return normalized content
    return jsonResponse({
      items: normalizedContent,
    });
    
    const durationMs = Date.now() - startTime;
    await logHealthEvent(supabase, {
      jobName: "fetch-open-library",
      status: "ok",
      durationMs,
      metadata: {
        items: normalizedContent.length,
      },
    });
    
    return jsonResponse({
      ok: true,
      items: normalizedContent,
    });
  } catch (error) {
    console.error("Error in fetch-open-library:", error);
    const durationMs = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    
    if (supabase) {
      await logHealthEvent(supabase, {
        jobName: "fetch-open-library",
        status: "fail",
        durationMs,
        errorMessage: errorMsg,
      });
    }
    
    return jsonResponse(
      {
        error: errorMsg,
      },
      500
    );
  }
});

