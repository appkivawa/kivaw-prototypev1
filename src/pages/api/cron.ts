import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const CRON_SECRET = process.env.CRON_SECRET;

    if (!CRON_SECRET) {
      console.error("❌ CRON_SECRET is missing");
      return res.status(500).json({ error: "CRON_SECRET not set" });
    }

    const SUPABASE_CRON_URL =
      "https://pjuueamhdxqdrnxvavwd.supabase.co/functions/v1/cron_runner";

    console.log("▶️ Calling Supabase cron_runner");

    const response = await fetch(SUPABASE_CRON_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": CRON_SECRET,
      },
      body: JSON.stringify({}),
    });

    const text = await response.text();

    console.log("⬅️ Supabase response:", response.status, text);

    return res.status(200).json({
      ok: true,
      supabaseStatus: response.status,
      supabaseResponse: text,
    });
  } catch (err: any) {
    console.error("🔥 Cron crashed:", err);
    return res.status(500).json({
      ok: false,
      error: err?.message || "Unknown error",
    });
  }
}
