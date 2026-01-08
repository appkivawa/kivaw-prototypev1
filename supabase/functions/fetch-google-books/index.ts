import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

type GoogleBooksRequest = {
  query?: string;
  subject?: string;
  limit?: number;
};

type GoogleBooksVolume = {
  id: string;
  volumeInfo: {
    title: string;
    subtitle?: string;
    description?: string;
    authors?: string[];
    publishedDate?: string;
    imageLinks?: {
      thumbnail?: string;
      smallThumbnail?: string;
      medium?: string;
      large?: string;
    };
    canonicalVolumeLink?: string;
    previewLink?: string;
    infoLink?: string;
    categories?: string[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

type GoogleBooksResponse = {
  items?: GoogleBooksVolume[];
  totalItems: number;
  kind: string;
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
// Google Books API Integration
// ============================================================

async function fetchGoogleBooks(
  query?: string,
  subject?: string,
  limit = 20,
  apiKey?: string
): Promise<GoogleBooksVolume[]> {
  // Google Books v1 API base URL
  const baseUrl = "https://www.googleapis.com/books/v1/volumes";
  const params = new URLSearchParams();
  
  // Build query: if both query and subject provided, combine them
  let searchQuery = "";
  if (query && subject) {
    searchQuery = `${query} subject:${subject}`;
  } else if (query) {
    searchQuery = query;
  } else if (subject) {
    searchQuery = `subject:${subject}`;
  } else {
    searchQuery = "bestseller";
  }
  
  params.append("q", searchQuery);
  params.append("maxResults", String(Math.min(limit, 40))); // Google Books max is 40
  params.append("orderBy", "relevance");

  // Add API key if provided (optional - for higher rate limits)
  if (apiKey && apiKey.trim()) {
    params.append("key", apiKey.trim());
  }

  const url = `${baseUrl}?${params.toString()}`;
  
  // DEV-only debug logging
  if (Deno.env.get("ENVIRONMENT") === "development" || Deno.env.get("DENO_ENV") === "development") {
    console.log("[DEV] Google Books API URL (key redacted):", url.replace(/key=[^&]+/, "key=***"));
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Accept": "application/json",
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error(`Google Books API error: ${response.status} ${response.statusText}`, errorText);
    throw new Error(`Google Books API error: ${response.status} ${response.statusText}. ${errorText}`);
  }

  const data: GoogleBooksResponse = await response.json();
  return data.items || [];
}

function normalizeGoogleBook(book: GoogleBooksVolume): NormalizedContent {
  const volumeInfo = book.volumeInfo;
  
  // Use title (with subtitle if available)
  const title = volumeInfo.subtitle
    ? `${volumeInfo.title}: ${volumeInfo.subtitle}`
    : volumeInfo.title;
  
  // Use thumbnail (force https)
  const imageUrl = volumeInfo.imageLinks?.thumbnail || null;
  const safeImageUrl = imageUrl ? imageUrl.replace(/^http:/, "https:") : null;
  
  // Use infoLink (force https)
  const url = volumeInfo.infoLink || null;
  const safeUrl = url ? url.replace(/^http:/, "https:") : null;

  return {
    provider: "google_books",
    provider_id: book.id,
    type: "read",
    title: title,
    description: volumeInfo.description ?? null,
    image_url: safeImageUrl,
    url: safeUrl,
    raw: book as Record<string, unknown>,
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

  try {
    // Get Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body: GoogleBooksRequest = await req.json().catch(() => ({}));
    const query = body.query;
    const subject = body.subject;
    const limit = body.limit || 20;

    // Check if Google Books provider is enabled
    const { data: providerSettings, error: settingsError } = await supabase
      .from("provider_settings")
      .select("enabled")
      .eq("provider", "google_books")
      .maybeSingle();

    if (settingsError) {
      console.error("Error checking provider settings:", settingsError);
      return jsonResponse({ error: "Failed to check provider settings" }, 500);
    }

    if (!providerSettings || !providerSettings.enabled) {
      return jsonResponse({ disabled: true, items: [] }, 200);
    }

    // Get Google Books API key from secrets (optional - API works without it)
    const GOOGLE_BOOKS_API_KEY = Deno.env.get("GOOGLE_BOOKS_API_KEY");
    
    // DEV-only debug logging (never log the key value)
    if (Deno.env.get("ENVIRONMENT") === "development" || Deno.env.get("DENO_ENV") === "development") {
      console.log("[DEV] GOOGLE_BOOKS_API_KEY exists:", !!GOOGLE_BOOKS_API_KEY);
    }
    
    // API key is optional - Google Books API works without it (with lower rate limits)
    const googleBooksApiKey = GOOGLE_BOOKS_API_KEY?.trim() || undefined;

    // Fetch books from Google Books
    const books = await fetchGoogleBooks(query, subject, limit, googleBooksApiKey);

    // Normalize and upsert to cache
    const normalizedContent = books.map(normalizeGoogleBook);
    
    const cacheInserts = normalizedContent.map((content) => ({
      provider: content.provider,
      provider_id: content.provider_id,
      type: content.type,
      title: content.title,
      description: content.description,
      image_url: content.image_url,
      url: content.url,
      raw: content.raw,
    }));

    // Upsert to external_content_cache and get cache IDs
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
            // Extract categories from raw Google Books data
            const categories: string[] = [];
            if (content.raw?.volumeInfo?.categories && Array.isArray(content.raw.volumeInfo.categories)) {
              categories.push(...content.raw.volumeInfo.categories.map(String));
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
              categories // Google Books categories
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
  } catch (error) {
    console.error("Error in fetch-google-books:", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

