const express = require('express');
const router = express.Router();
const Appointment = require('../models/appointment');

// Config: Available stores with their barbers and operating hours
const STORES = [
  { 
    id: 'nikaia', 
    name: 'Nikaia', 
    barbers: ['Nikos Ανδρεάκος', 'Stelios Καραλατόπουλος'], 
    start: '10:00', 
    end: '20:00', 
    slotMinutes: 30 
  },
  { 
    id: 'aigaleo', 
    name: 'Aigaleo', 
    barbers: ['Giorgos Papadopoulos', 'Kostas Yiannou'], 
    start: '09:00', 
    end: '17:00', 
    slotMinutes: 30 
  }
];

// Legacy: Available barbers and business hours (for backwards compatibility)
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

function generateSlots(startTime, endTime, slotMinutes) {
  // If no params provided, use legacy defaults
  if (!startTime || !endTime || !slotMinutes) {
    startTime = `${OPEN_HOUR}:00`;
    endTime = `${CLOSE_HOUR}:00`;
    slotMinutes = SLOT_MINUTES;
  }
  
  const slots = [];
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  
  let h = startH;
  let m = startM;
  
  while (h < endH || (h === endH && m < endM)) {
    const hh = `${h}`.padStart(2, '0');
    const mm = `${m}`.padStart(2, '0');
    slots.push(`${hh}:${mm}`);
    
    m += slotMinutes;
    if (m >= 60) {
      h += Math.floor(m / 60);
      m = m % 60;
    }
  }
  
  return slots;
}

function isValidSlot(time) {
  return generateSlots().includes(time);
}

function validatePayload({ name, email, phone, date, time, service, barber, store }) {
  if (!name || !email || !phone || !date || !time || !service || !barber) {
    return 'Missing required fields';
  }
  
  // Validate barber (either in legacy list or in a store)
  const barberInLegacy = BARBERS.includes(barber);
  const barberInAnyStore = STORES.some(s => s.barbers.includes(barber));
  
  if (!barberInLegacy && !barberInAnyStore) {
    return 'Invalid barber';
  }
  
  // If store is specified, validate it
  if (store) {
    const storeObj = STORES.find(s => s.id === store);
    if (!storeObj) {
      return 'Invalid store';
    }
    if (!storeObj.barbers.includes(barber)) {
      return 'Barber not found in specified store';
    }
  }
  
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return 'Invalid date format';
  }
  if (!/^\d{2}:\d{2}$/.test(time) || !isValidSlot(time)) {
    return 'Invalid time slot';
  }
  return null;
}

async function getAppointmentsByDateBarber(date, barber, store) {
  if (useMemoryStore) {
    let filtered = memoryAppointments.filter(a => a.date === date && a.barber === barber);
    if (store) {
      filtered = filtered.filter(a => a.store === store);
    }
    return filtered;
  }
  const filter = { date, barber };
  if (store) filter.store = store;
  return Appointment.find(filter).lean();
}

async function isSlotAvailable(date, time, barber, store) {
  if (useMemoryStore) {
    return !memoryAppointments.some(a => 
      a.date === date && 
      a.time === time && 
      a.barber === barber && 
      (!store || a.store === store)
    );
  }
  const filter = { date, time, barber };
  if (store) filter.store = store;
  const existing = await Appointment.findOne(filter).lean();
  return !existing;
}

// GET list of stores
router.get('/stores', (req, res) => {
  res.json(STORES);
});

// GET list of barbers
router.get('/barbers', (req, res) => {
  const { store } = req.query;
  
  if (store) {
    const storeObj = STORES.find(s => s.id === store);
    if (!storeObj) {
      return res.status(400).json({ error: 'Invalid store' });
    }
    return res.json(storeObj.barbers);
  }
  
  // Return union of all barbers (backwards compatibility)
  const allBarbers = new Set();
  STORES.forEach(s => s.barbers.forEach(b => allBarbers.add(b)));
  BARBERS.forEach(b => allBarbers.add(b));
  res.json(Array.from(allBarbers));
});

// GET available slots for a date and barber
router.get('/slots', async (req, res) => {
  try {
    const { date, barber, store } = req.query;
    if (!date || !barber) {
      return res.status(400).json({ error: 'date and barber are required' });
    }
    
    // Validate barber exists in specified store or globally
    let storeObj = null;
    if (store) {
      storeObj = STORES.find(s => s.id === store);
      if (!storeObj) {
        return res.status(400).json({ error: 'Invalid store' });
      }
      if (!storeObj.barbers.includes(barber)) {
        return res.status(400).json({ error: 'Barber not found in specified store' });
      }
    } else if (!BARBERS.includes(barber)) {
      // Check if barber exists in any store
      const barberInAnyStore = STORES.some(s => s.barbers.includes(barber));
      if (!barberInAnyStore) {
        return res.status(400).json({ error: 'Invalid barber' });
      }
    }

    // Generate slots based on store hours or legacy hours
    let allSlots;
    if (storeObj) {
      allSlots = generateSlots(storeObj.start, storeObj.end, storeObj.slotMinutes);
    } else {
      allSlots = generateSlots();
    }
    
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

    const { name, email, phone, date, time, service, barber, store } = req.body;

    const available = await isSlotAvailable(date, time, barber, store);
    if (!available) {
      return res.status(409).send('Selected time is no longer available');
    }

    if (useMemoryStore) {
      const newAppt = {
        _id: String(memoryIdCounter++),
        name, email, phone, date, time, service, barber,
        status: 'booked',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      if (store) newAppt.store = store;
      memoryAppointments.push(newAppt);
    } else {
      try {
        const apptData = { name, email, phone, date, time, service, barber, status: 'booked' };
        if (store) apptData.store = store;
        await new Appointment(apptData).save();
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
    const { name, email, phone, date, time, service, barber, status, store } = req.body || {};

    // Validate basic fields if provided
    const payload = { name, email, phone, date, time, service, barber, store };
    const errMsg = validatePayload(payload);
    if (errMsg) return res.status(400).json({ error: errMsg });

    // Check slot availability excluding current appointment
    if (useMemoryStore) {
      const current = memoryAppointments.find(a => String(a._id) === String(id));
      if (!current) return res.status(404).json({ error: 'Not found' });
      const conflict = memoryAppointments.some(a => 
        a.barber === barber && 
        a.date === date && 
        a.time === time && 
        String(a._id) !== String(id) &&
        (!store || a.store === store)
      );
      if (conflict) return res.status(409).json({ error: 'Selected time is no longer available' });
      Object.assign(current, { name, email, phone, date, time, service, barber });
      if (store) current.store = store;
      if (status && ['booked', 'completed', 'cancelled'].includes(status)) current.status = status;
      current.updatedAt = new Date().toISOString();
      return res.json(current);
    }

    const filter = { barber, date, time, _id: { $ne: id } };
    if (store) filter.store = store;
    const conflict = await Appointment.findOne(filter).lean();
    if (conflict) return res.status(409).json({ error: 'Selected time is no longer available' });

    const update = { name, email, phone, date, time, service, barber };
    if (store) update.store = store;
    if (status && ['booked', 'completed', 'cancelled'].includes(status)) update.status = status;
    const appt = await Appointment.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!appt) return res.status(404).json({ error: 'Not found' });
    res.json(appt);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});
