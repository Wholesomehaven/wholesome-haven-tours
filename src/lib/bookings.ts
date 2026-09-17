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
