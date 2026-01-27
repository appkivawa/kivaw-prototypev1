import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logHealthEvent } from "./_shared/logHealthEvent.ts";

// --------------------
// CORS
// --------------------
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret, x-ingest-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
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

async function safeJson(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

// Call internal function with timeout and CRON_SECRET
async function callInternalFunction(args: {
  supabaseUrl: string;
  serviceKey: string;
  cronSecret: string;
  functionName: string;
  body: Record<string, unknown>;
  timeoutMs?: number;
  extraHeaders?: Record<string, string>;
}): Promise<{ ok: boolean; status: number; data: unknown; error?: string }> {
  const url = `${args.supabaseUrl}/functions/v1/${args.functionName}`;
  const timeoutMs = args.timeoutMs ?? 20000; // Default 20s

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${args.serviceKey}`,
        apikey: args.serviceKey,
        "x-cron-secret": args.cronSecret,
        ...(args.extraHeaders ?? {}),
      },
      body: JSON.stringify(args.body ?? {}),
    });

    clearTimeout(timeoutId);
    const data = await safeJson(res);
    return { ok: res.ok, status: res.status, data };
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e.name === "AbortError") {
      return { ok: false, status: 408, data: {}, error: "Request timeout" };
    }
    return { ok: false, status: 500, data: {}, error: e?.message ?? String(e) };
  }
}

// Update system_health table
async function updateSystemHealth(
  supabase: ReturnType<typeof createClient>,
  key: string,
  lastOk: boolean,
  lastError: string | null,
  meta: Record<string, unknown> = {}
): Promise<void> {
  try {
    const { error } = await supabase
      .from("system_health")
      .upsert(
        {
          key,
          last_run_at: new Date().toISOString(),
          last_ok: lastOk,
          last_error: lastError,
          meta,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );

    if (error) {
      console.error(`[cron_runner] Failed to update system_health for ${key}:`, error);
    }
  } catch (e) {
    console.error(`[cron_runner] Exception updating system_health for ${key}:`, e);
  }
}

// Prune stale RSS items (mark undiscoverable)
async function pruneStaleRss(
  supabase: ReturnType<typeof createClient>,
  daysOld: number = 14
): Promise<{ pruned: number }> {
  try {
    const { data, error } = await supabase.rpc("prune_stale_rss", { days_old: daysOld });
    if (error) {
      console.error("[cron_runner] RSS prune error:", error);
      return { pruned: 0 };
    }
    const pruned = Array.isArray(data) && data.length > 0 ? (data[0]?.pruned_count ?? 0) : 0;
    return { pruned };
  } catch (e) {
    console.error("[cron_runner] RSS prune exception:", e);
    return { pruned: 0 };
  }
}

// --------------------
// Main (Orchestration)
// --------------------
serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  // Smoke test
  if (req.method === "GET") {
    return json({ ok: true, fn: "cron_runner", version: "2026-01-27" });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const runStartedAt = new Date();
  let supabase: ReturnType<typeof createClient> | null = null;
  let job: string = "unknown";

  try {
    // Check CRON_SECRET
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

    const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") ?? "").trim();
    const SERVICE_KEY = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, 500);
    }

    // Parse job type from body
    const body = await req.json().catch(() => ({}));
    job = (body.job as "hourly" | "six_hour" | "daily" | undefined) || "unknown";

    if (!job || !["hourly", "six_hour", "daily"].includes(job)) {
      return json({ error: "Invalid job. Must be: hourly, six_hour, or daily" }, 400);
    }

    supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Update health: running
    await updateSystemHealth(supabase, `cron_runner:${job}`, false, null, { status: "running" });

    const results: Record<string, unknown> = {};
    let overallOk = true;

    // ============================================================
    // JOB: hourly - RSS ingestion
    // ============================================================
    if (job === "hourly") {
      const INGEST_SECRET = (Deno.env.get("INGEST_SECRET") ?? "").trim();
      const ingestHeaders = INGEST_SECRET ? { "x-ingest-secret": INGEST_SECRET } : {};

      const rssResult = await callInternalFunction({
        supabaseUrl: SUPABASE_URL,
        serviceKey: SERVICE_KEY,
        cronSecret: CRON_SECRET || "dev",
        functionName: "ingest_rss",
        body: { maxFeeds: 25, perFeedLimit: 75 },
        timeoutMs: 15000,
        extraHeaders: ingestHeaders,
      });

      results.rss = rssResult;
      overallOk = overallOk && rssResult.ok;

      await updateSystemHealth(
        supabase,
        `cron_runner:${job}`,
        rssResult.ok,
        rssResult.error || (rssResult.ok ? null : "RSS ingest failed"),
        {
          status: rssResult.ok ? "success" : "error",
          counts: typeof rssResult.data === "object" && rssResult.data !== null && "ingested" in rssResult.data
            ? { ingested: rssResult.data.ingested }
            : {},
          ...(typeof rssResult.data === "object" && rssResult.data !== null ? rssResult.data : {}),
        }
      );
    }

    // ============================================================
    // JOB: six_hour - Refresh watch content (TMDB)
    // ============================================================
    if (job === "six_hour") {
      const tmdbResult = await callInternalFunction({
        supabaseUrl: SUPABASE_URL,
        serviceKey: SERVICE_KEY,
        cronSecret: CRON_SECRET || "dev",
        functionName: "sync-external-content",
        body: {},
        timeoutMs: 20000,
      });

      results.tmdb = tmdbResult;
      overallOk = overallOk && tmdbResult.ok;

      await updateSystemHealth(
        supabase,
        `cron_runner:${job}`,
        tmdbResult.ok,
        tmdbResult.error || (tmdbResult.ok ? null : "TMDB sync failed"),
        {
          status: tmdbResult.ok ? "success" : "error",
          ...(typeof tmdbResult.data === "object" && tmdbResult.data !== null ? tmdbResult.data : {}),
        }
      );
    }

    // ============================================================
    // JOB: daily - Refresh books + prune RSS
    // ============================================================
    if (job === "daily") {
      // Fetch Open Library books
      const olResult = await callInternalFunction({
        supabaseUrl: SUPABASE_URL,
        serviceKey: SERVICE_KEY,
        cronSecret: CRON_SECRET || "dev",
        functionName: "fetch-open-library",
        body: { limit: 20 },
        timeoutMs: 15000,
      });

      results.openLibrary = olResult;
      overallOk = overallOk && olResult.ok;

      // Fetch Google Books (if enabled)
      const gbResult = await callInternalFunction({
        supabaseUrl: SUPABASE_URL,
        serviceKey: SERVICE_KEY,
        cronSecret: CRON_SECRET || "dev",
        functionName: "fetch-google-books",
        body: { q: "popular", maxResults: 20 },
        timeoutMs: 15000,
      });

      results.googleBooks = gbResult;
      overallOk = overallOk && gbResult.ok;

      // Prune RSS older than 14 days
      const pruneResult = await pruneStaleRss(supabase, 14);
      results.prune = pruneResult;

      await updateSystemHealth(
        supabase,
        `cron_runner:${job}`,
        overallOk,
        overallOk ? null : "One or more daily jobs failed",
        {
          status: overallOk ? "success" : "error",
          openLibrary: {
            ok: olResult.ok,
            ...(typeof olResult.data === "object" && olResult.data !== null ? olResult.data : {}),
          },
          googleBooks: {
            ok: gbResult.ok,
            ...(typeof gbResult.data === "object" && gbResult.data !== null ? gbResult.data : {}),
          },
          prune: pruneResult,
        }
      );
    }

    const durationMs = Date.now() - runStartedAt.getTime();
    
    // Log health event for cron_runner
    if (supabase) {
      await logHealthEvent(supabase, {
        jobName: `cron_runner:${job}`,
        status: overallOk ? "ok" : "fail",
        durationMs,
        errorMessage: overallOk ? null : "One or more jobs failed",
        metadata: {
          job,
          results,
        },
      });
    }
    
    return json({
      ok: overallOk,
      job,
      results,
      ranAt: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error("[cron_runner] Unhandled error:", e);
    const errorMsg = e?.message ?? String(e) ?? "Unknown error";
    const durationMs = Date.now() - runStartedAt.getTime();

    if (supabase) {
      await updateSystemHealth(
        supabase,
        `cron_runner:${job}`,
        false,
        errorMsg,
        { status: "error" }
      );
      
      // Log health event for failure
      await logHealthEvent(supabase, {
        jobName: `cron_runner:${job}`,
        status: "fail",
        durationMs,
        errorMessage: errorMsg,
      });
    }

    return json({ ok: false, error: errorMsg }, 500);
  }
});
