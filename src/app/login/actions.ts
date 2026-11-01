"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { step: "email" | "code"; email: string; error?: string };

export async function sendSignInEmail(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { step: "email", email, error: "Enter a valid email address." };
  }

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  });

  if (error) {
    // The sign-up allowlist trigger surfaces as a generic database error.
    if (error.message.includes("Database error saving new user")) {
      return { step: "email", email, error: "That email isn't on the guest list for Two Couches." };
    }
    if (error.status === 429) {
      return { step: "email", email, error: "Too many emails sent. Wait a minute and try again." };
    }
    console.error("signInWithOtp failed", error);
    return { step: "email", email, error: "Couldn't send the email. Try again shortly." };
  }

  return { step: "code", email };
}

export async function verifySignInCode(_prev: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const email = String(formData.get("email") ?? "");
  const token = String(formData.get("code") ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(token)) {
    return { error: "The code is the 6 digits from the email." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) {
    return { error: "That code didn't work. It may have expired; send a new email." };
  }

  redirect("/");
}
