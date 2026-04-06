export const studyRules = [
  "Se não estudou hoje, continue amanhã de onde parou. Não reinicie o ciclo.",
  "Se perdeu 2 dias ou mais, faça compensação com 3 sessões atrasadas + 1 sessão de Português.",
  "Português nunca é cancelado. Se tiver só 30 minutos, faça 15 questões.",
  "Não avance conteúdo novo sem revisar erros e fazer questões da sessão anterior.",
  "A partir do ciclo 8, a proporção de questões deve superar a de teoria.",
];

export const phase3Cycle = [
  {
    day: "A",
    sessions: [
      "Português (questões)",
      "Conhecimentos AL — Decoreba",
      "Conhecimentos AL — Mapas mentais",
      "Informática (questões)",
    ],
  },
  {
    day: "B",
    sessions: [
      "Português (questões)",
      "Legislação PMAL (revisão)",
      "Dir. Constitucional (questões)",
      "Direitos Humanos — Decoreba",
    ],
  },
  {
    day: "C",
    sessions: [
      "Legislação PMAL (questões)",
      "Dir. Administrativo (questões)",
      "Dir. Penal Militar (questões)",
      "Dir. Proc. Penal Militar (questões)",
    ],
  },
  {
    day: "D",
    sessions: [
      "Português (questões)",
      "Informática — Decoreba",
      "Matemática — fórmulas/juros",
      "Dir. Processual Penal (questões)",
    ],
  },
  {
    day: "E",
    sessions: [
      "Legislação PMAL (questões)",
      "Dir. Constitucional (questões)",
      "Conhecimentos AL — Questões",
      "Direitos Humanos — Questões",
    ],
  },
  {
    day: "F",
    sessions: [
      "Português (questões)",
      "Dir. Administrativo (revisão)",
      "Informática — Questões",
      "Matemática — Questões",
    ],
  },
];

export const finalStretchDays = [
  { dayNumber: 85, title: "Simulado completo", duration: "4h30", detail: "120 questões cronometradas." },
  { dayNumber: 86, title: "Correção do Simulado 1", duration: "3h", detail: "Revisar os 10 tópicos com mais erros." },
  { dayNumber: 87, title: "Simulado 2", duration: "4h30", detail: "120 questões + reforço nos pontos fracos." },
  { dayNumber: 88, title: "Treino de redação", duration: "3h", detail: "2 temas com correção estrutural e gramatical." },
  { dayNumber: 89, title: "Revisão expressa", duration: "3h", detail: "Ler resumos de 1 folha por disciplina." },
  { dayNumber: 90, title: "Revisão leve + descanso", duration: "1h", detail: "Organizar documentos e reduzir carga mental." },
];

export const essayThemes = [
  "Inteligência Artificial e segurança pública",
  "Violência doméstica: avanços e lacunas da Lei Maria da Penha",
  "Crime organizado e os desafios do Estado brasileiro",
  "Abuso de autoridade policial e direitos humanos",
  "Crimes cibernéticos: o novo campo de batalha da segurança pública",
  "Saúde mental dos policiais militares",
  "Racismo estrutural e segurança pública no Brasil",
  "Câmeras corporais em policiais: transparência e controle",
  "Desastres climáticos e o papel das forças de segurança",
  "Redes sociais e o aumento da violência urbana",
];

export const disciplineRoadmaps = [
  {
    title: "Português",
    disciplineId: "portugues",
    cycles: [
      "Interpretação e compreensão de texto; tipos textuais.",
      "Ortografia, acentuação e uso do hífen.",
      "Coesão textual: conectivos, referenciação e substituição.",
      "Concordância verbal e nominal.",
      "Regência verbal e nominal + crase.",
      "Pontuação + colocação pronominal.",
      "Reescrita de frases + significação de palavras.",
    ],
  },
  {
    title: "Legislação PMAL",
    disciplineId: "legislacao_pmal",
    cycles: [
      "Sessões A/B/C: Estatuto PMAL parte 1, Estatuto parte 2, Regulamento Disciplinar.",
      "Sessões A/B/C: CP parte geral títulos I, II e III.",
      "Sessões A/B/C: Lei de Drogas, Maria da Penha e ECA.",
      "Sessões A/B/C: Hediondos + Tortura, Racismo + Crime Organizado, Desarmamento + Meio Ambiente.",
      "Sessões A/B/C: CTB crimes, Abuso de Autoridade, Prisão Temporária + Juizados.",
      "Sessões A/B/C: Lei Orgânica PM, revisão bloco 1, revisão bloco 2.",
      "Sessões A/B/C: revisão bloco 3 + duas baterias de questões mistas.",
    ],
  },
  {
    title: "Direito Constitucional",
    disciplineId: "dir_constitucional",
    cycles: [
      "Conceito, classificação, supremacia e interpretação da CF.",
      "Princípios Fundamentais (arts. 1º–4º).",
      "Direitos e garantias individuais (art. 5º) parte 1.",
      "Art. 5º parte 2 + direitos sociais (arts. 6º–11).",
      "Organização do Estado (arts. 18–36).",
      "Administração Pública e militares.",
      "Segurança Pública, Defesa do Estado e Constituição de AL.",
    ],
  },
  {
    title: "Direito Administrativo",
    disciplineId: "dir_administrativo",
    cycles: [
      "Conceitos centrais + princípios LIMPE.",
      "Ato administrativo: elementos, atributos e extinção.",
      "Poderes da administração: hierárquico, disciplinar e polícia.",
      "Regime jurídico-administrativo + responsabilidade civil do Estado.",
      "Controle da Administração + improbidade administrativa.",
      "Licitações na Lei 14.133/2021.",
      "Contratos administrativos + revisão geral.",
    ],
  },
  {
    title: "Informática",
    disciplineId: "informatica",
    cycles: [
      "Windows: conceitos, atalhos e gerenciamento.",
      "Word: formatação, revisão, estilos e mala direta.",
      "Excel: SOMA, MÉDIA, SE, PROCV e gráficos.",
      "PowerPoint: slides, animações e apresentação.",
      "Internet: navegadores, URL, HTTP, cookies e buscas.",
      "Segurança: vírus, malware, firewall, backup e cloud.",
      "E-mail, redes sociais e revisão geral.",
    ],
  },
  {
    title: "Matemática",
    disciplineId: "matematica",
    cycles: [
      "Operações com inteiros e frações.",
      "Decimais + MMC e MDC.",
      "Proporções e divisão proporcional.",
      "Regra de três simples.",
      "Regra de três composta.",
      "Porcentagem: aumento, desconto e variação.",
      "Juros simples e compostos + capitalização e desconto.",
    ],
  },
  {
    title: "Dir. Processual Penal",
    disciplineId: "dir_proc_penal",
    cycles: [
      "Inquérito policial: instauração, prazo e características.",
      "Ação penal: pública, condicionada e privada.",
      "Prisão em flagrante: espécies, lavratura e comunicação.",
      "Prisão preventiva: requisitos e revogação.",
      "Prisão temporária: cabimento e prazos.",
      "Provas, licitude, ônus e habeas corpus.",
      "Competência + procedimentos + revisão.",
    ],
  },
  {
    title: "Dir. Penal Militar",
    disciplineId: "dir_penal_militar",
    cycles: [
      "Aplicação da lei penal militar.",
      "Crime militar: próprios e impróprios.",
      "Imputabilidade + concurso de agentes.",
      "Penas militares principais e acessórias.",
      "Suspensão condicional, livramento e extinção.",
      "Crimes militares em tempo de paz.",
      "Princípios penais constitucionais + revisão.",
    ],
  },
  {
    title: "Dir. Proc. Penal Militar",
    disciplineId: "dir_proc_penal_militar",
    cycles: [
      "Polícia Judiciária Militar + instauração do IPM.",
      "IPM: prazo, conclusão e arquivamento.",
      "Ação penal militar + denúncia.",
      "Prisão em flagrante e preventiva militar.",
      "Processos em espécie: ordinário, deserção e insubmissão.",
      "Atos probatórios + nulidades.",
      "Recursos + execução + revisão.",
    ],
  },
  {
    title: "Conhecimentos de AL",
    disciplineId: "conhecimentos_al",
    cycles: [
      "História: colonização, açúcar, emancipação e província.",
      "Quilombo dos Palmares, Zumbi e resistência.",
      "Geografia: regiões e Rio São Francisco.",
      "Organização político-administrativa e poderes.",
      "Economia: cana, turismo e serviços.",
      "Cultura e patrimônio histórico.",
      "Revisão geral + questões.",
    ],
  },
  {
    title: "Direitos Humanos",
    disciplineId: "direitos_humanos",
    cycles: [
      "Conceito, evolução histórica e gerações.",
      "Declaração Universal dos Direitos Humanos.",
      "Sistema ONU de proteção.",
      "Pacto de San José.",
      "CIDH e Corte IDH.",
      "Grupos vulneráveis.",
      "Revisão + questões.",
    ],
  },
];
