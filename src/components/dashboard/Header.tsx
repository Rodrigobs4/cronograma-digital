import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";

interface HeaderProps {
  dayNumber: number;
  cycleDay: string;
  phaseName: string;
  onLogout: () => void;
}

export function Header({
  dayNumber,
  cycleDay,
  phaseName,
  onLogout,
}: HeaderProps) {
  return (
    <Card className="mb-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Plano PMAL 2026</h1>
          <p className="mt-2 text-slate-600">
            Sistema de ciclos de estudo com foco em execução diária.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge>Dia {dayNumber}</Badge>
          <Badge>Ciclo {cycleDay}</Badge>
          <Badge>{phaseName}</Badge>
          <button
            onClick={onLogout}
            className="ml-2 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
          >
            Sair
          </button>
        </div>
      </div>
    </Card>
  );
}
