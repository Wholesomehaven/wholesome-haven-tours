import { useEffect, useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { SITE } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({ component: Login });

const CALLBACK = "/admin";
const BEARER_KEY = "grok-auth.bearer-token";

function captureBearerFromResponse(headers: Headers | null | undefined) {
  const token = headers?.get("set-auth-token");
  if (!token) return;
  try {
    window.sessionStorage.setItem(BEARER_KEY, token);
  } catch {
    /* ignore */
  }
}

function Login() {
  const { user, isPending } = useCurrentUserState();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState<string>(SITE.adminEmail);
  const [password, setPassword] = useState("");
  const [name, setName] = useState("Haven Admin");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showSocial, setShowSocial] = useState(false);

  useEffect(() => {
    setShowSocial(/\bgrok/.test(window.location.hostname));
  }, []);

  if (isPending) {
    return <div className="min-h-screen bg-bg" />;
  }
  if (user) return <Navigate to="/admin" />;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (email.trim().toLowerCase() !== SITE.adminEmail) {
      setError(`Staff accounts must use ${SITE.adminEmail}.`);
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "up") {
        const { error: err } = await authClient.signUp.email(
          {
            email: email.trim().toLowerCase(),
            password,
            name,
            callbackURL: CALLBACK,
          },
          {
            onSuccess(ctx) {
              captureBearerFromResponse(ctx.response.headers);
            },
          },
        );
        if (err) {
          setError(err.message ?? "Could not create the account.");
          return;
        }
      } else {
        const { error: err } = await authClient.signIn.email(
          {
            email: email.trim().toLowerCase(),
            password,
            callbackURL: CALLBACK,
          },
          {
            onSuccess(ctx) {
              captureBearerFromResponse(ctx.response.headers);
            },
          },
        );
        if (err) {
          setError(err.message ?? "Could not sign in.");
          return;
        }
      }
      try {
        await authClient.getSession();
      } catch {
        /* session store hydrates on the next page */
      }
      window.location.href = CALLBACK;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-bg px-4 py-10 text-fg">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 sm:p-8">
        <Link to="/" className="flex items-center gap-3">
          <img src="/images/logo.png" alt="" className="h-12 w-12 object-contain" />
          <span>
            <span className="font-display block text-lg">{SITE.shortName}</span>
            <span className="text-xs tracking-[0.16em] text-muted uppercase">Staff sign in</span>
          </span>
        </Link>
        <h1 className="font-display mt-6 text-3xl">Tour desk</h1>
        <p className="mt-2 text-sm text-muted">
          Sign in with {SITE.adminEmail} to review private tour requests.
        </p>

        {authEnabled ? (
          <>
            <form className="mt-6 space-y-3" onSubmit={onSubmit}>
              {mode === "up" ? (
                <div className="grid gap-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
              ) : null}
              <div className="grid gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "up" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error ? <p className="text-sm text-danger">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Please wait…" : mode === "up" ? "Create staff account" : "Sign in"}
              </Button>
            </form>
            <button
              type="button"
              className="mt-3 text-sm text-primary hover:underline"
              onClick={() => {
                setMode(mode === "in" ? "up" : "in");
                setError(null);
              }}
            >
              {mode === "in" ? "First time? Create the staff account" : "Already have an account? Sign in"}
            </button>
            {showSocial ? (
              <>
                <div className="relative my-6">
                  <div className="h-px bg-border" />
                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface px-3 text-xs tracking-wide text-muted uppercase">
                    or
                  </span>
                </div>
                <div className="space-y-2">
                  {GROK_PROVIDERS.map((p) => (
                    <Button
                      key={p.providerId}
                      type="button"
                      variant="secondary"
                      className="w-full"
                      onClick={() => signIn(p.providerId, { callbackURL: CALLBACK })}
                    >
                      Continue with {p.label}
                    </Button>
                  ))}
                </div>
              </>
            ) : null}
          </>
        ) : (
          <p className="mt-6 text-sm text-muted">Sign-in is disabled.</p>
        )}
      </div>
    </main>
  );
}
