import { Card } from "../ui/Card";
import type { CycleDay, Discipline } from "../../types";

interface CycleBoardProps {
  currentCycleDay: string;
  cycleDays: CycleDay[];
  disciplines: Discipline[];
}

export function CycleBoard({
  currentCycleDay,
  cycleDays,
  disciplines,
}: CycleBoardProps) {
  return (
    <Card className="overflow-hidden border-0 bg-white/92">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-950">Ciclos do plano</h2>
        <p className="mt-1 text-sm text-slate-500">
          Visualize a rotação A–F e o que cai em cada dia do ciclo.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cycleDays.map((day: CycleDay) => (
          <div
            key={day.id}
            className={`rounded-2xl border p-3.5 ${
              day.id === currentCycleDay
                ? "border-sky-300 bg-[linear-gradient(180deg,#eff6ff,#dff7ff)]"
                : "border-slate-200 bg-white"
            }`}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-950">Dia {day.id}</h3>
                <p className="text-xs uppercase tracking-[0.14em] text-slate-400">
                  {day.sessions.length} bloco(s)
                </p>
              </div>

              {day.id === currentCycleDay && (
                <span className="rounded-full bg-cyan-600 px-2 py-1 text-xs font-semibold text-white">
                  Hoje
                </span>
              )}
            </div>

            <div className="space-y-2">
              {day.sessions.map((sessionId: string) => {
                const discipline = disciplines.find(
                  (d: Discipline) => d.id === sessionId,
                );

                if (!discipline) return null;

                return (
                  <div
                    key={sessionId}
                    className="rounded-xl border border-white bg-white px-3 py-2 text-sm text-slate-700"
                  >
                    {discipline.emoji} {discipline.shortName}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
