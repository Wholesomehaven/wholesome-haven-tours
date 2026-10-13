import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";

/** Extra tour-desk login. It opens the same owner desk as the admin email. */
export const DEFAULT_STAFF_USERNAME = "whstaff";
const STAFF_PASSWORD_SALT = "wh-tours-whstaff-v1";
const STAFF_PASSWORD_FALLBACK_HASH = Buffer.from(
  "4ee04cb11bc060a33f3d528df417be93f40417b60391706843bfe058461a3282",
  "hex",
);

function stripSecret(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/^['"]|['"]$/g, "");
}

export function staffUsername() {
  return (process.env.STAFF_USERNAME?.trim().toLowerCase() || DEFAULT_STAFF_USERNAME);
}

function equalSecret(left: string, right: string) {
  const key = process.env.BETTER_AUTH_SECRET || "wh-tours-staff-compare";
  const digest = (value: string) => createHmac("sha256", key).update(value).digest();
  return timingSafeEqual(digest(left), digest(right));
}

export function staffPasswordMatches(password: string) {
  const configured = stripSecret(process.env.STAFF_PASSWORD);
  if (configured) return equalSecret(password, configured);
  const hashed = scryptSync(password, STAFF_PASSWORD_SALT, 32);
  return hashed.length === STAFF_PASSWORD_FALLBACK_HASH.length && timingSafeEqual(hashed, STAFF_PASSWORD_FALLBACK_HASH);
}

export function staffCredentialsMatch(username: string, password: string) {
  return equalSecret(username.trim().toLowerCase(), staffUsername()) && staffPasswordMatches(password);
}
