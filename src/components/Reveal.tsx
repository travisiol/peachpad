"use client";

import { motion, type HTMLMotionProps } from "framer-motion";

type Props = HTMLMotionProps<"div"> & {
  /** Pixels to rise from. The reference uses 28 for section heads, 24 for
   *  columns and 16 for the small tool cards. */
  y?: number;
  delay?: number;
};

/** Fade-and-rise once, when the block scrolls into view. */
export function Reveal({ y = 28, delay = 0, children, ...rest }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px 0px" }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      style={{ willChange: "transform, opacity" }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
