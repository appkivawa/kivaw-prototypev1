-- ============================================================
-- public.feed_sources: canonical registry of ingestion sources
-- ============================================================

create table if not exists public.feed_sources (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  feed_url text not null,
  title text,
  site_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Uniqueness: one row per RSS feed_url
create unique index if not exists feed_sources_feed_url_key
  on public.feed_sources (feed_url);

-- Optional: fast lookup by source_type
create index if not exists feed_sources_source_type_idx
  on public.feed_sources (source_type);
