import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { authClient } from "@/lib/auth/client";
import { SITE } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" && search.token ? search.token : undefined,
    error: typeof search.error === "string" && search.error ? search.error : undefined,
  }),
  component: ResetPassword,
  head: () => ({
    meta: [{ title: `Reset password | ${SITE.shortName}` }],
  }),
});

function ResetPassword() {
  const { token = "", error: tokenError } = Route.useSearch();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(
    tokenError === "INVALID_TOKEN" ? "This reset link is invalid or has expired." : null,
  );
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError("This reset link is missing a token. Request a new one from the sign-in page.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Those passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const { error: err } = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (err) {
        setError(err.message ?? "Could not update the password. Request a new link.");
        return;
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-bg px-4 py-10 text-fg">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 sm:p-8">
        <Link to="/login" className="flex items-center gap-3">
          <img src="/images/logo.png" alt="" className="h-12 w-12 object-contain" />
          <span>
            <span className="font-display block text-lg">{SITE.shortName}</span>
            <span className="text-xs tracking-[0.16em] text-muted uppercase">Staff sign in</span>
          </span>
        </Link>
        <h1 className="font-display mt-6 text-3xl">New password</h1>
        {done ? (
          <>
            <p className="mt-2 text-sm text-muted">
              Your tour desk password is updated. Sign in with {SITE.adminEmail}.
            </p>
            <Button className="mt-6 w-full" asChild>
              <Link to="/login">Back to sign in</Link>
            </Button>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted">
              Choose a new password for {SITE.adminEmail}. Use at least 8 characters.
            </p>
            <form className="mt-6 space-y-3" onSubmit={onSubmit}>
              <div className="grid gap-1.5">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              {error ? <p className="text-sm text-danger">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={busy || !token}>
                {busy ? "Saving…" : "Save new password"}
              </Button>
            </form>
            <Link to="/login" className="mt-3 inline-block text-sm text-primary hover:underline">
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
