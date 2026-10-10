import type { CSSProperties } from "react";

export type IconName =
  | "arrow"
  | "search"
  | "plus"
  | "clock"
  | "wallet"
  | "car"
  | "leaf"
  | "cube"
  | "chip"
  | "check"
  | "link"
  | "menu"
  | "close"
  | "spark"
  | "book";
const paths: Record<IconName, React.ReactNode> = {
  arrow: (
    <>
      <path d="M4 12h16M14 6l6 6-6 6" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 4 4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  wallet: (
    <>
      <path d="M20 8H5a2 2 0 0 1 0-4h13v4M4 6v12a2 2 0 0 0 2 2h14V8M20 12h-5v4h5" />
      <path d="M16 14h.01" />
    </>
  ),
  car: (
    <>
      <path d="m5 10 2-6h10l2 6M3 10h18v8H3zM5 18v2M19 18v2M6 14h2M16 14h2" />
    </>
  ),
  leaf: (
    <>
      <path d="M20 3C7 2 2 9 6 16s16 4 14-13ZM4 21 16 9" />
    </>
  ),
  cube: (
    <>
      <path d="m12 3 9 5v9l-9 5-9-5V8zM3 8l9 5 9-5M12 13v9M7 5.8l9 5" />
    </>
  ),
  chip: (
    <>
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <path d="M9 9h6v6H9zM9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  link: (
    <>
      <path d="m10 14 4-4M8 16l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0M16 8l1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  spark: (
    <>
      <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z" />
    </>
  ),
  book: (
    <>
      <path d="M12 5C8 2 4 3 2 4v15c4-2 7-1 10 1 3-2 6-3 10-1V4c-2-1-6-2-10 1v15" />
    </>
  ),
};
export function Icon({
  name,
  size = 20,
  style,
}: {
  name: IconName;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      {paths[name]}
    </svg>
  );
}
export function ElephantMark({ size = 38 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <rect width="48" height="48" rx="15" fill="var(--brand)" />
      <path
        d="M12 31V21c0-7 5-11 12-11h4c7 0 11 5 11 11v9c0 5-2 8-6 8-3 0-5-2-5-5h4c0 1 0 2 1 2s2-1 2-3v-5h-5v7h-6v-7h-6v7h-6v-3Z"
        fill="var(--on-brand)"
      />
      <path
        d="M25 15c-5 0-8 3-8 7s3 7 7 7"
        stroke="var(--brand)"
        strokeWidth="2"
      />
      <circle cx="32" cy="19" r="1.5" fill="var(--brand)" />
      <path
        d="m33 27 2 3"
        stroke="var(--brand-muted)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
