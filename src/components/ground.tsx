/**
 * The page ground's moving parts (Phase 10): Sunburst's rays, which can turn, and a second layer of Night
 * Owl's stars, which twinkle. Fixed behind everything and clipped to the screen; the skin and the Motion
 * level decide what shows and moves (globals.css, "Sprint 25"), and src/lib/ground.ts adds the flare and
 * the shooting stars. Decorative.
 */
export function Ground() {
  return (
    <div data-ground aria-hidden className="ground">
      <div data-ground-rays className="ground-rays" />
      <div className="ground-stars" />
    </div>
  );
}
