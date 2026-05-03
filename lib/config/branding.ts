/**
 * Kick Off — single source of truth for the business identity.
 * On Day 2 we move this to a Settings table; the shape stays.
 */
export const branding = {
  pitchName: "Kick Off",
  bookingPrefix: "KO",
  tagline: "7-a-side. Floodlit. Salmiya.",
  ownerName: "Mohamad N",
  ownerPhone: "+965 9000 0000",
  ownerEmail: "owner@kickoff.kw",
  /** Admin sign-in: any of these phone numbers are allowed.
   *  Day 2: replace with DB-backed AdminUser + OTP verification. */
  adminPhones: ["+96590000000", "90000000"] as readonly string[],
  location: "Salmiya, Kuwait",
  /** Three independent pitches — each can be booked at the same time slot. */
  pitches: ["Pitch 1", "Pitch 2", "Pitch 3"] as readonly string[],
  currency: "KWD",
  priceFils: 25_000,
  openingHour: 15,
  closingHour: 23,
  slotMinutes: 60,
  timezone: "Asia/Kuwait",
  brand: {
    primary: "#16a34a",
    primaryDark: "#052e16",
  },
} as const;

export type Branding = typeof branding;
