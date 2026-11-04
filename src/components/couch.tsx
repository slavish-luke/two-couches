/**
 * The mascot: a little cartoon couch with a face, one per person in their colour. It bobs and blinks
 * (globals.css, off with reduced motion; the partner's couch runs a beat behind). Decorative.
 */
export function Couch({ who, size = 56, className = "" }: { who: "me" | "partner"; size?: number; className?: string }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={Math.round(size * 0.78)}
      viewBox="0 0 64 50"
      className={`couch ${who === "partner" ? "couch-partner" : ""} shrink-0 overflow-visible ${className}`}
    >
      <CouchShape fill={who === "me" ? "var(--me)" : "var(--partner)"} />
    </svg>
  );
}

/** The couch drawing on its 64 × 50 grid, for use inside another SVG. */
export function CouchShape({ fill }: { fill: string }) {
  const ink = "var(--outline)";
  return (
    <g stroke={ink} strokeWidth={3}>
      <rect x="9" y="8" width="46" height="24" rx="9" fill={fill} />
      <rect x="3" y="20" width="14" height="22" rx="6" fill={fill} />
      <rect x="47" y="20" width="14" height="22" rx="6" fill={fill} />
      <rect x="13" y="28" width="38" height="14" rx="5" fill={fill} />
      <path d="M10 42v5M54 42v5" strokeLinecap="round" />
      <ellipse className="couch-eye" cx="26" cy="19" rx="2.6" ry="3.4" fill={ink} stroke="none" />
      <ellipse className="couch-eye" cx="38" cy="19" rx="2.6" ry="3.4" fill={ink} stroke="none" />
      <path d="M28 25q4 3.5 8 0" fill="none" strokeWidth={2.4} strokeLinecap="round" />
      <circle cx="21" cy="24" r="2.6" fill="#ff5c8a" opacity={0.45} stroke="none" />
      <circle cx="43" cy="24" r="2.6" fill="#ff5c8a" opacity={0.45} stroke="none" />
    </g>
  );
}

/** Both couches side by side, as in the logo. */
export function Couches({ size = 44, className = "" }: { size?: number; className?: string }) {
  return (
    <span aria-hidden className={`inline-flex items-end ${className}`}>
      <Couch who="me" size={size} />
      <Couch who="partner" size={size} className="-ml-[8%]" />
    </span>
  );
}
