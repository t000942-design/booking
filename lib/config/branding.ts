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
  /** One photo per pitch, shown under that pitch's calendar on /book.
   *  Replace with your own URLs / static imports. */
  pitchPhotos: {
    "Pitch 1":
      "https://images.unsplash.com/photo-1551958219-acbc608c6377?auto=format&fit=crop&w=1200&q=70",
    "Pitch 2":
      "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1200&q=70",
    "Pitch 3":
      "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=1200&q=70",
  } as Record<string, string>,
  pitchTaglines: {
    "Pitch 1": "Main pitch · floodlit",
    "Pitch 2": "Indoor astroturf · all-weather",
    "Pitch 3": "Outdoor pitch · sunset side",
  } as Record<string, string>,
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
