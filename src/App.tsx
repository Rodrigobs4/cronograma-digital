import { useState, useEffect } from "react";
import { AppShell } from "./components/layout/AppShell";
import { Header } from "./components/dashboard/Header";
import { supabase } from "./lib/supabase";
import { StatsCards } from "./components/dashboard/StatsCards";
import { TodaySessions } from "./components/dashboard/TodaySessions";
import { CycleBoard } from "./components/cycle/CycleBoard";
import { LoginPage } from "./data/LoginPage";
import { disciplines } from "./data/disciplines";
import { cycleDays } from "./data/cycleDays";
import {
  getCycleDay,
  getPhase,
  getPlanDay,
  getTodayCycleSessions,
} from "./lib/plan";
import { usePlanStore } from "./store/usePlanStore";

export default function App() {
  const { currentDate, completedSessions, toggleSession } = usePlanStore();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Verifica se há uma sessão ativa no Supabase ou LocalStorage
    const checkAuth = async () => {
      const { data } = (await supabase?.auth.getSession()) ?? {
        data: { session: null },
      };
      const localSession = localStorage.getItem("pmal_auth_session");
      setIsAuthenticated(!!data.session || !!localSession);
    };

    checkAuth();

    // Escuta mudanças de estado de autenticação
    const {
      data: { subscription },
    } = supabase?.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    }) ?? { data: { subscription: null } };

    return () => subscription?.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase?.auth.signOut();
    localStorage.removeItem("pmal_auth_session");
    setIsAuthenticated(false);
  };

  if (isAuthenticated === null) return null;

  if (!isAuthenticated) {
    return <LoginPage onLogin={() => setIsAuthenticated(true)} />;
  }

  const dayNumber = getPlanDay(currentDate);
  const cycleDay = getCycleDay(dayNumber) || "1";
  const phase = getPhase(dayNumber) || { name: "Fase não definida" };
  const todayCycle = getTodayCycleSessions(dayNumber) || { sessions: [] };

  return (
    <AppShell>
      <Header
        dayNumber={dayNumber}
        cycleDay={cycleDay}
        phaseName={phase?.name || "N/A"}
        onLogout={handleLogout}
      />

      <StatsCards
        dayNumber={dayNumber}
        cycleDay={cycleDay}
        completedCount={completedSessions.length}
        totalToday={todayCycle?.sessions?.length || 0}
      />

      <TodaySessions
        disciplines={disciplines}
        sessionIds={todayCycle?.sessions || []}
        completedSessions={completedSessions}
        onToggle={toggleSession}
      />

      <CycleBoard
        currentCycleDay={cycleDay}
        cycleDays={cycleDays}
        disciplines={disciplines}
      />
    </AppShell>
  );
}
