alter table public.workspace_disciplines
add column if not exists current_cycle integer not null default 1,
add column if not exists skip_completed_topics boolean not null default false,
add column if not exists notes text,
add column if not exists selected_topic text,
add column if not exists mastery_level text not null default 'nao_estudada' check (
  mastery_level in ('nao_estudada', 'parcial', 'revisao')
);

create table if not exists public.workspace_tracker_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.exam_workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  day_number integer not null,
  entry_date date,
  cycle_completed boolean not null default false,
  disciplines_studied text,
  hours_invested numeric(6,2),
  observations text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, day_number),
  check (day_number >= 1),
  check (hours_invested is null or hours_invested >= 0)
);

create index if not exists idx_workspace_tracker_entries_workspace_id
on public.workspace_tracker_entries (workspace_id, day_number);

create trigger set_workspace_tracker_entries_updated_at
before update on public.workspace_tracker_entries
for each row
execute function public.set_updated_at();

alter table public.workspace_tracker_entries enable row level security;

create policy "workspace_tracker_entries_own_all"
on public.workspace_tracker_entries
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
