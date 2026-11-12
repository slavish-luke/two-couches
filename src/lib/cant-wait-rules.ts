/** "Can't wait" on Coming soon (Sprint 19). Pure functions, safe in server and client code. */
import { titleKey, type TitleRef } from "./watch";

/** Who has marked each title "Can't wait": profile IDs by titleKey(). */
export type CantWaits = Record<string, string[]>;

/** Rows from the cant_wait table, grouped by title. */
export function groupCantWaits(rows: (TitleRef & { profile_id: string })[]): CantWaits {
  const marks: CantWaits = {};
  for (const row of rows) {
    const key = titleKey(row);
    marks[key] = [...new Set([...(marks[key] ?? []), row.profile_id])];
  }
  return marks;
}

/** Whether both of you (or, before pairing up, you) have marked a title. */
export function bothCantWait(marks: CantWaits, ref: TitleRef, people: string[]) {
  const who = marks[titleKey(ref)] ?? [];
  return people.length > 0 && people.every((id) => who.includes(id));
}

/** A row with the titles you both can't wait for first, otherwise in its own order. */
export function cantWaitFirst<T extends TitleRef>(items: T[], marks: CantWaits, people: string[]) {
  const both = items.filter((item) => bothCantWait(marks, item, people));
  return [...both, ...items.filter((item) => !both.includes(item))];
}
