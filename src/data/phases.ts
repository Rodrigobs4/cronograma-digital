import type { Phase } from "../types";

export const phases: Phase[] = [
  {
    id: "fase1",
    name: "Fase 1 — Construção",
    startDay: 1,
    endDay: 42,
    description: "Teoria nova + questões no final.",
  },
  {
    id: "fase2",
    name: "Fase 2 — Consolidação",
    startDay: 43,
    endDay: 72,
    description: "Mais questões do que teoria.",
  },
  {
    id: "fase3",
    name: "Fase 3 — Decoreba Turbo",
    startDay: 73,
    endDay: 84,
    description: "Revisão final, mapas mentais e questões.",
  },
  {
    id: "fase4",
    name: "Fase 4 — Reta Final",
    startDay: 85,
    endDay: 90,
    description: "Simulados, redação e revisão leve.",
  },
];
