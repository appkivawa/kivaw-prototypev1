function sendJson(res: any, statusCode: number, body: unknown, extraHeaders?: Record<string, string>) {
  try {
    if (extraHeaders) {
      for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
    }
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(body));
  } catch {
    try {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ ok: false, error: "Failed to write response" }));
    } catch {
      // ignore
    }
  }
}

function getHeader(req: any, name: string): string | null {
  const h = req?.headers?.[name] ?? req?.headers?.[name.toLowerCase()];
  if (!h) return null;
  if (Array.isArray(h)) return h[0] ?? null;
  return String(h);
}

export default async function handler(req: any, res: any) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[api/cron] ❌ CRON_SECRET is missing");
    return sendJson(res, 500, { ok: false, error: "CRON_SECRET not set" });
  }

  // ✅ AUTH: require either:
  // - x-cron-secret header matching CRON_SECRET
  // - or ?secret=... query (useful if your scheduler can’t set headers)
  // - or Vercel’s cron header (x-vercel-cron: 1) + secret
  const headerSecret = getHeader(req, "x-cron-secret");
  const querySecret = req?.query?.secret ? String(req.query.secret) : null;
  const isVercelCron = getHeader(req, "x-vercel-cron") === "1";

  const provided = headerSecret || querySecret;
  if (!provided || provided !== cronSecret) {
    // If you want to allow ONLY Vercel cron, you could also require isVercelCron === true here.
    console.warn("[api/cron] ❌ Unauthorized cron hit", {
      path: req?.url,
      isVercelCron,
      hasHeaderSecret: !!headerSecret,
      hasQuerySecret: !!querySecret,
    });
    return sendJson(res, 401, { ok: false, error: "Unauthorized" });
  }

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
    console.log("[api/cron] ▶️ Calling Supabase cron_runner", { url });

    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": cronSecret,
        Authorization: `Bearer ${supabaseAnonKey}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({ source: "vercel_cron" }),
    });

    const text = await upstream.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { ok: false, error: "cron_runner returned non-JSON", raw: text };
    }

    console.log("[api/cron] ⬅️ Supabase response:", upstream.status, upstream.ok);

    return sendJson(res, upstream.status, data, {
      "x-cron-runner-status": String(upstream.status),
      "x-cron-runner-ok": upstream.ok ? "true" : "false",
    });
  } catch (e: any) {
    console.error("[api/cron] 🔥 Cron crashed:", e);
    return sendJson(res, 500, { ok: false, error: e?.message ?? String(e) });
  }
}



