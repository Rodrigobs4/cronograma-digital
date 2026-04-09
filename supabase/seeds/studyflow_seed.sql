insert into public.plan_templates (title, description, study_type, template_payload)
values
  (
    'Concurso 90 dias',
    'Template com foco em revisão crescente e carga semanal progressiva.',
    'concurso',
    jsonb_build_object(
      'weekly_minutes', 1500,
      'block_minutes', 50,
      'subjects_per_day', 4
    )
  ),
  (
    'ENEM 180 dias',
    'Template com equilíbrio entre teoria, exercícios e redação.',
    'enem',
    jsonb_build_object(
      'weekly_minutes', 1200,
      'block_minutes', 45,
      'subjects_per_day', 3
    )
  )
on conflict do nothing;

insert into public.review_presets (code, name, description, steps, is_system)
values
  (
    'classic_24_7_30',
    'Clássico 24h / 7d / 30d',
    'Agenda simples e eficiente para revisão espaçada.',
    jsonb_build_array(
      jsonb_build_object('offset_hours', 24),
      jsonb_build_object('offset_days', 7),
      jsonb_build_object('offset_days', 30)
    ),
    true
  ),
  (
    'light_2_7_21',
    'Leve 2d / 7d / 21d',
    'Preset enxuto para conteúdos de baixa carga.',
    jsonb_build_array(
      jsonb_build_object('offset_days', 2),
      jsonb_build_object('offset_days', 7),
      jsonb_build_object('offset_days', 21)
    ),
    true
  ),
  (
    'intensive_1_3_7_15',
    'Intensivo 1d / 3d / 7d / 15d',
    'Ideal para tópicos difíceis ou com alto índice de erro.',
    jsonb_build_array(
      jsonb_build_object('offset_days', 1),
      jsonb_build_object('offset_days', 3),
      jsonb_build_object('offset_days', 7),
      jsonb_build_object('offset_days', 15)
    ),
    true
  )
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  steps = excluded.steps;

insert into public.subject_catalog (slug, name, category)
values
  ('lingua-portuguesa', 'Língua Portuguesa', 'Linguagens'),
  ('matematica', 'Matemática', 'Exatas'),
  ('direito-constitucional', 'Direito Constitucional', 'Direito'),
  ('biologia', 'Biologia', 'Ciências da Natureza'),
  ('historia', 'História', 'Humanas')
on conflict (slug) do update
set
  name = excluded.name,
  category = excluded.category;

