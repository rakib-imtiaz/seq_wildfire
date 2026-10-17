import { useEffect, useRef, type CSSProperties, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import type { MediaSlot, ThermalPairSlot } from "../data/media";
import { SceneArt, type SceneKind } from "./SceneArt";

type Ratio = [number, number];

/**
 * A photo slot. With no `src` yet it renders a dark generated placeholder; `data-media` names the expected
 * file from prompts/IMAGE-PROMPTS.md. Reveals with a heat bloom from `origin`.
 */
export function PhotoSlot({
  media,
  kind,
  ratio,
  seed,
  origin = ["50%", "60%"],
  bloom = true,
  className = "",
  children,
  sizes = "(min-width: 1024px) 50vw, 100vw",
}: {
  media: MediaSlot;
  kind: SceneKind;
  ratio: Ratio;
  seed?: number;
  origin?: [string, string];
  bloom?: boolean;
  className?: string;
  children?: ReactNode;
  sizes?: string;
}) {
  const style = { "--pr": `${ratio[0]} / ${ratio[1]}`, "--bx": origin[0], "--by": origin[1] } as CSSProperties;
  return (
    <figure className={`photo ${bloom ? "bloom" : ""} ${className}`} style={style} data-media={media.expected}>
      {media.src ? (
        <img src={media.src} srcSet={media.srcset} alt={media.alt} loading="lazy" decoding="async" sizes={sizes} />
      ) : (
        <SceneArt kind={kind} ratio={ratio} seed={seed} />
      )}
      {children}
    </figure>
  );
}

/**
 * Visible/thermal pair with a small thermal lens that follows the pointer (mouse hover, or touch drag).
 * The thermal layer is a CSS radial mask. On touch-only devices the lens rests on the hotspot.
 */
export function ThermalPair({
  pair,
  kind,
  ratio,
  seed,
  rest = [0.5, 0.5],
  className = "",
  label,
  sizes = "(min-width: 1100px) 28vw, (min-width: 600px) 46vw, 92vw",
}: {
  pair: ThermalPairSlot;
  kind: SceneKind;
  ratio: Ratio;
  seed?: number;
  rest?: [number, number];
  className?: string;
  label?: string;
  sizes?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const [rx, ry] = rest;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const place = () => {
      const r = el.getBoundingClientRect();
      if (el.dataset.active !== undefined) return;
      el.style.setProperty("--lx", `${(r.width * rx).toFixed(1)}px`);
      el.style.setProperty("--ly", `${(r.height * ry).toFixed(1)}px`);
    };
    place();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(place) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [rx, ry]);

  const move = (e: RPointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--lx", `${(e.clientX - r.left).toFixed(1)}px`);
    el.style.setProperty("--ly", `${(e.clientY - r.top).toFixed(1)}px`);
    el.dataset.active = "";
  };
  const leave = () => {
    const el = ref.current;
    if (!el) return;
    delete el.dataset.active;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--lx", `${(r.width * rx).toFixed(1)}px`);
    el.style.setProperty("--ly", `${(r.height * ry).toFixed(1)}px`);
  };

  const img = (m: MediaSlot, mode: "visible" | "thermal") =>
    m.src ? (
      <img
        src={m.src}
        srcSet={m.srcset}
        sizes={m.srcset ? sizes : undefined}
        alt={mode === "visible" ? m.alt : ""}
        loading="lazy"
        decoding="async"
        draggable={false}
      />
    ) : (
      <SceneArt kind={kind} mode={mode} ratio={ratio} seed={seed} />
    );

  return (
    <div
      ref={ref}
      className={`tpair ${className}`}
      style={{ "--pr": `${ratio[0]} / ${ratio[1]}` } as CSSProperties}
      data-media={`${pair.visible.expected} + ${pair.thermal.expected}`}
      onPointerMove={move}
      onPointerDown={move}
      onPointerLeave={leave}
      onPointerCancel={leave}
    >
      <div className="tpair__layer">{img(pair.visible, "visible")}</div>
      <div className="tpair__layer tpair__thermal" aria-hidden="true">
        {img(pair.thermal, "thermal")}
      </div>
      <span className="tpair__rim" aria-hidden="true">
        <i />
      </span>
      {label && <span className="tpair__label mono mono--s">{label}</span>}
    </div>
  );
}
