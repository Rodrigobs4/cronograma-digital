# StudyFlow Blueprint

## Fase 1: visão geral do produto

### Proposta de valor
StudyFlow é uma plataforma de gestão de estudos orientada por dados, foco e revisão inteligente. O sistema organiza o plano, executa o cronograma, registra o que foi feito de verdade e recalcula o caminho quando a rotina muda.

### Problema que resolve
- Planos de estudo quebram quando o usuário atrasa ou muda a disponibilidade.
- Revisões costumam ficar soltas, sem priorização por erro e esquecimento.
- O estudante vê horas estudadas, mas não enxerga claramente avanço por disciplina, tópico e desempenho.
- Editais, matérias e metas mudam ao longo do tempo, mas muitas ferramentas são rígidas.

### Diferenciais de produto
- Planejamento híbrido: manual quando o usuário quer controle, automático quando quer otimização.
- Estrutura verticalizada editável: disciplina > assunto > tópico > subtópico.
- Replanejamento automático com base em faltas, prazo, dificuldade e desempenho real.
- Revisões inteligentes combinando agenda fixa e adaptação por acerto/erro.
- Dashboard focado em constância, domínio, gargalos e retorno por matéria.
- Mobile-first desde a concepção.

### Persona principal
- Usuário que estuda de forma autônoma, tem tempo limitado e precisa de clareza para decidir o que estudar hoje.

### Jornada macro
1. Criar conta e responder onboarding.
2. Escolher objetivo e prazo.
3. Montar ou importar a estrutura do plano.
4. Gerar cronograma semanal e fila diária.
5. Executar sessões com cronômetro, registro e revisão.
6. Acompanhar progresso e rebalancear o plano.

## Fase 2: requisitos funcionais e não funcionais

### Requisitos funcionais
- Cadastro, login, logout e recuperação de senha.
- Onboarding com meta, prazo, carga horária, método de revisão e nível percebido.
- Criação de múltiplos planos de estudo por usuário.
- Importação de edital ou estrutura programática.
- Gestão de disciplinas, assuntos, tópicos e subtópicos.
- Geração automática de cronograma semanal.
- Geração automática de fila diária de estudo.
- Registro manual ou por cronômetro/pomodoro.
- Registro de páginas, aulas, questões, acertos, erros, foco e observações.
- Agenda de revisões com presets e método customizado.
- Dashboard com progresso, constância, desempenho, heatmap e comparativos.
- Relatórios por disciplina, tópico e período.
- Exportação de dados.

### Regras de negócio
- Cada tópico possui estado: `not_started`, `in_progress`, `reviewing`, `completed`.
- O peso da disciplina influencia alocação de tempo.
- Dificuldade percebida e desempenho real influenciam replanejamento.
- Revisão atrasada aumenta prioridade futura.
- Faltas ou baixa execução disparam rebalanceamento.
- Tópicos equivalentes entre planos/editais podem ser agrupados.
- O progresso real considera execução, cobertura e resultado.

### Requisitos não funcionais
- Responsivo e mobile-first.
- Tempo de resposta baixo em dashboard e agenda.
- Segurança com autenticação, RLS e auditoria mínima.
- Arquitetura evolutiva, modular e orientada a domínio.
- Componentes reutilizáveis e design system consistente.
- Observabilidade básica: logs de jobs, importações e falhas de sincronização.

## Fase 3: arquitetura técnica

### Decisão arquitetural para o rebuild
Para o MVP do repositório atual, a recomendação é:
- Frontend: React + TypeScript + Tailwind
- Backend: Supabase Auth + Postgres + Edge Functions/Jobs
- Persistência: SQL versionado em `supabase/migrations`
- Estado local: store leve apenas para UX e otimização de tela

Motivo:
- reduz tempo de entrega
- mantém uma única linguagem na maior parte do sistema
- permite RLS, auth e banco fortes sem adicionar um backend separado agora

### Arquitetura em camadas
- `presentation`: telas, componentes, navegação, formulários
- `application`: casos de uso, validação, montagem de payloads
- `domain`: entidades, enums, regras de negócio e algoritmos
- `infrastructure`: auth, banco, storage, importações, jobs

### Bounded contexts
- Identity: perfil, preferências, autenticação
- Planning: planos, disciplinas, tópicos, agenda, fila diária
- Execution: sessões, pomodoro, registro de estudo
- Review: presets, agenda, logs e recomputação
- Analytics: snapshots, heatmap, dificuldade e relatórios
- Import: edital, OCR/parser, agrupamento semântico

### Fluxos de sistema
- Onboarding
  - cria perfil
  - cria workspace
  - cria primeiro plano
  - gera fila semanal inicial
- Replanejamento
  - lê execução real
  - recalcula déficit
  - redistribui blocos futuros
- Revisão
  - consolida sessões e erros
  - recalcula próxima revisão
  - injeta revisões na agenda

### Estratégia de jobs
- Job de importação de edital
- Job noturno de recalcular revisões
- Job diário de gerar agenda semanal se necessário
- Job de snapshot analítico

## Fase 4: modelagem do banco

### Núcleo
- `profiles`
- `user_preferences`
- `workspaces`
- `study_plans`
- `plan_templates`

### Conteúdo
- `exam_notices`
- `notice_import_jobs`
- `subject_catalog`
- `subjects`
- `topics`
- `topic_equivalences`

### Planejamento e execução
- `weekly_plans`
- `daily_plan_items`
- `study_sessions`
- `calendar_events`
- `goals`

### Revisão e aprendizagem
- `review_presets`
- `review_items`
- `review_logs`
- `difficulty_maps`

### Analytics e engajamento
- `performance_snapshots`
- `notifications`
- `gamification_streaks`

### Modelagem conceitual
- usuário possui um ou mais workspaces
- workspace agrupa planos
- plano possui disciplinas
- disciplina possui árvore de tópicos
- plano gera semanas e itens diários
- itens diários viram sessões
- sessões alimentam revisão, dificuldade e analytics

## Fase 5: design das telas

### 1. Landing page
- header com CTA principal
- explicação do produto
- cards com benefícios
- blocos de prova social futura

### 2. Login / cadastro / recuperação
- tela simples, foco em ação
- login e cadastro por tabs
- recuperação de senha em fluxo separado

### 3. Onboarding
- passo 1: objetivo e tipo de estudo
- passo 2: prazo, disponibilidade e carga
- passo 3: disciplinas e dificuldade
- passo 4: método de revisão e planejamento
- passo 5: confirmação e geração do plano

### 4. Dashboard principal
- visão do dia
- fila diária
- revisões pendentes
- progresso por plano
- métricas rápidas

### 5. Meu plano de estudos
- cards de plano
- visão semanal
- distribuição de carga
- rebalancear plano

### 6. Disciplinas e tópicos
- lista lateral de disciplinas
- árvore editável de conteúdo
- estados por tópico
- métricas por matéria

### 7. Edital / estrutura verticalizada
- upload/import
- parser com revisão manual
- agrupamento de disciplinas repetidas
- ajustes finos antes de salvar

### 8. Planejamento semanal
- calendário semanal
- blocos diários
- drag and drop futuro
- modo manual e automático

### 9. Sessão de estudo / cronômetro
- timer central
- disciplina e tópico atual
- blocos de registro rápido
- salvar sessão e gerar revisão

### 10. Revisões
- lista pendente
- atrasadas
- feitas hoje
- prioridade por risco

### 11. Estatísticas e relatórios
- horas por período
- acurácia por matéria
- heatmap
- assuntos fortes e fracos

### 12. Calendário
- semanal e mensal
- planejado vs realizado
- revisões e eventos

### 13. Perfil / configurações
- conta
- preferências
- tema
- exportações
- integrações

### Wireframes textuais

#### Dashboard
- topo: saudação + seletor de plano + CTA iniciar sessão
- faixa 1: horas da semana, consistência, revisões pendentes, conclusão do plano
- faixa 2: fila diária à esquerda, revisões à direita
- faixa 3: gráfico semanal, heatmap, matérias em risco

#### Disciplinas
- coluna esquerda: disciplinas com busca e filtros
- área principal: árvore de tópicos, progresso, dificuldade, ações rápidas

#### Sessão
- cabeçalho: plano, disciplina, tópico
- centro: pomodoro/timer
- rodapé: registro de páginas, aulas, questões, foco e observações

## Fase 6: backlog priorizado

### MVP
- autenticação e perfil
- onboarding básico
- criação de plano
- cadastro de disciplinas e tópicos
- geração de fila semanal automática
- registro de sessões
- agenda de revisões simples
- dashboard com métricas básicas

### V1
- importação de edital
- agrupamento de tópicos equivalentes
- heatmap e relatórios comparativos
- replanejamento automático avançado
- calendário integrado

### V2
- notificações push
- integração com agenda externa
- ranking pessoal de retorno por matéria
- gamificação leve
- app mobile com sincronização offline

## Fase 7: implementação do MVP com código

### Entregáveis iniciais deste rebuild
- novo schema SQL substituível
- seed inicial com presets
- motor de planejamento semanal
- motor de revisão inicial
- modelos de dados mockados para frontend

### Próximas etapas de implementação
1. consolidar a nova modelagem no banco
2. substituir o frontend legado por novas telas do MVP
3. ligar onboarding, planos, sessões e revisões ao banco
4. adicionar analytics e replanejamento incremental

