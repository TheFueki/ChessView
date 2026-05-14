/**
 * Shared loading spinner.
 *
 * FSD layer: shared/ui
 */

import { clsx } from "clsx";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = { sm: "h-4 w-4", md: "h-6 w-6", lg: "h-10 w-10" };

export function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <div
      className={clsx(
        "animate-spin rounded-full border-2 border-neutral-500 border-t-transparent",
        sizeMap[size],
        className,
      )}
    />
  );
}
