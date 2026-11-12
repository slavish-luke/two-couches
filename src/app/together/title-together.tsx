import { Suspense } from "react";
import { getI18n } from "@/lib/i18n/server";
import { getListItem } from "@/lib/list";
import { getPartner, requireProfile } from "@/lib/session";
import { tmdbLocale } from "@/lib/tmdb";
import { getEpisodeNames, getEpisodeReactions, getItemComments } from "@/lib/together";
import { watchedSeasons } from "@/lib/together-rules";
import type { TitleRef } from "@/lib/watch";
import { CommentThread } from "./comment-thread";
import { EpisodeReactions } from "./episode-reactions";

/**
 * The title page's Sprint 20 parts for a title on your list, below the "On our list" panel: hidden episode
 * reactions (series) and the comment thread. Its own boundary; nothing shows for a title not on the list.
 * Live through the page's ListSync.
 */
export function TitleTogether(props: { titleRef: TitleRef; seasonEpisodes: number[] | null }) {
  return (
    // No fallback, like the "On our list" panel above it: until the list is read, nothing says it will show.
    <Suspense>
      <Together {...props} />
    </Suspense>
  );
}

async function Together({ titleRef, seasonEpisodes }: { titleRef: TitleRef; seasonEpisodes: number[] | null }) {
  const [profile, partner, { language, t }] = await Promise.all([requireProfile(), getPartner(), getI18n()]);
  if (!profile.couple_id || !profile.country) return null;
  const item = await getListItem(profile.couple_id, titleRef);
  if (!item) return null;

  const series = item.media_type === "tv";
  const seasons = series ? watchedSeasons(item, seasonEpisodes) : [];
  const [comments, reactions, names] = await Promise.all([
    getItemComments(item.id),
    series ? getEpisodeReactions(item.id, profile.id) : null,
    series
      ? getEpisodeNames(item.tmdb_id, seasons.map((s) => s.season), tmdbLocale(profile.language, profile.home_country))
      : {},
  ]);
  const now = new Date();
  const me = { id: profile.id, name: t.common.you };
  const them = partner && { id: partner.id, name: partner.display_name || t.common.yourPartner };

  return (
    <div className="grid gap-12">
      {reactions && (
        <EpisodeReactions
          itemId={item.id}
          seasons={seasons}
          names={names}
          mine={reactions.mine}
          partner={reactions.partner}
          partnerHas={reactions.partnerHas}
          partnerName={them?.name ?? null}
          language={language}
        />
      )}
      <CommentThread
        target={{ listItemId: item.id }}
        comments={comments}
        me={me}
        partner={them}
        language={language}
        serverNow={now.getTime()}
        heading={t.together.comments.heading}
      />
    </div>
  );
}
