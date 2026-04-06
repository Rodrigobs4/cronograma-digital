import type { PropsWithChildren } from "react";
import { cn } from "../../lib/utils";

interface BadgeProps extends PropsWithChildren {
  className?: string;
}

export function Badge({ children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700",
        className,
      )}
    >
      {children}
    </span>
  );
}
