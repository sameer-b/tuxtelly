import type { RefObject } from "react";
import tmdbLogo from "../assets/credits/tmdb.svg";

export type AboutViewProps = {
  version: string;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onBack: () => void;
};

export function AboutView({ version, headingRef, onBack }: AboutViewProps) {
  return (
    <main className="settings" aria-labelledby="about-title">
      <p className="eyebrow">ABOUT & CREDITS</p>
      <h1 id="about-title" ref={headingRef} tabIndex={-1}>
        About TuxTelly.
      </h1>
      <p className="subtitle">
        Your streaming services, one Linux TV remote. Version {version} ·
        development preview.
      </p>
      <section className="panel">
        <h2>Movie and TV data</h2>
        <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">
          <img className="tmdb-logo" src={tmdbLogo} alt="TMDB" />
        </a>
        <p>
          This product uses the TMDB API but is not endorsed or certified by
          TMDB.
        </p>
        <p>
          Streaming availability data is powered by{" "}
          <a href="https://www.justwatch.com/" target="_blank" rel="noreferrer">
            JustWatch
          </a>
          . Provider listings vary by region and subscription.
        </p>
      </section>
      <section className="panel">
        <h2>Software and artwork</h2>
        <p>
          TuxTelly’s source code is available under the{" "}
          <a
            href="https://github.com/sameer-b/tuxtelly"
            target="_blank"
            rel="noreferrer"
          >
            MIT license
          </a>
          . Provider names and logos belong to their respective owners.
        </p>
        <p>
          Optional photo wallpapers are by Enrico Bet, GHEORGHE LUPAN, Luca
          Bravo, and Max Fomin, used under the Unsplash License. See the{" "}
          <a
            href="https://github.com/sameer-b/tuxtelly/blob/main/packages/ui/src/assets/wallpapers/README.md"
            target="_blank"
            rel="noreferrer"
          >
            wallpaper credits
          </a>
          .
        </p>
      </section>
      <button onClick={onBack}>Back to Library</button>
    </main>
  );
}
