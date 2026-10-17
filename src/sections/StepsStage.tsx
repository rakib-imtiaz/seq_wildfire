import { memo } from "react";
import { SampleTag } from "../components/Motifs";
import { TABLE_STILLS } from "../lib/table3d";
import type { Zone } from "../lib/zone";

/**
 * The steps' stand-in (data-slot="table-steps"): stills rendered from the live 3D scene itself (with its labels and,
 * for step 4, its map layers), one per step, crossfading. It is what the lite tier and the no-WebGL path show, and
 * what everyone sees until the WebGL table has drawn. Step 5 adds the sample report as text over its still.
 */
export const StepsStage = memo(function StepsStage({ zone, step, phone }: { zone: Zone | null; step: number; phone: boolean }) {
  const v = phone ? "phone" : "desk";
  const first = zone?.checkpoints[0]?.t ?? "19:42";
  const last = zone?.checkpoints[zone.checkpoints.length - 1]?.t ?? "20:12";
  return (
    <div className="sstage" data-step={step}>
      {[1, 2, 3, 4, 5].map((n) => (
        <img
          key={`${v}-${n}`}
          className="sstage__still"
          src={TABLE_STILLS.step(n, v)}
          alt=""
          aria-hidden="true"
          decoding="async"
          loading={n === 1 ? "eager" : "lazy"}
          data-on={n === step ? "" : undefined}
        />
      ))}

      <div className="sstage__report" aria-hidden={step < 5}>
        <div className="report">
          <div className="report__head">
            <p className="mono mono--s">Monitoring report</p>
            <SampleTag />
          </div>
          <p className="report__title">{zone?.name ?? "Sample watch zone 07"}</p>
          <dl className="report__rows mono mono--s">
            <div>
              <dt>Flight record</dt>
              <dd>FLT-07 &middot; M3T</dd>
            </div>
            <div>
              <dt>Thermal observation</dt>
              <dd>1 hotspot &middot; Max {zone?.hotspot.peakC ?? 312} &deg;C</dd>
            </div>
            <div>
              <dt>Geotagged imagery</dt>
              <dd>Visible + thermal</dd>
            </div>
            <div>
              <dt>Incident location</dt>
              <dd>
                E +{String(zone?.hotspot.x ?? 395).padStart(4, "0")} N +{String(-(zone?.hotspot.z ?? -385)).padStart(4, "0")}
              </dd>
            </div>
            <div>
              <dt>Timestamps</dt>
              <dd>
                {first} to {last}
              </dd>
            </div>
            <div>
              <dt>Follow-up</dt>
              <dd>Additional monitoring</dd>
            </div>
          </dl>
          <ul className="report__to mono mono--s">
            <li>Authorized client representatives</li>
            <li>Relevant emergency authorities</li>
          </ul>
        </div>
      </div>
    </div>
  );
});
