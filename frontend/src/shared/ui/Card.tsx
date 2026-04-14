/**
 * Shared Card component.
 *
 * Elevated dark surface with subtle border and optional glow.
 *
 * FSD layer: shared/ui
 */

import { type HTMLAttributes, type ReactNode } from "react";
import { clsx } from "clsx";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  glow?: boolean;
}

export function Card({ children, glow, className, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-neutral-800 bg-neutral-900/80 backdrop-blur-sm p-6",
        "transition-all duration-300",
        glow && "shadow-lg shadow-emerald-500/5 hover:shadow-emerald-500/10 hover:border-neutral-700",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
