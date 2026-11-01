import { Suspense } from "react";
import { getI18n } from "@/lib/i18n/server";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · Two Couches" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="mx-auto grid max-w-sm gap-6">
      <Suspense>
        <Login searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Login({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const [{ language, t }, { error }] = await Promise.all([getI18n(), searchParams]);
  return (
    <>
      <div className="grid gap-2">
        <h1 className="font-display text-3xl font-bold tracking-tight">{t.account.login.signIn}</h1>
        <p className="text-muted">{t.account.login.tagline}</p>
      </div>
      {error === "link" && (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{t.account.login.linkExpired}</p>
      )}
      <LoginForm language={language} />
    </>
  );
}
