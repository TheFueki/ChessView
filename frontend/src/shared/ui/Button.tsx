/**
 * Shared Button component.
 *
 * Dark premium aesthetic: emerald accent, glow on hover, smooth transitions.
 *
 * FSD layer: shared/ui
 */

import { type ButtonHTMLAttributes } from "react";
import { clsx } from "clsx";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30",
  secondary:
    "bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border border-neutral-700 hover:border-neutral-600",
  danger:
    "bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 hover:border-red-500/50",
  ghost:
    "bg-transparent hover:bg-neutral-800/50 text-neutral-400 hover:text-neutral-200",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3.5 py-1.5 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 cursor-pointer",
        "focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-neutral-950",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none",
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
