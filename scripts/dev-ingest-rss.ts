#!/usr/bin/env tsx
// scripts/dev-ingest-rss.ts
// Local dev-only script to continuously trigger RSS ingest every 5 minutes
// Usage: npm run dev:ingest

import { config } from "dotenv";
import { resolve } from "path";

// Load .env file if it exists
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "http://localhost:54321";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";
const INGEST_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/ingest_rss`;

interface IngestResult {
  ok: boolean;
  feeds: number;
  ingested: number;
  results?: Array<{
    feedUrl: string;
    ok: boolean;
    fetched?: number;
    upserted?: number;
    error?: string;
    ms?: number;
  }>;
  error?: string;
  note?: string;
}

async function runIngest(): Promise<void> {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] 🚀 Triggering RSS ingest...`);

  try {
    const response = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(SUPABASE_ANON_KEY && {
          apikey: SUPABASE_ANON_KEY,
        }),
      },
      body: JSON.stringify({
        maxFeeds: 50,
        perFeedLimit: 100,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as IngestResult;

    if (data.error) {
      console.error(`[${timestamp}] ❌ Error:`, data.error);
      if (data.message) console.error(`   Message:`, data.message);
      return;
    }

    // Calculate summary
    const sourcesProcessed = data.feeds || 0;
    const itemsFetched = data.results?.reduce((sum, r) => sum + (r.fetched || 0), 0) || 0;
    const itemsUpserted = data.ingested || 0;
    const errorsCount = data.results?.filter((r) => !r.ok).length || 0;

    // Log summary
    console.log(`[${timestamp}] ✅ RSS Ingest Complete!`);
    console.log(`[${timestamp}] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[${timestamp}] 📊 Sources Processed: ${sourcesProcessed}`);
    console.log(`[${timestamp}] 📥 Items Fetched: ${itemsFetched}`);
    console.log(`[${timestamp}] 💾 Items Upserted: ${itemsUpserted}`);
    if (errorsCount > 0) {
      console.log(`[${timestamp}] ⚠️  Errors: ${errorsCount}`);
    }
    console.log(`[${timestamp}] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // Log feed details (condensed)
    if (data.results && data.results.length > 0) {
      const successCount = data.results.filter((r) => r.ok).length;
      const failCount = data.results.filter((r) => !r.ok).length;
      console.log(`[${timestamp}] 📋 Feeds: ${successCount} succeeded, ${failCount} failed`);

      // Show failed feeds
      if (failCount > 0) {
        console.log(`[${timestamp}] ❌ Failed feeds:`);
        data.results
          .filter((r) => !r.ok)
          .forEach((feed) => {
            console.log(`[${timestamp}]   - ${feed.feedUrl}: ${feed.error || "Unknown error"}`);
          });
      }
    }

    if (data.note) {
      console.log(`[${timestamp}] ℹ️  Note: ${data.note}`);
    }
  } catch (error: any) {
    console.error(`[${timestamp}] ❌ Failed to trigger RSS ingest:`, error.message);
    console.error(`[${timestamp}] 💡 Make sure:`);
    console.error(`[${timestamp}]    1. Supabase is running locally: \`supabase start\``);
    console.error(`[${timestamp}]    2. VITE_SUPABASE_URL is set in your .env file`);
    console.error(`[${timestamp}]    3. The ingest_rss function is deployed locally`);
  }
}

async function main() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔄 RSS Ingest Loop (Dev Only)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`📍 Function URL: ${FUNCTION_URL}`);
  console.log(`⏱️  Interval: ${INGEST_INTERVAL_MS / 1000 / 60} minutes`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\n💡 Press Ctrl+C to stop\n");

  // Run immediately
  await runIngest();

  // Then run every 5 minutes
  const intervalId = setInterval(async () => {
    await runIngest();
  }, INGEST_INTERVAL_MS);

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n\n🛑 Stopping RSS ingest loop...");
    clearInterval(intervalId);
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("\n\n🛑 Stopping RSS ingest loop...");
    clearInterval(intervalId);
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});




