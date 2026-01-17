import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

async function callInternalFunction(args: {
  supabaseUrl: string;
  serviceKey: string;
  functionName: string;
  body: Record<string, unknown>;
  extraHeaders?: Record<string, string>;
}): Promise<{ ok: boolean; status: number; data: unknown }> {
  const url = `${args.supabaseUrl}/functions/v1/${args.functionName}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Supabase gateway verification (JWT). Service role key is a JWT and works here.
      Authorization: `Bearer ${args.serviceKey}`,
      apikey: args.serviceKey,
      ...(args.extraHeaders ?? {}),
    },
    body: JSON.stringify(args.body ?? {}),
  });

  const data = await safeJson(res);
  return { ok: res.ok, status: res.status, data };
}

// --------------------
// Logging to ingestion_runs
// --------------------
async function logIngestionRun(
  supabase: ReturnType<typeof createClient>,
  jobName: string,
  status: "success" | "error" | "running",
  startedAt: Date,
  finishedAt: Date | null = null,
  details: Record<string, unknown> = {},
  errorMessage: string | null = null
): Promise<void> {
  try {
    const { error } = await supabase.from("ingestion_runs").insert({
      job_name: jobName,
      status,
      started_at: startedAt.toISOString(),
      finished_at: finishedAt?.toISOString() ?? null,
      details,
      error_message: errorMessage,
    });

    if (error) {
      console.error(`[cron_runner] Failed to log ingestion run for ${jobName}:`, error);
      // Don't throw - logging failure shouldn't break ingestion
    } else {
      console.log(`[cron_runner] Logged ingestion run: ${jobName} - ${status}`);
    }
  } catch (e) {
    console.error(`[cron_runner] Exception logging ingestion run for ${jobName}:`, e);
    // Don't throw - logging failure shouldn't break ingestion
  }
}

// --------------------
// Main (Orchestration only)
// --------------------
serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  // Smoke test
  if (req.method === "GET") {
    return json({ ok: true, fn: "cron_runner" });
  }

  const runStartedAt = new Date();
  const jobName = "cron_runner";
  let supabase: ReturnType<typeof createClient> | null = null;

  try {
    // Require x-cron-secret to match CRON_SECRET (optional if called from pg_cron with service role)
    const expected = (Deno.env.get("CRON_SECRET") ?? "").trim();
    const got = (req.headers.get("x-cron-secret") ?? "").trim();
    
    // Allow bypass if called from pg_cron (no x-cron-secret header, but has service role)
    if (expected && got !== expected) {
      // Check if this is an internal call (service role via pg_cron)
      const authHeader = req.headers.get("Authorization");
      if (!authHeader || !authHeader.includes("Bearer")) {
        return json({ error: "Unauthorized" }, 401);
      }
    }

    const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") ?? "").trim();
    const SERVICE_KEY = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, 500);
    }

    // Create Supabase client for logging
    supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Log run start
    await logIngestionRun(supabase, jobName, "running", runStartedAt);

    // If ingest_rss is protected with INGEST_SECRET, pass it along (no ingest logic changes)
    const INGEST_SECRET = (Deno.env.get("INGEST_SECRET") ?? "").trim();
    const ingestHeaders = INGEST_SECRET ? { "x-ingest-secret": INGEST_SECRET } : undefined;

    // 1) ingest_rss
    const rssStartedAt = new Date();
    const rss = await callInternalFunction({
      supabaseUrl: SUPABASE_URL,
      serviceKey: SERVICE_KEY,
      functionName: "ingest_rss",
      body: {},
      extraHeaders: ingestHeaders,
    });
    const rssFinishedAt = new Date();

    // Log RSS ingest result
    await logIngestionRun(
      supabase,
      "rss_ingest",
      rss.ok ? "success" : "error",
      rssStartedAt,
      rssFinishedAt,
      { 
        status: rss.status, 
        ok: rss.ok,
        // Extract summary from response if available
        ...(typeof rss.data === "object" && rss.data !== null ? rss.data : {}),
      },
      rss.ok ? null : (typeof rss.data === "object" && rss.data !== null && "error" in rss.data ? String(rss.data.error) : "RSS ingest failed")
    );

    // 2) sync-external-content
    const externalStartedAt = new Date();
    const external = await callInternalFunction({
      supabaseUrl: SUPABASE_URL,
      serviceKey: SERVICE_KEY,
      functionName: "sync-external-content",
      body: {},
    });
    const externalFinishedAt = new Date();

    // Log external content sync result
    await logIngestionRun(
      supabase,
      "sync_external_content",
      external.ok ? "success" : "error",
      externalStartedAt,
      externalFinishedAt,
      { 
        status: external.status, 
        ok: external.ok,
        // Extract summary from response if available
        ...(typeof external.data === "object" && external.data !== null ? external.data : {}),
      },
      external.ok ? null : (typeof external.data === "object" && external.data !== null && "error" in external.data ? String(external.data.error) : "External content sync failed")
    );

    const runFinishedAt = new Date();
    const overallSuccess = rss.ok && external.ok;

    // Log orchestrator run completion
    await logIngestionRun(
      supabase,
      jobName,
      overallSuccess ? "success" : "error",
      runStartedAt,
      runFinishedAt,
      {
        rss: { ok: rss.ok, status: rss.status },
        external: { ok: external.ok, status: external.status },
      },
      overallSuccess ? null : "One or more ingestion jobs failed"
    );

    return json({
      ok: overallSuccess,
      rss,
      external,
      ranAt: runFinishedAt.toISOString(),
    });
  } catch (e: any) {
    const runFinishedAt = new Date();
    console.error("[cron_runner] Unhandled error:", e);

    // Log orchestrator run error
    if (supabase) {
      await logIngestionRun(
        supabase,
        jobName,
        "error",
        runStartedAt,
        runFinishedAt,
        {},
        e?.message ?? String(e) ?? "Unknown error"
      );
    }

    return json({ ok: false, error: e?.message ?? String(e) }, 500);
  }
});

