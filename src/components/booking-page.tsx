import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  Clock,
  Leaf,
  MapPin,
  Phone,
  Users,
} from "lucide-react";
import {
  createBooking,
  getMonthAvailability,
  getPublicConfig,
  getSlotsForDate,
} from "@/lib/bookings";
import { RELATIONSHIPS, SITE } from "@/lib/site";
import { appleCalendarHref, googleCalendarUrl } from "@/lib/calendar";
import { formatLongDate, formatTime, todayInFacility } from "@/lib/time";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { SocialFollow } from "./social-follow";
import { BookingCalendar } from "./booking-calendar";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

type Slot = { time: string; open: boolean };
type Confirmed = {
  id: number;
  tourDate: string;
  tourTime: string;
  guestName: string;
  tourMinutes: number;
};

const HIGHLIGHTS = [
  {
    img: "/images/living-room.png",
    title: "The living room",
    copy: "Fireplace, piano, and a quiet place to sit together.",
  },
  {
    img: "/images/bedroom.jpg",
    title: "Private bedrooms",
    copy: "Warm, residential rooms — not a hospital corridor.",
  },
  {
    img: "/images/exterior.png",
    title: "The garden & house",
    copy: "A six-bed home on a quiet Spring Valley court.",
  },
];

export function BookingPage() {
  const initial = todayInFacility();
  const [year, setYear] = useState(() => Number(initial.slice(0, 4)));
  const [month, setMonth] = useState(() => Number(initial.slice(5, 7)));
  const [availability, setAvailability] = useState<Record<string, number>>({});
  const [tourMinutes, setTourMinutes] = useState(45);
  const [maxParty, setMaxParty] = useState(6);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [loadingMonth, setLoadingMonth] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Confirmed | null>(null);

  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [relationship, setRelationship] = useState("");
  const [residentName, setResidentName] = useState("");
  const [notes, setNotes] = useState("");
  const [smsOptIn, setSmsOptIn] = useState(false);

  useEffect(() => {
    getPublicConfig()
      .then((c) => {
        setTourMinutes(c.tourMinutes);
        setMaxParty(c.maxPartySize);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingMonth(true);
    getMonthAvailability({ data: { year, month } })
      .then((res) => {
        if (cancelled) return;
        const map: Record<string, number> = {};
        for (const d of res.days) map[d.date] = d.open;
        setAvailability(map);
        setTourMinutes(res.settings.tourMinutes);
        setMaxParty(res.settings.maxPartySize);
      })
      .catch(() => {
        if (!cancelled) setAvailability({});
      })
      .finally(() => {
        if (!cancelled) setLoadingMonth(false);
      });
    return () => {
      cancelled = true;
    };
  }, [year, month]);

  useEffect(() => {
    if (!selectedDate) {
      setSlots([]);
      setSelectedTime(null);
      return;
    }
    let cancelled = false;
    setLoadingSlots(true);
    setSelectedTime(null);
    getSlotsForDate({ data: { date: selectedDate } })
      .then((res) => {
        if (cancelled) return;
        setSlots(res.slots);
        setTourMinutes(res.tourMinutes);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  const canSubmit = useMemo(() => {
    return Boolean(
      selectedDate &&
        selectedTime &&
        guestName.trim().length >= 2 &&
        guestEmail.includes("@") &&
        guestPhone.replace(/\D/g, "").length >= 10 &&
        !submitting,
    );
  }, [selectedDate, selectedTime, guestName, guestEmail, guestPhone, submitting]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDate || !selectedTime) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await createBooking({
        data: {
          guestName: guestName.trim(),
          guestEmail: guestEmail.trim(),
          guestPhone: guestPhone.trim(),
          partySize,
          relationship: relationship || undefined,
          residentName: residentName.trim() || undefined,
          notes: notes.trim() || undefined,
          smsOptIn,
          tourDate: selectedDate,
          tourTime: selectedTime,
        },
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setConfirmed(res.booking);
    } catch {
      setError("Something went wrong. Please call us and we’ll save your visit.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg text-fg">
      <SiteHeader />
      <main>
        <section className="relative isolate min-h-[28rem] overflow-hidden sm:min-h-[32rem]">
          <img
            src="/images/exterior.png"
            alt="Wholesome Haven, a six-bed home in Spring Valley"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-fg/80 via-fg/45 to-fg/20" />
          <div className="relative mx-auto flex min-h-[28rem] max-w-6xl flex-col justify-end px-4 py-12 sm:min-h-[32rem] sm:px-6 sm:py-16">
            <p className="text-xs tracking-[0.22em] text-primary-fg/80 uppercase">
              Spring Valley, California
            </p>
            <h1 className="font-display mt-3 max-w-xl text-4xl leading-tight text-primary-fg sm:text-5xl md:text-6xl">
              Book a private tour
            </h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-primary-fg/85 sm:text-lg">
              Walk our six-bed home, sit in the living room, and meet the people
              who will care for your family.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div>
              <p className="text-xs tracking-[0.2em] text-primary uppercase">A visit, not a sales pitch</p>
              <h2 className="font-display mt-2 text-3xl sm:text-4xl">What you’ll see</h2>
              <p className="mt-4 max-w-prose text-[1.05rem] leading-relaxed text-muted">
                At Wholesome Haven, your loved one isn’t just another resident —
                they’re part of our family. Our holistic approach blends
                whole-food nutrition, meaningful activities, and professional
                care. You get to be their son or daughter again.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  { icon: Leaf, t: "Forty-five quiet minutes", d: "A private walkthrough of the house, garden, and bedrooms." },
                  { icon: Users, t: "Meet the care team", d: "Ask about availability, daily rhythm, and a care plan." },
                  { icon: MapPin, t: "On a quiet court", d: SITE.address },
                ].map((item) => (
                  <li key={item.t} className="flex gap-3">
                    <item.icon className="mt-0.5 size-5 shrink-0 text-primary" />
                    <div>
                      <p className="font-medium">{item.t}</p>
                      <p className="text-sm leading-relaxed text-muted">{item.d}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {HIGHLIGHTS.map((h) => (
                <figure key={h.title} className="overflow-hidden rounded-lg bg-bg-warm">
                  <img src={h.img} alt={h.title} className="h-36 w-full object-cover sm:h-48" />
                  <figcaption className="hidden p-3 sm:block">
                    <p className="text-sm font-medium">{h.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted">{h.copy}</p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section id="book" className="border-y border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <div className="mb-8 max-w-2xl">
              <p className="text-xs tracking-[0.2em] text-primary uppercase">Reserve a time</p>
              <h2 className="font-display mt-2 text-3xl sm:text-4xl">Choose a day for your tour</h2>
              <p className="mt-3 text-muted">
                Tours last about {tourMinutes} minutes. We’ll confirm by phone or email.
              </p>
            </div>

            {confirmed ? (
              <Confirmation card={confirmed} onReset={() => setConfirmed(null)} />
            ) : (
              <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
                <div className="rounded-xl border border-border bg-bg p-4 sm:p-6">
                  {loadingMonth ? (
                    <div className="h-72 animate-pulse rounded-lg bg-bg-warm" />
                  ) : (
                    <BookingCalendar
                      year={year}
                      month={month}
                      selected={selectedDate}
                      availability={availability}
                      onSelect={setSelectedDate}
                      onMonthChange={(y, m) => {
                        setYear(y);
                        setMonth(m);
                      }}
                    />
                  )}
                  <p className="mt-4 text-xs text-muted">
                    Days with a sage dot have an open time. We typically host
                    Monday–Saturday.
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-bg p-4 sm:p-6">
                  {!selectedDate ? (
                    <div className="flex h-full min-h-56 flex-col items-center justify-center text-center">
                      <CalendarDays className="size-8 text-primary" />
                      <p className="mt-3 font-medium">Select a date to see times</p>
                      <p className="mt-1 max-w-xs text-sm text-muted">
                        Open days are marked on the calendar.
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs tracking-[0.16em] text-muted uppercase">Times</p>
                      <h3 className="font-display mt-1 text-2xl">{formatLongDate(selectedDate)}</h3>
                      {loadingSlots ? (
                        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="h-11 animate-pulse rounded-md bg-bg-warm" />
                          ))}
                        </div>
                      ) : (
                        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {slots.map((s) => (
                            <button
                              key={s.time}
                              type="button"
                              disabled={!s.open}
                              onClick={() => setSelectedTime(s.time)}
                              className={`h-11 rounded-md border text-sm transition-colors duration-150 ${
                                selectedTime === s.time
                                  ? "border-primary bg-primary text-primary-fg"
                                  : s.open
                                    ? "border-border bg-surface hover:border-primary"
                                    : "cursor-not-allowed border-border/60 text-muted/40"
                              }`}
                            >
                              {formatTime(s.time)}
                            </button>
                          ))}
                          {slots.every((s) => !s.open) ? (
                            <p className="col-span-full text-sm text-muted">
                              No remaining times this day. Please pick another.
                            </p>
                          ) : null}
                        </div>
                      )}

                      {selectedTime ? (
                        <form className="mt-8 space-y-4" onSubmit={onSubmit}>
                          <div className="flex items-center gap-2 text-sm text-primary">
                            <Clock className="size-4" />
                            {formatTime(selectedTime)} · {tourMinutes} minutes
                          </div>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <Field label="Your name" htmlFor="name">
                              <Input
                                id="name"
                                required
                                autoComplete="name"
                                value={guestName}
                                onChange={(e) => setGuestName(e.target.value)}
                              />
                            </Field>
                            <Field label="Email" htmlFor="email">
                              <Input
                                id="email"
                                type="email"
                                required
                                autoComplete="email"
                                value={guestEmail}
                                onChange={(e) => setGuestEmail(e.target.value)}
                              />
                            </Field>
                            <Field label="Phone" htmlFor="phone">
                              <Input
                                id="phone"
                                type="tel"
                                required
                                autoComplete="tel"
                                value={guestPhone}
                                onChange={(e) => setGuestPhone(e.target.value)}
                              />
                            </Field>
                            <Field label="Guests on the tour" htmlFor="party">
                              <select
                                id="party"
                                className="flex h-11 w-full rounded-md border border-border bg-surface px-3 text-base"
                                value={partySize}
                                onChange={(e) => setPartySize(Number(e.target.value))}
                              >
                                {Array.from({ length: maxParty }, (_, i) => i + 1).map((n) => (
                                  <option key={n} value={n}>
                                    {n}
                                  </option>
                                ))}
                              </select>
                            </Field>
                            <Field label="You are the…" htmlFor="rel">
                              <select
                                id="rel"
                                className="flex h-11 w-full rounded-md border border-border bg-surface px-3 text-base"
                                value={relationship}
                                onChange={(e) => setRelationship(e.target.value)}
                              >
                                <option value="">Select</option>
                                {RELATIONSHIPS.map((r) => (
                                  <option key={r.value} value={r.value}>
                                    {r.label}
                                  </option>
                                ))}
                              </select>
                            </Field>
                            <Field label="Loved one’s name (optional)" htmlFor="resident">
                              <Input
                                id="resident"
                                value={residentName}
                                onChange={(e) => setResidentName(e.target.value)}
                              />
                            </Field>
                          </div>
                          <Field label="Anything we should know?" htmlFor="notes">
                            <Textarea
                              id="notes"
                              rows={3}
                              value={notes}
                              onChange={(e) => setNotes(e.target.value)}
                              placeholder="Accessibility needs, questions about memory care, preferred language…"
                            />
                          </Field>
                          <label className="flex items-start gap-3 text-sm leading-relaxed text-muted">
                            <input
                              type="checkbox"
                              className="mt-1 size-4 accent-primary"
                              checked={smsOptIn}
                              onChange={(e) => setSmsOptIn(e.target.checked)}
                            />
                            I agree to receive appointment reminders by text. Message and data rates may apply.
                          </label>
                          {error ? <p className="text-sm text-danger">{error}</p> : null}
                          <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={!canSubmit}>
                            {submitting ? "Sending…" : "Request this tour"}
                          </Button>
                        </form>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="grid gap-8 rounded-xl bg-primary-dark px-6 py-10 text-primary-fg sm:grid-cols-2 sm:px-10">
            <div>
              <h2 className="font-display text-3xl">Prefer to talk first?</h2>
              <p className="mt-3 max-w-sm text-primary-fg/80">
                Call the house. We’ll help you find a time that works for your family.
              </p>
            </div>
            <div className="flex flex-col justify-center gap-3 sm:items-end">
              <a
                href={SITE.phoneHref}
                className="inline-flex h-12 items-center gap-2 rounded-md bg-surface px-5 font-medium text-fg hover:bg-bg"
              >
                <Phone className="size-4" />
                {SITE.phone}
              </a>
              <p className="text-sm text-primary-fg/70">Usually answered 8 a.m. – 6 p.m. Pacific</p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
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

function Confirmation({ card, onReset }: { card: Confirmed; onReset: () => void }) {
  return (
    <div className="rise-in mx-auto max-w-xl rounded-xl border border-border bg-bg p-6 sm:p-10">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Check className="size-6" />
      </div>
      <h3 className="font-display mt-4 text-3xl">Your tour is requested</h3>
      <p className="mt-3 text-muted">
        Thank you, {card.guestName}. We’ll confirm this visit by phone or email.
      </p>
      <dl className="mt-6 space-y-2 text-sm">
        <div className="flex justify-between gap-4 border-b border-border py-2">
          <dt className="text-muted">Date</dt>
          <dd>{formatLongDate(card.tourDate)}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-border py-2">
          <dt className="text-muted">Time</dt>
          <dd>
            {formatTime(card.tourTime)} · {card.tourMinutes} min
          </dd>
        </div>
        <div className="flex justify-between gap-4 py-2">
          <dt className="text-muted">Where</dt>
          <dd className="text-right">{SITE.address}</dd>
        </div>
      </dl>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button type="button" asChild>
          <a href={googleCalendarUrl(card)} target="_blank" rel="noreferrer">
            <CalendarDays className="size-4" />
            Google Calendar
          </a>
        </Button>
        <Button type="button" variant="secondary" asChild>
          <a href={appleCalendarHref(card)}>
            <CalendarDays className="size-4" />
            iPhone / Apple
          </a>
        </Button>
        <Button type="button" variant="secondary" asChild>
          <a href={SITE.mapsUrl} target="_blank" rel="noreferrer">
            Directions
          </a>
        </Button>
        <Button type="button" variant="ghost" onClick={onReset}>
          Book another
        </Button>
      </div>
      <p className="mt-3 text-xs text-muted">
        Google opens a Save screen. On iPhone, tap Add Event when Calendar opens.
      </p>
      <div className="mt-8">
        <SocialFollow />
      </div>
      <p className="mt-6 text-xs text-muted">Requested {todayInFacility()} · Reference #{card.id}</p>
    </div>
  );
}
