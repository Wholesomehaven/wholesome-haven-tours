import { createFileRoute } from "@tanstack/react-router";
import { tourIcs } from "@/lib/calendar";
import { parseClockTime } from "@/lib/time";

export const Route = createFileRoute("/api/tour-calendar")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const url = new URL(request.url);
        const date = String(url.searchParams.get("date") ?? "");
        const time = parseClockTime(String(url.searchParams.get("time") ?? ""));
        const minutes = Number(url.searchParams.get("minutes") ?? "45");
        const name = url.searchParams.get("name")?.trim() || undefined;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !time) {
          return new Response("Missing tour date or time.", { status: 400 });
        }
        if (!Number.isFinite(minutes) || minutes < 15 || minutes > 180) {
          return new Response("Invalid tour length.", { status: 400 });
        }
        const ics = tourIcs({
          tourDate: date,
          tourTime: time,
          tourMinutes: minutes,
          guestName: name,
        });
        return new Response(ics, {
          headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": 'inline; filename="wholesome-haven-tour.ics"',
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
