"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { step: "email" | "code"; email: string; error?: string };

export async function sendSignInEmail(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const errors = (await getI18n()).t.account.login.errors;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { step: "email", email, error: errors.invalidEmail };
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
      return { step: "email", email, error: errors.notAllowed };
    }
    if (error.status === 429) {
      return { step: "email", email, error: errors.rateLimited };
    }
    console.error("signInWithOtp failed", error);
    return { step: "email", email, error: errors.sendFailed };
  }

  return { step: "code", email };
}

export async function verifySignInCode(_prev: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const email = String(formData.get("email") ?? "");
  const token = String(formData.get("code") ?? "").replace(/\s/g, "");
  const errors = (await getI18n()).t.account.login.errors;
  if (!/^\d{6}$/.test(token)) {
    return { error: errors.codeFormat };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) {
    return { error: errors.codeFailed };
  }

  redirect("/");
}
