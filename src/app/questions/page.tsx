import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BackIcon } from "@/components/icons";
import { ListSync } from "@/components/list-sync";
import { AnswerBox } from "@/app/together/answer-box";
import { getI18n } from "@/lib/i18n/server";
import { formatDate } from "@/lib/list-rules";
import { isCountry } from "@/lib/places";
import { getPartner, requireProfile } from "@/lib/session";
import { getQuestionDays, type QuestionDay } from "@/lib/together";
import { dayBefore, QUESTION_HISTORY_DAYS, questionIndex, utcDay } from "@/lib/together-rules";
import { QuestionsSkeleton } from "./skeleton";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: `${t.together.question.page.heading} · ${t.common.appName}` };
}

export default function QuestionsPage() {
  return (
    <Suspense fallback={<QuestionsSkeleton />}>
      <Questions />
    </Suspense>
  );
}

/**
 * Every day's question you've answered (either of you) in the last three months, newest first, with both
 * answers: your partner's only once you've answered that day's too, so an unanswered one can be answered late.
 */
async function Questions() {
  const [profile, partner, { language, t }] = await Promise.all([requireProfile(), getPartner(), getI18n()]);
  if (!isCountry(profile.country)) redirect("/settings?welcome=1");
  if (!profile.couple_id) redirect("/couple");
  if (!partner) redirect("/");

  const text = t.together.question;
  const today = utcDay(new Date());
  const days = await getQuestionDays(profile.couple_id, profile.id, dayBefore(today, QUESTION_HISTORY_DAYS), today);
  const shown: QuestionDay[] = days.some((d) => d.day === today)
    ? days
    : [{ day: today, question: -1, mine: null, partner: { state: "none" } }, ...days];
  const partnerName = partner.display_name || t.common.yourPartner;

  return (
    <div className="grid gap-9">
      <ListSync coupleId={profile.couple_id} />
      <div className="grid gap-3">
        <Link href="/" className="tap-area group inline-flex items-center gap-1.5 justify-self-start font-bold underline underline-offset-4">
          <BackIcon className="size-4 transition-transform duration-200 ease-(--ease-spring) group-hover:-translate-x-1" /> {t.common.nav.list}
        </Link>
        <h1 className="display -rotate-1 text-[clamp(2.4rem,5vw,3.6rem)] [overflow-wrap:anywhere]">{text.page.heading}</h1>
        <p className="font-medium text-muted">{text.page.intro}</p>
      </div>

      <ol className="grid gap-5">
        {shown.map((day) => {
          const index = day.question >= 0 ? day.question : questionIndex(day.day, text.questions.length);
          return (
            <li key={day.day} data-question-day className="card grid gap-3">
              <p className="text-sm font-bold text-muted">{day.day === today ? text.page.today : formatDate(day.day, language)}</p>
              <p className="text-lg font-bold leading-snug">{text.questions[index] ?? text.questions[0]}</p>
              <AnswerBox
                day={day.day}
                mine={day.mine?.body ?? null}
                partner={day.partner}
                partnerName={partnerName}
                language={language}
                compact
              />
            </li>
          );
        })}
      </ol>
      {days.length === 0 && <p className="text-center font-medium text-muted">{text.page.empty}</p>}
    </div>
  );
}
