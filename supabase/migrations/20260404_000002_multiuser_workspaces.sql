create table if not exists public.exam_workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  exam_id uuid references public.exams (id) on delete set null,
  title text not null,
  organization text,
  banca text,
  exam_date date,
  plan_start_date date not null default current_date,
  target_daily_hours numeric(4,2) not null default 4.00,
  target_disciplines_per_day integer not null default 4,
  preferred_session_minutes integer not null default 50,
  experience_level text not null default 'intermediario' check (
    experience_level in ('iniciante', 'intermediario', 'avancado')
  ),
  study_strategy text not null default 'balanced' check (
    study_strategy in ('balanced', 'content_first', 'questions_first', 'review_heavy')
  ),
  status text not null default 'active' check (
    status in ('draft', 'active', 'archived')
  ),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (target_daily_hours > 0),
  check (target_disciplines_per_day between 1 and 10),
  check (preferred_session_minutes between 15 and 180)
);

alter table public.study_plans
add column if not exists workspace_id uuid references public.exam_workspaces (id) on delete set null;

create table if not exists public.workspace_disciplines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.exam_workspaces (id) on delete cascade,
  catalog_discipline_id uuid references public.disciplines (id) on delete set null,
  code text not null,
  name text not null,
  short_name text not null,
  emoji text,
  estimated_questions integer not null default 0,
  question_bank_count integer not null default 0,
  subject_type text not null check (
    subject_type in ('interpretacao', 'mista', 'decoreba', 'raciocinio')
  ),
  sessions_per_cycle integer not null default 1,
  display_order integer not null default 0,
  source text not null default 'catalog' check (
    source in ('catalog', 'custom', 'pdf', 'manual')
  ),
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, code),
  check (sessions_per_cycle >= 1)
);

create table if not exists public.workspace_topics (
  id uuid primary key default gen_random_uuid(),
  workspace_discipline_id uuid not null references public.workspace_disciplines (id) on delete cascade,
  catalog_topic_id uuid references public.discipline_topics (id) on delete set null,
  parent_topic_id uuid references public.workspace_topics (id) on delete cascade,
  title text not null,
  description text,
  cycle_number integer,
  topic_order integer not null default 1,
  study_mode text not null default 'teoria' check (
    study_mode in ('teoria', 'questoes', 'revisao', 'decoracao', 'mapa_mental', 'redacao')
  ),
  mastery_level text not null default 'nao_estudada' check (
    mastery_level in ('nao_estudada', 'parcial', 'revisao')
  ),
  source text not null default 'catalog' check (
    source in ('catalog', 'custom', 'pdf', 'manual')
  ),
  is_completed boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.edital_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  workspace_id uuid not null references public.exam_workspaces (id) on delete cascade,
  file_name text not null,
  storage_path text,
  mime_type text,
  file_size_bytes bigint,
  processing_status text not null default 'uploaded' check (
    processing_status in ('uploaded', 'queued', 'processing', 'processed', 'failed')
  ),
  extracted_text text,
  parsed_payload jsonb not null default '{}'::jsonb,
  error_message text,
  uploaded_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.workspace_schedule_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.exam_workspaces (id) on delete cascade,
  day_code text not null,
  day_index integer not null,
  planned_disciplines_count integer not null default 4,
  planned_minutes integer not null default 240,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, day_code),
  unique (workspace_id, day_index),
  check (planned_disciplines_count >= 1),
  check (planned_minutes >= 30)
);

create table if not exists public.workspace_schedule_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_schedule_template_id uuid not null references public.workspace_schedule_templates (id) on delete cascade,
  workspace_discipline_id uuid not null references public.workspace_disciplines (id) on delete cascade,
  workspace_topic_id uuid references public.workspace_topics (id) on delete set null,
  session_order integer not null,
  planned_minutes integer not null default 60,
  cognitive_mode text not null default 'balanced' check (
    cognitive_mode in ('new_content', 'retrieval', 'mixed', 'review')
  ),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workspace_schedule_template_id, session_order),
  check (planned_minutes >= 15)
);

create index if not exists idx_exam_workspaces_user_status
on public.exam_workspaces (user_id, status, exam_date);

create index if not exists idx_study_plans_workspace_id
on public.study_plans (workspace_id);

create index if not exists idx_workspace_disciplines_workspace_id
on public.workspace_disciplines (workspace_id, display_order);

create index if not exists idx_workspace_topics_workspace_discipline_id
on public.workspace_topics (workspace_discipline_id, topic_order);

create index if not exists idx_edital_uploads_workspace_status
on public.edital_uploads (workspace_id, processing_status, uploaded_at desc);

create index if not exists idx_workspace_schedule_templates_workspace_id
on public.workspace_schedule_templates (workspace_id, day_index);

create index if not exists idx_workspace_schedule_sessions_template_id
on public.workspace_schedule_sessions (workspace_schedule_template_id, session_order);

create trigger set_exam_workspaces_updated_at
before update on public.exam_workspaces
for each row
execute function public.set_updated_at();

create trigger set_workspace_disciplines_updated_at
before update on public.workspace_disciplines
for each row
execute function public.set_updated_at();

create trigger set_workspace_topics_updated_at
before update on public.workspace_topics
for each row
execute function public.set_updated_at();

create trigger set_edital_uploads_updated_at
before update on public.edital_uploads
for each row
execute function public.set_updated_at();

create trigger set_workspace_schedule_templates_updated_at
before update on public.workspace_schedule_templates
for each row
execute function public.set_updated_at();

create trigger set_workspace_schedule_sessions_updated_at
before update on public.workspace_schedule_sessions
for each row
execute function public.set_updated_at();

alter table public.exam_workspaces enable row level security;
alter table public.workspace_disciplines enable row level security;
alter table public.workspace_topics enable row level security;
alter table public.edital_uploads enable row level security;
alter table public.workspace_schedule_templates enable row level security;
alter table public.workspace_schedule_sessions enable row level security;

create policy "exam_workspaces_own_all"
on public.exam_workspaces
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "workspace_disciplines_own_all"
on public.workspace_disciplines
for all
using (
  exists (
    select 1
    from public.exam_workspaces ew
    where ew.id = workspace_disciplines.workspace_id
      and ew.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.exam_workspaces ew
    where ew.id = workspace_disciplines.workspace_id
      and ew.user_id = auth.uid()
  )
);

create policy "workspace_topics_own_all"
on public.workspace_topics
for all
using (
  exists (
    select 1
    from public.workspace_disciplines wd
    join public.exam_workspaces ew on ew.id = wd.workspace_id
    where wd.id = workspace_topics.workspace_discipline_id
      and ew.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.workspace_disciplines wd
    join public.exam_workspaces ew on ew.id = wd.workspace_id
    where wd.id = workspace_topics.workspace_discipline_id
      and ew.user_id = auth.uid()
  )
);

create policy "edital_uploads_own_all"
on public.edital_uploads
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "workspace_schedule_templates_own_all"
on public.workspace_schedule_templates
for all
using (
  exists (
    select 1
    from public.exam_workspaces ew
    where ew.id = workspace_schedule_templates.workspace_id
      and ew.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.exam_workspaces ew
    where ew.id = workspace_schedule_templates.workspace_id
      and ew.user_id = auth.uid()
  )
);

create policy "workspace_schedule_sessions_own_all"
on public.workspace_schedule_sessions
for all
using (
  exists (
    select 1
    from public.workspace_schedule_templates wst
    join public.exam_workspaces ew on ew.id = wst.workspace_id
    where wst.id = workspace_schedule_sessions.workspace_schedule_template_id
      and ew.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.workspace_schedule_templates wst
    join public.exam_workspaces ew on ew.id = wst.workspace_id
    where wst.id = workspace_schedule_sessions.workspace_schedule_template_id
      and ew.user_id = auth.uid()
  )
);

create or replace view public.v_workspace_dashboard as
select
  ew.id as workspace_id,
  ew.user_id,
  ew.title,
  ew.exam_date,
  ew.target_daily_hours,
  ew.target_disciplines_per_day,
  ew.experience_level,
  ew.study_strategy,
  count(distinct wd.id) filter (where wd.is_active) as active_disciplines,
  count(distinct wt.id) as total_topics,
  count(distinct wt.id) filter (where wt.is_completed) as completed_topics,
  count(distinct eu.id) as edital_uploads_count,
  coalesce(max(eu.uploaded_at), null) as last_edital_upload_at
from public.exam_workspaces ew
left join public.workspace_disciplines wd on wd.workspace_id = ew.id
left join public.workspace_topics wt on wt.workspace_discipline_id = wd.id
left join public.edital_uploads eu on eu.workspace_id = ew.id
group by
  ew.id,
  ew.user_id,
  ew.title,
  ew.exam_date,
  ew.target_daily_hours,
  ew.target_disciplines_per_day,
  ew.experience_level,
  ew.study_strategy;
