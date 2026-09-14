import { SITE } from "./site";
import { appleCalendarUrl, googleCalendarUrl } from "./calendar";
import { sendStaffMailSafe } from "./mail.server";
import { formatLongDate, formatTime } from "./time";

type MailBooking = {
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  partySize: number;
  residentName: string | null;
  notes: string | null;
  tourDate: string;
  tourTime: string;
  tourMinutes?: number;
};

function wrap(title: string, body: string): string {
  return `
    <div style="font-family:Georgia,serif;background:#fbfaf6;padding:24px;color:#3d3a32">
      <p style="margin:0 0 8px;letter-spacing:0.16em;font-size:11px;text-transform:uppercase;color:#5a7344">${SITE.shortName}</p>
      <h1 style="font-size:22px;color:#5a7344;margin:0 0 16px">${title}</h1>
      ${body}
      <p style="margin:24px 0 0;font-size:13px;color:#7a7568">${SITE.address}<br>${SITE.phone} · ${SITE.email}</p>
    </div>
  `;
}

function when(booking: Pick<MailBooking, "tourDate" | "tourTime">): string {
  return `${formatLongDate(booking.tourDate)} at ${formatTime(booking.tourTime)}`;
}

function calendarEvent(booking: MailBooking) {
  return {
    tourDate: booking.tourDate,
    tourTime: booking.tourTime,
    tourMinutes: booking.tourMinutes ?? 45,
    guestName: booking.guestName,
  };
}

function calendarLinks(booking: MailBooking): string {
  const event = calendarEvent(booking);
  return `<p style="margin:16px 0 0">
    <a href="${googleCalendarUrl(event)}" style="color:#5a7344">Add to Google Calendar</a>
    &nbsp;·&nbsp;
    <a href="${appleCalendarUrl(event)}" style="color:#5a7344">Add to iPhone / Apple Calendar</a>
  </p>`;
}

export async function notifyBookingCreated(booking: MailBooking) {
  const whenText = when(booking);
  const guestLines = `
      <p style="margin:0 0 12px">Thank you, ${booking.guestName}. We received your private tour request.</p>
      <p style="margin:0 0 12px"><strong>${whenText}</strong></p>
      <p style="margin:0 0 12px">Our team will review this and email you when it is confirmed. If you need to change anything, call ${SITE.phone}.</p>
      ${calendarLinks(booking)}
  `;
  await sendStaffMailSafe({
    to: booking.guestEmail,
    subject: `We received your tour request — ${SITE.shortName}`,
    text: `Thank you, ${booking.guestName}. We received your private tour request for ${whenText}. We will email you when it is confirmed. Call ${SITE.phone} with questions.`,
    html: wrap("Tour request received", guestLines),
  });

  const adminLines = `
      <p style="margin:0 0 12px">A family requested a private tour.</p>
      <p style="margin:0 0 8px"><strong>${whenText}</strong></p>
      <p style="margin:0 0 4px">${booking.guestName} · ${booking.guestEmail} · ${booking.guestPhone}</p>
      <p style="margin:0 0 4px">Party of ${booking.partySize}${booking.residentName ? ` · Resident: ${booking.residentName}` : ""}</p>
      ${booking.notes ? `<p style="margin:12px 0 0">${booking.notes}</p>` : ""}
      <p style="margin:16px 0 0"><a href="${SITE.website.replace(/\/$/, "")}/book-admin" style="color:#5a7344">Open tour desk</a></p>
  `;
  await sendStaffMailSafe({
    to: SITE.adminEmail,
    subject: `New tour request: ${booking.guestName} — ${whenText}`,
    text: `New tour request from ${booking.guestName} (${booking.guestEmail}, ${booking.guestPhone}) for ${whenText}. Party of ${booking.partySize}.`,
    html: wrap("New tour request", adminLines),
  });
}

export async function notifyBookingStatus(
  booking: MailBooking,
  status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show",
) {
  const whenText = when(booking);
  if (status === "confirmed") {
    await sendStaffMailSafe({
      to: booking.guestEmail,
      subject: `Your tour is confirmed — ${SITE.shortName}`,
      text: `Hi ${booking.guestName}, your private tour is confirmed for ${whenText}. ${SITE.address}. Call ${SITE.phone} if plans change.`,
      html: wrap(
        "Your tour is confirmed",
        `<p style="margin:0 0 12px">Hi ${booking.guestName}, we look forward to welcoming you.</p>
         <p style="margin:0 0 12px"><strong>${whenText}</strong></p>
         <p style="margin:0 0 12px">${SITE.address}</p>
         ${calendarLinks(booking)}
         <p style="margin:16px 0 0">Please call ${SITE.phone} if you need to reschedule.</p>`,
      ),
    });
    return;
  }
  if (status === "cancelled") {
    await sendStaffMailSafe({
      to: booking.guestEmail,
      subject: `Tour cancelled — ${SITE.shortName}`,
      text: `Hi ${booking.guestName}, the private tour requested for ${whenText} has been cancelled. Call ${SITE.phone} to book another time.`,
      html: wrap(
        "Tour cancelled",
        `<p style="margin:0 0 12px">Hi ${booking.guestName}, the private tour requested for <strong>${whenText}</strong> has been cancelled.</p>
         <p style="margin:0">Call ${SITE.phone} if you would like to choose another time.</p>`,
      ),
    });
  }
}
