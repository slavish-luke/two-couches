/**
 * A number that rolls in like an odometer (Sprint 28): `text` as it reads, with the digits of `value` (as
 * formatted inside `text`) split out so `<RollIn>` can spin each one. Screen readers get the whole text at
 * once from an sr-only copy; the drawn copy is hidden from them, so they never hear a number mid-roll.
 * Without `value`, all of `text` is the number. If `value` isn't in `text`, the text is plain.
 */
export function RollText({ text, value }: { text: string; value?: string }) {
  const number = value ?? text;
  const at = number ? text.indexOf(number) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {text.slice(0, at)}
        <span data-odo>
          {[...number].map((char, i) =>
            /\d/.test(char) ? (
              <span key={i} data-d={char}>
                <span>{char}</span>
              </span>
            ) : (
              char
            ),
          )}
        </span>
        {text.slice(at + number.length)}
      </span>
    </>
  );
}
