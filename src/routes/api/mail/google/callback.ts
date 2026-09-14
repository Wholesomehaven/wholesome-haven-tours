import { createFileRoute } from "@tanstack/react-router";
import { exchangeGoogleAuthCode } from "@/lib/mail.server";
import { SITE } from "@/lib/site";

export const Route = createFileRoute("/api/mail/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const error = url.searchParams.get("error");
        const code = url.searchParams.get("code");
        if (error || !code) {
          return htmlPage(
            "Gmail was not connected",
            error
              ? `Google returned: ${error}`
              : "The sign-in did not include an authorization code. Try Connect Gmail again.",
            false,
          );
        }
        try {
          await exchangeGoogleAuthCode(code);
          return htmlPage(
            "Google is connected",
            `${SITE.shortName} can now email families and add private tours to the ${SITE.adminEmail} Google Calendar. You can close this tab.`,
            true,
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : "Could not connect Gmail.";
          return htmlPage("Gmail was not connected", message, false);
        }
      },
    },
  },
});

function htmlPage(title: string, body: string, ok: boolean) {
  return new Response(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${title} | ${SITE.shortName}</title>
    <style>
      body { font-family: Georgia, serif; background: #fbfaf6; color: #3d3a32; margin: 0; min-height: 100vh; display: grid; place-items: center; }
      main { max-width: 28rem; padding: 2rem; }
      h1 { color: ${ok ? "#5a7344" : "#8b3a3a"}; font-size: 1.75rem; }
      a { color: #5a7344; }
    </style>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <p>${body}</p>
      <p><a href="/admin">Back to tour desk</a></p>
    </main>
  </body>
</html>`,
    {
      status: ok ? 200 : 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );
}
