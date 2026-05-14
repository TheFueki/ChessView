/**
 * Shared Card component.
 *
 * Elevated dark surface with subtle border and optional lift.
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
        glow && "shadow-lg shadow-neutral-950/20 hover:shadow-neutral-950/30 hover:border-neutral-700",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
