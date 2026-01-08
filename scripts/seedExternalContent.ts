// scripts/seedExternalContent.ts
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !ANON_KEY) {
  console.error("Missing SUPABASE env vars. Need VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or SUPABASE_URL / SUPABASE_ANON_KEY).");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, ANON_KEY);

type SeedJob = {
  fn: "fetch-google-books" | "fetch-tmdb";
  query: string;
  pages: number;
  limit: number; // per page
};

// These map to your Explore filters / moods
const jobs: SeedJob[] = [
  // BOOKS (Google Books)
  { fn: "fetch-google-books", query: "comforting books for anxiety", pages: 3, limit: 30 },
  { fn: "fetch-google-books", query: "books for personal growth and clarity", pages: 3, limit: 30 },
  { fn: "fetch-google-books", query: "reflection journal prompts book", pages: 2, limit: 30 },
  { fn: "fetch-google-books", query: "faith devotionals peace", pages: 3, limit: 30 },
  { fn: "fetch-google-books", query: "books about logic and critical thinking", pages: 2, limit: 30 },
  { fn: "fetch-google-books", query: "books about beauty art inspiration", pages: 2, limit: 30 },

  // MOVIES (TMDB)
  { fn: "fetch-tmdb", query: "comfort movies", pages: 3, limit: 20 },
  { fn: "fetch-tmdb", query: "uplifting movies", pages: 3, limit: 20 },
  { fn: "fetch-tmdb", query: "calming movies", pages: 2, limit: 20 },
  { fn: "fetch-tmdb", query: "inspirational movies", pages: 3, limit: 20 },
];

async function run() {
  console.log("Seeding external content cache…");

  for (const job of jobs) {
    for (let page = 0; page < job.pages; page++) {
      const body =
        job.fn === "fetch-google-books"
          ? { query: job.query, limit: job.limit, startIndex: page * job.limit }
          : { query: job.query, limit: job.limit, page: page + 1 };

      console.log(`→ ${job.fn} | "${job.query}" | page ${page + 1}/${job.pages}`);

      const { data, error } = await supabase.functions.invoke(job.fn, { body });

      if (error) {
        console.error("  ✖ error:", error);
        continue;
      }
      console.log("  ✔ ok", typeof data === "object" ? "" : data);
      // tiny pause so you don’t rate-limit yourself
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  console.log("Done. Now check Supabase cache counts.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
