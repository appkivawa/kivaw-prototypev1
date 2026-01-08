import { supabase } from "../../lib/supabaseClient";

// ============================================================
// Types
// ============================================================

/**
 * Normalized content item from external providers
 */
export type ExternalContentItem = {
  provider: string;
  provider_id: string;
  type: "watch" | "read" | "listen" | "event";
  title: string;
  description: string | null;
  image_url: string | null;
  url: string | null;
  raw: Record<string, unknown>;
};

/**
 * Response from edge function when provider is disabled
 */
type DisabledResponse = {
  disabled: true;
  message: string;
};

/**
 * Success response from edge function
 */
type SuccessResponse = {
  items: ExternalContentItem[];
};

/**
 * Error response from edge function
 */
type ErrorResponse = {
  error: string;
};

type EdgeFunctionResponse = DisabledResponse | SuccessResponse | ErrorResponse;

// ============================================================
// Helper Functions
// ============================================================

/**
 * Check if response indicates provider is disabled
 */
function isDisabledResponse(response: EdgeFunctionResponse): response is DisabledResponse {
  return "disabled" in response && response.disabled === true;
}

/**
 * Check if response is an error
 */
function isErrorResponse(response: EdgeFunctionResponse): response is ErrorResponse {
  return "error" in response && !("success" in response);
}

/**
 * Check if response is successful
 */
function isSuccessResponse(response: EdgeFunctionResponse): response is SuccessResponse {
  return "items" in response && Array.isArray(response.items);
}

/**
 * Invoke edge function with error handling
 */
async function invokeEdgeFunction(
  functionName: string,
  body: Record<string, unknown>
): Promise<EdgeFunctionResponse> {
  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body,
    });

    if (error) {
      console.error(`[contentProviders] Error invoking ${functionName}:`, error);
      return { error: error.message || "Unknown error occurred" };
    }

    if (!data) {
      return { error: "No data returned from edge function" };
    }

    return data as EdgeFunctionResponse;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error(`[contentProviders] Exception invoking ${functionName}:`, err);
    return { error: errorMessage };
  }
}

// ============================================================
// TMDB (Movies) Functions
// ============================================================

/**
 * Search for movies using TMDB API
 * 
 * @param query - Search query (e.g., "inception")
 * @param limit - Maximum number of results (default: 20)
 * @returns Promise<ExternalContentItem[]> - Array of normalized movie items, or empty array if disabled/error
 */
export async function searchMovies(
  query: string,
  limit = 20
): Promise<ExternalContentItem[]> {
  const response = await invokeEdgeFunction("fetch-tmdb", {
    query: query.trim(),
    limit: Math.max(1, Math.min(limit, 40)), // Clamp between 1-40
  });

  if (isDisabledResponse(response)) {
    console.warn("[contentProviders] TMDB provider is disabled:", response.message);
    return [];
  }

  if (isErrorResponse(response)) {
    console.error("[contentProviders] Error searching movies:", response.error);
    return [];
  }

  if (isSuccessResponse(response)) {
    return response.items;
  }

  return [];
}

/**
 * Get trending/popular movies from TMDB
 * 
 * @param limit - Maximum number of results (default: 20)
 * @returns Promise<ExternalContentItem[]> - Array of normalized movie items, or empty array if disabled/error
 */
export async function getTrendingMovies(
  limit = 20
): Promise<ExternalContentItem[]> {
  const response = await invokeEdgeFunction("fetch-tmdb", {
    limit: Math.max(1, Math.min(limit, 40)), // Clamp between 1-40
  });

  if (isDisabledResponse(response)) {
    console.warn("[contentProviders] TMDB provider is disabled:", response.message);
    return [];
  }

  if (isErrorResponse(response)) {
    console.error("[contentProviders] Error fetching trending movies:", response.error);
    return [];
  }

  if (isSuccessResponse(response)) {
    return response.items;
  }

  return [];
}

// ============================================================
// Google Books Functions
// ============================================================

/**
 * Search for books using Google Books API
 * 
 * @param query - Search query (e.g., "meditation", "self-help")
 * @param limit - Maximum number of results (default: 20)
 * @returns Promise<ExternalContentItem[]> - Array of normalized book items, or empty array if disabled/error
 */
export async function searchBooks(
  query: string,
  limit = 20
): Promise<ExternalContentItem[]> {
  const response = await invokeEdgeFunction("fetch-google-books", {
    query: query.trim(),
    limit: Math.max(1, Math.min(limit, 40)), // Clamp between 1-40
  });

  if (isDisabledResponse(response)) {
    console.warn("[contentProviders] Google Books provider is disabled:", response.message);
    return [];
  }

  if (isErrorResponse(response)) {
    console.error("[contentProviders] Error searching books:", response.error);
    return [];
  }

  if (isSuccessResponse(response)) {
    return response.items;
  }

  return [];
}

/**
 * Get suggested books by subject from Google Books API
 * 
 * @param subject - Subject category (e.g., "self-help", "meditation", "philosophy")
 * @param limit - Maximum number of results (default: 20)
 * @returns Promise<ExternalContentItem[]> - Array of normalized book items, or empty array if disabled/error
 */
export async function getSuggestedBooks(
  subject: string,
  limit = 20
): Promise<ExternalContentItem[]> {
  const response = await invokeEdgeFunction("fetch-google-books", {
    subject: subject.trim(),
    limit: Math.max(1, Math.min(limit, 40)), // Clamp between 1-40
  });

  if (isDisabledResponse(response)) {
    console.warn("[contentProviders] Google Books provider is disabled:", response.message);
    return [];
  }

  if (isErrorResponse(response)) {
    console.error("[contentProviders] Error fetching suggested books:", response.error);
    return [];
  }

  if (isSuccessResponse(response)) {
    return response.items;
  }

  return [];
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Check if a provider is enabled
 * 
 * @param provider - Provider name ("tmdb" or "google_books")
 * @returns Promise<boolean> - True if provider is enabled
 */
export async function isProviderEnabled(provider: "tmdb" | "google_books"): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("provider_settings")
      .select("enabled")
      .eq("provider", provider)
      .maybeSingle();

    if (error) {
      console.error(`[contentProviders] Error checking provider status for ${provider}:`, error);
      return false;
    }

    return data?.enabled === true;
  } catch (err) {
    console.error(`[contentProviders] Exception checking provider status for ${provider}:`, err);
    return false;
  }
}

/**
 * Convert ExternalContentItem to a format compatible with ContentItem
 * (for use in existing UI components)
 * 
 * @param item - External content item
 * @returns Partial ContentItem-like object
 */
export function externalToContentItem(item: ExternalContentItem) {
  return {
    id: `${item.provider}_${item.provider_id}`,
    external_id: item.provider_id,
    kind: item.type === "watch" ? "Visual" : item.type === "read" ? "Book" : "Other",
    title: item.title,
    byline: item.provider === "tmdb" ? "TMDB" : "Google Books",
    meta: item.type,
    image_url: item.image_url,
    url: item.url,
    source: item.provider,
  };
}

