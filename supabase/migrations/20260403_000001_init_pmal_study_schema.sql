create extension if not exists pgcrypto;
create extension if not exists citext;

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
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  timezone text not null default 'America/Maceio',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  organization text,
  banca text,
  exam_date date,
  application_start_date date,
  study_start_date date,
  study_end_date date,
  total_days integer,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.disciplines (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams (id) on delete cascade,
  code text not null,
  name text not null,
  short_name text not null,
  emoji text,
  estimated_questions integer not null default 0,
  question_bank_count integer not null default 0,
  subject_type text not null check (subject_type in ('interpretacao', 'mista', 'decoreba', 'raciocinio')),
  strategic_group text not null check (strategic_group in ('inicio', 'turbo_final', 'final')),
  sessions_per_cycle integer not null default 1,
  display_order integer not null default 0,
  color_hex text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (exam_id, code)
);

create table if not exists public.exam_phases (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams (id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  start_day integer not null,
  end_day integer not null,
  focus_mode text not null check (focus_mode in ('teoria', 'questoes', 'revisao', 'simulado')),
  display_order integer not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (exam_id, code),
  check (start_day >= 1),
  check (end_day >= start_day)
);

create table if not exists public.cycle_templates (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams (id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  cycle_length_days integer not null default 6,
  total_sessions integer not null default 0,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (exam_id, code)
);

create table if not exists public.cycle_template_days (
  id uuid primary key default gen_random_uuid(),
  cycle_template_id uuid not null references public.cycle_templates (id) on delete cascade,
  day_code text not null,
  day_index integer not null,
  label text not null,
  phase_scope text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (cycle_template_id, day_code),
  unique (cycle_template_id, day_index)
);

create table if not exists public.cycle_template_sessions (
  id uuid primary key default gen_random_uuid(),
  cycle_template_day_id uuid not null references public.cycle_template_days (id) on delete cascade,
  discipline_id uuid not null references public.disciplines (id) on delete restrict,
  session_order integer not null,
  default_duration_minutes integer not null default 60,
  session_kind text not null default 'estudo' check (session_kind in ('estudo', 'questoes', 'revisao', 'simulado', 'redacao')),
  is_double_session boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (cycle_template_day_id, session_order)
);

create table if not exists public.discipline_topics (
  id uuid primary key default gen_random_uuid(),
  discipline_id uuid not null references public.disciplines (id) on delete cascade,
  phase_id uuid references public.exam_phases (id) on delete set null,
  parent_topic_id uuid references public.discipline_topics (id) on delete cascade,
  cycle_number integer,
  topic_order integer not null default 1,
  title text not null,
  description text,
  study_mode text not null default 'teoria' check (study_mode in ('teoria', 'questoes', 'revisao', 'decoracao', 'mapa_mental', 'redacao')),
  source_reference text,
  estimated_minutes integer,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  exam_id uuid not null references public.exams (id) on delete cascade,
  cycle_template_id uuid references public.cycle_templates (id) on delete set null,
  title text not null,
  description text,
  status text not null default 'active' check (status in ('draft', 'active', 'paused', 'completed', 'archived')),
  current_cycle_day_code text,
  current_day_number integer not null default 1,
  start_date date not null,
  planned_end_date date,
  exam_date date,
  daily_target_minutes integer not null default 240,
  weekly_target_minutes integer not null default 1440,
  weekly_target_questions integer not null default 500,
  weekly_target_essays integer not null default 1,
  allow_resume_from_missed_day boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.plan_phase_targets (
  id uuid primary key default gen_random_uuid(),
  study_plan_id uuid not null references public.study_plans (id) on delete cascade,
  phase_id uuid not null references public.exam_phases (id) on delete cascade,
  target_minutes integer,
  target_questions integer,
  target_revision_blocks integer,
  target_simulations integer,
  target_essays integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (study_plan_id, phase_id)
);

create table if not exists public.plan_discipline_targets (
  id uuid primary key default gen_random_uuid(),
  study_plan_id uuid not null references public.study_plans (id) on delete cascade,
  discipline_id uuid not null references public.disciplines (id) on delete cascade,
  target_sessions integer,
  target_questions integer,
  target_accuracy numeric(5,2),
  target_minutes integer,
  priority integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (study_plan_id, discipline_id)
);

create table if not exists public.plan_calendar_days (
  id uuid primary key default gen_random_uuid(),
  study_plan_id uuid not null references public.study_plans (id) on delete cascade,
  phase_id uuid references public.exam_phases (id) on delete set null,
  cycle_template_day_id uuid references public.cycle_template_days (id) on delete set null,
  study_date date not null,
  day_number integer not null,
  cycle_day_code text,
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'completed', 'skipped', 'rest')),
  is_compensation_day boolean not null default false,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (study_plan_id, study_date),
  unique (study_plan_id, day_number)
);

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  study_plan_id uuid not null references public.study_plans (id) on delete cascade,
  plan_calendar_day_id uuid references public.plan_calendar_days (id) on delete set null,
  discipline_id uuid references public.disciplines (id) on delete set null,
  topic_id uuid references public.discipline_topics (id) on delete set null,
  cycle_template_session_id uuid references public.cycle_template_sessions (id) on delete set null,
  phase_id uuid references public.exam_phases (id) on delete set null,
  title text,
  session_kind text not null default 'estudo' check (session_kind in ('estudo', 'questoes', 'revisao', 'simulado', 'redacao')),
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'completed', 'skipped', 'cancelled')),
  started_at timestamptz,
  finished_at timestamptz,
  planned_minutes integer not null default 60,
  actual_minutes integer not null default 0,
  theory_minutes integer not null default 0,
  practice_minutes integer not null default 0,
  review_minutes integer not null default 0,
  break_minutes integer not null default 0,
  questions_target integer not null default 0,
  questions_answered integer not null default 0,
  questions_correct integer not null default 0,
  questions_wrong integer not null default 0,
  questions_blank integer not null default 0,
  accuracy_percent numeric(5,2),
  difficulty_rating integer check (difficulty_rating between 1 and 5),
  energy_rating integer check (energy_rating between 1 and 5),
  focus_rating integer check (focus_rating between 1 and 5),
  mood_rating integer check (mood_rating between 1 and 5),
  content_coverage_percent numeric(5,2),
  notes text,
  mistakes_notes text,
  next_action text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (actual_minutes >= 0),
  check (questions_answered >= 0),
  check (questions_correct >= 0),
  check (questions_wrong >= 0),
  check (questions_blank >= 0)
);

create table if not exists public.session_checkpoints (
  id uuid primary key default gen_random_uuid(),
  study_session_id uuid not null references public.study_sessions (id) on delete cascade,
  checkpoint_kind text not null check (checkpoint_kind in ('start', 'pause', 'resume', 'finish', 'note')),
  checkpoint_at timestamptz not null default timezone('utc', now()),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.question_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  name text not null,
  provider text,
  source_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.question_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  study_plan_id uuid references public.study_plans (id) on delete cascade,
  discipline_id uuid references public.disciplines (id) on delete set null,
  topic_id uuid references public.discipline_topics (id) on delete set null,
  source_id uuid references public.question_sources (id) on delete set null,
  title text not null,
  banca text,
  question_year integer,
  total_questions integer not null default 0,
  difficulty_level text check (difficulty_level in ('easy', 'medium', 'hard', 'mixed')),
  tags text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.question_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  study_session_id uuid references public.study_sessions (id) on delete cascade,
  question_set_id uuid references public.question_sets (id) on delete set null,
  discipline_id uuid references public.disciplines (id) on delete set null,
  topic_id uuid references public.discipline_topics (id) on delete set null,
  attempted_at timestamptz not null default timezone('utc', now()),
  total_questions integer not null default 0,
  correct_answers integer not null default 0,
  wrong_answers integer not null default 0,
  blank_answers integer not null default 0,
  average_seconds_per_question integer,
  accuracy_percent numeric(5,2),
  error_pattern text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.review_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  study_plan_id uuid references public.study_plans (id) on delete cascade,
  discipline_id uuid references public.disciplines (id) on delete set null,
  topic_id uuid references public.discipline_topics (id) on delete set null,
  source_session_id uuid references public.study_sessions (id) on delete set null,
  prompt text not null,
  answer_summary text,
  review_type text not null default 'active_recall' check (review_type in ('active_recall', 'flashcard', 'error_log', 'summary', 'formula')),
  repetition_step integer not null default 0,
  ease_factor numeric(4,2) not null default 2.50,
  interval_days integer not null default 0,
  due_date date,
  last_reviewed_at timestamptz,
  success_streak integer not null default 0,
  lapse_count integer not null default 0,
  status text not null default 'active' check (status in ('active', 'paused', 'mastered', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.review_logs (
  id uuid primary key default gen_random_uuid(),
  review_item_id uuid not null references public.review_items (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  reviewed_at timestamptz not null default timezone('utc', now()),
  grade integer not null check (grade between 0 and 5),
  response_time_seconds integer,
  confidence_rating integer check (confidence_rating between 1 and 5),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.study_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  study_plan_id uuid references public.study_plans (id) on delete cascade,
  discipline_id uuid references public.disciplines (id) on delete set null,
  topic_id uuid references public.discipline_topics (id) on delete set null,
  session_id uuid references public.study_sessions (id) on delete set null,
  title text not null,
  content text,
  note_type text not null default 'summary' check (note_type in ('summary', 'mistake', 'formula', 'mind_map', 'revision_sheet', 'essay_outline')),
  is_favorite boolean not null default false,
  tags text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.simulations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  study_plan_id uuid references public.study_plans (id) on delete cascade,
  title text not null,
  simulated_exam_date date,
  applied_at timestamptz not null default timezone('utc', now()),
  duration_minutes integer,
  total_questions integer not null default 0,
  correct_answers integer not null default 0,
  wrong_answers integer not null default 0,
  blank_answers integer not null default 0,
  score numeric(7,2),
  ranking_percentile numeric(5,2),
  redaction_score numeric(7,2),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.simulation_results (
  id uuid primary key default gen_random_uuid(),
  simulation_id uuid not null references public.simulations (id) on delete cascade,
  discipline_id uuid not null references public.disciplines (id) on delete cascade,
  questions_count integer not null default 0,
  correct_answers integer not null default 0,
  wrong_answers integer not null default 0,
  blank_answers integer not null default 0,
  score numeric(7,2),
  accuracy_percent numeric(5,2),
  weakest_topics text[] not null default '{}',
  strengths text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (simulation_id, discipline_id)
);

create table if not exists public.essay_themes (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams (id) on delete cascade,
  title text not null,
  category text,
  description text,
  display_order integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.essay_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  study_plan_id uuid references public.study_plans (id) on delete cascade,
  essay_theme_id uuid references public.essay_themes (id) on delete set null,
  session_id uuid references public.study_sessions (id) on delete set null,
  title text not null,
  submitted_at timestamptz not null default timezone('utc', now()),
  max_lines integer not null default 30,
  lines_written integer,
  grammar_errors integer not null default 0,
  content_score numeric(7,2),
  structure_score numeric(7,2),
  grammar_score numeric(7,2),
  final_score numeric(7,2),
  evaluator text,
  feedback text,
  text_content text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.habit_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  study_plan_id uuid references public.study_plans (id) on delete cascade,
  name text not null,
  description text,
  category text not null default 'study' check (category in ('study', 'health', 'organization', 'revision', 'essay')),
  target_frequency text not null default 'daily' check (target_frequency in ('daily', 'weekly', 'custom')),
  target_count integer not null default 1,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_template_id uuid not null references public.habit_templates (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  logged_on date not null,
  value numeric(10,2),
  completed boolean not null default true,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (habit_template_id, logged_on)
);

create table if not exists public.goal_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  study_plan_id uuid references public.study_plans (id) on delete cascade,
  snapshot_date date not null,
  total_minutes integer not null default 0,
  total_questions integer not null default 0,
  total_sessions integer not null default 0,
  completed_sessions integer not null default 0,
  essays_done integer not null default 0,
  simulations_done integer not null default 0,
  streak_days integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, study_plan_id, snapshot_date)
);

create index if not exists idx_disciplines_exam_id on public.disciplines (exam_id);
create index if not exists idx_exam_phases_exam_id on public.exam_phases (exam_id);
create index if not exists idx_study_plans_user_id on public.study_plans (user_id);
create index if not exists idx_plan_calendar_days_plan_date on public.plan_calendar_days (study_plan_id, study_date);
create index if not exists idx_study_sessions_user_plan on public.study_sessions (user_id, study_plan_id);
create index if not exists idx_study_sessions_discipline on public.study_sessions (discipline_id, status);
create index if not exists idx_question_attempts_user_time on public.question_attempts (user_id, attempted_at desc);
create index if not exists idx_review_items_due_date on public.review_items (user_id, due_date);
create index if not exists idx_simulations_user_applied_at on public.simulations (user_id, applied_at desc);
create index if not exists idx_essay_submissions_user_date on public.essay_submissions (user_id, submitted_at desc);
create index if not exists idx_habit_logs_user_date on public.habit_logs (user_id, logged_on desc);

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create trigger set_exams_updated_at
before update on public.exams
for each row
execute function public.set_updated_at();

create trigger set_disciplines_updated_at
before update on public.disciplines
for each row
execute function public.set_updated_at();

create trigger set_exam_phases_updated_at
before update on public.exam_phases
for each row
execute function public.set_updated_at();

create trigger set_cycle_templates_updated_at
before update on public.cycle_templates
for each row
execute function public.set_updated_at();

create trigger set_cycle_template_days_updated_at
before update on public.cycle_template_days
for each row
execute function public.set_updated_at();

create trigger set_cycle_template_sessions_updated_at
before update on public.cycle_template_sessions
for each row
execute function public.set_updated_at();

create trigger set_discipline_topics_updated_at
before update on public.discipline_topics
for each row
execute function public.set_updated_at();

create trigger set_study_plans_updated_at
before update on public.study_plans
for each row
execute function public.set_updated_at();

create trigger set_plan_phase_targets_updated_at
before update on public.plan_phase_targets
for each row
execute function public.set_updated_at();

create trigger set_plan_discipline_targets_updated_at
before update on public.plan_discipline_targets
for each row
execute function public.set_updated_at();

create trigger set_plan_calendar_days_updated_at
before update on public.plan_calendar_days
for each row
execute function public.set_updated_at();

create trigger set_study_sessions_updated_at
before update on public.study_sessions
for each row
execute function public.set_updated_at();

create trigger set_question_sources_updated_at
before update on public.question_sources
for each row
execute function public.set_updated_at();

create trigger set_question_sets_updated_at
before update on public.question_sets
for each row
execute function public.set_updated_at();

create trigger set_question_attempts_updated_at
before update on public.question_attempts
for each row
execute function public.set_updated_at();

create trigger set_review_items_updated_at
before update on public.review_items
for each row
execute function public.set_updated_at();

create trigger set_study_notes_updated_at
before update on public.study_notes
for each row
execute function public.set_updated_at();

create trigger set_simulations_updated_at
before update on public.simulations
for each row
execute function public.set_updated_at();

create trigger set_simulation_results_updated_at
before update on public.simulation_results
for each row
execute function public.set_updated_at();

create trigger set_essay_themes_updated_at
before update on public.essay_themes
for each row
execute function public.set_updated_at();

create trigger set_essay_submissions_updated_at
before update on public.essay_submissions
for each row
execute function public.set_updated_at();

create trigger set_habit_templates_updated_at
before update on public.habit_templates
for each row
execute function public.set_updated_at();

create trigger set_habit_logs_updated_at
before update on public.habit_logs
for each row
execute function public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.study_plans enable row level security;
alter table public.plan_phase_targets enable row level security;
alter table public.plan_discipline_targets enable row level security;
alter table public.plan_calendar_days enable row level security;
alter table public.study_sessions enable row level security;
alter table public.session_checkpoints enable row level security;
alter table public.question_sources enable row level security;
alter table public.question_sets enable row level security;
alter table public.question_attempts enable row level security;
alter table public.review_items enable row level security;
alter table public.review_logs enable row level security;
alter table public.study_notes enable row level security;
alter table public.simulations enable row level security;
alter table public.simulation_results enable row level security;
alter table public.essay_submissions enable row level security;
alter table public.habit_templates enable row level security;
alter table public.habit_logs enable row level security;
alter table public.goal_snapshots enable row level security;

create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id);

create policy "profiles_insert_own"
on public.profiles
for insert
with check (auth.uid() = id);

create policy "study_plans_own_all"
on public.study_plans
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "plan_phase_targets_own_all"
on public.plan_phase_targets
for all
using (
  exists (
    select 1
    from public.study_plans sp
    where sp.id = plan_phase_targets.study_plan_id
      and sp.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.study_plans sp
    where sp.id = plan_phase_targets.study_plan_id
      and sp.user_id = auth.uid()
  )
);

create policy "plan_discipline_targets_own_all"
on public.plan_discipline_targets
for all
using (
  exists (
    select 1
    from public.study_plans sp
    where sp.id = plan_discipline_targets.study_plan_id
      and sp.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.study_plans sp
    where sp.id = plan_discipline_targets.study_plan_id
      and sp.user_id = auth.uid()
  )
);

create policy "plan_calendar_days_own_all"
on public.plan_calendar_days
for all
using (
  exists (
    select 1
    from public.study_plans sp
    where sp.id = plan_calendar_days.study_plan_id
      and sp.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.study_plans sp
    where sp.id = plan_calendar_days.study_plan_id
      and sp.user_id = auth.uid()
  )
);

create policy "study_sessions_own_all"
on public.study_sessions
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "session_checkpoints_own_all"
on public.session_checkpoints
for all
using (
  exists (
    select 1
    from public.study_sessions ss
    where ss.id = session_checkpoints.study_session_id
      and ss.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.study_sessions ss
    where ss.id = session_checkpoints.study_session_id
      and ss.user_id = auth.uid()
  )
);

create policy "question_sources_own_all"
on public.question_sources
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "question_sets_own_all"
on public.question_sets
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "question_attempts_own_all"
on public.question_attempts
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "review_items_own_all"
on public.review_items
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "review_logs_own_all"
on public.review_logs
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "study_notes_own_all"
on public.study_notes
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "simulations_own_all"
on public.simulations
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "simulation_results_own_all"
on public.simulation_results
for all
using (
  exists (
    select 1
    from public.simulations s
    where s.id = simulation_results.simulation_id
      and s.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.simulations s
    where s.id = simulation_results.simulation_id
      and s.user_id = auth.uid()
  )
);

create policy "essay_submissions_own_all"
on public.essay_submissions
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "habit_templates_own_all"
on public.habit_templates
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "habit_logs_own_all"
on public.habit_logs
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "goal_snapshots_own_all"
on public.goal_snapshots
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "catalog_read_exams"
on public.exams
for select
using (true);

create policy "catalog_read_disciplines"
on public.disciplines
for select
using (true);

create policy "catalog_read_exam_phases"
on public.exam_phases
for select
using (true);

create policy "catalog_read_cycle_templates"
on public.cycle_templates
for select
using (true);

create policy "catalog_read_cycle_template_days"
on public.cycle_template_days
for select
using (true);

create policy "catalog_read_cycle_template_sessions"
on public.cycle_template_sessions
for select
using (true);

create policy "catalog_read_discipline_topics"
on public.discipline_topics
for select
using (true);

create policy "catalog_read_essay_themes"
on public.essay_themes
for select
using (true);

alter table public.exams enable row level security;
alter table public.disciplines enable row level security;
alter table public.exam_phases enable row level security;
alter table public.cycle_templates enable row level security;
alter table public.cycle_template_days enable row level security;
alter table public.cycle_template_sessions enable row level security;
alter table public.discipline_topics enable row level security;
alter table public.essay_themes enable row level security;

insert into public.exams (
  slug,
  title,
  organization,
  banca,
  exam_date,
  application_start_date,
  study_start_date,
  study_end_date,
  total_days,
  metadata
)
values (
  'pmal-2026',
  'PMAL 2026 - Cronograma de Ciclos',
  'Polícia Militar de Alagoas',
  'CEBRASPE',
  '2026-07-19',
  '2026-04-03',
  '2026-04-03',
  '2026-07-01',
  90,
  jsonb_build_object(
    'cycle_length_days', 6,
    'final_margin_days', 18,
    'minimum_questions_per_session', 10,
    'recommended_platforms', jsonb_build_array('QConcursos', 'TEC Concursos', 'Gran Cursos')
  )
)
on conflict (slug) do update
set
  title = excluded.title,
  organization = excluded.organization,
  banca = excluded.banca,
  exam_date = excluded.exam_date,
  application_start_date = excluded.application_start_date,
  study_start_date = excluded.study_start_date,
  study_end_date = excluded.study_end_date,
  total_days = excluded.total_days,
  metadata = excluded.metadata,
  updated_at = timezone('utc', now());

with exam_ref as (
  select id from public.exams where slug = 'pmal-2026'
)
insert into public.disciplines (
  exam_id,
  code,
  name,
  short_name,
  emoji,
  estimated_questions,
  question_bank_count,
  subject_type,
  strategic_group,
  sessions_per_cycle,
  display_order,
  color_hex
)
select
  exam_ref.id,
  data.code,
  data.name,
  data.short_name,
  data.emoji,
  data.estimated_questions,
  data.question_bank_count,
  data.subject_type,
  data.strategic_group,
  data.sessions_per_cycle,
  data.display_order,
  data.color_hex
from exam_ref
cross join (
  values
    ('portugues', 'Língua Portuguesa', 'Português', '📖', 20, 3743, 'interpretacao', 'inicio', 4, 1, '#0f766e'),
    ('legislacao_pmal', 'Legislação PMAL', 'Leg. PMAL', '⚖️', 22, 2001, 'mista', 'turbo_final', 3, 2, '#7c3aed'),
    ('dir_constitucional', 'Direito Constitucional', 'Dir. Constitucional', '🏛️', 13, 1014, 'interpretacao', 'inicio', 3, 3, '#2563eb'),
    ('dir_administrativo', 'Direito Administrativo', 'Dir. Administrativo', '🏢', 12, 1231, 'interpretacao', 'inicio', 2, 4, '#0f766e'),
    ('informatica', 'Informática', 'Informática', '💻', 11, 1193, 'decoreba', 'final', 2, 5, '#db2777'),
    ('dir_proc_penal', 'Direito Processual Penal', 'Proc. Penal', '⚖️', 8, 428, 'mista', 'inicio', 2, 6, '#9333ea'),
    ('matematica', 'Matemática', 'Matemática', '➕', 8, 324, 'raciocinio', 'turbo_final', 2, 7, '#ea580c'),
    ('dir_penal_militar', 'Direito Penal Militar', 'Pen. Militar', '🪖', 5, 161, 'mista', 'turbo_final', 1, 8, '#7c2d12'),
    ('conhecimentos_al', 'Conhecimentos de Alagoas', 'Conh. AL', '🌿', 5, 137, 'decoreba', 'final', 1, 9, '#15803d'),
    ('direitos_humanos', 'Direitos Humanos', 'Dir. Humanos', '🕊️', 3, 129, 'decoreba', 'final', 1, 10, '#0891b2'),
    ('dir_proc_penal_militar', 'Direito Processual Penal Militar', 'Proc. P. Militar', '🪖', 3, 93, 'decoreba', 'final', 1, 11, '#a16207')
) as data(
  code,
  name,
  short_name,
  emoji,
  estimated_questions,
  question_bank_count,
  subject_type,
  strategic_group,
  sessions_per_cycle,
  display_order,
  color_hex
)
on conflict (exam_id, code) do update
set
  name = excluded.name,
  short_name = excluded.short_name,
  emoji = excluded.emoji,
  estimated_questions = excluded.estimated_questions,
  question_bank_count = excluded.question_bank_count,
  subject_type = excluded.subject_type,
  strategic_group = excluded.strategic_group,
  sessions_per_cycle = excluded.sessions_per_cycle,
  display_order = excluded.display_order,
  color_hex = excluded.color_hex,
  updated_at = timezone('utc', now());

with exam_ref as (
  select id from public.exams where slug = 'pmal-2026'
)
insert into public.exam_phases (
  exam_id,
  code,
  name,
  description,
  start_day,
  end_day,
  focus_mode,
  display_order,
  metadata
)
select
  exam_ref.id,
  data.code,
  data.name,
  data.description,
  data.start_day,
  data.end_day,
  data.focus_mode,
  data.display_order,
  data.metadata
from exam_ref
cross join (
  values
    ('fase1', 'Fase 1 — Construção', 'Teoria nova + 10 questões ao final de cada sessão.', 1, 42, 'teoria', 1, '{"cycles":"1-7"}'::jsonb),
    ('fase2', 'Fase 2 — Consolidação', '15 min revisão + 35 min questões + 10 min revisão de erros.', 43, 72, 'questoes', 2, '{"cycles":"8-12","target_questions_total":500}'::jsonb),
    ('fase3', 'Fase 3 — Decoreba Turbo', 'Mapas mentais, revisão final e 100% questões.', 73, 84, 'revisao', 3, '{"cycles":"13-14"}'::jsonb),
    ('fase4', 'Fase 4 — Reta Final', 'Simulados, redação, revisão expressa e descanso.', 85, 90, 'simulado', 4, '{"simulados":2,"redacoes":1}'::jsonb)
) as data(code, name, description, start_day, end_day, focus_mode, display_order, metadata)
on conflict (exam_id, code) do update
set
  name = excluded.name,
  description = excluded.description,
  start_day = excluded.start_day,
  end_day = excluded.end_day,
  focus_mode = excluded.focus_mode,
  display_order = excluded.display_order,
  metadata = excluded.metadata,
  updated_at = timezone('utc', now());

with exam_ref as (
  select id from public.exams where slug = 'pmal-2026'
)
insert into public.cycle_templates (
  exam_id,
  code,
  name,
  description,
  cycle_length_days,
  total_sessions,
  metadata
)
select
  exam_ref.id,
  'ciclo-base',
  'Ciclo Base PMAL 2026',
  'Ciclo de 6 dias com 22 sessões e continuidade mesmo após faltas.',
  6,
  22,
  '{"rules":["nao_recomeca","continua_de_onde_parou","portugues_nunca_cancelado"]}'::jsonb
from exam_ref
on conflict (exam_id, code) do update
set
  name = excluded.name,
  description = excluded.description,
  cycle_length_days = excluded.cycle_length_days,
  total_sessions = excluded.total_sessions,
  metadata = excluded.metadata,
  updated_at = timezone('utc', now());

with template_ref as (
  select ct.id
  from public.cycle_templates ct
  join public.exams e on e.id = ct.exam_id
  where e.slug = 'pmal-2026'
    and ct.code = 'ciclo-base'
)
insert into public.cycle_template_days (
  cycle_template_id,
  day_code,
  day_index,
  label
)
select
  template_ref.id,
  data.day_code,
  data.day_index,
  data.label
from template_ref
cross join (
  values
    ('A', 1, 'Dia A'),
    ('B', 2, 'Dia B'),
    ('C', 3, 'Dia C'),
    ('D', 4, 'Dia D'),
    ('E', 5, 'Dia E'),
    ('F', 6, 'Dia F')
) as data(day_code, day_index, label)
on conflict (cycle_template_id, day_code) do update
set
  day_index = excluded.day_index,
  label = excluded.label,
  updated_at = timezone('utc', now());

with ctx as (
  select
    ctd.id as cycle_template_day_id,
    ctd.day_code,
    d.id as discipline_id,
    d.code as discipline_code
  from public.cycle_template_days ctd
  join public.cycle_templates ct on ct.id = ctd.cycle_template_id
  join public.exams e on e.id = ct.exam_id
  join public.disciplines d on d.exam_id = e.id
  where e.slug = 'pmal-2026'
    and ct.code = 'ciclo-base'
)
insert into public.cycle_template_sessions (
  cycle_template_day_id,
  discipline_id,
  session_order,
  default_duration_minutes,
  session_kind
)
select
  ctx.cycle_template_day_id,
  ctx.discipline_id,
  data.session_order,
  60,
  'estudo'
from (
  values
    ('A', 'portugues', 1),
    ('A', 'legislacao_pmal', 2),
    ('A', 'dir_constitucional', 3),
    ('A', 'dir_administrativo', 4),
    ('B', 'portugues', 1),
    ('B', 'matematica', 2),
    ('B', 'informatica', 3),
    ('B', 'dir_proc_penal', 4),
    ('C', 'legislacao_pmal', 1),
    ('C', 'dir_constitucional', 2),
    ('C', 'dir_penal_militar', 3),
    ('C', 'dir_proc_penal_militar', 4),
    ('D', 'portugues', 1),
    ('D', 'dir_administrativo', 2),
    ('D', 'informatica', 3),
    ('D', 'dir_proc_penal', 4),
    ('E', 'legislacao_pmal', 1),
    ('E', 'dir_constitucional', 2),
    ('E', 'matematica', 3),
    ('E', 'conhecimentos_al', 4),
    ('F', 'portugues', 1),
    ('F', 'dir_penal_militar', 2),
    ('F', 'direitos_humanos', 3),
    ('F', 'dir_proc_penal_militar', 4)
) as data(day_code, discipline_code, session_order)
join ctx
  on ctx.day_code = data.day_code
 and ctx.discipline_code = data.discipline_code
on conflict (cycle_template_day_id, session_order) do update
set
  discipline_id = excluded.discipline_id,
  default_duration_minutes = excluded.default_duration_minutes,
  session_kind = excluded.session_kind,
  updated_at = timezone('utc', now());

with exam_ref as (
  select id from public.exams where slug = 'pmal-2026'
)
insert into public.essay_themes (
  exam_id,
  title,
  category,
  description,
  display_order
)
select
  exam_ref.id,
  data.title,
  data.category,
  data.description,
  data.display_order
from exam_ref
cross join (
  values
    ('Inteligência Artificial e segurança pública', 'Tecnologia', 'Tema prioritário para treino semanal de redação.', 1),
    ('Violência doméstica: avanços e lacunas da Lei Maria da Penha', 'Segurança/Sociedade', 'Tema com forte aderência à legislação especial.', 2),
    ('Crime organizado e os desafios do Estado brasileiro', 'Segurança', 'Explora políticas públicas e atuação estatal.', 3),
    ('Abuso de autoridade policial e direitos humanos', 'Segurança/DH', 'Cruza segurança pública, legalidade e direitos humanos.', 4),
    ('Crimes cibernéticos: o novo campo de batalha da segurança pública', 'Tecnologia', 'Exige repertório sobre internet e persecução penal.', 5),
    ('Saúde mental dos policiais militares', 'Saúde/Sociedade', 'Tema institucional e humano com alta chance de cobrança.', 6),
    ('Racismo estrutural e segurança pública no Brasil', 'Sociedade', 'Permite repertório constitucional e social.', 7),
    ('Câmeras corporais em policiais: transparência e controle', 'Tecnologia/Segurança', 'Tema contemporâneo e objetivo.', 8),
    ('Desastres climáticos e o papel das forças de segurança', 'Ecologia', 'Tema multidisciplinar e atual.', 9),
    ('Redes sociais e o aumento da violência urbana', 'Tecnologia/Sociedade', 'Tema argumentativo ligado à realidade social.', 10)
) as data(title, category, description, display_order)
where not exists (
  select 1
  from public.essay_themes et
  where et.exam_id = exam_ref.id
    and et.title = data.title
);

create or replace view public.v_discipline_progress as
select
  sp.user_id,
  sp.id as study_plan_id,
  d.id as discipline_id,
  d.name as discipline_name,
  d.short_name,
  d.estimated_questions,
  d.sessions_per_cycle,
  count(ss.id) filter (where ss.status = 'completed') as completed_sessions,
  coalesce(sum(ss.actual_minutes) filter (where ss.status = 'completed'), 0) as total_minutes,
  coalesce(sum(ss.questions_answered), 0) as total_questions_answered,
  coalesce(sum(ss.questions_correct), 0) as total_questions_correct,
  round(
    case
      when coalesce(sum(ss.questions_answered), 0) = 0 then 0
      else (coalesce(sum(ss.questions_correct), 0)::numeric / sum(ss.questions_answered)::numeric) * 100
    end,
    2
  ) as accuracy_percent
from public.study_plans sp
join public.disciplines d on d.exam_id = sp.exam_id
left join public.study_sessions ss
  on ss.study_plan_id = sp.id
 and ss.discipline_id = d.id
group by
  sp.user_id,
  sp.id,
  d.id,
  d.name,
  d.short_name,
  d.estimated_questions,
  d.sessions_per_cycle;

create or replace view public.v_plan_dashboard as
select
  sp.user_id,
  sp.id as study_plan_id,
  sp.title,
  sp.status,
  sp.current_day_number,
  sp.start_date,
  sp.planned_end_date,
  sp.exam_date,
  coalesce(count(ss.id) filter (where ss.status = 'completed'), 0) as completed_sessions,
  coalesce(count(ss.id), 0) as total_sessions_logged,
  coalesce(sum(ss.actual_minutes) filter (where ss.status = 'completed'), 0) as total_minutes,
  coalesce(sum(ss.questions_answered), 0) as total_questions_answered,
  coalesce(sum(ss.questions_correct), 0) as total_questions_correct,
  coalesce(count(distinct pcd.study_date) filter (where pcd.status = 'completed'), 0) as completed_days,
  coalesce(count(distinct sim.id), 0) as simulations_done,
  coalesce(count(distinct es.id), 0) as essays_done
from public.study_plans sp
left join public.study_sessions ss on ss.study_plan_id = sp.id
left join public.plan_calendar_days pcd on pcd.study_plan_id = sp.id
left join public.simulations sim on sim.study_plan_id = sp.id
left join public.essay_submissions es on es.study_plan_id = sp.id
group by
  sp.user_id,
  sp.id,
  sp.title,
  sp.status,
  sp.current_day_number,
  sp.start_date,
  sp.planned_end_date,
  sp.exam_date;
