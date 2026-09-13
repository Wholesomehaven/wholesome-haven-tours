/**
 * Local email/password sign-in (this app's Better Auth DB — not the broker).
 *
 * Off by default. To enable: set `emailAndPasswordEnabled` to `true` below,
 * then build sign-up / sign-in forms with `authClient.signUp.email` /
 * `authClient.signIn.email` from `@/lib/auth/client` (see the auth skill).
 *
 * Do NOT edit `server.ts` for this — that file is frozen pre-wired config.
 */
import { SITE } from "../site";
import { env } from "../env.server";
import {
  rememberPreviewResetUrl,
  sendStaffMail,
} from "../mail.server";

export const emailAndPasswordEnabled = true;

/** Frontend page — skip Better Auth's /api/auth/reset-password/:token hop. */
function staffResetPageUrl(token: string, fallbackUrl: string): string {
  const deployed = Boolean(env("DATABASE_URL") || env("RAILWAY_ENVIRONMENT"));
  const origin = (
    deployed
      ? env("PUBLIC_APP_URL") || "https://tours.wholesomehavensd.com"
      : (() => {
          try {
            return new URL(fallbackUrl).origin;
          } catch {
            return "https://tours.wholesomehavensd.com";
          }
        })()
  ).replace(/\/+$/, "");
  if (token) return `${origin}/reset-password?token=${encodeURIComponent(token)}`;
  return `${origin}/reset-password`;
}

export async function sendStaffResetPassword({
  user,
  url,
  token,
}: {
  user: { email: string; name?: string | null };
  url: string;
  token: string;
}) {
  const resetUrl = staffResetPageUrl(token, url);
  rememberPreviewResetUrl(user.email, resetUrl);

  const html = `
    <div style="font-family:Georgia,serif;background:#fbfaf6;padding:24px;color:#3d3a32">
      <h1 style="font-size:22px;color:#5a7344;margin:0 0 12px">Reset your tour desk password</h1>
      <p style="margin:0 0 16px">Hello${user.name ? ` ${user.name}` : ""},</p>
      <p style="margin:0 0 16px">Someone asked to reset the Wholesome Haven staff password for ${user.email}. This link expires in one hour.</p>
      <p style="margin:0 0 24px"><a href="${resetUrl}" style="background:#5a7344;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">Choose a new password</a></p>
      <p style="margin:0 0 8px;font-size:13px">If the button does not work, paste this address into your browser:</p>
      <p style="margin:0 0 24px;font-size:13px;word-break:break-all">${resetUrl}</p>
      <p style="margin:0;font-size:13px;color:#7a7568">If you did not ask for this, you can ignore the email. Call ${SITE.phone} if you need help.</p>
    </div>
  `;

  try {
    await sendStaffMail({
      to: user.email,
      subject: "Reset your Wholesome Haven tour desk password",
      text: `Reset your staff password (expires in one hour):\n${resetUrl}\n\nIf you did not ask for this, ignore the email.`,
      html,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "NO_MAILER") {
      if (env("DATABASE_URL") || env("RAILWAY_ENVIRONMENT")) {
        throw new Error(
          "Password reset email is not set up yet. Call the house at " + SITE.phone + ".",
        );
      }
      return;
    }
    throw err;
  }
}

export const emailAndPasswordOptions = {
  enabled: true as const,
  sendResetPassword: sendStaffResetPassword,
  resetPasswordTokenExpiresIn: 60 * 60,
};
