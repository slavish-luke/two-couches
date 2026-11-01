"use server";

import { redirect } from "next/navigation";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export async function startCouple() {
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_couple");
  if (error && !error.message.includes("already_in_couple")) throw error;
  redirect("/couple");
}

export async function joinCouple(_prev: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("join_couple", { code: String(formData.get("code") ?? "") });
  if (error) {
    const { t } = await getI18n();
    const joinErrors = t.account.couple.joinErrors;
    const known = (Object.keys(joinErrors) as (keyof typeof joinErrors)[]).find((key) => error.message.includes(key));
    if (!known) console.error("join_couple failed", error);
    return { error: known ? joinErrors[known] : t.account.couple.joinFailed };
  }
  redirect("/");
}
