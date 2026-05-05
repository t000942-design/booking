# Kick Off

A football-pitch booking app for **Kick Off**, a 7-a-side venue in Salmiya, Kuwait,
run by Mohamad N. Three pitches, hourly slots from 15:00 to 23:00, KWD 25/slot.

Built as a proper Next.js 16 server (App Router + server actions + `/api`
route handlers + Tailwind 4).

> **Day 1 scope.** Real database, real payments, and real SMS are intentionally
> out of scope for this commit and will be added next. The architecture is
> already shaped to accept all three without a rewrite.

## Features

### Customer flow
- Single sign-in / sign-up screen at `/` (phone, plus name on sign-up)
- 7-day calendar at `/book` — every day shows all 3 pitches with all timings
- Confirmation page at `/booking/[ref]` with the booking code
- Animated soccer-pitch background: mowed stripes, field markings, corner
  floodlights, top/bottom goals, bouncing ball — respects
  `prefers-reduced-motion`

### Admin flow
- Sign in with the owner number (`90000000` by default → straight to `/admin`)
- Today's schedule split per pitch: open / booked / blocked
- Mark booking done · cancel · refund (full or 50%)
- Block any open slot · unblock any blocked slot

### HTTP surface (`/api/*`)
```
GET  /api/health
GET  /api/auth/session
POST /api/auth/sign-in        { phone }
POST /api/auth/sign-up        { phone, name }
POST /api/auth/sign-out
GET  /api/availability        ?date=YYYY-MM-DD&pitch=...
GET  /api/bookings            ?date=YYYY-MM-DD          (admin only)
POST /api/bookings            { customerName, date, hour, pitch, ... }
GET  /api/bookings/:ref
PATCH /api/bookings/:ref      { status: "DONE" | "CANCELLED" }   (admin only)
DELETE /api/bookings/:ref                                         (admin only)
```

## Stack

- **Next.js 16** (App Router, Turbopack)
- **React 19** server components + server actions
- **TypeScript** strict
- **Tailwind 4** (CSS-first theme via `@theme`)
- **Zod** for input validation
- **date-fns-tz** for venue-local time (Asia/Kuwait)
- **nanoid** for booking refs (`KO-XXXXXX`)

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

- Customer side: enter any phone number (e.g. `66666666`) → land on `/book`.
- Admin side: enter `90000000` → land on `/admin`.

The app uses an in-memory store for Day 1, so bookings reset when the dev
server restarts. That is on purpose.

## Deploying

The fastest path is **Vercel**:

1. Sign in to https://vercel.com with GitHub.
2. *Add New… → Project → Import* this repo (`t000942-design/booking`).
3. Accept all the defaults and click *Deploy*.

You will get a live URL like `kickoff-xyz.vercel.app`. The URL can then go in
the GitHub repo's "About → Website" field so it appears on the landing page.

> Heads up: bookings still vanish when the serverless container is recycled,
> because we are still on the in-memory store. The next commit moves storage
> to Prisma + a hosted DB.

## Project layout

```
app/
  (public)/                  Customer-facing routes
    layout.tsx               Pitch background, brand header, footer
    page.tsx                 Sign in / sign up
    book/page.tsx            Calendar (7 days x 3 pitches)
    booking/[ref]/page.tsx   Confirmation
  admin/
    layout.tsx               Admin shell (requires owner session)
    page.tsx                 Today's schedule, all 3 pitches
  api/
    auth/                    sign-in, sign-up, sign-out, session
    availability/route.ts
    bookings/                list / create / patch / delete
    health/route.ts
components/
  Brand.tsx, PitchScene.tsx
  ui/                        Button, Input, Textarea, Field, Badge
lib/
  config/branding.ts         Single source of truth for the business
  domain/                    Pure types, slot generation, validation
  storage/                   BookingRepository interface + in-memory impl
  services/bookings.ts       Booking lifecycle
  server/                    Server actions for forms
  auth/                      Phone normalization, session cookie, OTP stub
```

The seam between `services/` and `storage/` is the swap point. To move to
Prisma on Day 2: implement `BookingRepository` against Prisma, change the
single export in `lib/storage/index.ts`, ship.
