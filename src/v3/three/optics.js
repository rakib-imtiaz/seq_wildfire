// The M3T's three cameras, FACTS.md §3 only (DJI spec page, read 2026-10-16).
//   Wide     1/2-inch CMOS, 48 MP, 24 mm eq, FOV 84°, f/2.8      → 4:3 frame
//   Tele     1/2-inch CMOS, 12 MP, 162 mm eq, FOV 15°             → 4:3 frame
//   Thermal  640 × 512 VOx, 40 mm eq, DFOV 61°, f/1.0             → 5:4 frame
// DJI states the thermal FOV as diagonal (DFOV). The wide and tele figures are read as diagonal too (DJI's FOV
// for these camera modules is the diagonal one); the half-angles below split the diagonal by the frame aspect.
// Nothing else (no rangefinder, no RTK) is modelled.

const rad = (d) => (d * Math.PI) / 180;

function lens(id, dfov, aspect) {
  const td = Math.tan(rad(dfov) / 2);
  const k = Math.sqrt(aspect * aspect + 1);
  const th = (td * aspect) / k; // tan of the horizontal half-angle
  const tv = td / k;            // tan of the vertical half-angle
  return { id, dfov, aspect, th, tv, vfov: (2 * Math.atan(tv) * 180) / Math.PI };
}

export const LENSES = [
  lens('wide', 84, 4 / 3),
  lens('tele', 15, 4 / 3),
  lens('thermal', 61, 640 / 512),
];
export const LENS_INDEX = { wide: 0, tele: 1, thermal: 2 };

// The SAMPLE hover: the M3T squares its camera to the slope at the hotspot and stands this far off it along the
// slope's normal, which puts it 100 m above the ground under it. The page's footprint figures read the same value.
export const STANDOFF = 77;

/** a lens's footprint, metres across × along, on a plane square to its axis at distance d */
export const footprint = (L, d) => [2 * d * L.th, 2 * d * L.tv];
