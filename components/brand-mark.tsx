/**
 * The System mark: a target — the shape of aiming at a goal and landing on
 * it, rendered as concentric rings in the natural (sage/clay) palette
 * instead of the emoji's red-and-white. Pure SVG, no external assets — this
 * is also what public/favicon.svg and the PWA icons are rendered from, so
 * it works fully offline.
 */
export function BrandMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="System"
    >
      <rect x="0.5" y="0.5" width="39" height="39" rx="11" fill="#1B1813" stroke="#332C22" />
      <circle cx="20" cy="20" r="14.5" fill="#EDE6D8" />
      <circle cx="20" cy="20" r="11" fill="#1B1813" />
      <circle cx="20" cy="20" r="7.6" fill="#7C9468" />
      <circle cx="20" cy="20" r="4.3" fill="#1B1813" />
      <circle cx="20" cy="20" r="2.3" fill="#C17A4E" />
    </svg>
  );
}
