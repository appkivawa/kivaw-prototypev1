-- Create feed_items table (baseline for local dev / explore_items_v2)

create table if not exists public.feed_items (
  id uuid primary key default gen_random_uuid(),

  source_type text not null,
  source_id uuid null,
  source_item_id text not null,

  url text not null,
  title text not null,
  summary text null,
  author text null,
  image_url text null,

  published_at timestamptz null,
  tags text[] null,
  topics text[] null,

  raw jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,

  ingested_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  source text null,
  external_id text null,

  is_discoverable boolean not null default true,
  score double precision null,

  content_kind text not null default 'rss'::text,
  provider text not null default 'rss'::text
);

create unique index if not exists feed_items_dedupe
  on public.feed_items (source_type, source_item_id);

create unique index if not exists feed_items_external_id_key
  on public.feed_items (external_id)
  where external_id is not null;

create index if not exists feed_items_ingested_at_idx
  on public.feed_items (ingested_at desc);

create index if not exists feed_items_published_at_idx
  on public.feed_items (published_at desc nulls last);

create index if not exists feed_items_source_type_idx
  on public.feed_items (source_type);

create index if not exists idx_feed_items_created_at
  on public.feed_items (created_at desc);

create index if not exists idx_feed_items_tags
  on public.feed_items using gin (tags);

create index if not exists idx_feed_items_topics
  on public.feed_items using gin (topics);

create unique index if not exists idx_feed_items_provider_external_id
  on public.feed_items (provider, external_id)
  where external_id is not null;

create unique index if not exists idx_feed_items_provider_url
  on public.feed_items (provider, url)
  where external_id is null;
