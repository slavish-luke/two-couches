"use client";

import { useActionState } from "react";
import { sendSignInEmail, verifySignInCode, type LoginState } from "./actions";

const initialState: LoginState = { step: "email", email: "" };

export function LoginForm() {
  const [emailState, sendEmail, sending] = useActionState(sendSignInEmail, initialState);
  const [codeState, verifyCode, verifying] = useActionState(verifySignInCode, {});

  if (emailState.step === "email") {
    return (
      <form action={sendEmail} className="grid gap-3">
        <label className="grid gap-1">
          <span className="text-sm font-semibold">Email</span>
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
          {sending ? "Sending…" : "Email me a sign-in link"}
        </button>
      </form>
    );
  }

  return (
    <form action={verifyCode} className="grid gap-3">
      <input type="hidden" name="email" value={emailState.email} />
      <p className="text-muted">
        We sent a link to <strong className="text-ink">{emailState.email}</strong>. Open it on this device, or type
        the 6-digit code from the email here.
      </p>
      <label className="grid gap-1">
        <span className="text-sm font-semibold">Code</span>
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
        {verifying ? "Checking…" : "Sign in"}
      </button>
    </form>
  );
}
