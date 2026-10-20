import { forwardRef } from "react";
import { REPORT } from "../data/copy";

/**
 * The SAMPLE incident report that rises in under the whole model in the last beat (beside it in the static story).
 * Real HTML (readable, selectable); the two thumbnails are the canopy pair (visible / thermal), standing in for the
 * geotagged imagery.
 */
export const ReportCard = forwardRef<HTMLDivElement, { className?: string; style?: React.CSSProperties }>(function ReportCard({ className = "", style }, ref) {
  return (
    <div ref={ref} className={`rep ${className}`} style={style} role="group" aria-label="SAMPLE incident report">
      <div className="rep__head">
        <span className="tag">SAMPLE</span>
        <span className="rep__zone">{REPORT.zone}</span>
      </div>
      <p className="rep__title">{REPORT.title}</p>
      <div className="rep__imgs">
        <img src="/media/photos/svc-canopy-visible-640.webp" alt="SAMPLE geotagged image, visible light: a canopy with a smouldering stump." width={640} height={480} />
        <img src="/media/photos/svc-canopy-thermal-640.webp" alt="SAMPLE geotagged image, thermal: the stump as the hotspot." width={640} height={480} />
      </div>
      <dl className="rep__rows">
        {REPORT.rows.map((r) => (
          <div key={r.k} className="rep__row">
            <dt>{r.k}</dt>
            <dd>{r.v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
});
