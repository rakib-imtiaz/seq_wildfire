import { subject, summary, validate } from "./_lib/proposal.js";

/**
 * POST /api/proposal  (Vercel serverless function, Node runtime)
 *
 * Ported from seq_security's quote route: zod validation, honeypot, naive rate limit, then email via Resend's
 * HTTP API if configured. Without RESEND_API_KEY + PROPOSAL_NOTIFY_EMAIL it logs the request and returns ok, so
 * the form works before keys exist. Keys are set by the client in the hosting dashboard, never in code.
 *
 *   RESEND_API_KEY          Resend API key
 *   PROPOSAL_NOTIFY_EMAIL   where requests go
 *   PROPOSAL_FROM_EMAIL     optional verified sender, e.g. "Sequoia Security <proposals@your-domain>"
 */

declare const process: { env: Record<string, string | undefined> };

type Req = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  socket?: { remoteAddress?: string };
};
type Res = {
  status(code: number): Res;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
};

export default async function handler(req: Req, res: Res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const fwd = req.headers["x-forwarded-for"];
  const ip = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";

  const v = validate(req.body, ip);
  if (v.kind === "error") return res.status(v.result.status).json(v.result.body);
  // honeypot tripped: pretend success, drop silently
  if (v.kind === "bot") return res.status(200).json({ ok: true });

  const data = v.data;
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.PROPOSAL_NOTIFY_EMAIL;
  const from = process.env.PROPOSAL_FROM_EMAIL || "Sequoia Security Website <onboarding@resend.dev>";

  if (!apiKey || !to) {
    console.info("[proposal] received (RESEND_API_KEY or PROPOSAL_NOTIFY_EMAIL not set; not emailed):", {
      organization: data.organization,
      name: data.name,
      email: data.email,
      assetTypes: data.assetTypes,
      site: data.site,
    });
    return res.status(200).json({ ok: true });
  }

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: data.email,
        subject: subject(data),
        text: summary(data),
      }),
    });
    if (!r.ok) throw new Error(`resend responded ${r.status}`);
  } catch (err) {
    console.error("[proposal] email send failed:", err);
    return res.status(502).json({ ok: false, error: "send_failed" });
  }

  return res.status(200).json({ ok: true });
}
