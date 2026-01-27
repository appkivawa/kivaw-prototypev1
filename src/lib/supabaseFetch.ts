/**
 * Consistent Supabase fetch wrapper
 * 
 * Normalizes errors, attaches request IDs, logs in DEV only
 */

import { supabase } from "./supabaseClient";

export type FetchError = {
  requestId: string;
  message: string;
  code?: string;
  status?: number;
  details?: string;
  originalError?: unknown;
};

export type FetchResult<T> = {
  data: T | null;
  error: FetchError | null;
  requestId: string;
};

// Generate unique request ID
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Normalize Supabase error to standard shape
function normalizeError(error: any, requestId: string): FetchError {
  const fetchError: FetchError = {
    requestId,
    message: "An unexpected error occurred",
    originalError: error,
  };

  // Supabase PostgrestError
  if (error?.code) {
    fetchError.code = error.code;
    fetchError.message = error.message || fetchError.message;
    fetchError.details = error.details;
    
    // Map common error codes to user-friendly messages
    if (error.code === "42P01") {
      fetchError.message = "Database table not found. Please contact support.";
    } else if (error.code === "42501") {
      fetchError.message = "Permission denied. You may not have access to this resource.";
    } else if (error.code === "23505") {
      fetchError.message = "This item already exists.";
    } else if (error.code === "PGRST116") {
      fetchError.message = "No rows found.";
    }
  }
  // Supabase FunctionsHttpError
  else if (error?.status || error?.statusCode) {
    fetchError.status = error.status || error.statusCode;
    fetchError.message = error.message || fetchError.message;
    
    // Map HTTP status codes
    if (fetchError.status === 401) {
      fetchError.message = "Authentication required. Please log in.";
    } else if (fetchError.status === 403) {
      fetchError.message = "Access forbidden. You don't have permission.";
    } else if (fetchError.status === 404) {
      fetchError.message = "Resource not found.";
    } else if (fetchError.status === 500) {
      fetchError.message = "Server error. Please try again later.";
    }
  }
  // Generic Error
  else if (error?.message) {
    fetchError.message = error.message;
  }
  // String error
  else if (typeof error === "string") {
    fetchError.message = error;
  }

  return fetchError;
}

// Log in DEV only
function logFetch(level: "info" | "warn" | "error", requestId: string, message: string, meta?: Record<string, unknown>) {
  if (import.meta.env.DEV) {
    const timestamp = new Date().toISOString();
    console.log(JSON.stringify({
      timestamp,
      level,
      requestId,
      message,
      ...meta,
    }));
  }
}

/**
 * Fetch from Supabase table
 */
export async function fetchTable<T = any>(
  table: string,
  options: {
    select?: string;
    filters?: Record<string, unknown>;
    orderBy?: { column: string; ascending?: boolean };
    limit?: number;
    single?: boolean;
  } = {}
): Promise<FetchResult<T>> {
  const requestId = generateRequestId();
  const startTime = Date.now();

  try {
    logFetch("info", requestId, "Fetching from table", { table, options });

    let query = supabase.from(table).select(options.select || "*");

    // Apply filters
    if (options.filters) {
      Object.entries(options.filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });
    }

    // Apply ordering
    if (options.orderBy) {
      query = query.order(options.orderBy.column, {
        ascending: options.orderBy.ascending ?? true,
      });
    }

    // Apply limit
    if (options.limit) {
      query = query.limit(options.limit);
    }

    // Execute query
    const { data, error } = options.single
      ? await query.maybeSingle()
      : await query;

    const duration = Date.now() - startTime;

    if (error) {
      const fetchError = normalizeError(error, requestId);
      logFetch("error", requestId, "Table fetch failed", {
        table,
        error: fetchError.message,
        code: fetchError.code,
        duration,
      });
      return { data: null, error: fetchError, requestId };
    }

    logFetch("info", requestId, "Table fetch successful", {
      table,
      count: Array.isArray(data) ? data.length : (data ? 1 : 0),
      duration,
    });

    return { data: data as T, error: null, requestId };
  } catch (e: any) {
    const duration = Date.now() - startTime;
    const fetchError = normalizeError(e, requestId);
    logFetch("error", requestId, "Table fetch exception", {
      table,
      error: fetchError.message,
      duration,
    });
    return { data: null, error: fetchError, requestId };
  }
}

/**
 * Invoke Supabase Edge Function
 */
export async function invokeFunction<T = any>(
  functionName: string,
  body?: Record<string, unknown>
): Promise<FetchResult<T>> {
  const requestId = generateRequestId();
  const startTime = Date.now();

  try {
    logFetch("info", requestId, "Invoking function", { functionName, hasBody: !!body });

    const { data, error } = await supabase.functions.invoke<T>(functionName, {
      body: body || {},
    });

    const duration = Date.now() - startTime;

    if (error) {
      const fetchError = normalizeError(error, requestId);
      logFetch("error", requestId, "Function invocation failed", {
        functionName,
        error: fetchError.message,
        status: fetchError.status,
        duration,
      });
      return { data: null, error: fetchError, requestId };
    }

    // Check for function-level errors in response
    if (data && typeof data === "object" && "error" in data) {
      const fetchError: FetchError = {
        requestId,
        message: (data as any).error || "Function returned an error",
        details: (data as any).message,
      };
      logFetch("error", requestId, "Function returned error", {
        functionName,
        error: fetchError.message,
        duration,
      });
      return { data: null, error: fetchError, requestId };
    }

    logFetch("info", requestId, "Function invocation successful", {
      functionName,
      duration,
    });

    return { data, error: null, requestId };
  } catch (e: any) {
    const duration = Date.now() - startTime;
    const fetchError = normalizeError(e, requestId);
    logFetch("error", requestId, "Function invocation exception", {
      functionName,
      error: fetchError.message,
      duration,
    });
    return { data: null, error: fetchError, requestId };
  }
}

/**
 * Call Supabase RPC function
 */
export async function callRPC<T = any>(
  functionName: string,
  params?: Record<string, unknown>
): Promise<FetchResult<T>> {
  const requestId = generateRequestId();
  const startTime = Date.now();

  try {
    logFetch("info", requestId, "Calling RPC", { functionName, hasParams: !!params });

    const { data, error } = await supabase.rpc(functionName, params || {}) as { data: T | null; error: any };

    const duration = Date.now() - startTime;

    if (error) {
      const fetchError = normalizeError(error, requestId);
      logFetch("error", requestId, "RPC call failed", {
        functionName,
        error: fetchError.message,
        code: fetchError.code,
        duration,
      });
      return { data: null, error: fetchError, requestId };
    }

    logFetch("info", requestId, "RPC call successful", {
      functionName,
      duration,
    });

    return { data, error: null, requestId };
  } catch (e: any) {
    const duration = Date.now() - startTime;
    const fetchError = normalizeError(e, requestId);
    logFetch("error", requestId, "RPC call exception", {
      functionName,
      error: fetchError.message,
      duration,
    });
    return { data: null, error: fetchError, requestId };
  }
}
