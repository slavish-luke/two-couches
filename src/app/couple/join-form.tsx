"use client";

import { useActionState } from "react";
import { joinCouple } from "./actions";

export function JoinForm() {
  const [state, join, joining] = useActionState(joinCouple, {});

  return (
    <form action={join} className="grid gap-3">
      <label className="grid gap-1">
        <span className="text-sm font-semibold">Invite code</span>
        <input
          name="code"
          required
          autoComplete="off"
          autoCapitalize="characters"
          placeholder="ABCD-2345"
          className="field font-mono uppercase tracking-widest"
        />
      </label>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      <button className="btn" disabled={joining}>
        {joining ? "Joining…" : "Join"}
      </button>
    </form>
  );
}
