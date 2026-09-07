import { site } from "@/lib/site";
import { PeachMark } from "@/components/PeachMark";

/**
 * The framed peach plus `Peach Pad`, second word in the accent. `sm` is the
 * nav (text steps up at the sm breakpoint), `md` the footer (fixed base).
 * The 40px frame is the same in both.
 */
export function Wordmark({ size = "sm" }: { size?: "sm" | "md" }) {
  const [first, second] = site.wordmark;
  return (
    <>
      <PeachMark size={40} />
      <span
        className={`font-display text-ink ${
          size === "sm" ? "text-sm sm:text-base" : "text-base"
        }`}
      >
        {first} <span className="text-peach">{second}</span>
      </span>
    </>
  );
}
