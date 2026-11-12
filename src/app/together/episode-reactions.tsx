"use client";

import { useOptimistic, useState, useTransition } from "react";
import { ReactionSticker } from "@/components/icons";
import { getMessages } from "@/lib/i18n";
import type { EpisodeReaction } from "@/lib/together";
import { episodeKey, MAX_EPISODE_NOTE_LENGTH, REACTIONS, type Reaction } from "@/lib/together-rules";
import { reactToEpisode } from "./actions";

/** Episodes listed before "Show the rest". */
const EPISODES_SHOWN = 10;
/** Seasons shown as chips; more than this become a menu. */
const SEASON_CHIPS = 6;

type Change = { key: string; reaction: EpisodeReaction | null };

/**
 * Hidden episode reactions on a series' title page: a sticker and an optional line from each of you per
 * episode, only for episodes the list says you've watched (newest first, a season at a time). Your partner's
 * shows once you've reacted to the same episode; until then a sealed sticker says they have.
 */
export function EpisodeReactions(props: {
  itemId: string;
  seasons: { season: number; episodes: number }[];
  names: Record<string, string>;
  mine: Record<string, EpisodeReaction>;
  partner: Record<string, EpisodeReaction>;
  partnerHas: string[];
  partnerName: string | null;
  language: string;
}) {
  const { seasons, partnerName, language } = props;
  const t = getMessages(language);
  const text = t.together.episodes;
  const kinds = t.nights.room.reactions.kinds;
  const [season, setSeason] = useState(seasons[0]?.season ?? 1);
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ kind: Reaction | null; note: string }>({ kind: null, note: "" });
  const [error, setError] = useState<{ key: string; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [mine, change] = useOptimistic(props.mine, (mine: Record<string, EpisodeReaction>, c: Change) => {
    const next = { ...mine };
    if (c.reaction) next[c.key] = c.reaction;
    else delete next[c.key];
    return next;
  });

  const current = seasons.find((s) => s.season === season) ?? seasons[0];
  const episodes = current ? Array.from({ length: current.episodes }, (_, i) => current.episodes - i) : [];
  const listed = showAll ? episodes : episodes.slice(0, EPISODES_SHOWN);

  function edit(key: string) {
    setError(null);
    setEditing(key);
    setDraft({ kind: mine[key]?.kind ?? null, note: mine[key]?.note ?? "" });
  }

  function save(seasonNumber: number, episode: number, reaction: EpisodeReaction | null) {
    const key = episodeKey(seasonNumber, episode);
    setError(null);
    setEditing(null);
    startTransition(async () => {
      change({ key, reaction });
      const result = await reactToEpisode(props.itemId, seasonNumber, episode, reaction?.kind ?? null, reaction?.note ?? "");
      if (result.error) setError({ key, text: result.error });
    });
  }

  return (
    <section aria-labelledby="episode-reactions" data-episode-reactions className="grid gap-4">
      <div className="grid gap-1.5">
        <h2 id="episode-reactions" className="display text-[2rem]">
          {text.heading}
        </h2>
        <p className="font-medium text-muted">{partnerName ? text.intro(partnerName) : text.introAlone}</p>
      </div>

      <div className="card grid gap-3" aria-busy={pending}>
        {seasons.length === 0 ? (
          <p className="font-medium text-muted">{text.none}</p>
        ) : (
          <>
            {seasons.length > SEASON_CHIPS && (
              // A long-running series: one menu rather than dozens of chips.
              <label className="grid gap-1 justify-self-start text-sm font-bold">
                <span className="sr-only">{text.seasonLabel}</span>
                <select
                  value={current?.season}
                  onChange={(e) => {
                    setSeason(Number(e.target.value));
                    setShowAll(false);
                    setEditing(null);
                  }}
                  className="field py-1.5 text-[15px] font-medium"
                >
                  {seasons.map((s) => (
                    <option key={s.season} value={s.season}>
                      {text.season(s.season)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {seasons.length > 1 && seasons.length <= SEASON_CHIPS && (
              <div className="flex flex-wrap gap-1.5">
                {seasons.map((s) => (
                  <button
                    key={s.season}
                    type="button"
                    aria-pressed={s.season === current?.season}
                    onClick={() => {
                      setSeason(s.season);
                      setShowAll(false);
                      setEditing(null);
                    }}
                    className="chip px-3 py-0.5 text-sm"
                  >
                    {text.season(s.season)}
                  </button>
                ))}
              </div>
            )}
            <ul className="grid">
              {listed.map((episode) => {
                const key = episodeKey(current.season, episode);
                const own = mine[key];
                const theirs = props.partner[key];
                const sealed = !theirs && props.partnerHas.includes(key);
                const name = props.names[key];
                return (
                  <li key={key} data-episode className="grid gap-1.5 border-t-2 border-outline/15 py-2 first:border-t-0 first:pt-0 last:pb-0">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="sr-only">{text.episodeLong(current.season, episode)}</span>
                        <span aria-hidden className="font-bold tabular-nums">
                          {text.episode(episode)}
                        </span>
                        {name && <span className="font-medium"> · {name}</span>}
                      </span>
                      {partnerName && sealed && (
                        // Theirs is sealed until you've reacted to this one too.
                        <span role="img" aria-label={text.partnerHidden(partnerName)} title={text.partnerHidden(partnerName)} data-sealed className="relative grid size-8 shrink-0 place-items-center rounded-full border-[2.5px] border-dashed border-outline bg-partner-soft font-display text-lg leading-none">
                          ?
                        </span>
                      )}
                      {partnerName && theirs && (
                        <span role="img" aria-label={`${partnerName}: ${kinds[theirs.kind]}`} title={`${partnerName}: ${kinds[theirs.kind]}`} className="relative shrink-0">
                          <ReactionSticker kind={theirs.kind} className="size-8" />
                          <span aria-hidden className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-[1.5px] border-outline bg-partner" />
                        </span>
                      )}
                      <button
                        type="button"
                        aria-expanded={editing === key}
                        aria-label={own ? `${text.change}: ${kinds[own.kind]} (${text.episodeLong(current.season, episode)})` : `${text.react} (${text.episodeLong(current.season, episode)})`}
                        onClick={() => (editing === key ? setEditing(null) : edit(key))}
                        className={own ? "relative shrink-0 transition-transform hover:-rotate-6" : "btn-quiet shrink-0 px-2.5 py-0.5 text-sm"}
                      >
                        {own ? (
                          <>
                            <ReactionSticker kind={own.kind} className="size-8" />
                            <span aria-hidden className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-[1.5px] border-outline bg-me" />
                          </>
                        ) : (
                          text.react
                        )}
                      </button>
                    </div>
                    {(own?.note || theirs?.note) && editing !== key && (
                      <div className="grid gap-0.5 text-sm">
                        {own?.note && (
                          <p className="[overflow-wrap:anywhere]">
                            <span className="font-bold">{t.common.you}:</span> {own.note}
                          </p>
                        )}
                        {partnerName && theirs?.note && (
                          <p className="[overflow-wrap:anywhere]">
                            <span className="font-bold">{partnerName}:</span> {theirs.note}
                          </p>
                        )}
                      </div>
                    )}
                    {editing === key && (
                      <form
                        className="paper grid gap-2 rounded-control border-[2.5px] border-outline p-2.5"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (draft.kind) save(current.season, episode, { kind: draft.kind, note: draft.note.trim() });
                        }}
                      >
                        <fieldset className="grid gap-1.5">
                          <legend className="mb-1 text-sm font-bold">{text.pick}</legend>
                          <div className="flex flex-wrap gap-1">
                            {REACTIONS.map((kind) => (
                              <button
                                key={kind}
                                type="button"
                                aria-pressed={draft.kind === kind}
                                aria-label={kinds[kind]}
                                title={kinds[kind]}
                                onClick={() => setDraft((d) => ({ ...d, kind }))}
                                className="grid size-10 place-items-center rounded-full border-2 border-transparent transition hover:bg-current/10 aria-pressed:-rotate-6 aria-pressed:border-outline aria-pressed:bg-accent-soft"
                              >
                                <ReactionSticker kind={kind} className="size-7" />
                              </button>
                            ))}
                          </div>
                        </fieldset>
                        <input
                          value={draft.note}
                          onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
                          maxLength={MAX_EPISODE_NOTE_LENGTH}
                          aria-label={text.notePlaceholder}
                          placeholder={text.notePlaceholder}
                          className="field py-1 text-[15px]"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button disabled={!draft.kind || pending} className="btn px-3.5 pb-1 pt-1.5 text-base">
                            {text.save}
                          </button>
                          {own && (
                            <button type="button" onClick={() => save(current.season, episode, null)} className="btn-quiet px-3 py-1 text-sm">
                              {text.remove}
                            </button>
                          )}
                          <button type="button" onClick={() => setEditing(null)} className="btn-quiet px-3 py-1 text-sm">
                            {text.cancel}
                          </button>
                        </div>
                      </form>
                    )}
                    {error?.key === key && (
                      <p role="alert" className="text-sm font-semibold text-danger">
                        {error.text}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
            {listed.length < episodes.length && (
              <button type="button" onClick={() => setShowAll(true)} className="tap-area justify-self-start text-sm font-bold underline underline-offset-4">
                {text.more(episodes.length - listed.length)}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}
