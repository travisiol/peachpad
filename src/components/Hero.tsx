"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { site, percent } from "@/lib/site";
import { FloatingPeaches } from "@/components/FloatingPeaches";

const rise = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

export function Hero() {
  return (
    <section
      id="home"
      className="relative isolate flex min-h-[100svh] items-center justify-center overflow-hidden pt-20"
    >
      <FloatingPeaches />

      <motion.div
        initial="hidden"
        animate="show"
        transition={{ staggerChildren: 0.1, delayChildren: 0.15 }}
        className="relative z-20 mx-auto flex max-w-4xl flex-col items-center px-5 text-center sm:px-8"
      >
        <motion.div variants={rise} transition={{ duration: 0.5 }}>
          <span className="pixel-badge !px-4 !py-2 !text-xs sm:!text-sm">
            <span className="inline-block h-2.5 w-2.5 bg-peach" />
            Launch middleware · Success layer
          </span>
        </motion.div>

        <motion.h1
          variants={rise}
          transition={{ duration: 0.5 }}
          className="mt-8 font-display text-[2.45rem] leading-[1.12] text-ink sm:text-6xl md:text-7xl lg:text-[4.5rem]"
        >
          <span className="text-peach">{site.name}</span>
        </motion.h1>

        <motion.p
          variants={rise}
          transition={{ duration: 0.5 }}
          className="mt-6 max-w-2xl text-base leading-relaxed text-ink/70 sm:text-lg"
        >
          We don’t run our own factory. We launch you on proven pads, starting
          with {site.firstPad}, and give your token the optional tools to
          actually grow. You keep {percent.creator}. We take {percent.pad}.
        </motion.p>

        <motion.div
          variants={rise}
          transition={{ duration: 0.5 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
        >
          <Link href="/launch/" className="btn-primary px-9 py-4 text-base">
            Launch on {site.firstPad}
            <span aria-hidden="true">→</span>
          </Link>
          <a href="#about" className="btn-secondary px-7 py-4 text-base">
            How it works
          </a>
        </motion.div>
      </motion.div>
    </section>
  );
}
