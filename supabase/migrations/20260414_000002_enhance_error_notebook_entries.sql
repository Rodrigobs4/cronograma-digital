alter table public.error_notebook_entries
add column if not exists entry_type text not null default 'error'
  check (entry_type in ('error', 'rule', 'insight', 'trap', 'commentary')),
add column if not exists source_kind text not null default 'manual'
  check (source_kind in ('question', 'class', 'teacher_comment', 'book', 'manual', 'mock_exam')),
add column if not exists source_label text,
add column if not exists teacher_comment text,
add column if not exists review_note text;

create index if not exists idx_error_notebook_entries_plan_type_status
on public.error_notebook_entries (study_plan_id, entry_type, entry_status, last_error_at desc);
