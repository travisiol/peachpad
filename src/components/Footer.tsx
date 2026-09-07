import Link from "next/link";
import { site, percent } from "@/lib/site";
import { Reveal } from "@/components/Reveal";
import { Wordmark } from "@/components/Wordmark";

const NAV = [
  { href: "#home", label: "Home" },
  { href: "#launches", label: "Launches" },
  { href: "#about", label: "About" },
  { href: "#token", label: "Token" },
  { href: "/launch/", label: "Launchpad" },
];

const linkClass =
  "text-sm uppercase tracking-wide text-ink/70 transition-colors hover:text-peach";

export function Footer() {
  return (
    <footer className="relative border-t-4 border-ink bg-cream-deep">
      <Reveal y={20} className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-14">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xs">
            <Link href="#home" className="inline-flex items-center gap-2.5">
              <Wordmark size="md" />
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-ink/60">
              Middleware for launches on proven pads, plus optional tools that
              raise the odds of success. You keep {percent.creator}.
            </p>
          </div>
          <div className="flex flex-wrap gap-12 sm:gap-16">
            <div>
              <p className="font-display text-xs text-ink/50">Navigate</p>
              <ul className="mt-3 space-y-2">
                {NAV.map((n) => (
                  <li key={n.href}>
                    {n.href.startsWith("#") ? (
                      <a href={n.href} className={linkClass}>
                        {n.label}
                      </a>
                    ) : (
                      <Link href={n.href} className={linkClass}>
                        {n.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-display text-xs text-ink/50">Social</p>
              <ul className="mt-3 space-y-2">
                <li>
                  <a href={site.x} target="_blank" rel="noopener noreferrer" className={linkClass} aria-label="X">
                    X
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t-4 border-ink/20 pt-6 sm:flex-row sm:items-center">
          <p className="text-xs uppercase tracking-wide text-ink/45">
            © {new Date().getFullYear()} {site.name}. All rights reserved.
          </p>
          <p className="text-xs uppercase tracking-wide text-ink/40">
            First pad: {site.firstPad} · More platforms ahead
          </p>
        </div>
      </Reveal>
    </footer>
  );
}
