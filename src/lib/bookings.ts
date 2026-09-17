import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { GATE_SESSION_MARKER_COOKIE } from "@/lib/auth/gate-session-marker";
import { SITE } from "./site";
import { notifyBookingCreated, notifyBookingStatus } from "./tour-emails";
import { syncStaffCalendarSafe } from "./staff-calendar.server";
import {
  addDaysIso,
  facilityDateTime,
  isoFromParts,
  parseClockTime,
  todayInFacility,
  weekdayOfIso,
} from "./time";

const ADMIN_EMAIL = SITE.adminEmail.toLowerCase();

export type PublicSettings = {
  daysOfWeek: number[];
  slotTimes: string[];
  tourMinutes: number;
  maxPartySize: number;
  leadHours: number;
  horizonDays: number;
};

export type BookingRow = {
  id: number;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  partySize: number;
  relationship: string | null;
  residentName: string | null;
  notes: string | null;
  smsOptIn: boolean;
  tourDate: string;
  tourTime: string;
  status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
  staffNotes: string | null;
  createdAt: string;
};

type SettingsRow = {
  days_of_week: string;
  slot_times: string;
  tour_minutes: number;
  max_party_size: number;
  lead_hours: number;
  horizon_days: number;
};

function parseSettings(row: SettingsRow | undefined): PublicSettings {
  const fallback: PublicSettings = {
    daysOfWeek: [1, 2, 3, 4, 5, 6],
    slotTimes: ["10:00", "11:00", "13:00", "14:00", "15:00"],
    tourMinutes: 45,
    maxPartySize: 6,
    leadHours: 3,
    horizonDays: 90,
  };
  if (!row) return fallback;
  const days = row.days_of_week
    .split(",")
    .map((d) => Number(d.trim()))
    .filter((n) => n >= 0 && n <= 6);
  let slots: string[] = fallback.slotTimes;
  try {
    const parsed = JSON.parse(row.slot_times) as unknown;
    if (Array.isArray(parsed)) {
      slots = parsed.filter((s): s is string => typeof s === "string");
    }
  } catch {
    /* keep fallback */
  }
  return {
    daysOfWeek: days.length ? days : fallback.daysOfWeek,
    slotTimes: slots.length ? slots : fallback.slotTimes,
    tourMinutes: row.tour_minutes,
    maxPartySize: row.max_party_size,
    leadHours: row.lead_hours,
    horizonDays: row.horizon_days,
  };
}

async function loadSettings(): Promise<PublicSettings> {
  const sql = await getSql();
  const rows = await sql<SettingsRow>`
    select days_of_week, slot_times, tour_minutes, max_party_size, lead_hours, horizon_days
    from availability_settings where id = 1
  `;
  return parseSettings(rows[0]);
}

function mapBooking(r: {
  id: number;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  party_size: number;
  relationship: string | null;
  resident_name: string | null;
  notes: string | null;
  sms_opt_in: boolean;
  tour_date: string;
  tour_time: string;
  status: string;
  staff_notes: string | null;
  created_at: string;
}): BookingRow {
  return {
    id: r.id,
    guestName: r.guest_name,
    guestEmail: r.guest_email,
    guestPhone: r.guest_phone,
    partySize: r.party_size,
    relationship: r.relationship,
    residentName: r.resident_name,
    notes: r.notes,
    smsOptIn: Boolean(r.sms_opt_in),
    tourDate: String(r.tour_date).slice(0, 10),
    tourTime: r.tour_time,
    status: r.status as BookingRow["status"],
    staffNotes: r.staff_notes,
    createdAt: String(r.created_at),
  };
}

function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, "");
}

function slotIsInFuture(date: string, time: string, leadHours: number): boolean {
  const start = facilityDateTime(date, time);
  return start.getTime() - Date.now() >= leadHours * 60 * 60 * 1000;
}

async function hasGateCookie(): Promise<boolean> {
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const req = getRequest();
    const cookie = req?.headers.get("cookie") ?? "";
    return cookie
      .split(";")
      .some((p) => p.trim().startsWith(`${GATE_SESSION_MARKER_COOKIE}=`));
  } catch {
    return false;
  }
}

async function staffContext(userId: string) {
  const sql = await getSql();
  const rows = await sql<{ email: string | null }>`
    select email from "user" where id = ${userId} limit 1
  `;
  const email = (rows[0]?.email ?? "").trim().toLowerCase();
  const preview = !process.env.DATABASE_URL?.trim();
  const gate = await hasGateCookie();
  const isAdmin = email === ADMIN_EMAIL || preview || gate;
  return { email, isAdmin, preview };
}

async function assertAdmin(userId: string) {
  const ctx = await staffContext(userId);
  if (!ctx.isAdmin) {
    const err = new Error("Forbidden");
    (err as Error & { status: number }).status = 403;
    throw err;
  }
  return ctx;
}

export const getPublicConfig = createServerFn({ method: "GET" }).handler(
  async () => {
    const settings = await loadSettings();
    return {
      ...settings,
      address: SITE.address,
      phone: SITE.phone,
      email: SITE.email,
      name: SITE.name,
    };
  },
);
