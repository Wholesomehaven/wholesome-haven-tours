import { SITE } from "./site";
import { env } from "./env.server";

type Mail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

const previewStore = globalThis as typeof globalThis & {
  __whResetPreview__?: { email: string; url: string; at: number };
};

export function rememberPreviewResetUrl(email: string, url: string) {
  previewStore.__whResetPreview__ = {
    email: email.trim().toLowerCase(),
    url,
    at: Date.now(),
  };
}

/** Only for sandbox preview (no Postgres). Never returns a link on Railway. */
export function peekPreviewResetUrl(email: string): string | null {
  if (env("DATABASE_URL") || env("RAILWAY_ENVIRONMENT")) return null;
  const row = previewStore.__whResetPreview__;
  if (!row) return null;
  if (row.email !== email.trim().toLowerCase()) return null;
  if (Date.now() - row.at > 15 * 60 * 1000) return null;
  return row.url;
}

export function mailerConfigured(): boolean {
  return Boolean(env("RESEND_API_KEY") || env("SMTP_HOST"));
}

export async function sendStaffMail(mail: Mail): Promise<void> {
  const from = env("MAIL_FROM") ?? `${SITE.shortName} <${SITE.email}>`;
  const resend = env("RESEND_API_KEY");
  if (resend) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resend}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: mail.to,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      }),
    });
    if (!response.ok) {
      throw new Error(`Could not send email (${response.status}).`);
    }
    return;
  }

  const host = env("SMTP_HOST");
  if (host) {
    const nodemailer = await import("nodemailer");
    const port = Number(env("SMTP_PORT") ?? "465");
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: env("SMTP_USER")
        ? { user: env("SMTP_USER"), pass: env("SMTP_PASS") ?? "" }
        : undefined,
    });
    await transporter.sendMail({
      from,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
    return;
  }

  throw new Error("NO_MAILER");
}
