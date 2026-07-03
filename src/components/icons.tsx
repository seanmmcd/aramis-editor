import type { ReactNode } from "react";

type IconProps = {
  className?: string;
  size?: number;
};

function iconStroke(size: number, targetPx = 1.75) {
  return (24 / size) * targetPx;
}

function IconSvg({
  className = "",
  size = 14,
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={iconStroke(size)}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function IconClose({ className = "", size = 12 }: IconProps) {
  return (
    <IconSvg className={className} size={size}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </IconSvg>
  );
}

export function IconRotateLeft({ className = "", size = 14 }: IconProps) {
  return (
    <IconSvg className={className} size={size}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </IconSvg>
  );
}

export function IconRotateRight({ className = "", size = 14 }: IconProps) {
  return (
    <IconSvg className={className} size={size}>
      <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
    </IconSvg>
  );
}

export function IconChevronDown({ className = "", size = 12 }: IconProps) {
  return (
    <IconSvg className={className} size={size}>
      <path d="m6 9 6 6 6-6" />
    </IconSvg>
  );
}

export function IconChevronRight({ className = "", size = 12 }: IconProps) {
  return (
    <IconSvg className={className} size={size}>
      <path d="m9 18 6-6-6-6" />
    </IconSvg>
  );
}
