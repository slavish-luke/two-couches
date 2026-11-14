import { Couch } from "./couch";

/**
 * The "We can both watch" switch inside its chip (Browse, Home, Pick, the swipe deck): your two couches,
 * apart when it's off and side by side on the bubblegum when it's on. The chip (a link with aria-current)
 * stays the control; this is decoration. The couches follow the chip's state in globals.css ("Sprint 25"),
 * and scoot over on a tap before the new page arrives (src/lib/motion-touches.ts).
 */
export function BothSwitch() {
  return (
    <span data-both-switch aria-hidden className="both-switch">
      <span data-seat="me" className="both-seat">
        <Couch who="me" size={17} />
      </span>
      <span data-seat="partner" className="both-seat">
        <Couch who="partner" size={17} />
      </span>
    </span>
  );
}
