import { CalendarRange, CheckCircle2, Layers3 } from "lucide-react";
import { Card } from "../ui/Card";

interface StatsCardsProps {
  dayNumber: number;
  cycleDay: string;
  completedCount: number;
  totalToday: number;
  studiedMinutes: number;
}

export function StatsCards({
  dayNumber,
  cycleDay,
  completedCount,
  totalToday,
  studiedMinutes,
}: StatsCardsProps) {
  return (
    <div className="mb-6 grid gap-4 md:grid-cols-4">
      <Card className="border-emerald-200 bg-[linear-gradient(180deg,#ffffff,#f0fdf4)] shadow-[0_10px_30px_rgba(16,185,129,0.08)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Execução do dia</p>
            <h2 className="mt-2 text-3xl font-black text-slate-950">
              {completedCount}/{totalToday}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Sessões concluídas até agora.
            </p>
          </div>
          <div className="rounded-2xl bg-emerald-500 p-2 text-white">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>
      </Card>

      <Card className="border-sky-200 bg-[linear-gradient(180deg,#ffffff,#eff6ff)] shadow-[0_10px_30px_rgba(14,165,233,0.08)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Dia do plano</p>
            <h2 className="mt-2 text-3xl font-black text-slate-950">{dayNumber}</h2>
            <p className="mt-2 text-sm text-slate-600">
              Marco atual dentro da jornada.
            </p>
          </div>
          <div className="rounded-2xl bg-sky-500 p-2 text-white">
            <CalendarRange className="h-5 w-5" />
          </div>
        </div>
      </Card>

      <Card className="border-violet-200 bg-[linear-gradient(180deg,#ffffff,#f5f3ff)] shadow-[0_10px_30px_rgba(139,92,246,0.08)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Ciclo em execução</p>
            <h2 className="mt-2 text-3xl font-black text-slate-950">{cycleDay}</h2>
            <p className="mt-2 text-sm text-slate-600">
              Posição atual na rotação do plano.
            </p>
          </div>
          <div className="rounded-2xl bg-violet-500 p-2 text-white">
            <Layers3 className="h-5 w-5" />
          </div>
        </div>
      </Card>

      <Card className="border-amber-200 bg-[linear-gradient(180deg,#ffffff,#fffbeb)] shadow-[0_10px_30px_rgba(245,158,11,0.08)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Ritmo real</p>
            <h2 className="mt-2 text-3xl font-black text-slate-950">{studiedMinutes}m</h2>
            <p className="mt-2 text-sm text-slate-600">
              Tempo líquido realmente registrado.
            </p>
          </div>
          <div className="rounded-2xl bg-amber-500 p-2 text-white">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>
      </Card>
    </div>
  );
}
