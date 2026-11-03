import "server-only";
import { getListItem, type ListItem } from "./list";
import { isWrapupDue, wrapupWindowStart, type Reviews } from "./review-rules";
import { createClient } from "./supabase/server";
import { pickText } from "./titles";
import type { MediaType, TitleRef } from "./watch";

/**
 * Each item's reviews as the signed-in person may see them: their own, and their partner's text only once
 * they've written their own (RLS hides it until then; review_authors() says whether it exists).
 */
export async function getReviews(itemIds: string[], myId: string): Promise<Record<string, Reviews>> {
  if (itemIds.length === 0) return {};
  const supabase = await createClient();
  const [rows, authors] = await Promise.all([
    supabase.from("list_reviews").select("list_item_id, profile_id, body").in("list_item_id", itemIds),
    supabase.rpc("review_authors", { p_list_item_ids: itemIds }),
  ]);
  if (rows.error) throw rows.error;
  if (authors.error) throw authors.error;

  return Object.fromEntries(
    itemIds.map((id): [string, Reviews] => {
      const mine = rows.data.find((r) => r.list_item_id === id && r.profile_id === myId);
      const theirs = rows.data.find((r) => r.list_item_id === id && r.profile_id !== myId);
      const theyWrote = authors.data.some((a) => a.list_item_id === id && a.profile_id !== myId);
      return [
        id,
        {
          mine: mine?.body ?? null,
          partner: theirs ? { state: "shown", body: theirs.body } : theyWrote ? { state: "hidden" } : { state: "none" },
        },
      ];
    }),
  );
}

const OUTCOMES = ["saved", "skipped"] as const;
type Outcome = (typeof OUTCOMES)[number];

function isOutcome(value: unknown): value is Outcome {
  return typeof value === "string" && (OUTCOMES as readonly string[]).includes(value);
}

export type Wrapup = {
  night: { id: string; starts_at: string };
  title: TitleRef & { title: string; poster_path: string | null; runtime: number | null };
  /** The title's list entry, or null if it isn't on the list (saving adds it). */
  item: ListItem | null;
  reviews: Reviews;
  /** How your partner dealt with their card for this night, if they have. */
  partnerOutcome: Outcome | null;
};

/**
 * The couple's watch nights with a title that ended in the last WRAPUP_DAYS and that the signed-in person
 * hasn't wrapped up yet, latest first. Titles are named like getList().
 */
export async function getWrapups(
  coupleId: string,
  myId: string,
  locales: string[],
  now = new Date(),
): Promise<Wrapup[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("watch_nights")
    .select(
      "id, starts_at, media_type, tmdb_id, titles(original_title, poster_path, runtime, title_texts(locale, title, poster_path)), night_wrapups(profile_id, outcome)",
    )
    .eq("couple_id", coupleId)
    .not("media_type", "is", null)
    .gte("starts_at", wrapupWindowStart(now).toISOString())
    .lte("starts_at", now.toISOString())
    .in("titles.title_texts.locale", locales)
    .order("starts_at", { ascending: false });
  if (error) throw error;

  const due = data.flatMap((row) => {
    if (!row.titles || !row.media_type || !row.tmdb_id) return [];
    if (row.night_wrapups.some((w) => w.profile_id === myId)) return [];
    const media_type = row.media_type as MediaType;
    if (!isWrapupDue({ starts_at: row.starts_at, media_type, runtime: row.titles.runtime }, now)) return [];
    const partner = row.night_wrapups.find((w) => w.profile_id !== myId);
    return [
      {
        night: { id: row.id, starts_at: row.starts_at },
        title: {
          media_type,
          tmdb_id: row.tmdb_id,
          ...pickText(row.titles.title_texts, locales, row.titles),
          runtime: row.titles.runtime,
        },
        partnerOutcome: isOutcome(partner?.outcome) ? partner.outcome : null,
      },
    ];
  });

  const items = await Promise.all(due.map((w) => getListItem(coupleId, w.title)));
  const reviews = await getReviews([...new Set(items.flatMap((item) => (item ? [item.id] : [])))], myId);
  return due.map((w, i) => {
    const item = items[i];
    return { ...w, item, reviews: (item && reviews[item.id]) || { mine: null, partner: { state: "none" } } };
  });
}
