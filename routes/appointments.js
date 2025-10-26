const express = require('express');
const router = express.Router();
const Appointment = require('../models/appointment');

// Config: Available barbers and business hours
const BARBERS = [
  'Νίκος Ανδρεάκος',
  'Στέλιος Καρλαφτόπουλος',
  'Γιώργος Μαχαίρας',
  'Δημήτρης Ξάφης'
];
const OPEN_HOUR = 10; // 10:00
const CLOSE_HOUR = 20; // 20:00 (last slot starts at 19:30)
const SLOT_MINUTES = 30;

const useMemoryStore = !process.env.MONGO_URI;
const memoryAppointments = [];
let memoryIdCounter = 1;

function generateSlots() {
  const slots = [];
  for (let h = OPEN_HOUR; h < CLOSE_HOUR; h++) {
    for (let m = 0; m < 60; m += SLOT_MINUTES) {
      const hh = `${h}`.padStart(2, '0');
      const mm = `${m}`.padStart(2, '0');
      slots.push(`${hh}:${mm}`);
    }
  }
  return slots;
}

function isValidSlot(time) {
  return generateSlots().includes(time);
}

function validatePayload({ name, email, phone, date, time, service, barber }) {
  if (!name || !email || !phone || !date || !time || !service || !barber) {
    return 'Missing required fields';
  }
  if (!BARBERS.includes(barber)) {
    return 'Invalid barber';
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return 'Invalid date format';
  }
  if (!/^\d{2}:\d{2}$/.test(time) || !isValidSlot(time)) {
    return 'Invalid time slot';
  }
  return null;
}

async function getAppointmentsByDateBarber(date, barber) {
  if (useMemoryStore) {
    return memoryAppointments.filter(a => a.date === date && a.barber === barber);
  }
  return Appointment.find({ date, barber }).lean();
}

async function isSlotAvailable(date, time, barber) {
  if (useMemoryStore) {
    return !memoryAppointments.some(a => a.date === date && a.time === time && a.barber === barber);
  }
  const existing = await Appointment.findOne({ date, time, barber }).lean();
  return !existing;
}

// GET list of barbers
router.get('/barbers', (req, res) => {
  res.json(BARBERS);
});

// GET available slots for a date and barber
router.get('/slots', async (req, res) => {
  try {
    const { date, barber } = req.query;
    if (!date || !barber) {
      return res.status(400).json({ error: 'date and barber are required' });
    }
    if (!BARBERS.includes(barber)) {
      return res.status(400).json({ error: 'Invalid barber' });
    }

    const allSlots = generateSlots();
    const appts = await getAppointmentsByDateBarber(date, barber);
    const booked = new Set(appts.map(a => a.time));
    const available = allSlots.filter(s => !booked.has(s));
    res.json(available);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch slots' });
  }
});

// POST book an appointment
router.post('/book', async (req, res) => {
  try {
    const error = validatePayload(req.body || {});
    if (error) return res.status(400).send(error);

    const { name, email, phone, date, time, service, barber } = req.body;

    const available = await isSlotAvailable(date, time, barber);
    if (!available) {
      return res.status(409).send('Selected time is no longer available');
    }

    if (useMemoryStore) {
      memoryAppointments.push({
        _id: String(memoryIdCounter++),
        name, email, phone, date, time, service, barber,
        status: 'booked',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } else {
      try {
        await new Appointment({ name, email, phone, date, time, service, barber, status: 'booked' }).save();
      } catch (e) {
        // Handle unique index conflict cleanly
        if (e && e.code === 11000) {
          return res.status(409).send('Selected time is no longer available');
        }
        throw e;
      }
    }

    res.send('Appointment booked successfully!');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error booking appointment');
  }
});

// Simple admin check middleware for this route
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

// GET all appointments (admin)
router.get('/all', requireAdmin, async (req, res) => {
  try {
    const { date, barber } = req.query;
    const filter = {};
    if (date) filter.date = date;
    if (barber) filter.barber = barber;

    if (useMemoryStore) {
      let items = memoryAppointments.slice();
      if (date) items = items.filter(a => a.date === date);
      if (barber) items = items.filter(a => a.barber === barber);
      items.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      return res.json(items);
    }

    const items = await Appointment.find(filter).sort({ createdAt: -1 }).lean();
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

module.exports = router;
// Admin-protected endpoints for managing appointments

// Middleware already defined earlier
// function requireAdmin(req, res, next) { ... }

// Update appointment status
router.patch('/:id/status', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    if (!['booked', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    if (useMemoryStore) {
      const appt = memoryAppointments.find(a => String(a._id) === String(id));
      if (!appt) return res.status(404).json({ error: 'Not found' });
      appt.status = status;
      appt.updatedAt = new Date().toISOString();
      return res.json(appt);
    }
    const appt = await Appointment.findByIdAndUpdate(id, { status }, { new: true }).lean();
    if (!appt) return res.status(404).json({ error: 'Not found' });
    res.json(appt);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Modify appointment details
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, date, time, service, barber, status } = req.body || {};

    // Validate basic fields if provided
    const payload = { name, email, phone, date, time, service, barber };
    const errMsg = validatePayload(payload);
    if (errMsg) return res.status(400).json({ error: errMsg });

    // Check slot availability excluding current appointment
    if (useMemoryStore) {
      const current = memoryAppointments.find(a => String(a._id) === String(id));
      if (!current) return res.status(404).json({ error: 'Not found' });
      const conflict = memoryAppointments.some(a => a.barber === barber && a.date === date && a.time === time && String(a._id) !== String(id));
      if (conflict) return res.status(409).json({ error: 'Selected time is no longer available' });
      Object.assign(current, { name, email, phone, date, time, service, barber });
      if (status && ['booked', 'completed', 'cancelled'].includes(status)) current.status = status;
      current.updatedAt = new Date().toISOString();
      return res.json(current);
    }

    const conflict = await Appointment.findOne({ barber, date, time, _id: { $ne: id } }).lean();
    if (conflict) return res.status(409).json({ error: 'Selected time is no longer available' });

    const update = { name, email, phone, date, time, service, barber };
    if (status && ['booked', 'completed', 'cancelled'].includes(status)) update.status = status;
    const appt = await Appointment.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!appt) return res.status(404).json({ error: 'Not found' });
    res.json(appt);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});
