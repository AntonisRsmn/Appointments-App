# Barber Shop Booking App

A modern barber shop website with 30-minute appointment booking between 10:00 and 20:00. Choose a barber by name, pick a date, and select an available timeslot.

## Features

- Choose a barber from a predefined list
- 30-minute slots from 10:00–20:00
- Real-time availability per barber/date
- Prevents double-booking
- Works with MongoDB or in-memory fallback (if no DB configured)

## Requirements

- Node.js 18+
- Optional: MongoDB (Atlas or local)

## Setup

1. Install dependencies

```powershell
npm install
```

2. Configure environment (optional but recommended)

Create a `.env` file based on `.env.example` and set your MongoDB connection string.

```env
MONGO_URI=mongodb+srv://<user>:<pass>@<cluster>/<db>?retryWrites=true&w=majority
PORT=3000
```

If `MONGO_URI` is not set, the app will use an in-memory store (data will reset on restart).

3. Run the app

```powershell
npm run dev
```

Open http://localhost:3000

## API

- GET `/appointments/barbers` → `["Alex", "Jordan", "Taylor", "Casey"]`
- GET `/appointments/slots?date=YYYY-MM-DD&barber=Name` → `["10:00", "10:30", ...]`
- POST `/appointments/book`
  - JSON body: `{ name, email, phone, date, time, service, barber }`
  - 409 conflict if slot already booked

## Notes

- Booking validation enforces 30-minute slots within business hours.
- A unique index on `{ barber, date, time }` prevents duplicates when using MongoDB.
