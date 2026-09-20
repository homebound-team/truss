// Presentational SVG icons. Identical in every app — no styling decisions live
// here beyond `currentColor`, so this file does not affect the comparison.

type IconProps = { size?: number };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export function SearchIcon({ size = 14 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  );
}

export function SunIcon({ size = 15 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function MoonIcon({ size = 15 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}

export function MonitorIcon({ size = 15 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

export function MenuIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}

export function BellIcon({ size = 15 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

export function ArrowUpIcon({ size = 12 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

export function ArrowDownIcon({ size = 12 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 5v14M19 12l-7 7-7-7" />
    </svg>
  );
}

export function CheckIcon({ size = 14 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function PlusIcon({ size = 14 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function DotsIcon({ size = 15 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </svg>
  );
}

export function ChevronIcon({ size = 13 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export function LogoMark({ size = 15 }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={2.2}>
      <path d="M4 15a4 4 0 0 1 1-7.9 5.5 5.5 0 0 1 10.6-1.4A4.5 4.5 0 0 1 19 15" />
      <path d="M12 12v9M8.5 17.5 12 21l3.5-3.5" />
    </svg>
  );
}
