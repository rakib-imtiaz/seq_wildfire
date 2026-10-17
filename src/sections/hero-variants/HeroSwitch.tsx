import "./hero-switch.css";

const HERO: [string, string][] = [
  ["0", "3D table"],
  ["1", "1 · Video"],
  ["2", "2 · Film"],
  ["3", "3 · Ambient"],
];

/** Review-only pill (shown whenever ?hero= is present) to flip between the hero variants. */
export function HeroSwitch({ hero }: { hero: string | null }) {
  const h = hero ?? "0";
  return (
    <nav className="hero-switch mono mono--s" aria-label="Review variants">
      <span className="hero-switch__group">
        <span className="hero-switch__k">Hero</span>
        {HERO.map(([v, label]) => (
          <a key={v} href={`/?hero=${v}`} aria-current={v === h ? "page" : undefined}>
            {label}
          </a>
        ))}
      </span>
    </nav>
  );
}
