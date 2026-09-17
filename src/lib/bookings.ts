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
