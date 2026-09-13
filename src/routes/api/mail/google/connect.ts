import { createFileRoute } from "@tanstack/react-router";
import { googleAuthUrl, googleMailClientId } from "@/lib/mail.server";

export const Route = createFileRoute("/api/mail/google/connect")({
  server: {
    handlers: {
      GET: ({ request }) => {
        if (!googleMailClientId()) {
          return new Response("Google mail is not configured on this server.", {
            status: 503,
          });
        }
        const origin = new URL(request.url).origin;
        return Response.redirect(googleAuthUrl(origin), 302);
      },
    },
  },
});
