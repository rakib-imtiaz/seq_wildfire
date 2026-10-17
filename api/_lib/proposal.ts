import { z } from "zod";

/**
 * Proposal intake core, shared by the Vercel function (api/proposal.ts) and the dev middleware (vite.config.ts).
 * Ported from seq_security's quote route: zod validation, honeypot, naive in-memory rate limit.
 * Files under api/_lib are not deployed as routes.
 */

export const ASSET_TYPES = ["hydro", "transmission", "remote-utility", "industrial", "forestry", "other"] as const;
export const SETUPS = ["none", "ground", "other"] as const;

const opt = (max: number) => z.string().trim().max(max).optional().default("");

export const proposalSchema = z.object({
  organization: z.string().trim().min(2).max(160),
  name: z.string().trim().min(2).max(120),
  role: opt(120),
  email: z.string().trim().email().max(160),
  phone: opt(40),
  assetTypes: z.array(z.enum(ASSET_TYPES)).min(1).max(ASSET_TYPES.length),
  assetOther: opt(160),
  site: z.string().trim().min(2).max(200),
  area: opt(120),
  season: opt(120),
  setup: z.enum(SETUPS).optional(),
  setupOther: opt(200),
  notes: opt(4000),
  // honeypot: any value means a bot; accepted silently and dropped
  website: z.string().max(500).optional().default(""),
});

export type Proposal = z.infer<typeof proposalSchema>;

export interface Result {
  status: number;
  body: { ok: boolean; error?: string; fields?: string[] };
}

/* naive in-memory rate limit (per warm instance), fine for a brochure site */
const hits = new Map<string, number[]>();
const WINDOW = 60_000;
const MAX = 5;

export function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > MAX;
}

export type Validated = { kind: "ok"; data: Proposal } | { kind: "bot" } | { kind: "error"; result: Result };

/** Parse + validate a request body. Never throws. */
export function validate(body: unknown, ip: string): Validated {
  if (rateLimited(ip)) return { kind: "error", result: { status: 429, body: { ok: false, error: "rate_limited" } } };
  let input = body;
  if (typeof input === "string") {
    try {
      input = JSON.parse(input);
    } catch {
      return { kind: "error", result: { status: 400, body: { ok: false, error: "bad_json" } } };
    }
  }
  const parsed = proposalSchema.safeParse(input);
  if (!parsed.success) {
    const fields = Array.from(new Set(parsed.error.issues.map((i) => String(i.path[0] ?? ""))));
    return { kind: "error", result: { status: 422, body: { ok: false, error: "invalid", fields } } };
  }
  if (parsed.data.website) return { kind: "bot" };
  return { kind: "ok", data: parsed.data };
}

const ASSET_LABEL: Record<(typeof ASSET_TYPES)[number], string> = {
  hydro: "Hydroelectric",
  transmission: "Transmission & substations",
  "remote-utility": "Remote utility & construction",
  industrial: "Industrial near forest",
  forestry: "Forestry",
  other: "Other",
};

const SETUP_LABEL: Record<(typeof SETUPS)[number], string> = {
  none: "None",
  ground: "Ground only",
  other: "Other",
};

export function summary(d: Proposal): string {
  return [
    `Organization: ${d.organization}`,
    `Name: ${d.name}`,
    d.role ? `Role: ${d.role}` : "",
    `Email: ${d.email}`,
    d.phone ? `Phone: ${d.phone}` : "",
    `Asset type: ${d.assetTypes.map((a) => ASSET_LABEL[a]).join(", ")}${d.assetOther ? ` (${d.assetOther})` : ""}`,
    `Site / region: ${d.site}`,
    d.area ? `Approx. area / corridor length: ${d.area}` : "",
    d.season ? `Monitoring season / dates: ${d.season}` : "",
    d.setup ? `Current fire-watch setup: ${SETUP_LABEL[d.setup]}${d.setupOther ? ` (${d.setupOther})` : ""}` : "",
    d.notes ? `\nNotes:\n${d.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function subject(d: Proposal): string {
  return `Wildfire monitoring proposal request, ${d.organization} (${d.name})`;
}
