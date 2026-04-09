import type { PropsWithChildren } from "react";
import { cn } from "../../lib/utils";

interface CardProps extends PropsWithChildren {
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[1.65rem] border border-white/70 bg-white/88 p-5 shadow-[0_18px_45px_rgba(17,24,39,0.06)] backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </div>
  );
}
