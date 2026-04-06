import { useEffect, useState } from "react";
import { Pause, Play, RotateCcw, TimerReset } from "lucide-react";
import { Card } from "../ui/Card";

const presets = [
  { label: "Foco 25/5", focusMinutes: 25, breakMinutes: 5 },
  { label: "Profundo 50/10", focusMinutes: 50, breakMinutes: 10 },
  { label: "Leve 15/3", focusMinutes: 15, breakMinutes: 3 },
];

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");

  return `${minutes}:${seconds}`;
}

export function PomodoroCard() {
  const [selectedPreset, setSelectedPreset] = useState(presets[0]);
  const [mode, setMode] = useState<"focus" | "break">("focus");
  const [secondsLeft, setSecondsLeft] = useState(selectedPreset.focusMinutes * 60);
  const [running, setRunning] = useState(false);
  const [completedFocusBlocks, setCompletedFocusBlocks] = useState(0);

  useEffect(() => {
    if (!running) {
      return;
    }

    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current > 1) {
          return current - 1;
        }

        if (mode === "focus") {
          setMode("break");
          setCompletedFocusBlocks((value) => value + 1);
          return selectedPreset.breakMinutes * 60;
        }

        setMode("focus");
        return selectedPreset.focusMinutes * 60;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [mode, running, selectedPreset]);

  function resetCurrentMode() {
    setRunning(false);
    setSecondsLeft(
      mode === "focus"
        ? selectedPreset.focusMinutes * 60
        : selectedPreset.breakMinutes * 60,
    );
  }

  function applyPreset(label: string) {
    const preset = presets.find((item) => item.label === label);

    if (!preset) {
      return;
    }

    setSelectedPreset(preset);
    setMode("focus");
    setRunning(false);
    setSecondsLeft(preset.focusMinutes * 60);
  }

  return (
    <Card className="overflow-hidden border-0 bg-[linear-gradient(135deg,#0f172a,#111827_55%,#1d4ed8)] p-0 text-white shadow-xl">
      <div className="grid gap-5 px-5 py-5 lg:grid-cols-[1fr_auto] lg:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
            Pomodoro
          </p>
          <h3 className="mt-2 text-2xl font-black">Blocos de foco na tela inicial</h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
            Use blocos curtos para reduzir atrito de início, preservar energia mental
            e acumular repetição distribuída.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset.label)}
                className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                  selectedPreset.label === preset.label
                    ? "bg-white text-slate-950"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/6 p-5 text-center backdrop-blur-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
            {mode === "focus" ? "Tempo de foco" : "Intervalo"}
          </p>
          <p className="mt-3 text-5xl font-black tracking-tight">
            {formatTime(secondsLeft)}
          </p>
          <p className="mt-2 text-sm text-slate-300">
            {completedFocusBlocks} bloco(s) de foco concluído(s) hoje
          </p>

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => setRunning((value) => !value)}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950"
            >
              {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {running ? "Pausar" : "Iniciar"}
            </button>
            <button
              type="button"
              onClick={resetCurrentMode}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white"
            >
              <RotateCcw className="h-4 w-4" />
              Resetar
            </button>
            <button
              type="button"
              onClick={() => {
                setMode((value) => (value === "focus" ? "break" : "focus"));
                setRunning(false);
                setSecondsLeft(
                  mode === "focus"
                    ? selectedPreset.breakMinutes * 60
                    : selectedPreset.focusMinutes * 60,
                );
              }}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white"
            >
              <TimerReset className="h-4 w-4" />
              Trocar modo
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
