import { CheckCircle2, Circle } from "lucide-react";
import { Card } from "../ui/Card";

export interface TodaySessionCardItem {
  key: string;
  disciplineId: string;
  shortName: string;
  name: string;
  emoji: string;
  estimatedQuestions: number;
  bankCount: number;
  type: string;
  completed: boolean;
  topicTitle: string;
}

interface TodaySessionsProps {
  items: TodaySessionCardItem[];
  onToggle: (key: string) => void;
}

export function TodaySessions({ items, onToggle }: TodaySessionsProps) {
  return (
    <Card className="overflow-hidden border-0 bg-white/94 p-5 shadow-[0_16px_34px_rgba(15,23,42,0.055)]">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-950">Fila do ciclo atual</h2>
        <p className="mt-1 text-sm text-slate-500">
          Conclua todos os blocos para liberar o próximo dia do ciclo.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.key}
            className={`rounded-2xl border p-4 transition ${
              item.completed
                ? "border-emerald-200 bg-emerald-50"
                : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
            }`}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-xl">
                  {item.emoji}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold text-slate-950">
                    {item.shortName}
                  </h3>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{item.name}</p>
                </div>
              </div>

              <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600">
                {item.estimatedQuestions}q
              </span>
            </div>

            <div className="mb-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
              <p className="line-clamp-2 text-sm leading-5 text-slate-700">
                Tópico: {item.topicTitle}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Tipo: {item.type} • Banco: {item.bankCount}
              </p>
            </div>

            <button
              onClick={() => onToggle(item.key)}
              className={`inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold transition-all ${
                item.completed
                  ? "bg-emerald-600 text-white shadow-sm shadow-emerald-100 hover:bg-emerald-700"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
              }`}
            >
              {item.completed ? (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  Desmarcar conclusão
                </>
              ) : (
                <>
                  <Circle className="h-5 w-5" />
                  Marcar como feito
                </>
              )}
            </button>
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <p className="py-10 text-center text-slate-500">
          Nenhum bloco pendente no ciclo atual.
        </p>
      )}
    </Card>
  );
}
