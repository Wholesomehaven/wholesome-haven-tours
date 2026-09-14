import { SITE } from "./site";
import { env } from "./env.server";
import { getSql } from "./db";

type Mail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const GOOGLE_SCOPES = `${GMAIL_SEND_SCOPE} ${CALENDAR_SCOPE}`;

const previewStore = globalThis as typeof globalThis & {
  __whResetPreview__?: { email: string; url: string; at: number };
  __whGmailAccess__?: { token: string; expiresAt: number };
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

export function googleMailClientId(): string | undefined {
  return env("GOOGLE_MAIL_CLIENT_ID");
}

export function googleMailClientSecret(): string | undefined {
  return env("GOOGLE_MAIL_CLIENT_SECRET");
}

export function mailRedirectUri(origin?: string): string {
  const base = (origin || SITE.tourAppUrl).replace(/\/+$/, "");
  return `${base}/api/mail/google/callback`;
}

export function googleAuthUrl(origin?: string): string {
  const clientId = googleMailClientId();
  if (!clientId) throw new Error("GOOGLE_MAIL_CLIENT_ID is not set.");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: mailRedirectUri(origin),
    response_type: "code",
    scope: GOOGLE_SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    login_hint: SITE.adminEmail,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function loadStoredRefreshToken(): Promise<string | undefined> {
  const fromEnv = env("GOOGLE_MAIL_REFRESH_TOKEN");
  if (fromEnv) return fromEnv;
  try {
    const sql = await getSql();
    const rows = await sql<{ refresh_token: string }>`
      select refresh_token from mail_oauth where id = 1
    `;
    return rows[0]?.refresh_token;
  } catch {
    return undefined;
  }
}

export async function mailerConfigured(): Promise<boolean> {
  if (env("RESEND_API_KEY") || env("SMTP_HOST")) return true;
  if (googleMailClientId() && googleMailClientSecret() && (await loadStoredRefreshToken())) {
    return true;
  }
  return false;
}

export async function saveGmailRefreshToken(refreshToken: string, mailbox?: string) {
  const sql = await getSql();
  await sql`
    insert into mail_oauth (id, refresh_token, mailbox, updated_at)
    values (1, ${refreshToken}, ${mailbox ?? SITE.adminEmail}, now())
    on conflict (id) do update set
      refresh_token = excluded.refresh_token,
      mailbox = excluded.mailbox,
      updated_at = now()
  `;
}

export async function exchangeGoogleAuthCode(code: string, origin?: string) {
  const clientId = googleMailClientId();
  const clientSecret = googleMailClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error("Google mail credentials are not set.");
  }
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: mailRedirectUri(origin),
    grant_type: "authorization_code",
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await response.json()) as {
    refresh_token?: string;
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!response.ok) {
    throw new Error(json.error_description || json.error || "Could not connect Gmail.");
  }
  if (json.refresh_token) {
    await saveGmailRefreshToken(json.refresh_token);
  }
  if (json.access_token && json.expires_in) {
    previewStore.__whGmailAccess__ = {
      token: json.access_token,
      expiresAt: Date.now() + (json.expires_in - 60) * 1000,
    };
  }
  return json;
}

export async function googleAccessToken(): Promise<string> {
  const cached = previewStore.__whGmailAccess__;
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  const clientId = googleMailClientId();
  const clientSecret = googleMailClientSecret();
  const refreshToken = await loadStoredRefreshToken();
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("NO_MAILER");
  }
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const json = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };
  if (!response.ok || !json.access_token) {
    throw new Error(json.error || "Could not refresh Gmail access.");
  }
  previewStore.__whGmailAccess__ = {
    token: json.access_token,
    expiresAt: Date.now() + ((json.expires_in ?? 3600) - 60) * 1000,
  };
  return json.access_token;
}

function encodeSubject(subject: string): string {
  if (/^[\x20-\x7e]*$/.test(subject)) return subject;
  return `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`;
}

function toBase64Url(raw: string): string {
  return Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function sendViaGmail(mail: Mail, from: string): Promise<void> {
  const token = await googleAccessToken();
  const boundary = `wh${Date.now()}`;
  const rfc822 = [
    `From: ${from}`,
    `To: ${mail.to}`,
    `Subject: ${encodeSubject(mail.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    mail.text,
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    mail.html,
    `--${boundary}--`,
    "",
  ].join("\r\n");

  const response = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: toBase64Url(rfc822) }),
    },
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gmail send failed (${response.status}): ${detail.slice(0, 200)}`);
  }
}

export async function sendStaffMail(mail: Mail): Promise<void> {
  const from = env("MAIL_FROM") ?? `${SITE.shortName} <${SITE.email}>`;

  const gmailReady =
    Boolean(googleMailClientId() && googleMailClientSecret()) &&
    Boolean(await loadStoredRefreshToken());
  if (gmailReady) {
    await sendViaGmail(mail, from);
    return;
  }

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

export async function sendStaffMailSafe(mail: Mail): Promise<void> {
  try {
    await sendStaffMail(mail);
  } catch (err) {
    console.error("[mail]", mail.subject, err);
  }
}
