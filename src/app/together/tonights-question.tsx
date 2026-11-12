import Link from "next/link";
import { Suspense } from "react";
import { ArrowIcon } from "@/components/icons";
import { getI18n } from "@/lib/i18n/server";
import { getPartner, requireProfile } from "@/lib/session";
import { getQuestionDays } from "@/lib/together";
import { questionIndex, utcDay } from "@/lib/together-rules";
import { AnswerBox } from "./answer-box";
import { QuestionSkeleton } from "./question-skeleton";

/**
 * Home's "Tonight's question": the day's film-and-TV question (the same for both of you: picked from the UTC
 * date), your answer and your partner's, which stays hidden until you've answered. Self-contained, with its
 * own boundary; changes arrive through Home's ListSync.
 */
export function TonightsQuestion() {
  return (
    <Suspense fallback={<QuestionSkeleton />}>
      <QuestionCard />
    </Suspense>
  );
}

async function QuestionCard() {
  const [profile, partner, { language, t }] = await Promise.all([requireProfile(), getPartner(), getI18n()]);
  if (!profile.couple_id || !partner) return null;
  const text = t.together.question;
  const day = utcDay(new Date());
  const [today] = await getQuestionDays(profile.couple_id, profile.id, day, day);
  const index = today && today.question >= 0 ? today.question : questionIndex(day, text.questions.length);
  const question = text.questions[index] ?? text.questions[0];

  return (
    <section data-question-card aria-labelledby="tonights-question" className="card grid gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="tonights-question" className="display-ink text-2xl">
          {text.heading}
        </h2>
        <Link href="/questions" className="tap-area group inline-flex items-center gap-1 text-sm font-bold underline underline-offset-4">
          {text.history}
          <ArrowIcon className="size-3.5 transition-transform duration-200 ease-(--ease-spring) group-hover:translate-x-1" />
        </Link>
      </div>
      <p className="text-xl font-bold leading-snug">{question}</p>
      <AnswerBox
        day={day}
        mine={today?.mine?.body ?? null}
        partner={today?.partner ?? { state: "none" }}
        partnerName={partner.display_name || t.common.yourPartner}
        language={language}
      />
    </section>
  );
}
