function sendJson(res: any, statusCode: number, body: unknown, extraHeaders?: Record<string, string>) {
  try {
    if (extraHeaders) {
      for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
    }
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(body));
  } catch (e) {
    // Last-resort fallback
    try {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ ok: false, error: "Failed to write response" }));
    } catch {
      // ignore
    }
  }
}

export default async function handler(_req: any, res: any) {
  // Accept any request method (GET/POST/etc.)

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[api/cron] ❌ CRON_SECRET is missing");
    return sendJson(res, 500, { ok: false, error: "CRON_SECRET not set" });
  }

  // Supabase Edge Functions gateway expects a JWT in Authorization unless the function
  // is deployed with --no-verify-jwt. Using the anon key is sufficient here (cron_runner still
  // enforces x-cron-secret internally).
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseAnonKey) {
    console.error("[api/cron] ❌ SUPABASE_ANON_KEY is missing");
    return sendJson(res, 500, { ok: false, error: "SUPABASE_ANON_KEY not set" });
  }

  const projectRef = process.env.PROJECT_REF;
  const supabaseBase = (projectRef
    ? `https://${projectRef}.supabase.co`
    : process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ""
  ).trim();

  if (!supabaseBase) {
    return sendJson(res, 500, { ok: false, error: "Missing PROJECT_REF or SUPABASE_URL" });
  }

  const url = `${supabaseBase.replace(/\/+$/, "")}/functions/v1/cron_runner`;

  try {
    console.log("[api/cron] ▶️ Calling Supabase cron_runner");

    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": cronSecret,
        Authorization: `Bearer ${supabaseAnonKey}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({}),
    });

    const text = await upstream.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { ok: false, error: "cron_runner returned non-JSON", raw: text };
    }

    console.log("[api/cron] ⬅️ Supabase response:", upstream.status, upstream.ok);

    return sendJson(
      res,
      upstream.status,
      data,
      {
        "x-cron-runner-status": String(upstream.status),
        "x-cron-runner-ok": upstream.ok ? "true" : "false",
      }
    );
  } catch (e: any) {
    console.error("[api/cron] 🔥 Cron crashed:", e);
    return sendJson(res, 500, { ok: false, error: e?.message ?? String(e) });
  }
}


