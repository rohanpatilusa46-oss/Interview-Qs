create table if not exists public.user_library (
  user_id text primary key,
  bookmarks jsonb not null default '[]'::jsonb,
  conversations jsonb not null default '{}'::jsonb,
  quiz_cache jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists user_library_updated_at_idx on public.user_library (updated_at desc);
