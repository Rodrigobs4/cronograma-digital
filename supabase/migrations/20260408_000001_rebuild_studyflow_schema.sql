create extension if not exists pgcrypto;
create extension if not exists citext;

drop view if exists public.v_workspace_dashboard;
drop view if exists public.v_plan_dashboard;
drop view if exists public.v_discipline_progress;

drop table if exists public.workspace_tracker_entries cascade;
drop table if exists public.workspace_schedule_sessions cascade;
drop table if exists public.workspace_schedule_templates cascade;
drop table if exists public.edital_uploads cascade;
drop table if exists public.workspace_topics cascade;
drop table if exists public.workspace_disciplines cascade;
drop table if exists public.exam_workspaces cascade;
drop table if exists public.goal_snapshots cascade;
drop table if exists public.habit_logs cascade;
drop table if exists public.habit_templates cascade;
drop table if exists public.essay_submissions cascade;
drop table if exists public.essay_themes cascade;
drop table if exists public.simulation_results cascade;
drop table if exists public.simulations cascade;
drop table if exists public.study_notes cascade;
drop table if exists public.review_logs cascade;
drop table if exists public.review_items cascade;
drop table if exists public.question_attempts cascade;
drop table if exists public.question_sets cascade;
drop table if exists public.question_sources cascade;
drop table if exists public.session_checkpoints cascade;
drop table if exists public.study_sessions cascade;
drop table if exists public.plan_calendar_days cascade;
drop table if exists public.plan_discipline_targets cascade;
drop table if exists public.plan_phase_targets cascade;
drop table if exists public.study_plans cascade;
drop table if exists public.discipline_topics cascade;
drop table if exists public.cycle_template_sessions cascade;
drop table if exists public.cycle_template_days cascade;
drop table if exists public.cycle_templates cascade;
drop table if exists public.exam_phases cascade;
drop table if exists public.disciplines cascade;
drop table if exists public.exams cascade;
drop table if exists public.user_preferences cascade;
drop table if exists public.gamification_streaks cascade;
drop table if exists public.notifications cascade;
drop table if exists public.performance_snapshots cascade;
drop table if exists public.difficulty_maps cascade;
drop table if exists public.review_logs cascade;
drop table if exists public.review_items cascade;
drop table if exists public.review_presets cascade;
drop table if exists public.study_sessions cascade;
drop table if exists public.daily_plan_items cascade;
drop table if exists public.weekly_plans cascade;
drop table if exists public.calendar_events cascade;
drop table if exists public.goals cascade;
drop table if exists public.topic_equivalences cascade;
drop table if exists public.topics cascade;
drop table if exists public.subjects cascade;
drop table if exists public.subject_catalog cascade;
drop table if exists public.notice_import_jobs cascade;
drop table if exists public.exam_notices cascade;
drop table if exists public.plan_templates cascade;
drop table if exists public.study_plans cascade;
drop table if exists public.workspaces cascade;
drop table if exists public.profiles cascade;

drop type if exists public.study_type cascade;
drop type if exists public.plan_status cascade;
drop type if exists public.planning_mode cascade;
drop type if exists public.topic_status cascade;
drop type if exists public.session_source cascade;
drop type if exists public.session_status cascade;
drop type if exists public.review_status cascade;
drop type if exists public.review_outcome cascade;
drop type if exists public.difficulty_level cascade;
drop type if exists public.recommendation_level cascade;
drop type if exists public.goal_type cascade;
drop type if exists public.notification_status cascade;
drop type if exists public.notification_type cascade;
drop type if exists public.calendar_event_type cascade;
drop type if exists public.import_status cascade;

create type public.study_type as enum ('concurso', 'vestibular', 'enem', 'faculdade', 'livre');
create type public.plan_status as enum ('draft', 'active', 'paused', 'completed', 'archived');
create type public.planning_mode as enum ('automatic', 'manual', 'hybrid');
create type public.topic_status as enum ('not_started', 'in_progress', 'reviewing', 'completed');
create type public.session_source as enum ('planned', 'manual', 'pomodoro', 'imported');
create type public.session_status as enum ('planned', 'running', 'completed', 'cancelled', 'skipped');
create type public.review_status as enum ('pending', 'completed', 'late', 'snoozed', 'archived');
create type public.review_outcome as enum ('fail', 'hard', 'good', 'easy');
create type public.difficulty_level as enum ('low', 'medium', 'high');
create type public.recommendation_level as enum ('advance', 'maintain', 'review', 'reinforce');
create type public.goal_type as enum ('hours', 'sessions', 'questions', 'reviews', 'topics');
create type public.notification_status as enum ('pending', 'sent', 'read', 'dismissed');
create type public.notification_type as enum ('study', 'review', 'goal', 'system');
create type public.calendar_event_type as enum ('study', 'review', 'exam', 'custom');
create type public.import_status as enum ('uploaded', 'processing', 'processed', 'failed');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do update
  set email = excluded.email;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email citext,
  avatar_url text,
  timezone text not null default 'America/Bahia',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.user_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  locale text not null default 'pt-BR',
  default_review_preset_code text not null default 'classic_24_7_30',
  week_starts_on integer not null default 1 check (week_starts_on between 0 and 6),
  mobile_notifications_enabled boolean not null default true,
  email_notifications_enabled boolean not null default true,
  integrations jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.plan_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  study_type public.study_type not null,
  template_payload jsonb not null default '{}'::jsonb,
  is_public boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.study_plans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  template_id uuid references public.plan_templates (id) on delete set null,
  title text not null,
  description text,
  study_type public.study_type not null,
  target_date date,
  planning_mode public.planning_mode not null default 'automatic',
  status public.plan_status not null default 'draft',
  weekly_available_minutes integer not null default 1500,
  daily_available_minutes integer not null default 240,
  preferred_block_minutes integer not null default 50,
  subjects_per_day integer not null default 4,
  review_method_code text not null default 'classic_24_7_30',
  allow_auto_rebalance boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (weekly_available_minutes > 0),
  check (daily_available_minutes > 0),
  check (preferred_block_minutes between 15 and 180),
  check (subjects_per_day between 1 and 10)
);

create or replace function public.user_owns_workspace(workspace_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.workspaces w
    where w.id = workspace_uuid
      and w.user_id = auth.uid()
  );
$$;

create or replace function public.user_owns_plan(plan_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.study_plans sp
    join public.workspaces w on w.id = sp.workspace_id
    where sp.id = plan_uuid
      and w.user_id = auth.uid()
  );
$$;

create table public.exam_notices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  study_plan_id uuid references public.study_plans (id) on delete set null,
  title text not null,
  organization text,
  exam_date date,
  source_type text not null default 'manual' check (source_type in ('manual', 'pdf', 'url', 'template')),
  file_url text,
  raw_text text,
  parsed_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.notice_import_jobs (
  id uuid primary key default gen_random_uuid(),
  exam_notice_id uuid not null references public.exam_notices (id) on delete cascade,
  file_name text,
  storage_path text,
  import_status public.import_status not null default 'uploaded',
  provider text,
  extracted_text text,
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.subject_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  study_plan_id uuid not null references public.study_plans (id) on delete cascade,
  subject_catalog_id uuid references public.subject_catalog (id) on delete set null,
  exam_notice_id uuid references public.exam_notices (id) on delete set null,
  code text not null,
  name text not null,
  color_hex text,
  priority_weight numeric(6,2) not null default 1.00,
  difficulty_perception public.difficulty_level not null default 'medium',
  priority_reason text,
  expected_question_weight numeric(6,2),
  target_minutes integer not null default 0,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (study_plan_id, code)
);

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  parent_topic_id uuid references public.topics (id) on delete cascade,
  title text not null,
  topic_code text,
  depth_level integer not null default 1,
  order_index integer not null default 1,
  estimated_minutes integer not null default 0,
  pages_target integer not null default 0,
  lessons_target integer not null default 0,
  questions_target integer not null default 0,
  difficulty_perception public.difficulty_level not null default 'medium',
  status public.topic_status not null default 'not_started',
  source_type text not null default 'manual' check (source_type in ('manual', 'imported', 'template')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.topic_equivalences (
  id uuid primary key default gen_random_uuid(),
  study_plan_id uuid not null references public.study_plans (id) on delete cascade,
  canonical_key text not null,
  topic_id uuid not null references public.topics (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (study_plan_id, canonical_key, topic_id)
);

create table public.weekly_plans (
  id uuid primary key default gen_random_uuid(),
  study_plan_id uuid not null references public.study_plans (id) on delete cascade,
  week_start_date date not null,
  status public.plan_status not null default 'draft',
  total_planned_minutes integer not null default 0,
  total_completed_minutes integer not null default 0,
  auto_generated boolean not null default true,
  rebalanced_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (study_plan_id, week_start_date)
);

create table public.daily_plan_items (
  id uuid primary key default gen_random_uuid(),
  weekly_plan_id uuid not null references public.weekly_plans (id) on delete cascade,
  study_plan_id uuid not null references public.study_plans (id) on delete cascade,
  study_date date not null,
  sequence_number integer not null default 1,
  subject_id uuid references public.subjects (id) on delete set null,
  topic_id uuid references public.topics (id) on delete set null,
  task_type text not null default 'study' check (task_type in ('study', 'review', 'questions', 'essay', 'simulado')),
  source_mode public.planning_mode not null default 'automatic',
  planned_minutes integer not null default 50,
  planned_questions integer not null default 0,
  priority_score numeric(8,2) not null default 0,
  status public.session_status not null default 'planned',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (study_plan_id, study_date, sequence_number)
);

create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  study_plan_id uuid not null references public.study_plans (id) on delete cascade,
  daily_plan_item_id uuid references public.daily_plan_items (id) on delete set null,
  subject_id uuid references public.subjects (id) on delete set null,
  topic_id uuid references public.topics (id) on delete set null,
  session_source public.session_source not null default 'planned',
  session_status public.session_status not null default 'completed',
  session_date date not null default current_date,
  started_at timestamptz,
  ended_at timestamptz,
  net_minutes integer not null default 0,
  pages_read integer not null default 0,
  lessons_watched integer not null default 0,
  questions_answered integer not null default 0,
  questions_correct integer not null default 0,
  questions_wrong integer not null default 0,
  focus_level integer check (focus_level between 1 and 5),
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.review_presets (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  steps jsonb not null default '[]'::jsonb,
  is_system boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.review_items (
  id uuid primary key default gen_random_uuid(),
  study_plan_id uuid not null references public.study_plans (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete set null,
  topic_id uuid references public.topics (id) on delete set null,
  source_session_id uuid references public.study_sessions (id) on delete set null,
  preset_id uuid references public.review_presets (id) on delete set null,
  review_status public.review_status not null default 'pending',
  last_studied_at timestamptz,
  last_reviewed_at timestamptz,
  next_review_at timestamptz,
  interval_days integer not null default 1,
  ease_factor numeric(4,2) not null default 2.50,
  lapse_count integer not null default 0,
  success_streak integer not null default 0,
  priority_score numeric(8,2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.review_logs (
  id uuid primary key default gen_random_uuid(),
  review_item_id uuid not null references public.review_items (id) on delete cascade,
  reviewed_at timestamptz not null default timezone('utc', now()),
  review_outcome public.review_outcome not null,
  response_quality integer check (response_quality between 0 and 5),
  questions_attempted integer not null default 0,
  questions_correct integer not null default 0,
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.difficulty_maps (
  id uuid primary key default gen_random_uuid(),
  study_plan_id uuid not null references public.study_plans (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete set null,
  topic_id uuid references public.topics (id) on delete set null,
  self_perception public.difficulty_level not null default 'medium',
  inferred_difficulty public.difficulty_level not null default 'medium',
  recommendation public.recommendation_level not null default 'maintain',
  confidence_score numeric(5,2) not null default 0,
  last_recalculated_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.performance_snapshots (
  id uuid primary key default gen_random_uuid(),
  study_plan_id uuid not null references public.study_plans (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete set null,
  topic_id uuid references public.topics (id) on delete set null,
  snapshot_date date not null,
  planned_minutes integer not null default 0,
  studied_minutes integer not null default 0,
  questions_answered integer not null default 0,
  questions_correct integer not null default 0,
  reviews_due integer not null default 0,
  reviews_done integer not null default 0,
  consistency_score numeric(5,2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (study_plan_id, subject_id, topic_id, snapshot_date)
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  study_plan_id uuid not null references public.study_plans (id) on delete cascade,
  goal_type public.goal_type not null,
  title text not null,
  target_value numeric(10,2) not null,
  current_value numeric(10,2) not null default 0,
  period_start date not null,
  period_end date not null,
  status public.plan_status not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  study_plan_id uuid not null references public.study_plans (id) on delete cascade,
  daily_plan_item_id uuid references public.daily_plan_items (id) on delete set null,
  event_type public.calendar_event_type not null default 'study',
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  provider text,
  external_event_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  study_plan_id uuid references public.study_plans (id) on delete cascade,
  notification_type public.notification_type not null,
  notification_status public.notification_status not null default 'pending',
  title text not null,
  body text,
  scheduled_at timestamptz,
  sent_at timestamptz,
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.gamification_streaks (
  id uuid primary key default gen_random_uuid(),
  study_plan_id uuid not null unique references public.study_plans (id) on delete cascade,
  current_streak integer not null default 0,
  best_streak integer not null default 0,
  last_study_date date,
  weekly_goal_hits integer not null default 0,
  badges jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index idx_profiles_email on public.profiles (email);
create index idx_workspaces_user on public.workspaces (user_id);
create index idx_study_plans_workspace on public.study_plans (workspace_id, status);
create index idx_subjects_plan on public.subjects (study_plan_id, is_active);
create index idx_topics_subject on public.topics (subject_id, parent_topic_id, order_index);
create index idx_weekly_plans_plan on public.weekly_plans (study_plan_id, week_start_date desc);
create index idx_daily_plan_items_plan_date on public.daily_plan_items (study_plan_id, study_date, status);
create index idx_study_sessions_plan_date on public.study_sessions (study_plan_id, session_date desc);
create index idx_review_items_plan_next on public.review_items (study_plan_id, next_review_at, review_status);
create index idx_performance_snapshots_plan_date on public.performance_snapshots (study_plan_id, snapshot_date desc);
create index idx_notifications_user_status on public.notifications (user_id, notification_status, scheduled_at);

create trigger set_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger set_user_preferences_updated_at before update on public.user_preferences for each row execute function public.set_updated_at();
create trigger set_workspaces_updated_at before update on public.workspaces for each row execute function public.set_updated_at();
create trigger set_plan_templates_updated_at before update on public.plan_templates for each row execute function public.set_updated_at();
create trigger set_study_plans_updated_at before update on public.study_plans for each row execute function public.set_updated_at();
create trigger set_exam_notices_updated_at before update on public.exam_notices for each row execute function public.set_updated_at();
create trigger set_notice_import_jobs_updated_at before update on public.notice_import_jobs for each row execute function public.set_updated_at();
create trigger set_subject_catalog_updated_at before update on public.subject_catalog for each row execute function public.set_updated_at();
create trigger set_subjects_updated_at before update on public.subjects for each row execute function public.set_updated_at();
create trigger set_topics_updated_at before update on public.topics for each row execute function public.set_updated_at();
create trigger set_weekly_plans_updated_at before update on public.weekly_plans for each row execute function public.set_updated_at();
create trigger set_daily_plan_items_updated_at before update on public.daily_plan_items for each row execute function public.set_updated_at();
create trigger set_study_sessions_updated_at before update on public.study_sessions for each row execute function public.set_updated_at();
create trigger set_review_presets_updated_at before update on public.review_presets for each row execute function public.set_updated_at();
create trigger set_review_items_updated_at before update on public.review_items for each row execute function public.set_updated_at();
create trigger set_difficulty_maps_updated_at before update on public.difficulty_maps for each row execute function public.set_updated_at();
create trigger set_goals_updated_at before update on public.goals for each row execute function public.set_updated_at();
create trigger set_calendar_events_updated_at before update on public.calendar_events for each row execute function public.set_updated_at();
create trigger set_notifications_updated_at before update on public.notifications for each row execute function public.set_updated_at();
create trigger set_gamification_streaks_updated_at before update on public.gamification_streaks for each row execute function public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.workspaces enable row level security;
alter table public.study_plans enable row level security;
alter table public.exam_notices enable row level security;
alter table public.notice_import_jobs enable row level security;
alter table public.subjects enable row level security;
alter table public.topics enable row level security;
alter table public.topic_equivalences enable row level security;
alter table public.weekly_plans enable row level security;
alter table public.daily_plan_items enable row level security;
alter table public.study_sessions enable row level security;
alter table public.review_items enable row level security;
alter table public.review_logs enable row level security;
alter table public.difficulty_maps enable row level security;
alter table public.performance_snapshots enable row level security;
alter table public.goals enable row level security;
alter table public.calendar_events enable row level security;
alter table public.notifications enable row level security;
alter table public.gamification_streaks enable row level security;
alter table public.exam_notices enable row level security;
alter table public.notice_import_jobs enable row level security;

create policy profiles_own_all on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy preferences_own_all on public.user_preferences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy workspaces_own_all on public.workspaces for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy study_plans_own_all on public.study_plans for all using (public.user_owns_workspace(workspace_id)) with check (public.user_owns_workspace(workspace_id));
create policy exam_notices_own_all on public.exam_notices for all using (public.user_owns_workspace(workspace_id)) with check (public.user_owns_workspace(workspace_id));
create policy notice_import_jobs_own_all on public.notice_import_jobs for all using (exists (select 1 from public.exam_notices en join public.workspaces w on w.id = en.workspace_id where en.id = notice_import_jobs.exam_notice_id and w.user_id = auth.uid())) with check (exists (select 1 from public.exam_notices en join public.workspaces w on w.id = en.workspace_id where en.id = notice_import_jobs.exam_notice_id and w.user_id = auth.uid()));
create policy subjects_own_all on public.subjects for all using (public.user_owns_plan(study_plan_id)) with check (public.user_owns_plan(study_plan_id));
create policy topics_own_all on public.topics for all using (exists (select 1 from public.subjects s join public.study_plans sp on sp.id = s.study_plan_id join public.workspaces w on w.id = sp.workspace_id where s.id = topics.subject_id and w.user_id = auth.uid())) with check (exists (select 1 from public.subjects s join public.study_plans sp on sp.id = s.study_plan_id join public.workspaces w on w.id = sp.workspace_id where s.id = topics.subject_id and w.user_id = auth.uid()));
create policy topic_equivalences_own_all on public.topic_equivalences for all using (public.user_owns_plan(study_plan_id)) with check (public.user_owns_plan(study_plan_id));
create policy weekly_plans_own_all on public.weekly_plans for all using (public.user_owns_plan(study_plan_id)) with check (public.user_owns_plan(study_plan_id));
create policy daily_plan_items_own_all on public.daily_plan_items for all using (public.user_owns_plan(study_plan_id)) with check (public.user_owns_plan(study_plan_id));
create policy study_sessions_own_all on public.study_sessions for all using (public.user_owns_plan(study_plan_id)) with check (public.user_owns_plan(study_plan_id));
create policy review_items_own_all on public.review_items for all using (public.user_owns_plan(study_plan_id)) with check (public.user_owns_plan(study_plan_id));
create policy review_logs_own_all on public.review_logs for all using (exists (select 1 from public.review_items ri join public.study_plans sp on sp.id = ri.study_plan_id join public.workspaces w on w.id = sp.workspace_id where ri.id = review_logs.review_item_id and w.user_id = auth.uid())) with check (exists (select 1 from public.review_items ri join public.study_plans sp on sp.id = ri.study_plan_id join public.workspaces w on w.id = sp.workspace_id where ri.id = review_logs.review_item_id and w.user_id = auth.uid()));
create policy difficulty_maps_own_all on public.difficulty_maps for all using (public.user_owns_plan(study_plan_id)) with check (public.user_owns_plan(study_plan_id));
create policy performance_snapshots_own_all on public.performance_snapshots for all using (public.user_owns_plan(study_plan_id)) with check (public.user_owns_plan(study_plan_id));
create policy goals_own_all on public.goals for all using (public.user_owns_plan(study_plan_id)) with check (public.user_owns_plan(study_plan_id));
create policy calendar_events_own_all on public.calendar_events for all using (public.user_owns_plan(study_plan_id)) with check (public.user_owns_plan(study_plan_id));
create policy notifications_own_all on public.notifications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy gamification_streaks_own_all on public.gamification_streaks for all using (exists (select 1 from public.study_plans sp join public.workspaces w on w.id = sp.workspace_id where sp.id = gamification_streaks.study_plan_id and w.user_id = auth.uid())) with check (exists (select 1 from public.study_plans sp join public.workspaces w on w.id = sp.workspace_id where sp.id = gamification_streaks.study_plan_id and w.user_id = auth.uid()));

create or replace view public.v_plan_dashboard as
with subject_stats as (
  select
    s.study_plan_id,
    count(distinct s.id) filter (where s.is_active) as active_subjects,
    count(distinct t.id) as total_topics,
    count(distinct t.id) filter (where t.status = 'completed') as completed_topics
  from public.subjects s
  left join public.topics t on t.subject_id = s.id
  group by s.study_plan_id
),
session_stats as (
  select
    ss.study_plan_id,
    coalesce(sum(ss.net_minutes), 0) as total_minutes,
    coalesce(sum(ss.questions_answered), 0) as total_questions,
    coalesce(sum(ss.questions_correct), 0) as total_correct
  from public.study_sessions ss
  where ss.session_status = 'completed'
  group by ss.study_plan_id
),
review_stats as (
  select
    ri.study_plan_id,
    count(distinct ri.id) filter (where ri.review_status in ('pending', 'late')) as pending_reviews
  from public.review_items ri
  group by ri.study_plan_id
)
select
  sp.id as study_plan_id,
  w.user_id,
  sp.title,
  sp.study_type,
  sp.status,
  sp.target_date,
  coalesce(subject_stats.active_subjects, 0) as active_subjects,
  coalesce(subject_stats.total_topics, 0) as total_topics,
  coalesce(subject_stats.completed_topics, 0) as completed_topics,
  coalesce(session_stats.total_minutes, 0) as total_minutes,
  coalesce(session_stats.total_questions, 0) as total_questions,
  coalesce(session_stats.total_correct, 0) as total_correct,
  coalesce(review_stats.pending_reviews, 0) as pending_reviews
from public.study_plans sp
join public.workspaces w on w.id = sp.workspace_id
left join subject_stats on subject_stats.study_plan_id = sp.id
left join session_stats on session_stats.study_plan_id = sp.id
left join review_stats on review_stats.study_plan_id = sp.id;
