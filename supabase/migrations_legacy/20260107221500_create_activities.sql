create extension if not exists "uuid-ossp";

create table if not exists public.activities (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text not null,
  mood text not null check (mood in ('destructive','blank','expansive','minimize')),
  tags text[] default '{}'::text[],
  duration_min integer not null check (duration_min > 0),
  cost_level integer not null check (cost_level >= 0 and cost_level <= 3),
  intensity integer not null check (intensity >= 1 and intensity <= 5),
  steps text[] default '{}'::text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.activities enable row level security;

drop policy if exists "Activities are viewable by everyone" on public.activities;
create policy "Activities are viewable by everyone"
on public.activities for select
using (true);

insert into public.activities (title, description, mood, tags, duration_min, cost_level, intensity, steps)
values
('Herbal Tea Ritual','Make tea and sip slowly.','minimize', array['self-care','low-energy','solo'], 15, 0, 1, array['Boil water','Steep tea','Sip slowly'])
on conflict do nothing;
