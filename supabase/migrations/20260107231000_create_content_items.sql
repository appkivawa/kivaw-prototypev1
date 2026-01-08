create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  description text,
  url text,
  image_url text,
  type text default 'link',
  tags text[] default '{}',
  is_public boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.content_items enable row level security;

create policy "Content items are viewable by everyone"
  on public.content_items
  for select
  using (is_public = true);

insert into public.content_items (title, subtitle, description, url, tags, is_public)
values
('KIVAW Starter Pack','3-minute reset','A quick reset when you feel overloaded.','https://example.com',array['comfort','solo'],true),
('Walk + Audio','Low effort','Put on a playlist and walk for 10 minutes.','https://example.com',array['movement','low-energy'],true)
on conflict do nothing;
