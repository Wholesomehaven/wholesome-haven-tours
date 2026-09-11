import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { GATE_SESSION_MARKER_COOKIE } from "@/lib/auth/gate-session-marker";
import { SITE } from "./site";
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

export const getMonthAvailability = createServerFn({ method: "GET" })
  .validator(
    z.object({
      year: z.number().int().min(2020).max(2100),
      month: z.number().int().min(1).max(12),
    }),
  )
  .handler(async ({ data }) => {
    const settings = await loadSettings();
    const sql = await getSql();
    const start = isoFromParts(data.year, data.month, 1);
    const endDay = new Date(Date.UTC(data.year, data.month, 0)).getUTCDate();
    const end = isoFromParts(data.year, data.month, endDay);
    const today = todayInFacility();
    const last = addDaysIso(today, settings.horizonDays);

    const booked = await sql<{ tour_date: string; tour_time: string }>`
      select tour_date, tour_time from bookings
      where tour_date >= ${start} and tour_date <= ${end}
        and status <> 'cancelled'
    `;
    const blocked = await sql<{ slot_date: string; slot_time: string | null }>`
      select slot_date, slot_time from blocked_slots
      where slot_date >= ${start} and slot_date <= ${end}
    `;

    const bookedSet = new Set(
      booked.map((b) => `${String(b.tour_date).slice(0, 10)}|${b.tour_time}`),
    );
    const blockedDay = new Set<string>();
    const blockedSlot = new Set<string>();
    for (const b of blocked) {
      const d = String(b.slot_date).slice(0, 10);
      if (b.slot_time) blockedSlot.add(`${d}|${b.slot_time}`);
      else blockedDay.add(d);
    }

    const days: { date: string; open: number }[] = [];
    for (let day = 1; day <= endDay; day++) {
      const date = isoFromParts(data.year, data.month, day);
      if (date < today || date > last) {
        days.push({ date, open: 0 });
        continue;
      }
      if (!settings.daysOfWeek.includes(weekdayOfIso(date))) {
        days.push({ date, open: 0 });
        continue;
      }
      if (blockedDay.has(date)) {
        days.push({ date, open: 0 });
        continue;
      }
      let open = 0;
      for (const t of settings.slotTimes) {
        if (blockedSlot.has(`${date}|${t}`)) continue;
        if (bookedSet.has(`${date}|${t}`)) continue;
        if (!slotIsInFuture(date, t, settings.leadHours)) continue;
        open += 1;
      }
      days.push({ date, open });
    }
    return { days, settings };
  });

export const getSlotsForDate = createServerFn({ method: "GET" })
  .validator(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
  .handler(async ({ data }) => {
    const settings = await loadSettings();
    const sql = await getSql();
    const date = data.date;
    const today = todayInFacility();
    const last = addDaysIso(today, settings.horizonDays);
    if (date < today || date > last) {
      return { slots: [] as { time: string; open: boolean }[], tourMinutes: settings.tourMinutes };
    }
    if (!settings.daysOfWeek.includes(weekdayOfIso(date))) {
      return { slots: [] as { time: string; open: boolean }[], tourMinutes: settings.tourMinutes };
    }

    const booked = await sql<{ tour_time: string }>`
      select tour_time from bookings
      where tour_date = ${date} and status <> 'cancelled'
    `;
    const blocked = await sql<{ slot_time: string | null }>`
      select slot_time from blocked_slots where slot_date = ${date}
    `;
    const bookedSet = new Set(booked.map((b) => b.tour_time));
    const dayBlocked = blocked.some((b) => !b.slot_time);
    const blockedSet = new Set(
      blocked.filter((b) => b.slot_time).map((b) => b.slot_time as string),
    );

    const slots = settings.slotTimes.map((time) => ({
      time,
      open:
        !dayBlocked &&
        !blockedSet.has(time) &&
        !bookedSet.has(time) &&
        slotIsInFuture(date, time, settings.leadHours),
    }));
    return { slots, tourMinutes: settings.tourMinutes };
  });

const bookingInput = z.object({
  guestName: z.string().trim().min(2).max(120),
  guestEmail: z.email(),
  guestPhone: z.string().trim().min(10).max(40),
  partySize: z.number().int().min(1).max(12),
  relationship: z.string().trim().max(40).optional(),
  residentName: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
  smsOptIn: z.boolean(),
  tourDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tourTime: z.string().regex(/^\d{2}:\d{2}$/),
});

export const createBooking = createServerFn({ method: "POST" })
  .validator(bookingInput)
  .handler(async ({ data }) => {
    const settings = await loadSettings();
    const phoneDigits = digitsOnly(data.guestPhone);
    if (phoneDigits.length < 10) {
      return { ok: false as const, error: "Please enter a valid phone number." };
    }
    if (data.partySize > settings.maxPartySize) {
      return {
        ok: false as const,
        error: `Tours are limited to ${settings.maxPartySize} guests.`,
      };
    }
    const today = todayInFacility();
    const last = addDaysIso(today, settings.horizonDays);
    if (data.tourDate < today || data.tourDate > last) {
      return { ok: false as const, error: "That date is outside our booking window." };
    }
    if (!settings.daysOfWeek.includes(weekdayOfIso(data.tourDate))) {
      return { ok: false as const, error: "We do not host tours on that day." };
    }
    if (!settings.slotTimes.includes(data.tourTime)) {
      return { ok: false as const, error: "Please choose one of the listed times." };
    }
    if (!slotIsInFuture(data.tourDate, data.tourTime, settings.leadHours)) {
      return { ok: false as const, error: "That time is no longer available." };
    }

    const sql = await getSql();
    const blocked = await sql<{ slot_time: string | null }>`
      select slot_time from blocked_slots where slot_date = ${data.tourDate}
    `;
    if (blocked.some((b) => !b.slot_time || b.slot_time === data.tourTime)) {
      return { ok: false as const, error: "That time was just taken. Please pick another." };
    }

    try {
      const rows = await sql<{ id: number; tour_date: string; tour_time: string }>`
        insert into bookings (
          guest_name, guest_email, guest_phone, party_size, relationship,
          resident_name, notes, sms_opt_in, tour_date, tour_time, status
        ) values (
          ${data.guestName},
          ${data.guestEmail.toLowerCase()},
          ${data.guestPhone.trim()},
          ${data.partySize},
          ${data.relationship || null},
          ${data.residentName || null},
          ${data.notes || null},
          ${data.smsOptIn},
          ${data.tourDate},
          ${data.tourTime},
          'pending'
        )
        returning id, tour_date, tour_time
      `;
      const row = rows[0];
      if (!row) return { ok: false as const, error: "Could not save your request." };
      return {
        ok: true as const,
        booking: {
          id: row.id,
          tourDate: String(row.tour_date).slice(0, 10),
          tourTime: row.tour_time,
          guestName: data.guestName,
          tourMinutes: settings.tourMinutes,
        },
      };
    } catch {
      return {
        ok: false as const,
        error: "That time was just taken. Please pick another.",
      };
    }
  });

export const getStaffSession = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => staffContext(context.userId));

export const listBookings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      status: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const sql = await getSql();
    const from = data.from || "2000-01-01";
    const to = data.to || "2100-12-31";
    const status = data.status && data.status !== "all" ? data.status : null;
    const rows = status
      ? await sql<Parameters<typeof mapBooking>[0]>`
          select id, guest_name, guest_email, guest_phone, party_size, relationship,
                 resident_name, notes, sms_opt_in, tour_date, tour_time, status,
                 staff_notes, created_at
          from bookings
          where tour_date >= ${from} and tour_date <= ${to} and status = ${status}
          order by case when status = 'pending' then 0 when status = 'confirmed' then 1 else 2 end,
                   tour_date asc, tour_time asc
        `
      : await sql<Parameters<typeof mapBooking>[0]>`
          select id, guest_name, guest_email, guest_phone, party_size, relationship,
                 resident_name, notes, sms_opt_in, tour_date, tour_time, status,
                 staff_notes, created_at
          from bookings
          where tour_date >= ${from} and tour_date <= ${to}
          order by case when status = 'pending' then 0 when status = 'confirmed' then 1 else 2 end,
                   tour_date asc, tour_time asc
        `;
    return rows.map(mapBooking);
  });

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const sql = await getSql();
    const today = todayInFacility();
    const weekEnd = addDaysIso(today, 7);
    const counts = await sql<{ status: string; n: number }>`
      select status, count(*)::int as n from bookings group by status
    `;
    const byStatus: Record<string, number> = {};
    for (const c of counts) byStatus[c.status] = c.n;
    const todayRows = await sql<Parameters<typeof mapBooking>[0]>`
      select id, guest_name, guest_email, guest_phone, party_size, relationship,
             resident_name, notes, sms_opt_in, tour_date, tour_time, status,
             staff_notes, created_at
      from bookings
      where tour_date = ${today} and status <> 'cancelled'
      order by tour_time asc
    `;
    const upcoming = await sql<{ n: number }>`
      select count(*)::int as n from bookings
      where tour_date >= ${today} and tour_date < ${weekEnd}
        and status in ('pending', 'confirmed')
    `;
    const pending = await sql<{ n: number }>`
      select count(*)::int as n from bookings where status = 'pending'
    `;
    const pendingRows = await sql<Parameters<typeof mapBooking>[0]>`
      select id, guest_name, guest_email, guest_phone, party_size, relationship,
             resident_name, notes, sms_opt_in, tour_date, tour_time, status,
             staff_notes, created_at
      from bookings
      where status = 'pending'
      order by tour_date asc, tour_time asc
    `;
    const upcomingRows = await sql<Parameters<typeof mapBooking>[0]>`
      select id, guest_name, guest_email, guest_phone, party_size, relationship,
             resident_name, notes, sms_opt_in, tour_date, tour_time, status,
             staff_notes, created_at
      from bookings
      where tour_date >= ${today} and tour_date <= ${weekEnd}
        and status in ('pending', 'confirmed')
      order by tour_date asc, tour_time asc
    `;
    return {
      byStatus,
      todayCount: todayRows.length,
      upcomingWeek: upcoming[0]?.n ?? 0,
      pending: pending[0]?.n ?? 0,
      todayTours: todayRows.map(mapBooking),
      pendingTours: pendingRows.map(mapBooking),
      upcomingTours: upcomingRows.map(mapBooking),
    };
  });

export const updateBookingStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      id: z.number().int(),
      status: z.enum(["pending", "confirmed", "completed", "cancelled", "no_show"]),
      staffNotes: z.string().trim().max(2000).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const sql = await getSql();
    if (data.staffNotes !== undefined) {
      await sql`
        update bookings
        set status = ${data.status}, staff_notes = ${data.staffNotes}, updated_at = now()
        where id = ${data.id}
      `;
    } else {
      await sql`
        update bookings
        set status = ${data.status}, updated_at = now()
        where id = ${data.id}
      `;
    }
    return { ok: true as const };
  });

export const saveStaffNotes = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.number().int(), staffNotes: z.string().trim().max(2000) }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const sql = await getSql();
    await sql`
      update bookings set staff_notes = ${data.staffNotes}, updated_at = now()
      where id = ${data.id}
    `;
    return { ok: true as const };
  });

export const listBlocks = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ from: z.string(), to: z.string() }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const sql = await getSql();
    return sql<{ id: number; slot_date: string; slot_time: string | null; reason: string | null }>`
      select id, slot_date, slot_time, reason from blocked_slots
      where slot_date >= ${data.from} and slot_date <= ${data.to}
      order by slot_date asc, slot_time asc nulls first
    `;
  });

export const blockSlot = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      time: z
        .string()
        .optional()
        .nullable()
        .transform((v) => {
          if (!v) return null;
          return parseClockTime(v);
        })
        .refine((v) => v === null || Boolean(v), "Use a time like 9:00 or 2:00 PM."),
      reason: z.string().trim().max(200).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const sql = await getSql();
    await sql`
      insert into blocked_slots (slot_date, slot_time, reason)
      values (${data.date}, ${data.time ?? null}, ${data.reason || null})
    `;
    return { ok: true as const };
  });

export const unblockSlot = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const sql = await getSql();
    await sql`delete from blocked_slots where id = ${data.id}`;
    return { ok: true as const };
  });

export const getAdminSettings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    return loadSettings();
  });

export const saveAdminSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      daysOfWeek: z.array(z.coerce.number().int().min(0).max(6)).min(1, "Pick at least one open day."),
      slotTimes: z
        .array(z.string())
        .min(1, "Pick at least one tour time.")
        .transform((arr, ctx) => {
          const out: string[] = [];
          for (const raw of arr) {
            const t = parseClockTime(raw);
            if (!t) {
              ctx.addIssue({
                code: "custom",
                message: `“${raw}” isn’t a valid time. Try 9:00 or 9:00 AM.`,
              });
              return z.NEVER;
            }
            out.push(t);
          }
          return [...new Set(out)].sort();
        }),
      tourMinutes: z.coerce.number().int().min(15).max(180),
      maxPartySize: z.coerce.number().int().min(1).max(12),
      leadHours: z.coerce.number().int().min(0).max(72),
      horizonDays: z.coerce.number().int().min(7).max(365),
    }),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const sql = await getSql();
    const days = [...new Set(data.daysOfWeek)].sort((a, b) => a - b).join(",");
    const slots = JSON.stringify(data.slotTimes);
    await sql`
      update availability_settings
      set days_of_week = ${days},
          slot_times = ${slots},
          tour_minutes = ${data.tourMinutes},
          max_party_size = ${data.maxPartySize},
          lead_hours = ${data.leadHours},
          horizon_days = ${data.horizonDays}
      where id = 1
    `;
    return { ok: true as const };
  });
