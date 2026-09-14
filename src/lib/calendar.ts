import { SITE } from "./site";
import { facilityDateTime, formatLongDate, formatTime } from "./time";

export type TourEvent = {
  tourDate: string;
  tourTime: string;
  tourMinutes: number;
  guestName?: string;
};

const TITLE = `Private tour — ${SITE.shortName}`;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function utcStamp(d: Date) {
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function localStamp(isoDate: string, hm: string) {
  const [h, m] = hm.split(":").map(Number);
  return `${isoDate.replace(/-/g, "")}T${pad(h)}${pad(m)}00`;
}

export function tourBounds(event: TourEvent) {
  const start = facilityDateTime(event.tourDate, event.tourTime);
  const end = new Date(start.getTime() + event.tourMinutes * 60 * 1000);
  const [h, m] = event.tourTime.split(":").map(Number);
  const endLocal = new Date(Date.UTC(2000, 0, 1, h, m, 0) + event.tourMinutes * 60 * 1000);
  const endH = endLocal.getUTCHours();
  const endM = endLocal.getUTCMinutes();
  let endDate = event.tourDate;
  if (h * 60 + m + event.tourMinutes >= 24 * 60) {
    const [y, mo, d] = event.tourDate.split("-").map(Number);
    const next = new Date(Date.UTC(y, mo - 1, d + 1));
    endDate = `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
  }
  return {
    start,
    end,
    startLocal: localStamp(event.tourDate, event.tourTime),
    endLocal: localStamp(endDate, `${pad(endH)}:${pad(endM)}`),
    startUtc: utcStamp(start),
    endUtc: utcStamp(end),
  };
}

export function tourLocalDateTimes(event: TourEvent) {
  const { startLocal, endLocal } = tourBounds(event);
  const toRfc = (stamp: string) =>
    `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}T${stamp.slice(9, 11)}:${stamp.slice(11, 13)}:${stamp.slice(13, 15)}`;
  return { start: toRfc(startLocal), end: toRfc(endLocal) };
}

function details(event: TourEvent) {
  const who = event.guestName ? ` for ${event.guestName}` : "";
  return [
    `Private tour${who} at ${SITE.name}.`,
    `${formatLongDate(event.tourDate)} at ${formatTime(event.tourTime)} (${event.tourMinutes} min).`,
    SITE.address,
    `Call ${SITE.phone} if plans change.`,
  ].join("\n");
}

export function googleCalendarUrl(event: TourEvent) {
  const { startLocal, endLocal } = tourBounds(event);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: TITLE,
    dates: `${startLocal}/${endLocal}`,
    ctz: SITE.timezone,
    location: SITE.address,
    details: details(event),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function icsEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function tourIcs(event: TourEvent) {
  const { startUtc, endUtc } = tourBounds(event);
  const uid = `tour-${event.tourDate}T${event.tourTime.replace(":", "")}@tours.wholesomehavensd.com`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Wholesome Haven//Private Tour//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${utcStamp(new Date())}`,
    `DTSTART:${startUtc}`,
    `DTEND:${endUtc}`,
    `SUMMARY:${icsEscape(TITLE)}`,
    `LOCATION:${icsEscape(SITE.address)}`,
    `DESCRIPTION:${icsEscape(details(event))}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export function appleCalendarHref(event: TourEvent) {
  const params = new URLSearchParams({
    date: event.tourDate,
    time: event.tourTime,
    minutes: String(event.tourMinutes),
  });
  if (event.guestName) params.set("name", event.guestName);
  return `/api/tour-calendar?${params.toString()}`;
}

export function appleCalendarUrl(event: TourEvent) {
  return `https://tours.wholesomehavensd.com${appleCalendarHref(event)}`;
}
