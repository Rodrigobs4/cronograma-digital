import React from "react";

interface LoginPageProps {
  onLogin: () => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Aqui você integraria com supabase.auth.signInWithPassword
    localStorage.setItem("pmal_auth_session", "true");
    onLogin();
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_28%)]">
      <div className="max-w-md w-full space-y-8 p-10 bg-slate-900/50 backdrop-blur-xl rounded-3xl border border-slate-800 shadow-2xl">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-sky-500/10 mb-4 border border-sky-500/20">
            <span className="text-3xl">🪖</span>
          </div>
          <h2 className="text-3xl font-bold text-white tracking-tight">
            PMAL Ciclos
          </h2>
          <p className="mt-3 text-slate-400">
            Entre para gerenciar seu cronograma de estudos
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <button
              type="submit"
              className="group relative w-full flex justify-center py-3.5 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-sky-600 hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-all shadow-lg shadow-sky-900/20"
            >
              Acessar Plataforma
            </button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-900 px-2 text-slate-500 font-medium">
                Versão 1.0
              </span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
