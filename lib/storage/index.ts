import { InMemoryBookingRepository, seedDevBookings } from "./memory";
import type { BookingRepository } from "./repository";
import { SupabaseBookingRepository } from "./supabase";

/**
 * Singleton repository pinned to globalThis so HMR doesn't clear bookings
 * during dev. Picks Supabase when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 * are set; otherwise falls back to in-memory (dev only — production fails
 * loudly if env vars are missing).
 *
 * Bump REPO_VERSION whenever the BookingRepository interface gains methods
 * — that forces a fresh instance on next HMR.
 */
const REPO_VERSION = 6;

const g = globalThis as unknown as {
  __bookingRepo?: BookingRepository;
  __bookingRepoVersion?: number;
};

function createRepository(): BookingRepository {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return new SupabaseBookingRepository();
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "[storage] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in production.",
    );
  }
  console.warn(
    "[storage] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set — using in-memory storage.",
  );
  const repo = new InMemoryBookingRepository();
  seedDevBookings(repo);
  return repo;
}

if (!g.__bookingRepo || g.__bookingRepoVersion !== REPO_VERSION) {
  g.__bookingRepo = createRepository();
  g.__bookingRepoVersion = REPO_VERSION;
}

export const bookingRepository: BookingRepository = g.__bookingRepo;

export type { BookingRepository } from "./repository";
export { SlotUnavailableError } from "./memory";
