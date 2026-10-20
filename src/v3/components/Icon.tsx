/**
 * The page's only glyphs, authored as SVG in one 1.5 px stroke (no icon library may be installed for this build).
 */
type Name = "prev" | "next" | "play" | "pause" | "out" | "menu" | "close";

const PATHS: Record<Name, string> = {
  prev: "M19 12H5M11 6l-6 6 6 6",
  next: "M5 12h14M13 6l6 6-6 6",
  play: "M8 5.5v13l10.5-6.5z",
  pause: "M9 5.5v13M15 5.5v13",
  out: "M7 17L17 7M9 7h8v8",
  menu: "M4 8h16M4 16h16",
  close: "M6 6l12 12M18 6L6 18",
};

export function Icon({ name, size = 20 }: { name: Name; size?: number }) {
  return (
    <svg className="ic" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
