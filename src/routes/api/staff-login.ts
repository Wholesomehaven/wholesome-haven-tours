import { createFileRoute } from "@tanstack/react-router";
import { auth, SESSION_TOKEN_COOKIE } from "@/lib/auth/server";
import { staffCredentialsMatch } from "@/lib/auth/staff-login";
import { SITE } from "@/lib/site";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const attempts = new Map<string, { count: number; resetAt: number }>();

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown";
}

function limited(ip: string) {
  const now = Date.now();
  const existing = attempts.get(ip);
  if (!existing || existing.resetAt <= now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  existing.count += 1;
  return existing.count > MAX_ATTEMPTS;
}

async function signedSessionCookie(token: string, secret: string, maxAge: number) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(token)));
  let binary = "";
  for (const byte of signature) binary += String.fromCharCode(byte);
  const value = encodeURIComponent(`${token}.${btoa(binary)}`);
  return `${SESSION_TOKEN_COOKIE}=${value}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}
function originAllowed(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const host = new URL(origin).hostname;
    return (
      host === "tours.wholesomehavensd.com" ||
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".grok-sandbox.com") ||
      host.endsWith(".railway.app")
    );
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/staff-login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!originAllowed(request)) {
          return Response.json({ message: "Sign-in from this site is not allowed." }, { status: 403 });
        }
        const ip = clientIp(request);
        if (limited(ip)) {
          return Response.json(
            { message: "Too many sign-in attempts. Please wait 15 minutes and try again." },
            { status: 429 },
          );
        }
        let body: { username?: string; password?: string };
        try {
          body = await request.json();
        } catch {
          return Response.json({ message: "The username or password is incorrect." }, { status: 400 });
        }
        const username = String(body.username ?? "");
        const password = String(body.password ?? "");
        if (!staffCredentialsMatch(username, password)) {
          return Response.json({ message: "The username or password is incorrect." }, { status: 401 });
        }
        const ctx = await auth.$context;
        const found = await ctx.internalAdapter.findUserByEmail(SITE.adminEmail);
        if (!found?.user) {
          return Response.json(
            { message: "The tour desk owner account is not set up yet. Sign in with the owner email once, then use the staff username." },
            { status: 409 },
          );
        }
        const session = await ctx.internalAdapter.createSession(found.user.id);
        attempts.delete(ip);
        const maxAge = Math.max(
          60,
          Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000),
        );
        const cookie = await signedSessionCookie(session.token, ctx.secret, maxAge);
        return Response.json(
          { ok: true },
          {
            headers: {
              "set-cookie": cookie,
              "set-auth-token": session.token,
              "cache-control": "no-store",
            },
          },
        );
      },
    },
  },
});
