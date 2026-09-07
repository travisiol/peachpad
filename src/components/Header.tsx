"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { site } from "@/lib/site";
import { Wordmark } from "@/components/Wordmark";
import { XIcon } from "@/components/XIcon";

const NAV = [
  { href: "#home", label: "Home" },
  { href: "#launches", label: "Launches" },
  { href: "#about", label: "About" },
  { href: "#token", label: "Token" },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("resize", close);
    return () => window.removeEventListener("resize", close);
  }, [open]);

  const solid = scrolled || open;

  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className={`fixed inset-x-0 top-0 z-50 border-b-4 transition-colors duration-200 ${
        solid ? "border-ink bg-cream" : "border-transparent bg-transparent"
      }`}
    >
      <nav className="mx-auto flex h-[4.25rem] max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link href="#home" className="group flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <Wordmark size="sm" />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="pixel-nav-link">
              {n.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <a
            href={site.x}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Follow on X"
            className="pixel-icon-btn"
          >
            <XIcon />
          </a>
          <Link href="/launch/" className="btn-primary">
            Launch NOW
          </Link>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <a
            href={site.x}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Follow on X"
            className="pixel-icon-btn !h-10 !w-10"
          >
            <XIcon />
          </a>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="pixel-icon-btn !h-10 !w-10"
          >
            <span className="sr-only">Menu</span>
            <div className="flex w-4 flex-col gap-1">
              <span
                className={`h-1 w-full bg-ink transition-transform duration-150 ${
                  open ? "translate-y-2 rotate-45" : ""
                }`}
              />
              <span
                className={`h-1 w-full bg-ink transition-opacity duration-150 ${
                  open ? "opacity-0" : ""
                }`}
              />
              <span
                className={`h-1 w-full bg-ink transition-transform duration-150 ${
                  open ? "-translate-y-2 -rotate-45" : ""
                }`}
              />
            </div>
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open ? (
          <motion.div
            key="menu"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-x-0 top-full border-b-4 border-ink bg-cream px-5 py-5 md:hidden"
          >
            <div className="flex flex-col gap-2">
              {NAV.map((n) => (
                <a
                  key={n.href}
                  href={n.href}
                  className="pixel-nav-link"
                  onClick={() => setOpen(false)}
                >
                  {n.label}
                </a>
              ))}
              <Link
                href="/launch/"
                className="btn-primary mt-2 justify-center"
                onClick={() => setOpen(false)}
              >
                Launch NOW
              </Link>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.header>
  );
}
