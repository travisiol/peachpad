/**
 * Shown wherever a number came from the bundled sample set rather than an
 * indexer. It sits in the same frame as the figures so it cannot be missed
 * while the figures are read.
 */
export function SampleNote({ what = "Sample data", className = "" }: { what?: string; className?: string }) {
  return (
    <p
      className={`inline-flex items-center gap-2 border-4 border-dashed border-ink/30 bg-white px-3 py-1.5 text-[11px] uppercase tracking-wide text-ink/55 ${className}`}
      role="note"
    >
      <span className="inline-block h-2 w-2 bg-ink/30" aria-hidden="true" />
      {what} · indexer not configured
    </p>
  );
}
