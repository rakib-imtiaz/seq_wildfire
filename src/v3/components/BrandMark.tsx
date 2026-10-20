import { useState } from "react";
import { Wordmark } from "../../components/Logo";
import { Scramble } from "./TextMotion";

/**
 * The header's wordmark (the main site's, from the client's card), animated: on load each letter's stroke draws in
 * left to right, a cobalt scan line passes over the word like a thermal sweep, and the descriptor decodes. Hovering
 * the brand plays it again. Motion off: the static wordmark.
 */
export function BrandMark() {
  const [play, setPlay] = useState(0);
  return (
    <span className="logo brand" onMouseEnter={() => setPlay((p) => p + 1)}>
      <Wordmark key={play} className="logo__mark brand__mark" />
      <Scramble className="logo__desc" text="Wildfire monitoring & fire watch" active replay={play} delay={play ? 120 : 650} />
      <span key={`s${play}`} className="brand__scan" aria-hidden="true" />
    </span>
  );
}
