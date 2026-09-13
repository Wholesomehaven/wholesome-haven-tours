import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { peekPreviewResetUrl } from "../mail.server";
import { SITE } from "../site";

export const peekStaffResetLink = createServerFn({ method: "POST" })
  .validator(z.object({ email: z.string().email() }))
  .handler(async ({ data }) => {
    if (data.email.trim().toLowerCase() !== SITE.adminEmail.toLowerCase()) {
      return { url: null as string | null };
    }
    return { url: peekPreviewResetUrl(data.email) };
  });
