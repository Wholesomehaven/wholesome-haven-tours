export const SITE = {
  name: "Wholesome Haven Senior Living",
  shortName: "Wholesome Haven",
  tagline: "A six-bed home in Spring Valley, California",
  addressLine: "10034 View Crest Ct",
  cityLine: "Spring Valley, CA 91977",
  address: "10034 View Crest Ct, Spring Valley, CA 91977",
  mapsUrl:
    "https://www.google.com/maps/search/?api=1&query=10034+View+Crest+Ct,+Spring+Valley,+CA+91977",
  phone: "(619) 759-5747",
  phoneHref: "tel:+16197595747",
  email: "admin@wholesomehavensd.com",
  emailHref: "mailto:admin@wholesomehavensd.com",
  website: "https://wholesomehavensd.com",
  timezone: "America/Los_Angeles",
  adminEmail: "admin@wholesomehavensd.com",
} as const;

export const RELATIONSHIPS = [
  { value: "adult-child", label: "Adult child" },
  { value: "spouse", label: "Spouse / partner" },
  { value: "family", label: "Other family" },
  { value: "friend", label: "Friend" },
  { value: "professional", label: "Care professional" },
  { value: "self", label: "Prospective resident" },
] as const;

export const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];
