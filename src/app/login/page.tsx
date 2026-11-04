import { Suspense } from "react";
import { Couches } from "@/components/couch";
import { getI18n, localisedTitle } from "@/lib/i18n/server";
import { LoginForm } from "./login-form";

export const generateMetadata = localisedTitle("signIn");

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    // The layout makes the root a 48rem column; the sign-in card is narrower inside it.
    <div>
      <div className="mx-auto grid max-w-md gap-6 pt-4 sm:pt-10">
        <Suspense>
          <Login searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function Login({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const [{ language, t }, { error }] = await Promise.all([getI18n(), searchParams]);
  return (
    <>
      <div className="grid justify-items-center gap-3 text-center">
        <Couches size={64} />
        <h1 className="display -rotate-2 text-[clamp(2.6rem,8vw,3.6rem)]">{t.account.login.signIn}</h1>
        <p className="max-w-[40ch] text-lg font-medium text-muted">{t.account.login.tagline}</p>
      </div>
      <div className="card grid gap-4 p-6">
        {error === "link" && (
          <p role="alert" className="rounded-control border-2 border-outline bg-danger-soft px-3 py-2 text-sm font-semibold text-danger">
            {t.account.login.linkExpired}
          </p>
        )}
        <LoginForm language={language} />
      </div>
    </>
  );
}
