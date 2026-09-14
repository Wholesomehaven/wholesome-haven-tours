import { SITE } from "./site";
import { tourLocalDateTimes } from "./calendar";
import { getSql } from "./db";
import { googleAccessToken } from "./mail.server";
import { formatLongDate, formatTime } from "./time";

type StaffTour = {
  id: number;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  partySize: number;
  residentName: string | null;
  notes: string | null;
  tourDate: string;
  tourTime: string;
  tourMinutes: number;
  status: string;
  googleEventId?: string | null;
};

function titleFor(booking: StaffTour) {
  const who = booking.guestName;
  if (booking.status === "confirmed") return `Private tour — ${who}`;
  if (booking.status === "pending") return `Tour requested — ${who}`;
  if (booking.status === "completed") return `Tour completed — ${who}`;
  if (booking.status === "no_show") return `Tour no-show — ${who}`;
  return `Tour cancelled — ${who}`;
}

function descriptionFor(booking: StaffTour) {
  return [
    `${formatLongDate(booking.tourDate)} at ${formatTime(booking.tourTime)} (${booking.tourMinutes} min).`,
    `Guest: ${booking.guestName}`,
    `Email: ${booking.guestEmail}`,
    `Phone: ${booking.guestPhone}`,
    `Party of ${booking.partySize}${booking.residentName ? ` · Resident: ${booking.residentName}` : ""}`,
    booking.notes ? `Notes: ${booking.notes}` : "",
    `Status: ${booking.status}`,
    `Desk: ${SITE.tourDeskUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function eventPayload(booking: StaffTour) {
  const { start, end } = tourLocalDateTimes(booking);
  return {
    summary: titleFor(booking),
    location: SITE.address,
    description: descriptionFor(booking),
    start: { dateTime: start, timeZone: SITE.timezone },
    end: { dateTime: end, timeZone: SITE.timezone },
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: 60 },
        { method: "popup", minutes: 24 * 60 },
      ],
    },
    extendedProperties: {
      private: { wholesomeTourId: String(booking.id) },
    },
  };
}

async function calendarFetch(path: string, init: RequestInit) {
  const token = await googleAccessToken();
  const response = await fetch(`https://www.googleapis.com/calendar/v3/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let json: { id?: string; error?: { message?: string } } = {};
  try {
    json = text ? (JSON.parse(text) as typeof json) : {};
  } catch {
    json = { error: { message: text.slice(0, 200) } };
  }
  return { ok: response.ok, status: response.status, json };
}

async function saveEventId(bookingId: number, eventId: string | null) {
  const sql = await getSql();
  await sql`
    update bookings set google_event_id = ${eventId}, updated_at = now()
    where id = ${bookingId}
  `;
}

export async function syncStaffCalendar(booking: StaffTour): Promise<void> {
  try {
    if (booking.status === "cancelled") {
      if (booking.googleEventId) {
        const del = await calendarFetch(
          `calendars/primary/events/${encodeURIComponent(booking.googleEventId)}`,
          { method: "DELETE" },
        );
        if (del.ok || del.status === 404 || del.status === 410) {
          await saveEventId(booking.id, null);
        }
      }
      return;
    }

    const body = JSON.stringify(eventPayload(booking));
    if (booking.googleEventId) {
      const patch = await calendarFetch(
        `calendars/primary/events/${encodeURIComponent(booking.googleEventId)}`,
        { method: "PATCH", body },
      );
      if (patch.ok) return;
      if (patch.status !== 404 && patch.status !== 410) {
        throw new Error(patch.json.error?.message || `Calendar update failed (${patch.status})`);
      }
    }

    const created = await calendarFetch("calendars/primary/events", {
      method: "POST",
      body,
    });
    if (!created.ok || !created.json.id) {
      throw new Error(created.json.error?.message || `Calendar create failed (${created.status})`);
    }
    await saveEventId(booking.id, created.json.id);
  } catch (err) {
    console.error("[staff-calendar]", booking.id, err);
  }
}

export async function syncStaffCalendarSafe(
  booking: Omit<StaffTour, "tourMinutes"> & { tourMinutes?: number },
): Promise<void> {
  const minutes = booking.tourMinutes ?? 45;
  await syncStaffCalendar({ ...booking, tourMinutes: minutes });
}
