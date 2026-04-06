import { Card } from "../ui/Card";

interface StatsCardsProps {
  dayNumber: number;
  cycleDay: string;
  completedCount: number;
  totalToday: number;
}

export function StatsCards({
  dayNumber,
  cycleDay,
  completedCount,
  totalToday,
}: StatsCardsProps) {
  return (
    <div className="mb-6 grid gap-4 md:grid-cols-3">
      <Card>
        <p className="text-sm text-slate-500">Processo do dia</p>
        <h2 className="mt-2 text-2xl font-bold">
          {completedCount}/{totalToday}
        </h2>
      </Card>

      <Card>
        <p className="text-sm text-slate-500">Dia do plano</p>
        <h2 className="mt-2 text-2xl font-bold">{dayNumber}</h2>
      </Card>

      <Card>
        <p className="text-sm text-slate-500">Dia do ciclo</p>
        <h2 className="mt-2 text-2xl font-bold">{cycleDay}</h2>
      </Card>
    </div>
  );
}
