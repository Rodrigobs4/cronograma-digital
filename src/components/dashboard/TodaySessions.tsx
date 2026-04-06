import { Card } from "../ui/Card";
import type { Discipline } from "../../types";

interface TodaySessionsProps {
  disciplines: Discipline[];
  sessionIds: string[];
  completedSessions: string[];
  selectedTopics?: Record<string, string>;
  reviewStrategies?: Record<
    string,
    {
      label: string;
      split: string;
    }
  >;
  onToggle: (key: string) => void;
}

export function TodaySessions({
  disciplines,
  sessionIds,
  completedSessions,
  selectedTopics = {},
  reviewStrategies = {},
  onToggle,
}: TodaySessionsProps) {
  return (
    <Card className="p-6">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-slate-900">Sessões de hoje</h2>
        <p className="mt-1 text-sm text-slate-500">
          Cards maiores e mais legíveis para a execução do dia.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
        {sessionIds.map((sessionId, index) => {
          const discipline = disciplines.find((item) => item.id === sessionId);

          if (!discipline) return null;

          const sessionKey = `${sessionId}-${index}`;
          const isDone = completedSessions.includes(sessionKey);

          return (
            <div
              key={sessionKey}
              className={`rounded-3xl border p-5 transition ${
                isDone
                  ? "border-emerald-300 bg-emerald-50"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-3xl">{discipline.emoji}</p>
                  <h3 className="mt-2 text-base font-semibold text-slate-900">
                    {discipline.shortName}
                  </h3>
                </div>

                <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600">
                  {discipline.estimatedQuestions}q
                </span>
              </div>

              <p className="mb-4 text-sm leading-6 text-slate-600">
                Tipo: {discipline.type} • Banco: {discipline.bankCount}
              </p>

              <div className="mb-5 rounded-2xl border border-white bg-white/80 px-4 py-3 text-sm text-slate-700">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                  Assunto atual
                </p>
                <p className="mt-2 min-h-14 leading-6">
                  {selectedTopics[discipline.id] || "Defina na aba Conteúdo"}
                </p>
              </div>

              <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-100/90 px-4 py-3 text-sm text-slate-700">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                  Modelo sugerido
                </p>
                <p className="mt-2 font-semibold text-slate-900">
                  {reviewStrategies[discipline.id]?.label || "Base + fixação"}
                </p>
                <p className="mt-1 leading-6 text-slate-600">
                  {reviewStrategies[discipline.id]?.split ||
                    "70% conteúdo • 20% questões • 10% revisão ativa"}
                </p>
              </div>

              <button
                onClick={() => onToggle(sessionKey)}
                className={`w-full rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  isDone
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "bg-slate-900 text-white hover:bg-slate-700"
                }`}
              >
                {isDone ? "Concluído" : "Marcar como concluído"}
              </button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
