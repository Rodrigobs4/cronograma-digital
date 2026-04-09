import { useState, type FormEvent } from "react";
import { AlertCircle, KeyRound, LogIn, Mail, UserPlus } from "lucide-react";

type AuthMode = "login" | "signup" | "reset";

interface LoginPageProps {
  isConfigured: boolean;
  loading?: boolean;
  error?: string | null;
  message?: string | null;
  onLogin: (email: string, password: string) => Promise<void>;
  onSignup: (email: string, password: string) => Promise<void>;
  onResetPassword: (email: string) => Promise<void>;
}

const authModes: Array<{
  key: AuthMode;
  label: string;
  icon: typeof LogIn;
}> = [
  { key: "login", label: "Entrar", icon: LogIn },
  { key: "signup", label: "Criar conta", icon: UserPlus },
  { key: "reset", label: "Recuperar senha", icon: KeyRound },
];

export function LoginPage({
  isConfigured,
  loading = false,
  error,
  message,
  onLogin,
  onSignup,
  onResetPassword,
}: LoginPageProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isConfigured) {
      return;
    }

    if (mode === "login") {
      await onLogin(email, password);
      return;
    }

    if (mode === "signup") {
      await onSignup(email, password);
      return;
    }

    await onResetPassword(email);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.18),transparent_28%)]">
      <div className="w-full max-w-md rounded-[2rem] border border-slate-800 bg-slate-900/70 p-8 shadow-2xl backdrop-blur-xl md:p-10">
        <div className="text-center">
          <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-sky-500/20 bg-sky-500/10">
            <span className="text-3xl">📚</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">StudyFlow</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Planejamento, execução e revisão no mesmo fluxo.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-2 rounded-2xl bg-slate-950/70 p-1">
          {authModes.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setMode(item.key)}
                className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold transition ${
                  mode === item.key
                    ? "bg-sky-500 text-white"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm text-slate-300">
            E-mail
            <div className="mt-2 flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3">
              <Mail className="h-4 w-4 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="voce@exemplo.com"
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
              />
            </div>
          </label>

          {mode !== "reset" && (
            <label className="block text-sm text-slate-300">
              Senha
              <div className="mt-2 flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3">
                <KeyRound className="h-4 w-4 text-slate-500" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Sua senha"
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                />
              </div>
            </label>
          )}

          {!isConfigured && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` para habilitar o acesso.
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            </div>
          )}

          {message && !error && (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !isConfigured}
            className="w-full rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? "Processando..."
              : mode === "login"
                ? "Entrar"
                : mode === "signup"
                  ? "Criar conta"
                  : "Enviar recuperação"}
          </button>
        </form>

        <div className="mt-6 rounded-2xl border border-white/5 bg-white/5 px-4 py-4 text-sm leading-6 text-slate-400">
          {mode === "login" && (
            <p>
              Entre com sua conta para acessar seus planos, sessões e revisões.
            </p>
          )}
          {mode === "signup" && (
            <p>
              A conta é criada com e-mail e senha. Se a confirmação por e-mail estiver ativa,
              valide seu inbox antes do primeiro login.
            </p>
          )}
          {mode === "reset" && (
            <p>
              Informe seu e-mail para receber o link de redefinição de senha.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
