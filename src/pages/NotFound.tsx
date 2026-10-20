import { Link } from "react-router-dom";
import { CTA_SHORT, META } from "../data/copy";
import { Arrow, Reticle } from "../components/Motifs";
import { useMeta } from "../lib/meta";
import "../styles/proposal.css";

export default function NotFound() {
  useMeta(META.notFound.title, META.notFound.description, { noindex: true });
  return (
    <section className="nf" aria-labelledby="nf-title">
      <div className="wrap nf__in">
        <Reticle className="nf__reticle" />
        <p className="mono smoke">404 &middot; No signal</p>
        <h1 id="nf-title" className="nf__title display">
          Page not found
        </h1>
        <p className="lead">This page is outside the watch zone. It may have moved, or the address may be mistyped.</p>
        <div className="nf__actions">
          <a href="/" className="btn btn--ghost btn--lg">
            Back to the site
          </a>
          <Link to="/proposal" className="btn btn--ember btn--lg">
            {CTA_SHORT}
            <Arrow />
          </Link>
        </div>
      </div>
    </section>
  );
}
