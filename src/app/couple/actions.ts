"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const JOIN_ERRORS: Record<string, string> = {
  invite_not_found: "No couple has that code. Check it with your partner.",
  couple_full: "That couple already has two people.",
  already_in_couple: "You're already in a couple.",
};

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
    const known = Object.keys(JOIN_ERRORS).find((key) => error.message.includes(key));
    if (!known) console.error("join_couple failed", error);
    return { error: known ? JOIN_ERRORS[known] : "Couldn't join. Try again." };
  }
  redirect("/");
}
