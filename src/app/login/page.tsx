import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · Two Couches" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="mx-auto grid max-w-sm gap-6">
      <div className="grid gap-2">
        <h1 className="font-display text-3xl font-bold tracking-tight">Sign in</h1>
        <p className="text-muted">One watchlist, two couches, two countries.</p>
      </div>
      <Suspense>
        <LinkError searchParams={searchParams} />
      </Suspense>
      <LoginForm />
    </div>
  );
}

async function LinkError({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { error } = await searchParams;
  if (error !== "link") return null;
  return (
    <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
      That sign-in link has expired or was already used. Send yourself a new one.
    </p>
  );
}
