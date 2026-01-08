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
  items: [];
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
  return "error" in response && !("items" in response);
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
      console.error(`[externalProviders] Error invoking ${functionName}:`, error);
      return { error: error.message || "Unknown error occurred" };
    }

    if (!data) {
      return { error: "No data returned from edge function" };
    }

    return data as EdgeFunctionResponse;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error(`[externalProviders] Exception invoking ${functionName}:`, err);
    return { error: errorMessage };
  }
}

// ============================================================
// Provider Functions
// ============================================================

/**
 * Fetch movies from TMDB
 * 
 * @param options - Query options
 * @param options.query - Optional search query
 * @param options.limit - Maximum number of results (default: 20)
 * @returns Promise<ExternalContentItem[]> - Array of normalized movie items, or empty array if disabled/error
 */
export async function fetchMovies(options?: {
  query?: string;
  limit?: number;
}): Promise<ExternalContentItem[]> {
  const query = options?.query?.trim();
  const limit = options?.limit || 20;

  const response = await invokeEdgeFunction("fetch-tmdb", {
    ...(query ? { query } : {}),
    limit: Math.max(1, Math.min(limit, 40)), // Clamp between 1-40
  });

  if (isDisabledResponse(response)) {
    console.warn("[externalProviders] TMDB provider is disabled");
    return [];
  }

  if (isErrorResponse(response)) {
    console.error("[externalProviders] Error fetching movies:", response.error);
    return [];
  }

  if (isSuccessResponse(response)) {
    return response.items;
  }

  return [];
}

/**
 * Fetch books from Google Books
 * 
 * @param options - Query options
 * @param options.query - Optional search query
 * @param options.subject - Optional subject filter
 * @param options.limit - Maximum number of results (default: 20)
 * @returns Promise<ExternalContentItem[]> - Array of normalized book items, or empty array if disabled/error
 */
export async function fetchBooks(options?: {
  query?: string;
  subject?: string;
  limit?: number;
}): Promise<ExternalContentItem[]> {
  const query = options?.query?.trim();
  const subject = options?.subject?.trim();
  const limit = options?.limit || 20;

  const response = await invokeEdgeFunction("fetch-google-books", {
    ...(query ? { query } : {}),
    ...(subject ? { subject } : {}),
    limit: Math.max(1, Math.min(limit, 40)), // Clamp between 1-40
  });

  if (isDisabledResponse(response)) {
    console.warn("[externalProviders] Google Books provider is disabled");
    return [];
  }

  if (isErrorResponse(response)) {
    console.error("[externalProviders] Error fetching books:", response.error);
    return [];
  }

  if (isSuccessResponse(response)) {
    return response.items;
  }

  return [];
}


