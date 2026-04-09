import type { PropsWithChildren } from "react";

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_10%_0%,rgba(14,165,233,0.16),transparent_28rem),radial-gradient(circle_at_92%_4%,rgba(34,197,94,0.13),transparent_26rem),linear-gradient(180deg,#f8f5ef_0%,#f1f7f5_45%,#eef2f7_100%)]">
      <div className="mx-auto max-w-[1480px] px-4 py-4 md:px-6 md:py-6 lg:px-8">
        <div className="absolute inset-x-0 top-0 -z-10 h-64 bg-[linear-gradient(180deg,rgba(17,24,39,0.045),transparent)]" />
        {children}
      </div>
    </div>
  );
}
