#!/usr/bin/env tsx
// scripts/ingest-rss.ts
// Local dev script to trigger RSS ingest
// Usage: npm run ingest-rss

import { config } from "dotenv";
import { resolve } from "path";

// Load .env file if it exists
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "http://localhost:54321";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/ingest_rss`;

async function main() {
  console.log("🚀 Triggering RSS ingest...");
  console.log(`📍 Function URL: ${FUNCTION_URL}`);

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

    const data = await response.json();

    if (data.error) {
      console.error("❌ Error:", data.error);
      if (data.message) console.error("   Message:", data.message);
      process.exit(1);
    }

    // Calculate summary
    const sourcesProcessed = data.feeds || 0;
    const itemsFetched = data.results?.reduce((sum: number, r: any) => sum + (r.fetched || 0), 0) || 0;
    const itemsUpserted = data.ingested || 0;
    const errorsCount = data.results?.filter((r: any) => !r.ok).length || 0;

    console.log("\n✅ RSS Ingest Complete!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`📊 Sources Processed: ${sourcesProcessed}`);
    console.log(`📥 Items Fetched: ${itemsFetched}`);
    console.log(`💾 Items Upserted: ${itemsUpserted}`);
    if (errorsCount > 0) {
      console.log(`⚠️  Errors: ${errorsCount}`);
    }
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    if (data.results && data.results.length > 0) {
      console.log("📋 Feed Details:");
      data.results.forEach((feed: any, idx: number) => {
        if (feed.ok) {
          console.log(
            `  ${idx + 1}. ✅ ${feed.feedUrl} - Fetched: ${feed.fetched || 0}, Upserted: ${feed.upserted || 0} (${feed.ms || "N/A"}ms)`
          );
        } else {
          console.log(`  ${idx + 1}. ❌ ${feed.feedUrl} - Error: ${feed.error || "Unknown"}`);
        }
      });
    }

    if (data.note) {
      console.log(`\nℹ️  Note: ${data.note}`);
    }
  } catch (error: any) {
    console.error("❌ Failed to trigger RSS ingest:", error.message);
    console.error("\n💡 Make sure:");
    console.error("   1. Supabase is running locally: `supabase start`");
    console.error("   2. VITE_SUPABASE_URL is set in your .env file");
    console.error("   3. The ingest_rss function is deployed locally");
    process.exit(1);
  }
}

main();





