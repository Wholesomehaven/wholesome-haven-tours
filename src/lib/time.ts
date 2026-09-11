import { SITE } from "./site";

const TZ = SITE.timezone;

export function todayInFacility(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

export function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function weekdayOfIso(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Instant for a civil date+time in America/Los_Angeles. */
export function facilityDateTime(isoDate: string, hm: string): Date {
  const local = `${isoDate}T${hm}:00`;
  const utcGuess = new Date(`${local}Z`);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(utcGuess).map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  const offset = asUtc - utcGuess.getTime();
  return new Date(utcGuess.getTime() - offset);
}

function isoParts(isoDate: string): [number, number, number] | null {
  const raw = String(isoDate ?? "").slice(0, 10);
  const [y, m, d] = raw.split("-").map(Number);
  if (!y || !m || !d) return null;
  return [y, m, d];
}

export function formatLongDate(isoDate: string): string {
  const parts = isoParts(isoDate);
  if (!parts) return isoDate || "—";
  const [y, m, d] = parts;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatShortDate(isoDate: string): string {
  const parts = isoParts(isoDate);
  if (!parts) return isoDate || "—";
  const [y, m, d] = parts;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatTime(hm: string): string {
  const [h, min] = String(hm ?? "").split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return hm || "—";
  const dt = new Date(Date.UTC(2000, 0, 1, h, min));
  return dt.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

/** Accepts 9:00, 09:00, 9am, 9:00 PM → HH:MM. */
export function parseClockTime(raw: string): string | null {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
  if (!s) return null;
  const am = s.endsWith("am");
  const pm = s.endsWith("pm");
  const core = s.replace(/am|pm$/, "");
  const m = core.match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2] ?? "0");
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute > 59) return null;
  if (am || pm) {
    if (hour < 1 || hour > 12) return null;
    if (am && hour === 12) hour = 0;
    if (pm && hour !== 12) hour += 12;
  } else if (hour > 23) {
    return null;
  }
  if (hour < 0) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function monthLabel(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isoFromParts(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
