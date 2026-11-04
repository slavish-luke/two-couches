"use client";

import { useActionState, useState } from "react";
import { CheckIcon } from "@/components/icons";
import { getMessages } from "@/lib/i18n";
import { joinCouple } from "./actions";

export function JoinForm({ language }: { language: string }) {
  const [state, join, joining] = useActionState(joinCouple, {});
  const t = getMessages(language).account.couple;

  return (
    <form action={join} className="grid gap-3">
      <label className="grid gap-1.5">
        <span className="font-semibold">{t.inviteCode}</span>
        <input
          name="code"
          required
          autoComplete="off"
          autoCapitalize="characters"
          placeholder="ABCD-2345"
          className="field text-lg font-bold uppercase tracking-[0.18em]"
        />
      </label>
      {state.error && (
        <p role="alert" className="rounded-control border-2 border-outline bg-danger-soft px-3 py-1.5 text-sm font-semibold text-danger">
          {state.error}
        </p>
      )}
      <button className="btn justify-self-start" disabled={joining}>
        {joining ? t.joining : t.join}
      </button>
    </form>
  );
}

/** Copies the invite code (as shown, with its dash) and says so for a moment. */
export function CopyCode({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);
  const t = getMessages(language).account.couple;

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard (an insecure page or a refused permission): the code can still be selected by hand.
    }
  }

  return (
    <button type="button" onClick={copy} className="btn">
      {copied && <CheckIcon />}
      <span aria-live="polite">{copied ? t.copied : t.copy}</span>
    </button>
  );
}
