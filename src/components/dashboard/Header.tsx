import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";

interface HeaderProps {
  dayNumber: number;
  cycleDay: string;
  phaseName: string;
  title?: string;
  subtitle?: string;
}

export function Header({
  dayNumber,
  cycleDay,
  phaseName,
  title = "Plano PMAL 2026",
  subtitle = "Sistema de ciclos de estudo com foco em execução diária.",
}: HeaderProps) {
  return (
    <Card className="mb-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
          <p className="mt-2 text-slate-600">{subtitle}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge>Dia {dayNumber}</Badge>
          <Badge>Ciclo {cycleDay}</Badge>
          <Badge>{phaseName}</Badge>
        </div>
      </div>
    </Card>
  );
}
