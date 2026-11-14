import type { CouchMood } from "@/lib/together-rules";

/**
 * The mascot: a little cartoon couch with a face, one per person in their colour. It bobs and blinks
 * (globals.css, off with reduced motion; the partner's couch runs a beat behind). `mood` changes the face
 * with how often you've watched together lately (couchMood()): sleepy after a long gap, happy or delighted
 * after recent nights; each skin draws the extras its own way. Decorative. Class hooks for the idle moves
 * and the motion of Sprint 27 (src/components/couch-life.tsx): couch-body, couch-look (the eyes), couch-mouth,
 * couch-cheek, and couch-yawn / couch-doze-z, hidden until a move shows them.
 */
export function Couch({
  who,
  size = 56,
  mood = "content",
  className = "",
}: {
  who: "me" | "partner";
  size?: number;
  mood?: CouchMood;
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      width={size}
      height={Math.round(size * 0.78)}
      viewBox="0 0 64 50"
      data-mood={mood === "content" ? undefined : mood}
      className={`couch ${who === "partner" ? "couch-partner" : ""} shrink-0 overflow-visible ${className}`}
    >
      <CouchShape fill={who === "me" ? "var(--me)" : "var(--partner)"} mood={mood} />
    </svg>
  );
}

/** A four-point sparkle centred on (x, y). */
function sparkle(x: number, y: number, r: number) {
  const w = r * 0.32;
  return `M${x} ${y - r}Q${x + w} ${y - w} ${x + r} ${y}Q${x + w} ${y + w} ${x} ${y + r}Q${x - w} ${y + w} ${x - r} ${y}Q${x - w} ${y - w} ${x} ${y - r}Z`;
}

/** A little heart centred on (x, y). */
function heart(x: number, y: number, r: number) {
  return `M${x} ${y + r}C${x - r * 1.6} ${y - r * 0.1} ${x - r * 0.9} ${y - r * 1.5} ${x} ${y - r * 0.5}C${x + r * 0.9} ${y - r * 1.5} ${x + r * 1.6} ${y - r * 0.1} ${x} ${y + r}Z`;
}

/** The couch drawing on its 64 × 50 grid, for use inside another SVG. */
export function CouchShape({ fill, mood = "content" }: { fill: string; mood?: CouchMood }) {
  const ink = "var(--outline)";
  return (
    <g className="couch-body" stroke={ink} strokeWidth={3}>
      <rect x="9" y="8" width="46" height="24" rx="9" fill={fill} />
      <rect x="3" y="20" width="14" height="22" rx="6" fill={fill} />
      <rect x="47" y="20" width="14" height="22" rx="6" fill={fill} />
      <rect x="13" y="28" width="38" height="14" rx="5" fill={fill} />
      <path d="M10 42v5M54 42v5" strokeLinecap="round" />
      <Face mood={mood} ink={ink} />
      {/* Hidden until an idle yawn or doze opens them (src/components/couch-life.tsx). */}
      <ellipse className="couch-yawn couch-ink" cx="32" cy="26" rx="2.6" ry="2.8" fill={ink} stroke="none" opacity={0} />
      {mood !== "sleepy" && (
        <g className="couch-doze-z" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0}>
          <path d="M55 2h5l-5 5h5" />
          <path d="M61 -6h3.5l-3.5 3.5h3.5" strokeWidth={1.6} />
        </g>
      )}
      {mood === "delighted" && (
        // Three ways to say "delighted"; each skin shows one (globals.css, Sprint 20).
        <g className="couch-extra" strokeWidth={1.6} strokeLinejoin="round">
          <g data-extra="sparks" fill="var(--pop)">
            <path d={sparkle(5, 6, 5)} />
            <path d={sparkle(60, 3, 3.6)} />
          </g>
          <g data-extra="lines" fill="none" strokeWidth={2.4} strokeLinecap="round">
            <path d="M2 10l-4-4M4 4l-1-5M60 6l4-4M62 13l5-1" />
          </g>
          <g data-extra="hearts" fill="var(--blush)">
            <path d={heart(5, 5, 4)} />
            <path d={heart(60, 2, 3.2)} />
          </g>
        </g>
      )}
      {mood === "sleepy" && (
        <g className="couch-extra couch-z" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M55 2h5l-5 5h5" />
          <path d="M61 -6h3.5l-3.5 3.5h3.5" strokeWidth={1.6} />
        </g>
      )}
    </g>
  );
}

function Face({ mood, ink }: { mood: CouchMood; ink: string }) {
  const cheeks = (opacity: number) => (
    <>
      <circle className="couch-cheek" cx="21" cy="24" r="2.6" fill="var(--blush)" opacity={opacity} stroke="none" />
      <circle className="couch-cheek" cx="43" cy="24" r="2.6" fill="var(--blush)" opacity={opacity} stroke="none" />
    </>
  );
  if (mood === "sleepy") {
    return (
      <>
        <path className="couch-look" d="M23.4 19.5q2.6 2.2 5.2 0M35.4 19.5q2.6 2.2 5.2 0" fill="none" strokeWidth={2.2} strokeLinecap="round" />
        <path className="couch-mouth" d="M30 26.2h4" fill="none" strokeWidth={2.4} strokeLinecap="round" />
        {cheeks(0.3)}
      </>
    );
  }
  if (mood === "delighted") {
    return (
      <>
        <path className="couch-look" d="M23.4 20.5q2.6-4 5.2 0M35.4 20.5q2.6-4 5.2 0" fill="none" strokeWidth={2.4} strokeLinecap="round" />
        <path className="couch-ink couch-mouth" d="M26.5 23.5h11c0 3.4-2.5 5.6-5.5 5.6s-5.5-2.2-5.5-5.6Z" fill={ink} strokeWidth={1.6} strokeLinejoin="round" />
        {cheeks(0.7)}
      </>
    );
  }
  return (
    <>
      <ellipse className="couch-eye couch-look" cx="26" cy="19" rx="2.6" ry="3.4" fill={ink} stroke="none" />
      <ellipse className="couch-eye couch-look" cx="38" cy="19" rx="2.6" ry="3.4" fill={ink} stroke="none" />
      {mood === "happy" ? (
        <path className="couch-mouth" d="M26.2 23.8q5.8 6.2 11.6 0" fill="none" strokeWidth={2.7} strokeLinecap="round" />
      ) : (
        <path className="couch-mouth" d="M28 25q4 3.5 8 0" fill="none" strokeWidth={2.4} strokeLinecap="round" />
      )}
      {cheeks(mood === "happy" ? 0.7 : 0.45)}
    </>
  );
}

/** Both couches side by side, as in the logo. */
export function Couches({ size = 44, mood = "content", className = "" }: { size?: number; mood?: CouchMood; className?: string }) {
  return (
    <span aria-hidden className={`inline-flex items-end ${className}`}>
      <Couch who="me" size={size} mood={mood} />
      <Couch who="partner" size={size} mood={mood} className="-ml-[8%]" />
    </span>
  );
}
