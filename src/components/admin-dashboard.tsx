import { Component, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarDays, Clock, Mail, Phone, Users } from "lucide-react";
import {
  blockSlot,
  getAdminSettings,
  getDashboard,
  getStaffSession,
  listBlocks,
  listBookings,
  saveAdminSettings,
  saveStaffNotes,
  unblockSlot,
  updateBookingStatus,
  type BookingRow,
  type PublicSettings,
} from "@/lib/bookings";
import { RedirectToSignIn, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { RELATIONSHIPS, SITE } from "@/lib/site";
import { addDaysIso, formatShortDate, formatTime, parseClockTime, todayInFacility } from "@/lib/time";
import { cn } from "@/lib/utils";
import { SiteHeader } from "./site-header";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

type Tab = "overview" | "bookings" | "availability";

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No-show" },
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TOUR_HOURS = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
];

function errorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object" && err && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m.trim()) return m;
  }
  return fallback;
}

class PanelErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="rounded-xl border border-border bg-surface p-6">
          <p className="font-medium">This list couldn’t be shown.</p>
          <p className="mt-1 text-sm text-muted">{this.state.error.message}</p>
          <Button
            type="button"
            className="mt-4"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function AdminDashboard() {
  const { user, isPending } = useCurrentUserState();
  const [tab, setTab] = useState<Tab>("bookings");
  const [staff, setStaff] = useState<{ email: string; isAdmin: boolean } | null>(null);
  const [staffError, setStaffError] = useState<string | null>(null);

  useEffect(() => {
    if (isPending || !user) return;
    let cancelled = false;
    getStaffSession()
      .then((ctx) => {
        if (!cancelled) {
          setStaffError(null);
          setStaff(ctx);
        }
      })
      .catch((err) => {
        if (!cancelled) setStaffError(errorMessage(err, "Could not verify staff access."));
      });
    return () => {
      cancelled = true;
    };
  }, [isPending, user]);

  // Stay on the desk if we already loaded staff — don't blank the page on a
  // background session refetch.
  if (staff?.isAdmin) {
    return (
      <div className="flex min-h-screen flex-col bg-bg text-fg">
        <SiteHeader
          variant="admin"
          trailing={
            <div className="flex min-w-0 items-center gap-2">
              <span className="hidden truncate text-xs text-muted sm:inline">{staff.email}</span>
              <UserButton />
            </div>
          }
        />
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs tracking-[0.18em] text-primary uppercase">Wholesome Haven</p>
              <h1 className="font-display text-3xl">Tour desk</h1>
            </div>
            <nav className="flex gap-1 rounded-lg bg-bg-warm p-1">
              {(
                [
                  ["bookings", "Bookings"],
                  ["overview", "Overview"],
                  ["availability", "Availability"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={cn(
                    "h-10 rounded-md px-3 text-sm font-medium transition-colors",
                    tab === id ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg",
                  )}
                >
                  {label}
                </button>
              ))}
            </nav>
          </div>
          <div className="mt-8 flex-1">
            <div className={cn(tab !== "bookings" && "hidden")}>
              <PanelErrorBoundary>
                <BookingsPanel />
              </PanelErrorBoundary>
            </div>
            <div className={cn(tab !== "overview" && "hidden")}>
              <PanelErrorBoundary>
                <Overview />
              </PanelErrorBoundary>
            </div>
            <div className={cn(tab !== "availability" && "hidden")}>
              <PanelErrorBoundary>
                <AvailabilityPanel />
              </PanelErrorBoundary>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isPending || (user && !staff && !staffError)) {
    return (
      <div className="min-h-screen bg-bg">
        <SiteHeader variant="admin" />
        <div className="mx-auto max-w-6xl px-4 py-10">
          <p className="text-sm text-muted">Opening the tour desk…</p>
          <div className="mt-4 h-40 animate-pulse rounded-xl bg-bg-warm" />
        </div>
      </div>
    );
  }
  if (!user) return <RedirectToSignIn />;
  if (staff && !staff.isAdmin) {
    return (
      <div className="min-h-screen bg-bg text-fg">
        <SiteHeader variant="admin" />
        <div className="mx-auto max-w-lg px-4 py-20 text-center">
          <h1 className="font-display text-3xl">Staff access only</h1>
          <p className="mt-3 text-muted">
            This desk is reserved for {SITE.adminEmail}. You’re signed in as{" "}
            {staff.email || "another account"}.
          </p>
          <Button asChild className="mt-6">
            <Link to="/">Back to tours</Link>
          </Button>
        </div>
      </div>
    );
  }
  if (staffError) {
    return (
      <div className="grid min-h-screen place-items-center bg-bg px-4 text-center">
        <div>
          <p className="text-muted">{staffError}</p>
          <Button asChild className="mt-4">
            <Link to="/login">Sign in again</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <SiteHeader variant="admin" />
      <div className="mx-auto max-w-6xl px-4 py-10">
        <p className="text-sm text-muted">Opening the tour desk…</p>
      </div>
    </div>
  );
}

function Overview() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getDashboard>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    setError(null);
    getDashboard()
      .then((next) => {
        setData(next);
        setError(null);
      })
      .catch((err) => setError(errorMessage(err, "Could not load the overview.")));
  }

  useEffect(() => {
    reload();
  }, []);

  if (error && !data) {
    return (
      <EmptyState
        title="Overview didn’t load"
        body={error}
        action={<Button onClick={reload}>Try again</Button>}
      />
    );
  }
  if (!data) return <div className="h-48 animate-pulse rounded-xl bg-bg-warm" />;

  const upcoming = data.upcomingTours ?? [];
  const pending = data.pendingTours ?? [];

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Today" value={data.todayCount} hint="tours on the calendar" />
        <Stat label="This week" value={data.upcomingWeek} hint="pending or confirmed" />
        <Stat label="Need a reply" value={data.pending} hint="new requests" />
      </div>
      {pending.length > 0 ? (
        <section>
          <h2 className="font-display text-2xl">Need a reply</h2>
          <ul className="mt-4 space-y-3">
            {pending.map((b) => (
              <BookingCard key={b.id} booking={b} onChange={reload} />
            ))}
          </ul>
        </section>
      ) : null}
      <section>
        <h2 className="font-display text-2xl">Coming up this week</h2>
        {upcoming.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No visits scheduled in the next seven days.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {upcoming.map((b) => (
              <BookingCard key={b.id} booking={b} onChange={reload} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="text-xs tracking-[0.16em] text-muted uppercase">{label}</p>
      <p className="mt-2 font-display text-4xl tabular-nums">{value}</p>
      <p className="mt-1 text-sm text-muted">{hint}</p>
    </div>
  );
}

function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-6 py-12 text-center">
      <p className="font-display text-2xl">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

function BookingsPanel() {
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<BookingRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    setError(null);
    listBookings({ data: { status } })
      .then((next) => {
        setRows(next);
        setError(null);
      })
      .catch((err) => {
        setError(errorMessage(err, "Could not load bookings."));
        setRows([]);
      });
  }

  useEffect(() => {
    setRows(null);
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((b) =>
      [b.guestName, b.guestEmail, b.guestPhone, b.residentName, b.notes]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [rows, query]);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setStatus(s.value)}
            className={cn(
              "h-10 rounded-full border px-3 text-sm",
              status === s.value
                ? "border-primary bg-primary text-primary-fg"
                : "border-border bg-surface text-fg",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="mt-4 max-w-sm">
        <Label htmlFor="booking-search" className="sr-only">
          Search bookings
        </Label>
        <Input
          id="booking-search"
          placeholder="Search name, email, or phone"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {error ? (
        <div className="mt-6">
          <EmptyState
            title="Bookings didn’t load"
            body={error}
            action={<Button onClick={reload}>Try again</Button>}
          />
        </div>
      ) : rows === null ? (
        <div className="mt-6 h-40 animate-pulse rounded-xl bg-bg-warm" />
      ) : rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No tour requests yet"
            body="When a family books a private tour, their visit will appear here so you can confirm it."
            action={
              <Button asChild variant="secondary">
                <Link to="/book-a-tour">Open the public booking page</Link>
              </Button>
            }
          />
        </div>
      ) : filtered.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No bookings match that search.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {filtered.map((b) => (
            <BookingCard key={b.id} booking={b} onChange={reload} />
          ))}
        </ul>
      )}
    </div>
  );
}

function relationshipLabel(value: string | null) {
  if (!value) return null;
  return RELATIONSHIPS.find((r) => r.value === value)?.label ?? value;
}

function BookingCard({ booking, onChange }: { booking: BookingRow; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(booking.staffNotes ?? "");
  const [busy, setBusy] = useState(false);

  async function setStatus(status: BookingRow["status"]) {
    setBusy(true);
    try {
      await updateBookingStatus({ data: { id: booking.id, status } });
      onChange();
    } finally {
      setBusy(false);
    }
  }

  async function saveNotes() {
    setBusy(true);
    try {
      await saveStaffNotes({ data: { id: booking.id, staffNotes: notes } });
      onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">{booking.guestName}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3.5" />
              {formatShortDate(booking.tourDate)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" />
              {formatTime(booking.tourTime)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" />
              {booking.partySize}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={booking.status}>{booking.status.replace("_", " ")}</Badge>
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
            {open ? "Close" : "Details"}
          </Button>
        </div>
      </div>
      {open ? (
        <div className="mt-4 space-y-4 border-t border-border pt-4 text-sm">
          <div className="grid gap-2 sm:grid-cols-2">
            <a href={`mailto:${booking.guestEmail}`} className="inline-flex items-center gap-2 text-primary hover:underline">
              <Mail className="size-4" />
              {booking.guestEmail}
            </a>
            <a href={`tel:${booking.guestPhone}`} className="inline-flex items-center gap-2 text-primary hover:underline">
              <Phone className="size-4" />
              {booking.guestPhone}
            </a>
            {relationshipLabel(booking.relationship) ? (
              <p>Relationship: {relationshipLabel(booking.relationship)}</p>
            ) : null}
            {booking.residentName ? <p>Loved one: {booking.residentName}</p> : null}
            {booking.smsOptIn ? <p>Text reminders: yes</p> : null}
          </div>
          {booking.notes ? (
            <p className="rounded-md bg-bg px-3 py-2 leading-relaxed">{booking.notes}</p>
          ) : null}
          <div className="grid gap-1.5">
            <Label htmlFor={`notes-${booking.id}`}>Staff notes</Label>
            <Textarea
              id={`notes-${booking.id}`}
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={saveNotes}>
              Save notes
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {booking.status === "pending" ? (
              <Button type="button" size="sm" disabled={busy} onClick={() => setStatus("confirmed")}>
                Confirm
              </Button>
            ) : null}
            {booking.status === "confirmed" ? (
              <Button type="button" size="sm" disabled={busy} onClick={() => setStatus("completed")}>
                Mark completed
              </Button>
            ) : null}
            {booking.status !== "cancelled" ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => setStatus("cancelled")}
              >
                Cancel
              </Button>
            ) : null}
            {booking.status === "confirmed" ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => setStatus("no_show")}
              >
                No-show
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}

function AvailabilityPanel() {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [blocks, setBlocks] = useState<
    { id: number; slot_date: string; slot_time: string | null; reason: string | null }[]
  >([]);
  const [blockDate, setBlockDate] = useState("");
  const [blockTime, setBlockTime] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = todayInFacility();
  const horizon = useMemo(() => addDaysIso(today, 120), [today]);

  function reload() {
    getAdminSettings()
      .then(setSettings)
      .catch(() => setError("Could not load availability."));
    listBlocks({ data: { from: today, to: horizon } })
      .then(setBlocks)
      .catch(() => setBlocks([]));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (!settings) return;
    setError(null);
    if (settings.daysOfWeek.length === 0) {
      setError("Pick at least one open day.");
      return;
    }
    const times = [
      ...new Set(
        settings.slotTimes
          .map((t) => parseClockTime(t))
          .filter((t): t is string => Boolean(t)),
      ),
    ].sort();
    if (times.length === 0) {
      setError("Pick at least one tour time.");
      return;
    }
    try {
      await saveAdminSettings({
        data: {
          daysOfWeek: settings.daysOfWeek,
          slotTimes: times,
          tourMinutes: settings.tourMinutes,
          maxPartySize: settings.maxPartySize,
          leadHours: settings.leadHours,
          horizonDays: settings.horizonDays,
        },
      });
      setSettings({ ...settings, slotTimes: times });
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (err) {
      setError(errorMessage(err, "Could not save settings. Check the times and try again."));
    }
  }

  async function addBlock() {
    if (!blockDate) return;
    const time = blockTime.trim() ? parseClockTime(blockTime) : null;
    if (blockTime.trim() && !time) {
      setError("Use a block time like 2:00 PM, or leave it blank to close the whole day.");
      return;
    }
    try {
      await blockSlot({
        data: {
          date: blockDate,
          time,
          reason: blockReason || undefined,
        },
      });
      setBlockDate("");
      setBlockTime("");
      setBlockReason("");
      setError(null);
      reload();
    } catch (err) {
      setError(errorMessage(err, "Could not block that date."));
    }
  }

  if (!settings) {
    return error ? (
      <EmptyState title="Availability didn’t load" body={error} action={<Button onClick={reload}>Try again</Button>} />
    ) : (
      <div className="h-48 animate-pulse rounded-xl bg-bg-warm" />
    );
  }

  function toggleDay(d: number) {
    setSettings((s) => {
      if (!s) return s;
      const has = s.daysOfWeek.includes(d);
      const days = has ? s.daysOfWeek.filter((x) => x !== d) : [...s.daysOfWeek, d];
      return { ...s, daysOfWeek: days.sort((a, b) => a - b) };
    });
  }

  function toggleHour(hm: string) {
    setSettings((s) => {
      if (!s) return s;
      const has = s.slotTimes.includes(hm);
      const slotTimes = has ? s.slotTimes.filter((x) => x !== hm) : [...s.slotTimes, hm].sort();
      return { ...s, slotTimes };
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-display text-2xl">Open days & times</h2>
        <p className="mt-1 text-sm text-muted">Families only see these slots on the public page.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {DAY_LABELS.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => toggleDay(i)}
              className={cn(
                "h-10 min-w-12 rounded-md border px-3 text-sm",
                settings.daysOfWeek.includes(i)
                  ? "border-primary bg-primary text-primary-fg"
                  : "border-border bg-bg text-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-5 grid gap-1.5">
          <p className="text-sm font-medium text-fg">Tour times</p>
          <p className="text-xs text-muted">Tap to open or close a slot. Families see these on the booking page.</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {TOUR_HOURS.map((hm) => (
              <button
                key={hm}
                type="button"
                onClick={() => toggleHour(hm)}
                className={cn(
                  "h-10 rounded-md border px-3 text-sm",
                  settings.slotTimes.includes(hm)
                    ? "border-primary bg-primary text-primary-fg"
                    : "border-border bg-bg text-muted",
                )}
              >
                {formatTime(hm)}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label="Tour length (min)" htmlFor="dur">
            <Input
              id="dur"
              type="number"
              value={settings.tourMinutes}
              onChange={(e) => setSettings({ ...settings, tourMinutes: Number(e.target.value) })}
            />
          </Field>
          <Field label="Max guests" htmlFor="party">
            <Input
              id="party"
              type="number"
              value={settings.maxPartySize}
              onChange={(e) => setSettings({ ...settings, maxPartySize: Number(e.target.value) })}
            />
          </Field>
          <Field label="Lead time (hours)" htmlFor="lead">
            <Input
              id="lead"
              type="number"
              value={settings.leadHours}
              onChange={(e) => setSettings({ ...settings, leadHours: Number(e.target.value) })}
            />
          </Field>
          <Field label="Bookable days ahead" htmlFor="horizon">
            <Input
              id="horizon"
              type="number"
              value={settings.horizonDays}
              onChange={(e) => setSettings({ ...settings, horizonDays: Number(e.target.value) })}
            />
          </Field>
        </div>
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        <Button type="button" className="mt-5" onClick={save}>
          {saved ? "Saved" : "Save availability"}
        </Button>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-display text-2xl">Block dates</h2>
        <p className="mt-1 text-sm text-muted">
          Hide a whole day or a single time — holidays, full house, private events.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Date" htmlFor="bdate">
            <Input id="bdate" type="date" value={blockDate} onChange={(e) => setBlockDate(e.target.value)} />
          </Field>
          <Field label="Time (blank = all day)" htmlFor="btime">
            <Input
              id="btime"
              placeholder="2:00 PM"
              value={blockTime}
              onChange={(e) => setBlockTime(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Reason (optional)" htmlFor="breason">
          <Input id="breason" value={blockReason} onChange={(e) => setBlockReason(e.target.value)} className="mt-3" />
        </Field>
        <Button type="button" variant="secondary" className="mt-4" onClick={addBlock} disabled={!blockDate}>
          Block this
        </Button>
        <ul className="mt-6 space-y-2">
          {blocks.length === 0 ? (
            <li className="text-sm text-muted">Nothing blocked ahead.</li>
          ) : (
            blocks.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between gap-3 rounded-md bg-bg px-3 py-2 text-sm"
              >
                <span>
                  {formatShortDate(String(b.slot_date).slice(0, 10))}
                  {b.slot_time ? ` · ${formatTime(b.slot_time)}` : " · all day"}
                  {b.reason ? ` — ${b.reason}` : ""}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    await unblockSlot({ data: { id: b.id } });
                    reload();
                  }}
                >
                  Remove
                </Button>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
