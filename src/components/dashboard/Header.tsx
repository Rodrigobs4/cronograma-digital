import { Clock3, LogOut, Sparkles, Target } from "lucide-react";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";

interface HeaderProps {
  dayNumber: number;
  cycleDay: string;
  phaseName: string;
  onLogout: () => void;
  userName: string;
  userEmail: string;
}

export function Header({
  dayNumber,
  cycleDay,
  phaseName,
  onLogout,
  userName,
  userEmail,
}: HeaderProps) {
  return (
    <Card className="mb-6 overflow-hidden border-0 bg-[linear-gradient(135deg,#020617,#0f172a_60%,#164e63)] p-0 text-white shadow-[0_24px_70px_rgba(15,23,42,0.22)]">
      <div className="grid gap-6 px-5 py-5 md:px-6 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-white/10 text-white">StudyFlow</Badge>
            <Badge className="bg-white/10 text-white">Mobile-first</Badge>
            <Badge className="bg-cyan-400/15 text-cyan-100">MVP em evolução</Badge>
          </div>

          <div>
            <h1 className="text-3xl font-black tracking-tight md:text-4xl">
              Seu fluxo de estudo, execução e revisão em um só lugar
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200 md:text-base">
              Planejamento automático, sessões diárias, revisão inteligente e métricas
              reais para você decidir o próximo passo com clareza.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 text-sm text-slate-200">
            <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-cyan-200">
                Plano ativo
              </p>
              <p className="mt-1 font-semibold">StudyFlow MVP</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-cyan-200">
                Direção do dia
              </p>
              <p className="mt-1 font-semibold">Estudar, revisar e registrar</p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div className="rounded-3xl border border-white/10 bg-white/8 p-4 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white/10 p-2">
                <Target className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-cyan-200">
                  Dia do plano
                </p>
                <p className="text-2xl font-black">{dayNumber}</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/8 p-4 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white/10 p-2">
                <Clock3 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-cyan-200">
                  Ciclo e fase
                </p>
                <p className="font-semibold">
                  {cycleDay} • {phaseName}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/8 p-4 backdrop-blur-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl bg-white/10 p-2">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-cyan-200">
                  Conta ativa
                </p>
                <p className="font-semibold">{userName}</p>
                <p className="text-xs text-slate-300">{userEmail}</p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
