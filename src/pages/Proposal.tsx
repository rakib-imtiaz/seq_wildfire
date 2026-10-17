import { useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { APPLICATIONS, BUSINESS, CTA_LONG, META, SIGNOFF } from "../data/copy";
import { MEDIA } from "../data/media";
import { Arrow, SampleTag, Stamp } from "../components/Motifs";
import { PhotoSlot } from "../components/Photo";
import { useMeta } from "../lib/meta";
import "../styles/proposal.css";

type AssetId = (typeof APPLICATIONS.items)[number]["id"] | "other";
type Setup = "none" | "ground" | "other" | "";

interface Values {
  organization: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  assetTypes: AssetId[];
  assetOther: string;
  site: string;
  area: string;
  season: string;
  setup: Setup;
  setupOther: string;
  notes: string;
  website: string; // honeypot
}

const EMPTY: Values = {
  organization: "",
  name: "",
  role: "",
  email: "",
  phone: "",
  assetTypes: [],
  assetOther: "",
  site: "",
  area: "",
  season: "",
  setup: "",
  setupOther: "",
  notes: "",
  website: "",
};

type FieldKey = keyof Values;
type Errors = Partial<Record<FieldKey, string>>;

const LABELS: Partial<Record<FieldKey, string>> = {
  organization: "Organization",
  name: "Name",
  email: "Email",
  phone: "Phone",
  assetTypes: "Asset type",
  site: "Site or region",
  notes: "Notes",
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^[0-9+().\-\s]{7,40}$/;

/** Mirrors the server schema in api/_lib/proposal.ts. */
function validate(v: Values): Errors {
  const e: Errors = {};
  if (v.organization.trim().length < 2) e.organization = "Enter the name of your organization.";
  if (v.name.trim().length < 2) e.name = "Enter your name.";
  if (!v.email.trim()) e.email = "Enter an email address.";
  else if (!EMAIL.test(v.email.trim())) e.email = "Enter a valid email address, like name@company.ca.";
  if (v.phone.trim() && !PHONE.test(v.phone.trim())) e.phone = "Enter a valid phone number, or leave it blank.";
  if (v.assetTypes.length === 0) e.assetTypes = "Choose at least one asset type.";
  if (v.site.trim().length < 2) e.site = "Enter the site or region.";
  if (v.notes.length > 4000) e.notes = "Keep notes under 4,000 characters.";
  return e;
}

const ASSETS: { id: AssetId; label: string; hint: string }[] = [
  ...APPLICATIONS.items.map((a) => ({ id: a.id as AssetId, label: a.title, hint: a.text })),
  { id: "other", label: "Other", hint: "Another type of site or asset." },
];

const SETUPS: { id: Exclude<Setup, "">; label: string }[] = [
  { id: "none", label: "None" },
  { id: "ground", label: "Ground only" },
  { id: "other", label: "Other" },
];

function Field({
  id,
  label,
  required,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="field" data-invalid={error ? "" : undefined}>
      <label className="field__label" htmlFor={id}>
        {label}
        {required ? (
          <span className="field__req" aria-hidden="true">
            *
          </span>
        ) : (
          <span className="field__opt">Optional</span>
        )}
      </label>
      {hint && (
        <p className="field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {children}
      <p className="field__err" id={`${id}-err`}>
        {error ?? ""}
      </p>
    </div>
  );
}

export default function Proposal() {
  useMeta(META.proposal.title, META.proposal.description);
  const [v, setV] = useState<Values>(EMPTY);
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [serverMsg, setServerMsg] = useState("");
  const [receivedAt, setReceivedAt] = useState("");
  const summaryRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);

  const errors = validate(v);
  const show = (k: FieldKey) => (submitted || touched[k] ? errors[k] : undefined);
  const visibleErrors = (Object.keys(errors) as FieldKey[]).filter((k) => show(k));

  const set = (k: FieldKey) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  const blur = (k: FieldKey) => () => setTouched((t) => ({ ...t, [k]: true }));
  const aria = (k: FieldKey, hint = false) => ({
    "aria-invalid": show(k) ? true : undefined,
    "aria-describedby": [hint ? `f-${k}-hint` : "", show(k) ? `f-${k}-err` : ""].filter(Boolean).join(" ") || undefined,
  });

  const toggleAsset = (id: AssetId) => {
    setV((s) => ({ ...s, assetTypes: s.assetTypes.includes(id) ? s.assetTypes.filter((a) => a !== id) : [...s.assetTypes, id] }));
    setTouched((t) => ({ ...t, assetTypes: true }));
  };

  const reset = () => {
    setV(EMPTY);
    setTouched({});
    setSubmitted(false);
    setStatus("idle");
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setServerMsg("");
    if (Object.keys(errors).length) {
      window.setTimeout(() => summaryRef.current?.focus(), 0);
      return;
    }
    setStatus("sending");
    try {
      const res = await fetch("/api/proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...v,
          setup: v.setup || undefined,
          assetOther: v.assetTypes.includes("other") ? v.assetOther : "",
          setupOther: v.setup === "other" ? v.setupOther : "",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        setReceivedAt(
          new Date().toLocaleString("en-CA", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }),
        );
        setStatus("done");
        window.scrollTo({ top: 0 });
        window.setTimeout(() => doneRef.current?.focus({ preventScroll: true }), 0);
        return;
      }
      setStatus("error");
      setServerMsg(
        res.status === 429
          ? "Too many requests from this connection. Please wait a minute and try again."
          : res.status === 422
            ? "Some details could not be accepted. Please check the fields and try again."
            : `The request could not be sent. Please try again, or call ${BUSINESS.phone}.`,
      );
    } catch {
      setStatus("error");
      setServerMsg(`The request could not be sent. Check your connection and try again, or call ${BUSINESS.phone}.`);
    }
  };

  return (
    <div className="prop">
      <section className="prop__hero" aria-labelledby="prop-title">
        <PhotoSlot media={MEDIA.proposalHero} kind="proposal" ratio={[21, 9]} seed={61} className="prop__photo" bloom={false} sizes="100vw" />
        <div className="prop__scrim" aria-hidden="true" />
        <div className="wrap prop__hero-in">
          <p className="label mono">
            <span className="label__idx">Proposal</span>
            <span className="label__rule" aria-hidden="true" />
            <span>Wildfire monitoring &amp; fire watch</span>
          </p>
          <h1 id="prop-title" className="prop__title display">
            {status === "done" ? "Request received" : CTA_LONG}
          </h1>
          <p className="lead prop__lead">Tell us about the site, the assets and the monitoring season. {SIGNOFF}</p>
        </div>
      </section>

      <div className="wrap prop__body">
        {status === "done" ? (
          <section className="prop__done" aria-labelledby="done-title">
            <Stamp items={["Received", receivedAt]} sample={false} />
            <h2 id="done-title" ref={doneRef} tabIndex={-1} className="h2">
              Thank you.
            </h2>
            <p className="lead">Your proposal request has been sent to {BUSINESS.name}.</p>
            <p className="body">
              Prefer to talk? Call{" "}
              <a className="prop__tel" href={BUSINESS.phoneHref}>
                {BUSINESS.phone}
              </a>
              .
            </p>
            <div className="prop__done-actions">
              <Link to="/" className="btn btn--ghost btn--lg">
                Back to the site
              </Link>
              <button type="button" className="btn btn--ghost btn--lg" onClick={reset}>
                Send another request
              </button>
            </div>
          </section>
        ) : (
          <div className="prop__grid">
            <form className="form" noValidate onSubmit={onSubmit}>
              <p className="mono mono--s smoke form__req">Fields marked * are required</p>

              {submitted && visibleErrors.length > 0 && (
                <div ref={summaryRef} className="form__summary" role="alert" tabIndex={-1}>
                  <p className="form__summary-title">
                    Please check {visibleErrors.length === 1 ? "1 field" : `${visibleErrors.length} fields`}:
                  </p>
                  <ul>
                    {visibleErrors.map((k) => (
                      <li key={k}>
                        <a href={`#f-${k}`}>{LABELS[k] ?? k}</a>: {errors[k]}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <fieldset className="form__set">
                <legend className="form__legend">
                  <span className="mono mono--s">01</span> Organization &amp; contact
                </legend>
                <div className="form__row form__row--2">
                  <Field id="f-organization" label="Organization" required error={show("organization")}>
                    <input
                      id="f-organization"
                      name="organization"
                      type="text"
                      autoComplete="organization"
                      maxLength={160}
                      value={v.organization}
                      onChange={set("organization")}
                      onBlur={blur("organization")}
                      required
                      {...aria("organization")}
                    />
                  </Field>
                  <Field id="f-name" label="Name" required error={show("name")}>
                    <input id="f-name" name="name" type="text" autoComplete="name" maxLength={120} value={v.name} onChange={set("name")} onBlur={blur("name")} required {...aria("name")} />
                  </Field>
                </div>
                <div className="form__row form__row--3">
                  <Field id="f-role" label="Role">
                    <input id="f-role" name="role" type="text" autoComplete="organization-title" maxLength={120} value={v.role} onChange={set("role")} />
                  </Field>
                  <Field id="f-email" label="Email" required error={show("email")}>
                    <input
                      id="f-email"
                      name="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      maxLength={160}
                      value={v.email}
                      onChange={set("email")}
                      onBlur={blur("email")}
                      required
                      {...aria("email")}
                    />
                  </Field>
                  <Field id="f-phone" label="Phone" error={show("phone")}>
                    <input id="f-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={40} value={v.phone} onChange={set("phone")} onBlur={blur("phone")} {...aria("phone")} />
                  </Field>
                </div>
              </fieldset>

              <fieldset className="form__set">
                <legend className="form__legend">
                  <span className="mono mono--s">02</span> Site &amp; assets
                </legend>
                <fieldset
                  id="f-assetTypes"
                  className="field field--group"
                  data-invalid={show("assetTypes") ? "" : undefined}
                  aria-describedby={show("assetTypes") ? "f-assetTypes-err" : undefined}
                  tabIndex={-1}
                >
                  <legend className="field__label">
                    Asset type
                    <span className="field__req" aria-hidden="true">
                      *
                    </span>
                    <span className="field__hint field__hint--inline">Choose all that apply</span>
                  </legend>
                  <div className="checks">
                    {ASSETS.map((a) => (
                      <label key={a.id} className="check">
                        <input type="checkbox" name="assetTypes" value={a.id} checked={v.assetTypes.includes(a.id)} onChange={() => toggleAsset(a.id)} />
                        <span className="check__box" aria-hidden="true" />
                        <span className="check__txt">
                          <span className="check__label">{a.label}</span>
                          <span className="check__hint">{a.hint}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="field__err" id="f-assetTypes-err">
                    {show("assetTypes") ?? ""}
                  </p>
                </fieldset>
                {v.assetTypes.includes("other") && (
                  <Field id="f-assetOther" label="Other asset type">
                    <input id="f-assetOther" name="assetOther" type="text" maxLength={160} value={v.assetOther} onChange={set("assetOther")} />
                  </Field>
                )}
                <div className="form__row form__row--2">
                  <Field id="f-site" label="Site or region" required hint="Facility name, nearest community or region" error={show("site")}>
                    <input id="f-site" name="site" type="text" maxLength={200} value={v.site} onChange={set("site")} onBlur={blur("site")} required {...aria("site", true)} />
                  </Field>
                  <Field id="f-area" label="Approx. area or corridor length" hint="For example hectares, or kilometres of corridor">
                    <input id="f-area" name="area" type="text" maxLength={120} value={v.area} onChange={set("area")} aria-describedby="f-area-hint" />
                  </Field>
                </div>
                <Field id="f-season" label="Monitoring season or dates" hint="For example the fire season, or specific dates">
                  <input id="f-season" name="season" type="text" maxLength={120} value={v.season} onChange={set("season")} aria-describedby="f-season-hint" />
                </Field>
              </fieldset>

              <fieldset className="form__set">
                <legend className="form__legend">
                  <span className="mono mono--s">03</span> Current fire watch
                </legend>
                <fieldset className="field field--group">
                  <legend className="field__label">
                    Current fire-watch setup<span className="field__opt">Optional</span>
                  </legend>
                  <div className="radios">
                    {SETUPS.map((s) => (
                      <label key={s.id} className="check check--radio">
                        <input type="radio" name="setup" value={s.id} checked={v.setup === s.id} onChange={() => setV((x) => ({ ...x, setup: s.id }))} />
                        <span className="check__box" aria-hidden="true" />
                        <span className="check__label">{s.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                {v.setup === "other" && (
                  <Field id="f-setupOther" label="Describe the current setup">
                    <input id="f-setupOther" name="setupOther" type="text" maxLength={200} value={v.setupOther} onChange={set("setupOther")} />
                  </Field>
                )}
                <Field id="f-notes" label="Notes" hint="Anything else about the site, access or timing" error={show("notes")}>
                  <textarea id="f-notes" name="notes" rows={5} maxLength={4000} value={v.notes} onChange={set("notes")} onBlur={blur("notes")} {...aria("notes", true)} />
                </Field>
              </fieldset>

              {/* honeypot: hidden from people, tempting to bots */}
              <div className="form__hp" aria-hidden="true">
                <label htmlFor="f-website">Website</label>
                <input id="f-website" name="website" type="text" tabIndex={-1} autoComplete="off" value={v.website} onChange={set("website")} />
              </div>

              {status === "error" && serverMsg && (
                <p className="form__server" role="alert">
                  {serverMsg}
                </p>
              )}

              <div className="form__actions">
                <button type="submit" className="btn btn--ember btn--lg form__submit" disabled={status === "sending"} aria-busy={status === "sending"}>
                  {status === "sending" ? "Sending" : "Request proposal"}
                  {status === "sending" ? <span className="form__spin" aria-hidden="true" /> : <Arrow />}
                </button>
              </div>
            </form>

            <aside className="prop__aside" aria-label="Contact">
              <div className="prop__card">
                <p className="mono mono--s smoke">Prefer to talk?</p>
                <a className="prop__phone" href={BUSINESS.phoneHref}>
                  {BUSINESS.phone}
                </a>
                <address className="prop__addr">
                  {BUSINESS.name}
                  <br />
                  {BUSINESS.street}
                  <br />
                  {BUSINESS.city}
                </address>
              </div>
              <div className="prop__card">
                <p className="mono mono--s smoke">Guarding &amp; security services</p>
                <a className="textlink" href={BUSINESS.mainSiteHref} target="_blank" rel="noopener noreferrer">
                  <span>{BUSINESS.mainSite}</span>
                  <span className="vh">(opens in a new tab)</span>
                </a>
              </div>
              <p className="prop__note mono mono--s smoke">
                Maps and readouts on this site are <SampleTag /> data from a fictional watch zone.
              </p>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
