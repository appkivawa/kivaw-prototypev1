export default async function handler(req: any, res: any) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    res.status(500).json({ ok: false, error: "CRON_SECRET is missing (set it in Vercel env vars)." });
    return;
  }

  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    (process.env.PROJECT_REF ? `https://${process.env.PROJECT_REF}.supabase.co` : "");

  if (!supabaseUrl) {
    res.status(500).json({
      ok: false,
      error: "Missing SUPABASE_URL (preferred) or PROJECT_REF to construct the Supabase URL.",
    });
    return;
  }

  const projectRef = process.env.PROJECT_REF;
  const baseUrl = projectRef ? `https://${projectRef}.supabase.co` : supabaseUrl;
  const url = `${baseUrl.replace(/\/+$/, "")}/functions/v1/cron_runner`;

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": cronSecret,
      },
      body: JSON.stringify({}),
    });

    const text = await upstream.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { ok: false, error: "cron_runner returned non-JSON", raw: text };
    }

    // Basic logging in server logs
    console.log("[vercel-cron] cron_runner", { status: upstream.status, ok: upstream.ok });

    // Basic logging surfaced via headers
    res.setHeader("x-cron-runner-status", String(upstream.status));
    res.setHeader("x-cron-runner-ok", upstream.ok ? "true" : "false");

    res.status(upstream.status).json(data);
  } catch (e: any) {
    console.error("[vercel-cron] fetch failed:", e);
    res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
}


