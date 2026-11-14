"use client";

import { useEffect, useRef, useState } from "react";
import { Couch } from "@/components/couch";
import { onCoupleChange, type CoupleChange } from "@/lib/couple-events";
import { fxLayer, sfx, sparkles } from "@/lib/fx";
import { getMessages } from "@/lib/i18n";
import { amp, anim, center, flyArc, isCalm, isReduced, isWild, OUT, wait } from "@/lib/motion";
import { createClient } from "@/lib/supabase/client";

/** Changes this close together share one visit (and one note). */
const VISIT_WINDOW_MS = 3000;
/** How long the note shows at Calm and with reduced motion (the lab's toast). */
const NOTE_MS = 2600;
/** How long to wait for the changed thing to appear after the page refreshes (ListSync). */
const TARGET_WAIT_MS = 2500;
/** Answers and ticks are only news when they're this fresh (an older one is a re-save). */
const FRESH_MS = 20_000;

type TitleRef = { media_type: string; tmdb_id: number };
type ItemMemo = TitleRef & { status: string; season: number | null; episode: number | null; notes: string | null; categories: string[] };

/** One thing your partner did: what to say, where it landed on this page (if it's here), and whether it's an add. */
type Entry = { text: string; target: () => Element | null; add?: boolean };

/**
 * Your partner pops in (Sprint 27, the motion lab's "peek" scene, the focal piece of Phase 10). When a change
 * your partner made reaches this screen live (announced by ListSync and useCoupleChanges, see
 * src/lib/couple-events.ts), their couch slides in from the edge with a speech bubble saying what they did,
 * tosses it in (the changed card, if it's on screen, lands with a ring in their colour), waves and ducks out.
 * Calm: no couch, the ring and a small note. Reduced motion: the note (a fade) and an outline in their colour.
 * Several changes within 3 s share one visit; nothing while the tab is hidden; your own changes (on any device)
 * never come in. Who made a change comes from the row (list_items.updated_by and watch_nights.updated_by are
 * set by triggers); a change without a known author stays quiet. Decoration: what it says is also read out
 * once, politely. Rendered once, in the layout, for paired users.
 */
export function PartnerPeek({ coupleId, language }: { coupleId: string; language: string }) {
  const template = useRef<HTMLSpanElement>(null);
  const [note, setNote] = useState<{ lines: string[]; key: number } | null>(null);
  const [said, setSaid] = useState("");

  useEffect(() => {
    const t = getMessages(language);
    const p = t.together.peek;
    const supabase = createClient();
    let myId: string | null = null;
    let partner: { id: string; name: string } | null = null;
    const items = new Map<string, ItemMemo>();
    const titles = new Map<string, Promise<string | null>>();
    const seen = new Set<string>();
    let cancelled = false;

    // Who you are, who your partner is, and the list as it stands (so an update can say what changed).
    const ready = (async () => {
      const { data } = await supabase.auth.getSession();
      myId = data.session?.user.id ?? null;
      if (!myId) return;
      const [people, list] = await Promise.all([
        supabase.from("profiles").select("id, display_name").eq("couple_id", coupleId).neq("id", myId).maybeSingle(),
        supabase.from("list_items").select("id, media_type, tmdb_id, status, season, episode, notes, categories").eq("couple_id", coupleId),
      ]);
      if (people.data) partner = { id: people.data.id, name: people.data.display_name || t.common.yourPartner };
      for (const row of list.data ?? []) items.set(row.id, row);
    })();

    async function item(id: unknown): Promise<ItemMemo | null> {
      if (typeof id !== "string") return null;
      const known = items.get(id);
      if (known) return known;
      const { data } = await supabase
        .from("list_items")
        .select("id, media_type, tmdb_id, status, season, episode, notes, categories")
        .eq("id", id)
        .maybeSingle();
      if (data) items.set(id, data);
      return data;
    }

    /** The title's name: from the page if it's on it, else the cached text in your language. */
    function titleName(ref: TitleRef | null): Promise<string | null> {
      if (!ref) return Promise.resolve(null);
      const key = `${ref.media_type}/${ref.tmdb_id}`;
      const onPage = document.querySelector(`a[data-item-title][href="/title/${key}"]`)?.textContent?.trim();
      if (onPage) return Promise.resolve(onPage);
      let found = titles.get(key);
      if (!found) {
        found = Promise.all([
          supabase.from("title_texts").select("locale, title").eq("media_type", ref.media_type).eq("tmdb_id", ref.tmdb_id),
          supabase.from("titles").select("original_title").eq("media_type", ref.media_type).eq("tmdb_id", ref.tmdb_id).maybeSingle(),
        ]).then(([texts, title]) => {
          const rows = (texts.data ?? []).filter((r) => r.title);
          const mine = rows.find((r) => r.locale.startsWith(`${language}-`)) ?? rows[0];
          return mine?.title ?? title.data?.original_title ?? null;
        });
        titles.set(key, found);
      }
      return found;
    }

    const byTitle = (ref: TitleRef | null) => () => (ref ? titleTarget(ref) : null);
    const byNight = (id: unknown) => () => (typeof id === "string" ? document.querySelector(`[data-night-card="${CSS.escape(id)}"]`) : null);
    const fresh = (at: unknown) => typeof at === "string" && Date.now() - Date.parse(at) < FRESH_MS;
    const stars = (n: unknown) => (typeof n === "number" ? n : 0);
    const ref = (row: Record<string, unknown>): TitleRef | null =>
      typeof row.media_type === "string" && typeof row.tmdb_id === "number" ? { media_type: row.media_type, tmdb_id: row.tmdb_id } : null;

    /** What the change says and who made it; null when there's nothing to tell (or it isn't from them). */
    async function describe(change: CoupleChange): Promise<{ actor: unknown; entry: () => Promise<Entry | null> } | null> {
      const row = change.new;
      const name = partner?.name ?? t.common.yourPartner;
      const insert = change.eventType === "INSERT";
      switch (change.table) {
        case "list_items": {
          const before = typeof row.id === "string" ? items.get(row.id) : undefined;
          const now = row as unknown as ItemMemo & { id: string };
          if (typeof row.id === "string") items.set(row.id, { ...now, categories: (now.categories ?? []) as string[] });
          return {
            actor: row.updated_by,
            entry: async () => {
              const title = await titleName(ref(row));
              const target = byTitle(ref(row));
              if (insert) return { text: now.status === "someday" ? p.shelved(name, title) : p.added(name, title), target, add: true };
              if (!before || before.status !== now.status) {
                const say = { watched: p.watched, dropped: p.dropped, someday: p.shelved, want: p.backUp, watching: p.started }[now.status] ?? p.changed;
                return { text: say(name, title), target };
              }
              if (now.season && now.episode && (before.season !== now.season || before.episode !== now.episode))
                return { text: p.progress(name, t.common.progress(now.season, now.episode), title), target };
              if ((before.notes ?? "") !== (now.notes ?? "")) return { text: p.note(name, title), target };
              if ((before.categories ?? []).join("\n") !== ((now.categories ?? []) as string[]).join("\n")) return { text: p.categories(name, title), target };
              return { text: p.changed(name, title), target };
            },
          };
        }
        case "list_ratings":
        case "season_ratings":
        case "rewatches":
        case "review_signals":
        case "season_review_signals":
        case "episode_signals":
          return {
            actor: change.table === "rewatches" ? (insert ? row.added_by : null) : row.profile_id,
            entry: async () => {
              const memo = await item(row.list_item_id);
              const title = await titleName(memo);
              const target = byTitle(memo);
              const text =
                change.table === "list_ratings"
                  ? p.rated(name, stars(row.rating), title)
                  : change.table === "season_ratings"
                    ? p.seasonRated(name, stars(row.season), stars(row.rating), title)
                    : change.table === "rewatches"
                      ? p.rewatch(name, title)
                      : change.table === "review_signals"
                        ? p.review(name, title)
                        : change.table === "season_review_signals"
                          ? p.seasonReview(name, stars(row.season), title)
                          : p.episode(name, t.common.progress(stars(row.season), stars(row.episode)), title);
              return { text, target };
            },
          };
        case "rewatch_ratings":
          return { actor: row.profile_id, entry: async () => ({ text: p.rewatchRated(name, null), target: () => null }) };
        case "comments":
          if (!insert) return null;
          return {
            actor: row.profile_id,
            entry: async () => {
              if (row.watch_night_id) return { text: p.comment(name, null), target: byNight(row.watch_night_id) };
              const memo = await item(row.list_item_id);
              return { text: p.comment(name, await titleName(memo)), target: byTitle(memo) };
            },
          };
        case "comment_reactions":
          return { actor: row.profile_id, entry: async () => ({ text: p.commentReaction(name), target: () => null }) };
        case "reminders":
          if (!insert) return null;
          return { actor: row.created_by, entry: async () => ({ text: p.reminder(name, await titleName(ref(row))), target: byTitle(ref(row)) }) };
        case "cant_wait":
          if (!insert) return null;
          return { actor: row.profile_id, entry: async () => ({ text: p.cantWait(name, await titleName(ref(row))), target: byTitle(ref(row)) }) };
        case "title_sends": {
          if (insert) return { actor: row.from_profile, entry: async () => ({ text: p.sent(name, await titleName(ref(row))), target: byTitle(ref(row)) }) };
          if (!row.answer || !fresh(row.answered_at)) return null;
          const say = row.answer === "added" ? p.sendAdded : row.answer === "shelved" ? p.sendShelved : p.sendWaved;
          return { actor: row.to_profile, entry: async () => ({ text: say(name, await titleName(ref(row))), target: byTitle(ref(row)) }) };
        }
        case "watch_nights":
          return {
            actor: row.updated_by,
            entry: async () => ({
              text: insert ? p.nightPlanned(name, await titleName(ref(row))) : p.nightChanged(name),
              target: byNight(row.id),
            }),
          };
        case "ready_checks":
          if (!row.ready_at || !fresh(row.ready_at)) return null;
          return { actor: row.profile_id, entry: async () => ({ text: p.ready(name), target: byNight(row.watch_night_id) }) };
        case "night_prep_items": {
          const label = typeof row.label === "string" ? row.label : "";
          if (insert) return { actor: row.added_by, entry: async () => ({ text: p.prepAdded(name, label), target: byNight(row.watch_night_id) }) };
          if (!row.done_at || !fresh(row.done_at)) return null;
          return { actor: row.done_by, entry: async () => ({ text: p.prepDone(name, label), target: byNight(row.watch_night_id) }) };
        }
        case "night_proposals": {
          if (insert) return { actor: row.proposed_by, entry: async () => ({ text: p.proposed(name), target: () => null }) };
          if (!fresh(row.answered_at)) return null;
          const text = row.status === "declined" ? p.declined(name) : p.picked(name);
          return { actor: row.answered_by, entry: async () => ({ text, target: byNight(row.watch_night_id) }) };
        }
        case "night_photos":
          if (!insert) return null;
          return { actor: row.uploaded_by, entry: async () => ({ text: p.photo(name), target: byNight(row.watch_night_id) }) };
        case "question_signals":
          return { actor: row.profile_id, entry: async () => ({ text: p.answered(name), target: () => null }) };
        case "free_evenings":
          if (row.free !== true) return null;
          return { actor: row.profile_id, entry: async () => ({ text: p.free(name), target: () => null }) };
        default:
          return null;
      }
    }

    // ---------------------------------------------------------------------------------------------------
    // The visit: one couch for a burst of changes.
    // ---------------------------------------------------------------------------------------------------
    let visit: { entries: Entry[]; last: number; add: (entry: Entry) => void } | null = null;
    let noteTimer: ReturnType<typeof setTimeout> | undefined;

    function linesFor(entries: Entry[]) {
      return entries.length > 1 ? [entries[0].text, p.more(entries.length - 1)] : [entries[0].text];
    }

    function showNote(entries: Entry[]) {
      clearTimeout(noteTimer);
      setNote({ lines: linesFor(entries), key: Date.now() });
      noteTimer = setTimeout(() => setNote(null), NOTE_MS);
    }

    async function arrive(entry: Entry) {
      if (visit && Date.now() - visit.last < VISIT_WINDOW_MS) {
        visit.entries.push(entry);
        visit.last = Date.now();
        visit.add(entry);
        setSaid(visit.entries.map((e) => e.text).join(". "));
        return;
      }
      const entries = [entry];
      setSaid(entry.text);
      if (isCalm()) {
        // Calm and reduced motion: no couch, just the note and the ring (or, reduced, an outline).
        visit = {
          entries,
          last: Date.now(),
          add: (next) => {
            showNote(entries);
            void land(next, null);
          },
        };
        showNote(entries);
        await land(entry, null);
        return;
      }
      await peek(entries);
    }

    /** Lively and Wild: the couch slides in, says it, tosses each change in, waves and ducks out. */
    async function peek(entries: Entry[]) {
      const couch = template.current?.firstElementChild?.cloneNode(true) as SVGElement | undefined;
      if (!couch) return;
      const layer = fxLayer();
      const host = document.createElement("div");
      host.className = "peek-host";
      const bubble = document.createElement("div");
      bubble.className = "peek-bubble";
      const setLines = (lines: string[]) => {
        bubble.replaceChildren(...lines.map((line, i) => Object.assign(document.createElement(i ? "small" : "span"), { textContent: line })));
      };
      setLines(linesFor(entries));
      host.append(bubble, couch);
      layer.append(host);
      const own = { entries, last: Date.now(), add: () => setLines(linesFor(entries)) };
      visit = own;

      // Beside the changed card if it's on screen, else half way down; clear of the bubble and the tab bar.
      const first = entries[0].target();
      const tabBar = document.querySelector("[data-tab-bar]")?.getBoundingClientRect();
      const barShown = tabBar && tabBar.height > 0 && tabBar.top < innerHeight;
      const floor = innerHeight - 110 - (barShown ? innerHeight - tabBar.top : 0);
      const aim = first && visible(first) ? center(first).y - 40 : innerHeight * 0.45;
      host.style.top = `${Math.min(floor, Math.max(150, aim))}px`;
      host.style.left = `${innerWidth - 120}px`;
      bubble.style.opacity = "0";

      const a = amp();
      await anim(host, [{ transform: "translateX(160px) rotate(20deg)" }, { transform: `translateX(-8px) rotate(${-12 * a}deg)`, offset: 0.7 }, { transform: "translateX(0) rotate(-8deg)" }], {
        duration: 520,
        easing: "ease-out",
        fill: "forwards",
      }).finished;
      void anim(bubble, [{ transform: "scale(0)", opacity: 0 }, { transform: "scale(1.08)", opacity: 1, offset: 0.7 }, { transform: "scale(1)", opacity: 1 }], {
        duration: 300,
        easing: "ease-out",
        fill: "forwards",
      });
      await wait(250);

      // Toss in each change as it comes (up to a few), until the burst is over.
      let handled = 0;
      const started = Date.now();
      while (!cancelled) {
        while (handled < own.entries.length) {
          const entry = own.entries[handled++];
          if (handled <= 3) await land(entry, host);
        }
        if (Date.now() - own.last >= 1200 || Date.now() - started > 8000) break;
        await wait(150);
      }
      if (visit === own) visit = null;

      // Wave, then duck out.
      await anim(host, [{ transform: "rotate(-8deg)" }, { transform: `rotate(${4 * a}deg)` }, { transform: "rotate(-10deg)" }, { transform: `rotate(${4 * a}deg)` }, { transform: "rotate(-8deg)" }], {
        duration: 700,
        easing: "ease-in-out",
        fill: "forwards",
      }).finished;
      await wait(500);
      await anim(host, [{ transform: "translateX(0) rotate(-8deg)" }, { transform: "translateX(-14px) rotate(-14deg)", offset: 0.2 }, { transform: "translateX(180px) rotate(14deg)" }], {
        duration: 380,
        easing: "ease-in",
        fill: "forwards",
      }).finished;
      host.remove();
    }

    /** The changed thing lands: tossed from the couch (when there is one), then a ring in your partner's colour. */
    async function land(entry: Entry, host: HTMLElement | null) {
      // An added card appears only once the page has refreshed; anything else is there already (or gone).
      const target = await waitFor(entry.target, entry.add ? TARGET_WAIT_MS : 800);
      if (!target || !visible(target)) return;
      if (host && !isReduced()) {
        const from = center(host.querySelector("svg") ?? host);
        const to = center(target);
        const token = tokenFor(target);
        fxLayer().append(token);
        const trail = isWild();
        let step = 0;
        await flyArc(token, from, to, {
          lift: 80 * amp(),
          duration: 560,
          spin: -25,
          onStep: (x, y, progress) => {
            if (!trail || progress * 6 < step) return;
            step += 1;
            sparkles(x, y, { count: 2, colors: ["var(--partner)"], distance: 20 });
          },
        });
        void anim(token, [{ opacity: 1 }, { opacity: 0, transform: `${token.style.transform} scale(.4)` }], { duration: 180, fill: "forwards" }).finished.then(() => token.remove());
        if (entry.add) sfx("add", to.x, to.y - 40);
      }
      ring(target);
    }

    function ring(target: Element) {
      if (target instanceof HTMLElement) {
        target.dataset.peeked = "";
        setTimeout(() => {
          delete target.dataset.peeked;
        }, 1600);
      }
      if (isReduced()) return;
      const r = target.getBoundingClientRect();
      const radius = getComputedStyle(target).borderRadius;
      const k = Math.max(0.5, amp());
      const times = isCalm() ? 1 : 2;
      for (let i = 0; i < times; i++) {
        const el = document.createElement("div");
        el.className = "peek-ring";
        el.style.cssText = `left:${r.left - 3}px;top:${r.top - 3}px;width:${r.width + 6}px;height:${r.height + 6}px;border-radius:${radius};`;
        fxLayer().append(el);
        void anim(el, [{ transform: "scale(.96)", opacity: 1 }, { transform: `scale(${1 + (32 * k) / r.width}, ${1 + (32 * k) / r.height})`, opacity: 0 }], {
          duration: 700,
          delay: i * 260,
          easing: OUT,
          fill: "backwards",
        }).finished.then(() => el.remove());
      }
    }

    const stop = onCoupleChange(async (change) => {
      const key = `${change.table}:${change.commit_timestamp}:${JSON.stringify(change.new.id ?? change.new)}`;
      if (seen.has(key)) return;
      seen.add(key);
      await ready;
      const told = await describe(change);
      // Only your partner's changes, only while you're looking; the list memory above stays current regardless.
      if (cancelled || !told || !myId || !told.actor || told.actor === myId || document.hidden) return;
      if (partner && told.actor !== partner.id) return;
      const entry = await told.entry();
      if (entry && !cancelled && !document.hidden) await arrive(entry);
    });

    return () => {
      cancelled = true;
      clearTimeout(noteTimer);
      stop();
    };
  }, [coupleId, language]);

  return (
    <>
      {/* The couch the visits clone into the effects layer. */}
      <span ref={template} hidden aria-hidden>
        <Couch who="partner" size={92} />
      </span>
      {note && (
        <div key={note.key} aria-hidden className="peek-note">
          <span aria-hidden className="size-2.5 shrink-0 rounded-full border-2 border-outline bg-partner" />
          <span className="grid">
            {note.lines.map((line, i) => (i ? <small key={i}>{line}</small> : <span key={i}>{line}</span>))}
          </span>
        </div>
      )}
      <p role="status" className="sr-only">
        {said}
      </p>
    </>
  );
}

/** The card (or panel) showing a title on this page, if any. On its own title page, the "On our list" panel. */
function titleTarget(ref: TitleRef): Element | null {
  const href = `/title/${ref.media_type}/${ref.tmdb_id}`;
  if (location.pathname === href) return document.querySelector("[data-list-panel]");
  for (const link of document.querySelectorAll(`a[href="${href}"]`)) {
    const card = link.closest("[data-list-card], [data-title-card], [data-night-card], [data-sent-card], .card");
    if (card && visible(card)) return card;
  }
  return null;
}

function visible(el: Element) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
}

/** Looks for the target until the refreshed page shows it (an added card appears only after the refresh). */
async function waitFor(find: () => Element | null, within: number): Promise<Element | null> {
  const until = Date.now() + within;
  for (;;) {
    const found = find();
    if (found || Date.now() > until) return found;
    await wait(150);
  }
}

/** What the couch tosses: a little copy of the card's poster, or a paper slip in your partner's colour. */
function tokenFor(target: Element): HTMLElement {
  const token = document.createElement("div");
  token.className = "peek-token";
  const img = target.querySelector("img");
  if (img?.currentSrc) {
    const copy = document.createElement("img");
    copy.src = img.currentSrc;
    copy.alt = "";
    token.append(copy);
  } else {
    token.dataset.slip = "";
  }
  return token;
}
