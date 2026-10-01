import type { CSSProperties } from "react";
const paths = {
  edit: "m16 3 5 5-12 12-6 1 1-6L16 3ZM14 5l5 5",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  upload: "M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  arrowUp: "M6 18 18 6M6 6h12v12",
  back: "M19 12H5m6-6-6 6 6 6",
  chat: "M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V11.5A8.5 8.5 0 0 1 10.5 3h2a8.5 8.5 0 0 1 8.5 8.5ZM7 9h9M7 13h6",
  lock: "M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5Zm7 4v3",
  shield: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6",
  moon: "M20.5 13A8.5 8.5 0 1 1 11 3.5 7 7 0 0 0 20.5 13Z",
  search: "M21 21l-5-5M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z",
  plus: "M12 5v14M5 12h14",
  close: "m6 6 12 12M6 18 18 6",
  menu: "M4 7h16M4 12h16M4 17h16",
  send: "m21 3-6 18-4-8-8-4 18-6ZM11 13 21 3",
  check: "m5 12 4 4L19 6",
  smile:
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM8 14s1 3 4 3 4-3 4-3M8 8h.01M16 8h.01",
  info: "M12 11v6m0-10h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  settings: "M4 7h16M4 17h16M8 4v6M16 14v6",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  archive: "M3 3h18v5H3Zm2 5v13h14V8M9 12h6",
  pin: "m16 3 5 5-4 1-4 4-1 5-3-3-6 6m6-6-3-3 5-1 4-4 1-4Z",
  github:
    "M9 22v-4c-4 1-4-2-6-2m12 6v-4a4 4 0 0 0-1-3c4 0 7-2 7-6a6 6 0 0 0-2-4V2l-4 2H9L5 2v3a6 6 0 0 0-2 4c0 4 3 6 7 6a4 4 0 0 0-1 3",
  wallet:
    "M20 8V5H4a2 2 0 0 1 0-4h14M4 5H2v15a2 2 0 0 0 2 2h16V8H4m16 4h-5v6h5M16 15h.01",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  globe:
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z",
  copy: "M8 8h13v13H8ZM16 4V2H2v14h2",
  trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7",
  code: "m8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18",
  sparkle: "m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z",
} as const;
export type IconName = keyof typeof paths;
export function Icon({
  name,
  size = 20,
  className = "",
  style,
}: {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
