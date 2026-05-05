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
  // No Supabase configured — fall back to in-memory. In production this means
  // bookings vanish on cold start, which is fine for a demo deploy. Warn so
  // we don't silently lose data in a "real" prod.
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[storage] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set — running with in-memory storage. " +
        "Bookings will not survive cold starts. Set the env vars in your hosting provider to persist data.",
    );
  } else {
    console.warn(
      "[storage] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set — using in-memory storage.",
    );
  }
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
