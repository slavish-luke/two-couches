"use client";

import { useActionState } from "react";
import { getMessages } from "@/lib/i18n";
import { sendSignInEmail, verifySignInCode, type LoginState } from "./actions";

const initialState: LoginState = { step: "email", email: "" };

export function LoginForm({ language }: { language: string }) {
  const [emailState, sendEmail, sending] = useActionState(sendSignInEmail, initialState);
  const [codeState, verifyCode, verifying] = useActionState(verifySignInCode, {});
  const t = getMessages(language).account.login;

  if (emailState.step === "email") {
    return (
      <form action={sendEmail} className="grid gap-3">
        <label className="grid gap-1">
          <span className="text-sm font-semibold">{t.email}</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={emailState.email}
            className="field"
          />
        </label>
        {emailState.error && <p className="text-sm text-danger">{emailState.error}</p>}
        <button className="btn" disabled={sending}>
          {sending ? t.sending : t.sendLink}
        </button>
      </form>
    );
  }

  return (
    <form action={verifyCode} className="grid gap-3">
      <input type="hidden" name="email" value={emailState.email} />
      <p className="text-muted">
        {t.codeSent.before}
        <strong className="text-ink">{emailState.email}</strong>
        {t.codeSent.after}
      </p>
      <label className="grid gap-1">
        <span className="text-sm font-semibold">{t.code}</span>
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]*"
          maxLength={7}
          required
          className="field tracking-[0.3em]"
        />
      </label>
      {codeState.error && <p className="text-sm text-danger">{codeState.error}</p>}
      <button className="btn" disabled={verifying}>
        {verifying ? t.checking : t.signIn}
      </button>
    </form>
  );
}
