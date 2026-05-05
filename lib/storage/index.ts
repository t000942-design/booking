import { InMemoryBookingRepository, seedDevBookings } from "./memory";
import type { BookingRepository } from "./repository";

/**
 * Singleton repository pinned to globalThis so HMR doesn't clear bookings
 * during dev. Swap the implementation here on Day 2 (Prisma).
 *
 * Bump REPO_VERSION whenever the BookingRepository interface gains methods
 * — that forces a fresh instance on next HMR (otherwise the old globalThis
 * instance is missing the new methods).
 */
const REPO_VERSION = 4;

const g = globalThis as unknown as {
  __bookingRepo?: BookingRepository;
  __bookingRepoVersion?: number;
};

function createRepository(): BookingRepository {
  const repo = new InMemoryBookingRepository();
  if (process.env.NODE_ENV !== "production") {
    seedDevBookings(repo);
  }
  return repo;
}

if (!g.__bookingRepo || g.__bookingRepoVersion !== REPO_VERSION) {
  g.__bookingRepo = createRepository();
  g.__bookingRepoVersion = REPO_VERSION;
}

export const bookingRepository: BookingRepository = g.__bookingRepo;

export type { BookingRepository } from "./repository";
export { SlotUnavailableError } from "./memory";
