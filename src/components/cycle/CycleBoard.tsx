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
    <Card className="mt-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-slate-900">Ciclos do plano</h2>
        <p className="mt-1 text-sm text-slate-500">
          Visualize a rotação A–F e o que cai em cada dia do ciclo.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cycleDays.map((day: CycleDay) => (
          <div
            key={day.id}
            className={`rounded-2xl border p-4 ${
              day.id === currentCycleDay
                ? "border-blue-400 bg-blue-50"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold">Dia {day.id}</h3>

              {day.id === currentCycleDay && (
                <span className="rounded-full bg-blue-600 px-2 py-1 text-xs font-semibold text-white">
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
