# NA Cuts Barber Salon — Multi‑store Booking App

A modern, production-ready barber booking site with multi-store support, services catalog, and admin dashboards (per‑store and master). Customers book 30‑minute slots between 10:00–20:00, pick a service, choose a store, and either select a specific barber or “Οποιοσδήποτε Υπάλληλος” for auto‑assignment.

Live routes (local):
- Public: `GET /`
- Unified admin login: `GET /admin/login`
- Store dashboards: `GET /admin/nikaia`, `GET /admin/aigaleo` (redirects to login when not authenticated)
- Master (all stores): `GET /admin/all` (requires master login)

## Stores and labels

Internal store codes are mapped to address labels everywhere in the UI:
- `Nikaia` → Olympou 11, Nikea 184 54
- `Aigaleo` → Mark. Mpotsari 9, Egaleo 122 41

The app uses the internal codes for logic and sends address labels only for display.

## Key features

- Services catalog grouped by category; selection required to book
- “Οποιοσδήποτε Υπάλληλος” (value `ANY`) barber option
  - Slots show times where at least one barber is free
  - On booking, a free barber is auto‑assigned; if none are free → 409
- 30‑minute slots 10:00–20:00 (last slot 19:30)
- Real‑time availability, per store and barber
- Prevents double‑booking in DB (unique guard) and at the API level
- Multi‑store admin dashboards with session‑based scoping
  - Store admins manage only their store
  - Master admin sees and manages everything
- Admin UI niceties
  - Auto‑refresh on changing store/barber/date filters
  - Create/Edit appointments in a modal (service dropdown included)
  - Status toggle (booked/completed), delete only in master admin
  - Store names in tables/filters use address labels
- Polished UX
  - Brand‑only navbar: “NA Cuts Barber Salon”
  - Services selection is clear, scrollable, and can be toggled off by clicking again
  - After booking, the form and service selection reset; page refresh also clears state

## Requirements

- Node.js 18+
- MongoDB (Atlas or local). If `MONGO_URI` is missing, the app falls back to in‑memory storage (for demo only).

## Setup

1) Install dependencies

```powershell
npm install
```

2) Environment

Create `.env` with the following (adjust values as needed):

```env
MONGO_URI=mongodb+srv://<user>:<pass>@<cluster>/?retryWrites=true&w=majority
MONGO_DB_NAME=appointments-app
PORT=3000

# Sessions
ADMIN_SESSION_SECRET=change-me

# Admin passwords (by behavior)
# Nikaia:  7080616
# Aigaleo: 7080610
# Master:  set ADMIN_MASTER_PASSWORD to override the default 7080619
ADMIN_MASTER_PASSWORD=7080619
```

Notes:
- If `MONGO_URI` is provided, sessions are persisted in MongoDB using `connect-mongo`.
- If `MONGO_URI` is omitted, data and sessions are in memory and will reset on restart (for quick demos).

3) Run

```powershell
npm run dev
```

Open http://localhost:3000

## Quick demo scenarios

### A) Public booking (customer)
1. Go to `http://localhost:3000`
2. Pick a Store (labels are full addresses)
3. Barber: leave the default “Οποιοσδήποτε Υπάλληλος” or choose a specific barber
4. Pick a Date → Time dropdown fills with available slots
5. Select a Service from the Services section
6. Fill Name/Email/Phone and click Book
   - On success you’ll see a success message, the form resets, and the service unselects

Edge cases to try:
- Choose “Οποιοσδήποτε Υπάλληλος”, select a time, then book → a free barber is auto‑assigned
- Try selecting an already booked time → you’ll get a “no longer available” conflict (409)

### B) Admin login (unified)
1. Go to `http://localhost:3000/admin/login`
2. Enter one of the passwords:
   - Nikaia admin: `7080616` → redirects to `/admin/nikaia`
   - Aigaleo admin: `7080610` → redirects to `/admin/aigaleo`
   - Master admin: `7080619` (or `ADMIN_MASTER_PASSWORD`) → redirects to `/admin/all`

Note: Visiting `/admin` while authenticated redirects you to the appropriate dashboard. When unauthenticated (session expired), protected routes redirect to `/admin/login`.

### C) Store admin dashboard (`/admin/nikaia` or `/admin/aigaleo`)
- Filters: Store (locked), Barber, Date
  - Changing any filter auto‑refreshes the table
- Actions per row:
  - Mark done/Undo → toggles status
  - Edit → open modal, change details, pick time from available slots
- Create button → open modal to create a new appointment
- Delete button → not shown for store admins

### D) Master admin dashboard (`/admin/all`)
- Same features as store admin plus:
  - Store filter is unlocked (All stores)
  - Delete button is available in the edit modal
  - Can view/edit/delete across all stores

## Data model

Appointment document fields (conceptual):
- `_id`: string/ObjectId
- `name`, `email`, `phone`
- `date` (YYYY‑MM‑DD), `time` (HH:mm)
- `service` (string)
- `barber` (string)
- `store` ("Nikaia" | "Aigaleo") — missing store defaults to Nikaia for backward compatibility
- `status` ("booked" | "completed" | "cancelled"), default: "booked"
- `createdAt`, `updatedAt`

Slots: generated every 30 minutes from 10:00 to 19:30.

MongoDB uniqueness: the API and DB guard against duplicates (`{ barber, date, time }`).

## Public API

Base path: `/appointments`

- `GET /stores` → `["Nikaia", "Aigaleo"]`
- `GET /services` → grouped by category: `{ "Κούρεμα Αντρικό": [{ id, name, durationMinutes, price }], ... }`
- `GET /barbers?store=Nikaia` → `["…"]`
- `GET /slots?date=YYYY-MM-DD&barber=ANY|Name&store=Nikaia` → `["10:00", "10:30", …]`
- `POST /book`
  - JSON: `{ name, email, phone, date, time, service, barber, store }`
  - `barber: "ANY"` supported → server auto‑assigns a free barber
  - Responses: 200 OK on success, 409 if no longer available, 400 for validation errors

## Admin API (authenticated)

- `GET /appointments/all?date=YYYY-MM-DD&barber=&store=` → lists appointments
  - Store is scoped to session unless master (`ALL`). Master sees all by default
- `PATCH /appointments/:id/status` body: `{ status: "booked"|"completed"|"cancelled" }`
- `PUT /appointments/:id` body: full appointment payload (validation applies)
- `DELETE /appointments/:id` → allowed only for master admin

## Security and sessions

- Sessions use `connect-mongo` when `MONGO_URI` is set (collection: `sessions`, TTL: 7 days)
- Cookies are `httpOnly`, `sameSite=lax`, and `secure` in production
- Unified login at `/admin/login` routes to the correct dashboard based on the password

## Troubleshooting

- Session warning about MemoryStore: fixed by using `connect-mongo` (already configured)
- No times available: ensure Barber and Date are set; for `ANY`, the list shows times where at least one barber is free
- Using in-memory mode: when `MONGO_URI` isn’t set, data resets on restart (for quick demos)

## License

MIT
