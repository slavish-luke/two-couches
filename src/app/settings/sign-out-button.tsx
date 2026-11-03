"use client";

import { useTransition } from "react";
import { forgetOfflineCopies } from "@/components/pwa";
import { getMessages } from "@/lib/i18n";
import { signOut } from "../auth/actions";

/** Signs out, after clearing this device's offline copy of the list. */
export function SignOutButton({ language }: { language: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await forgetOfflineCopies();
          await signOut();
        })
      }
      className="btn-quiet justify-self-start"
    >
      {getMessages(language).account.signOut}
    </button>
  );
}
