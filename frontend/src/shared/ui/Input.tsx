/**
 * Shared Input component.
 *
 * Dark theme: neutral-900 bg, soft border, emerald focus ring.
 *
 * FSD layer: shared/ui
 */

import { type InputHTMLAttributes, forwardRef } from "react";
import { clsx } from "clsx";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-neutral-400">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={clsx(
            "rounded-lg border bg-neutral-900/80 px-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-500",
            "border-neutral-700 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20",
            "outline-none transition-all duration-200",
            error && "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20",
            className,
          )}
          {...props}
        />
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    );
  },
);

Input.displayName = "Input";
