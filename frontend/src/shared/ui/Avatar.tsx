import { clsx } from "clsx";

type AvatarSize = "sm" | "md" | "lg" | "xl";

interface AvatarProps {
  username?: string;
  avatarUrl?: string | null;
  size?: AvatarSize;
  className?: string;
}

const sizeStyles: Record<AvatarSize, string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
  xl: "h-20 w-20 text-3xl",
};

function getInitials(username?: string) {
  const trimmed = username?.trim();

  if (!trimmed) {
    return "?";
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  const firstInitial = parts[0]?.[0] ?? "";
  const secondInitial = parts[1]?.[0] ?? "";

  return (firstInitial + secondInitial).toUpperCase();
}

export function Avatar({
  username,
  avatarUrl,
  size = "md",
  className,
}: AvatarProps) {
  return (
    <div
      className={clsx(
        "overflow-hidden rounded-full border border-neutral-700 bg-neutral-800 text-neutral-200",
        "inline-flex items-center justify-center font-semibold",
        sizeStyles[size],
        className,
      )}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt={`${username} avatar`} className="h-full w-full object-cover" />
      ) : (
        <span>{getInitials(username)}</span>
      )}
    </div>
  );
}
