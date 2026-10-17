/**
 * The fictional watch zone: the one layout shared by the 3D command table (public/table) and the 2D sample map
 * (src). Metres, table-local: x runs east (-800..800), z runs south (-500..500), y is up. Nothing here is a real
 * place; every label on screen that comes from this file is SAMPLE data.
 *
 * Story: a river leaves a reservoir in the north-west, passes a concrete dam and powerhouse, and runs south-east
 * down the valley. A transmission line climbs from the powerhouse switchyard along the north slope to a substation.
 * The gravel access road follows the valley floor to the dam and branches up to the substation. A hotspot sits in
 * the forest on the north slope, just below the line: the risk the whole page is about.
 *
 * Wave 1 may move points to sit well on the terrain, but must keep these names and shapes (both sides read them).
 *
 * Wave 1 nudges (2026-10-16, 3D table), so the layout is physically consistent; names, array lengths and
 * checkpoint indices are unchanged:
 *   - dam.rot is the river's downstream heading at the dam (atan2(dz, dx)); the crest runs across it, NE to SW.
 *   - reservoir: the two downstream vertices now sit on the dam crest's ends, so the lake ends at the dam.
 *   - powerhouse: moved from mid-river to the north bank at the dam toe, beside the switchyard (penstocks and
 *     intake on that side). The switchyard moved 32 m up the slope onto a bench at crest level (it overlapped
 *     the powerhouse yard 45 m below it); towers[0] moved just outside its pad (it stood in its middle).
 *   - road: the last three points left the river channel; the road now runs on the south bank floodplain and
 *     climbs the south valley wall to the dam's south crest end, so the crest is drivable.
 *   - patrol: points 13 to 17 follow the road edits, then cross the crest to its north end (the old last point
 *     was in the reservoir).
 *
 * Story move (2026-10-16, after the hero review): the hotspot moved from (395, -385), 115 m from the north cut
 * edge and upslope of the line, to (395, -250): in the forest on the downslope (south) side of the line between
 * towers 3 and 4 (the line runs at z = -299 there), about 250 m from every slab edge. The classic case: a fire
 * running upslope toward the line. The three perimeters grow upslope with the NE wind toward the line without
 * crossing it; the escalation band lies between the T+00:50 perimeter and the line; the observations ring the
 * new hotspot and the flight ends 60 m south of it. Names, array lengths and peakC unchanged.
 */

export const ZONE = {
  size: [1600, 1000],          // slab footprint, metres (x, z)
  name: 'SAMPLE WATCH ZONE 07',  // fictional; shown with a SAMPLE tag
  origin: { e: 0, n: 0 },      // no real coordinates; readouts use a fictional local grid

  /** valley floor / river centreline, north-west to south-east */
  river: [[-800, -330], [-560, -260], [-360, -170], [-170, -95], [-40, -10], [120, 70], [320, 150], [540, 260], [800, 360]],
  /** reservoir shoreline (closed polygon) upstream of the dam */
  reservoir: [[-800, -470], [-640, -440], [-470, -360], [-300, -250], [-125, -185], [-228, -18], [-300, -60], [-470, -120], [-640, -170], [-800, -190]],

  dam: { x: -190, z: -110, rot: 0.55, crest: 240, height: 48, spillwayGates: 4 },
  powerhouse: { x: -87, z: -101, rot: 0.55, w: 42, d: 26, h: 18 },
  switchyard: { x: -52, z: -176, w: 50, d: 34 },

  /** transmission line: switchyard to substation, one tower per point, wires sag between them */
  towers: [[-12, -186], [70, -205], [210, -250], [350, -290], [470, -315]],
  substation: { x: 590, z: -330, w: 90, d: 64, rot: 0.08 },

  /** gravel access road: south-east entrance, up the valley floor to the dam, with a branch to the substation */
  road: [[800, 420], [620, 330], [420, 230], [230, 140], [52, 78], [-82, 36], [-228, -16]],
  roadBranch: [[230, 140], [330, 40], [430, -90], [520, -220], [585, -290]],

  truckStart: { x: 300, z: 180, heading: -2.7 },

  /** the guard's patrol: road, around the substation fence, back, then across the dam crest */
  patrol: [[300, 180], [230, 140], [330, 40], [430, -90], [520, -220], [545, -362], [635, -368], [640, -298], [585, -290], [520, -220], [430, -90], [330, 40], [230, 140], [52, 78], [-82, 36], [-228, -16], [-187, -108], [-123, -186]],
  /** checkpoints along the patrol (indices into patrol[]) with sample timestamps */
  checkpoints: [{ i: 0, t: '19:42' }, { i: 4, t: '19:51' }, { i: 6, t: '19:54' }, { i: 10, t: '20:01' }, { i: 15, t: '20:09' }, { i: 17, t: '20:12' }],

  /** the hotspot: forest on the north slope, just downslope (south) of the line between towers 3 and 4 */
  hotspot: { x: 395, z: -250, peakC: 312 },  // peakC: a SAMPLE reading inside the M3T low-gain range (0 to 500 C)
  /** estimated affected area at three sample times, growing upslope toward the line with a NE wind (closed polygons) */
  perimeters: [
    { t: 'T+00:00', pts: [[382, -262], [406, -262], [410, -218], [392, -226], [378, -244]] },
    { t: 'T+00:25', pts: [[366, -268], [412, -276], [432, -258], [434, -206], [384, -212], [358, -244]] },
    { t: 'T+00:50', pts: [[350, -276], [418, -286], [446, -266], [460, -200], [398, -196], [350, -214], [338, -252]] },
  ],
  /** area needing escalation: the band between the T+00:50 perimeter and the line, running on west along the line */
  escalation: [[474, -292], [486, -312], [350, -286], [262, -262], [330, -268], [418, -288]],
  /** drone observation points (where the M3T paused to look) */
  observations: [[320, -232], [372, -322], [468, -296], [470, -215], [405, -178]],
  /** drone launch arc: from the truck bed up toward the hotspot (the hover is 60 m south of it) */
  flight: [[300, 180], [322, 80], [348, -20], [375, -110], [392, -190]],
};

/** Ironbow ramp, cold to hot. Heat data only, never decoration. */
export const IRONBOW = ['#14002e', '#4a0c6a', '#a2195b', '#e8452c', '#ff9e1b', '#ffe6a0', '#ffffff'];
