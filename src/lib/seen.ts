/**
 * Watches elements until each is first seen (Sprint 28): `onSeen` when it comes a little way into view (the
 * bottom `marginPercent` of the screen doesn't count, so the moment is seen; works for elements taller than
 * the screen), or `onPassed` if a jump (a long scroll, a fragment link) carries it above the screen without
 * it ever showing, so nothing is left held back. Each element is reported once. Browser only; returns the stop.
 */
export function watchFirstSight(
  elements: Element[],
  { onSeen, onPassed, marginPercent = 12 }: { onSeen: (el: Element) => void; onPassed: (el: Element) => void; marginPercent?: number },
): () => void {
  const waiting = new Set(elements);
  if (waiting.size === 0) return () => {};
  let frame = 0;
  const done = (el: Element) => {
    waiting.delete(el);
    observer.unobserve(el);
    if (waiting.size === 0) stop();
  };
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!waiting.has(entry.target)) continue;
        if (entry.isIntersecting) {
          done(entry.target);
          onSeen(entry.target);
        } else if (entry.boundingClientRect.bottom < 0) {
          done(entry.target);
          onPassed(entry.target);
        }
      }
    },
    { rootMargin: `0px 0px -${marginPercent}% 0px` },
  );
  const check = () => {
    frame = 0;
    for (const el of [...waiting]) {
      if (el.getBoundingClientRect().bottom < 0) {
        done(el);
        onPassed(el);
      }
    }
  };
  const onScroll = () => {
    if (!frame) frame = requestAnimationFrame(check);
  };
  function stop() {
    observer.disconnect();
    removeEventListener("scroll", onScroll);
    if (frame) cancelAnimationFrame(frame);
  }
  for (const el of elements) observer.observe(el);
  addEventListener("scroll", onScroll, { passive: true });
  return stop;
}
