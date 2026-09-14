export const SITE = {
  name: "Wholesome Haven Senior Living",
  shortName: "Wholesome Haven",
  tagline: "A six-bed home in Spring Valley, California",
  addressLine: "10034 View Crest Ct",
  cityLine: "Spring Valley, CA 91977",
  address: "10034 View Crest Ct, Spring Valley, CA 91977",
  mapsUrl:
    "https://www.google.com/maps/search/?api=1&query=10034+View+Crest+Ct,+Spring+Valley,+CA+91977",
  phone: "(818) 749-6701",
  phoneHref: "tel:+18187496701",
  email: "admin@wholesomehavensd.com",
  emailHref: "mailto:admin@wholesomehavensd.com",
  website: "https://wholesomehavensd.com",
  tourAppUrl: "https://tours.wholesomehavensd.com",
  tourDeskUrl: "https://tours.wholesomehavensd.com/admin",
  instagramUrl: "https://www.instagram.com/wholesomehavenseniorliving/",
  facebookUrl: "https://www.facebook.com/WholesomeHavenSeniorLiving?mibextid=ZbWKwL",
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
