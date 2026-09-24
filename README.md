# CampQueue

A token-based digital queue and appointment management system for health camps — built as a VTU project (VTU/PCC-PEC-O).

Patients register (walk-in or pre-booked slot), get a live-updating token with an estimated wait, and are called station-by-station (screening → general → pharmacy, plus standalone eye/dental) through a public display board and SMS. Staff and organisers get a console for calling/serving patients and an admin dashboard for setup, analytics, and CSV export.

## Tech stack

- **Next.js 16** (App Router, React 19) + TypeScript
- **Tailwind CSS v4** — custom design system (see `src/app/globals.css`)
- **Drizzle ORM + better-sqlite3** — file-based SQLite, WAL mode, zero external DB to run
- **Zod** for validation
- **Server-Sent Events** for live queue/token updates (no websocket server needed)
- **qrcode.react** for the entrance/poster QR code
- Signed-cookie PIN auth for staff/admin (no external auth provider)
- Pluggable SMS notifier: `console` (logs to server, default) or `twilio`
- English / Kannada / Hindi UI and SMS text
- **Vitest** + Testing Library — 58 tests (pure logic, service layer, UI/SSE)

## Getting started

```bash
npm install
cp .env.example .env.local     # then edit PINs / AUTH_SECRET
npm run db:seed                # creates data/campqueue.db with a demo camp
npm run dev                    # http://localhost:3000
```

Demo camp after seeding: slug `demo`, staff PIN `1234`, admin PIN `9999`.

- Public registration: `/c/demo`
- Token tracker: link is generated per token (`/t/<publicId>`)
- Display board (put this on a TV): `/display/demo`
- Staff console: `/staff/demo` (PIN login at `/login`)
- Admin dashboard: `/admin/demo`

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Run the Vitest suite |
| `npm run db:generate` | Regenerate Drizzle migrations after a schema change |
| `npm run db:seed` | Seed a demo camp with sample patients |

## Environment variables

See `.env.example`. Key ones:

- `DATABASE_PATH` — SQLite file location
- `STAFF_PIN` / `ADMIN_PIN` — sign-in PINs (change before real use)
- `AUTH_SECRET` — random secret used to sign the session cookie
- `NEXT_PUBLIC_BASE_URL` — used to build QR codes and SMS links
- `SMS_PROVIDER` — `console` or `twilio` (plus `TWILIO_*` vars if using Twilio)

For a Docker build with standalone output, set `BUILD_STANDALONE=1` at build time.

## Project structure

```
src/
  lib/
    db/          Drizzle schema + connection/migration
    queue/        engine.ts (pure queue logic), service.ts (business logic),
                   presets.ts (camp templates), index.ts (singleton)
    events.ts     in-process pub/sub feeding the SSE streams
    notify.ts     SMS notifier (console/Twilio)
    i18n.ts       English/Kannada/Hindi strings
    auth.ts       signed-cookie session handling
    guard.ts      server-side route protection
    http.ts       API route helpers (error handling, rate limiting, SSE)
    validators.ts Zod schemas
  components/     RegisterForm, TokenTracker, DisplayBoard, StaffConsole,
                   AdminCamp, LoginForm, LangSwitch, PosterView, live.tsx (SSE hook)
  app/            pages + API routes (see npm run build output for the full route list)
scripts/seed.ts   demo data
drizzle/          generated SQL migrations
tests/            engine.test.ts, service.test.ts, ui.test.tsx
```

## How the queue logic works (short version)

- Each **station** (screening, general, pharmacy, eye, dental) has its own FIFO queue, ordered by priority rank then arrival.
- **Priority**: emergency (desk-only, can't self-select) > senior citizen (auto-detected, 60+) > pre-booked slot > walk-in.
- Completing a station can **forward** a patient to the next station in a camp's flow (e.g. screening → general → pharmacy), with loop prevention.
- **No-shows** get one automatic requeue before being marked missed.
- Wait-time estimates use a rolling weighted average of each station's actual service time.
- `anonymiseCamp` strips patient PII after a camp ends, for privacy-conscious record-keeping — useful to mention in your report as a deliberate design decision.

## Notes for the VTU report

This build deliberately favours boring, well-understood tech over hype: SQLite instead of a hosted DB (no infra to explain or fail during a demo), SSE instead of websockets (simpler, sufficient for one-way live updates), and a pure `engine.ts` module so the core queueing algorithm can be unit-tested and explained independently of the framework. Happy to help turn this into an architecture diagram, ER diagram, or a written report/abstract next.
