import { useRef } from "react";
import { Hero } from "../Hero";
import { FilmButton, FilmPlayer, type FilmPlayerHandle } from "./FilmPlayer";

/** Variant 2 (?hero=2): the 3D command-table hero as is, plus a "Watch the film" CTA that opens a full-screen player. */
export function HeroFilm() {
  const player = useRef<FilmPlayerHandle>(null);
  const button = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Hero
        className="hero--film"
        actions={<FilmButton ref={button} onPrime={() => player.current?.prime()} onOpen={() => player.current?.open()} />}
      />
      <FilmPlayer ref={player} returnFocus={button} />
    </>
  );
}
