# Supabase migrations

## Active migrations (local dev)

Only the **baseline** migrations in `supabase/migrations/` are applied when you run `supabase db reset` or start a fresh local database. They define the canonical schema for local development.

**Active baseline set:**

- `20260201005000_create_feed_items_baseline.sql`
- `20260201005100_create_public_recommendations_baseline.sql`
- `20260201005200_create_user_signals_baseline.sql`
- `20260201005300_create_external_content_cache_baseline.sql`
- `20260201023000_create_feed_sources.sql`
- `20260207000000_create_system_health.sql`
- `20260207001000_create_explore_items_v2_view.sql`
- `20260207001001_create_explore_items_v2_view_verification.sql`

After a successful `supabase db reset` you should have: `feed_items`, `feed_sources`, `user_signals`, `public_recommendations`, `external_content_cache`, `system_health`, and the `explore_items_v2` view.

## Legacy migrations (quarantined)

All other migration files belong in **`supabase/migrations_quarantine/`**. They are **not** applied by Supabase. They are kept for reference or for porting logic into the baseline schema. Do not move them back into `migrations/` unless you are intentionally reintroducing that schema.

To move non-baseline migrations into quarantine, run from repo root:

```bash
./scripts/fix_migrations.sh
```

The script keeps only the baseline set above and moves every other `.sql` in `supabase/migrations/` to `supabase/migrations_quarantine/` (using `git mv` if tracked, else `mv`). It prints what was kept and what was moved.

## Adding new migrations

1. Create a new `.sql` file in `supabase/migrations/` with a timestamped name, e.g. `YYYYMMDDHHMMSS_description.sql`, so it runs after the baseline set.
2. Keep migrations **idempotent** where possible (e.g. `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`).
3. Run `supabase db reset` locally to verify, then commit.
