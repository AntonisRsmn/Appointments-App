const express = require('express');
const router = express.Router();
const Appointment = require('../models/appointment');

// Config: Stores and barbers
const STORES = {
  'Nikaia': [
    'Νίκος Ανδρεάκος',
    'Στέλιος Καρλαφτόπουλος',
    'Γιώργος Μαχαίρας',
    'Δημήτρης Ξάφης'
  ],
  'Aigaleo': [
    'Πέτρος Λάμπρου',
    'Μάριος Κωνσταντίνου',
    'Τάσος Βασιλείου'
  ]
};

// Config: Services catalog (shared across stores for now)
const SERVICES = [
  // Κούρεμα Αντρικό (6)
  { id: 'men-shaver-trimmer', category: 'Κούρεμα Αντρικό', name: 'Κούρεμα με shaver ή trimmer', durationMinutes: 30, price: 13 },
  { id: 'men-haircut', category: 'Κούρεμα Αντρικό', name: 'Κούρεμα Αντρικό', durationMinutes: 30, price: 12 },
  { id: 'buzz-cut', category: 'Κούρεμα Αντρικό', name: 'Buzz cut', durationMinutes: 15, price: 11 },
  { id: 'senior-haircut', category: 'Κούρεμα Αντρικό', name: 'Κούρεμα Συνταξιούχων', durationMinutes: 15, price: 10 },
  { id: 'classic-comb-scissors', category: 'Κούρεμα Αντρικό', name: 'Κούρεμα κλασικό (μόνο χτένα & ψαλίδι)', durationMinutes: 30, price: 17 },
  { id: 'fade-refresh', category: 'Κούρεμα Αντρικό', name: 'Fade Refresh', durationMinutes: 15, price: 10 },
  // Μούσι (4)
  { id: 'beard-luxury', category: 'Μούσι', name: 'Περιποίηση γενειάδας πολυτελείας', durationMinutes: 30, price: 7 },
  { id: 'beard-trim-shape', category: 'Μούσι', name: 'Τριμάρισμα γενειάδας & σχήμα', durationMinutes: 15, price: 5 },
  { id: 'haircut-plus-beard', category: 'Μούσι', name: 'Κούρεμα με shaver ή trimmer & Περιποίηση γενειάδας', durationMinutes: 30, price: 15 },
  { id: 'traditional-shave', category: 'Μούσι', name: 'Παραδοσιακό Ξύρισμα', durationMinutes: 30, price: 15 },
  // Θεραπείες Μαλλιών Και Τριχωτού Κεφαλής (1)
  { id: 'wash', category: 'Θεραπείες Μαλλιών Και Τριχωτού Κεφαλής', name: 'Λούσιμο', durationMinutes: 15, price: 2 },
  // Σχηματισμός Και Αποτρίχωση Φρυδιών (2)
  { id: 'eyebrow-shape', category: 'Σχηματισμός Και Αποτρίχωση Φρυδιών', name: 'Σχηματισμός Φρυδιών', durationMinutes: 30, price: 5 },
  { id: 'eyebrow-clean', category: 'Σχηματισμός Και Αποτρίχωση Φρυδιών', name: 'Καθαρισμός Φρυδιών', durationMinutes: 30, price: 3 },
  // Κούρεμα Παιδικό (1)
  { id: 'kids-haircut', category: 'Κούρεμα Παιδικό', name: 'Κούρεμα Παιδικό', durationMinutes: 30, price: 10 },
  // Θεραπείες Προσώπου (3)
  { id: 'face-clean', category: 'Θεραπείες Προσώπου', name: 'Καθαρισμός Προσώπου', durationMinutes: 30, price: 10 },
  { id: 'ear-clean', category: 'Θεραπείες Προσώπου', name: 'Καθαρισμός αυτιών', durationMinutes: 15, price: 10 },
  { id: 'total-care', category: 'Θεραπείες Προσώπου', name: 'Πακέτο Γενικής Περιποίησης', durationMinutes: 75, price: 25, compareAtPrice: 30 },
  // Αποτρίχωση Με Κερί Και Κλωστή (2)
  { id: 'wax-nose-ears', category: 'Αποτρίχωση Με Κερί Και Κλωστή', name: 'Αποτρίχωση με κερί μύτη-αυτιά', durationMinutes: 30, price: 5 },
  { id: 'wax-face', category: 'Αποτρίχωση Με Κερί Και Κλωστή', name: 'Αποτρίχωση με Κερί Πρόσωπο', durationMinutes: 30, price: 5 },
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

function getBarbersForStore(store = 'Nikaia') {
  return STORES[store] || [];
}

function validatePayload({ name, email, phone, date, time, service, barber, store = 'Nikaia' }) {
  if (!name || !email || !phone || !date || !time || !service || !barber) {
    return 'Missing required fields';
  }
  const validBarbers = getBarbersForStore(store);
  if (!validBarbers.includes(barber)) {
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

async function getAppointmentsByDateBarber(date, barber, store = 'Nikaia') {
  if (useMemoryStore) {
    return memoryAppointments.filter(a => a.date === date && a.barber === barber && (a.store || 'Nikaia') === store);
  }
  // include documents without store as 'Nikaia' for backward compatibility
  const match = { date, barber };
  if (store === 'Nikaia') {
    return Appointment.find({ ...match, $or: [{ store: 'Nikaia' }, { store: { $exists: false } }] }).lean();
  }
  return Appointment.find({ ...match, store }).lean();
}

async function isSlotAvailable(date, time, barber, store = 'Nikaia') {
  if (useMemoryStore) {
    return !memoryAppointments.some(a => a.date === date && a.time === time && a.barber === barber && (a.store || 'Nikaia') === store);
  }
  const query = { date, time, barber };
  if (store === 'Nikaia') {
    Object.assign(query, { $or: [{ store: 'Nikaia' }, { store: { $exists: false } }] });
  } else {
    query.store = store;
  }
  const existing = await Appointment.findOne(query).lean();
  return !existing;
}

// GET stores
router.get('/stores', (req, res) => {
  res.json(Object.keys(STORES));
});

// GET services catalog grouped by category
router.get('/services', (req, res) => {
  const byCat = SERVICES.reduce((acc, s) => {
    acc[s.category] = acc[s.category] || [];
    acc[s.category].push({ id: s.id, name: s.name, durationMinutes: s.durationMinutes, price: s.price });
    return acc;
  }, {});
  res.json(byCat);
});

// GET list of barbers (optionally per store)
router.get('/barbers', (req, res) => {
  const store = req.query.store || 'Nikaia';
  res.json(getBarbersForStore(store));
});

// GET available slots for a date and barber
router.get('/slots', async (req, res) => {
  try {
    const { date } = req.query;
    const store = req.query.store || 'Nikaia';
    const barber = req.query.barber;
    if (!date || !barber) {
      return res.status(400).json({ error: 'date and barber are required' });
    }
    const validBarbers = getBarbersForStore(store);
    if (!validBarbers.includes(barber)) {
      return res.status(400).json({ error: 'Invalid barber' });
    }

    const allSlots = generateSlots();
    const appts = await getAppointmentsByDateBarber(date, barber, store);
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
    const payload = { ...(req.body || {}) };
    if (!payload.store) payload.store = 'Nikaia';
    const error = validatePayload(payload);
    if (error) return res.status(400).send(error);

    const { name, email, phone, date, time, service, barber, store } = payload;

    const available = await isSlotAvailable(date, time, barber, store);
    if (!available) {
      return res.status(409).send('Selected time is no longer available');
    }

    if (useMemoryStore) {
      memoryAppointments.push({
        _id: String(memoryIdCounter++),
        name, email, phone, date, time, service, barber, store,
        status: 'booked',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } else {
      try {
        await new Appointment({ name, email, phone, date, time, service, barber, store, status: 'booked' }).save();
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
    // Determine store filter based on session and query
    const sessionStore = req.session && req.session.adminStore;
    let storeFilter = null;
    if (sessionStore && sessionStore !== 'ALL') {
      storeFilter = sessionStore;
    } else if (req.query.store) {
      storeFilter = req.query.store;
    }
    if (date) filter.date = date;
    if (barber) filter.barber = barber;

    if (useMemoryStore) {
      let items = memoryAppointments.slice();
      if (date) items = items.filter(a => a.date === date);
      if (barber) items = items.filter(a => a.barber === barber);
      if (storeFilter) items = items.filter(a => (a.store || 'Nikaia') === storeFilter);
      items.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      return res.json(items);
    }

    let mongoFilter = { ...filter };
    if (storeFilter) {
      if (storeFilter === 'Nikaia') {
        mongoFilter = { ...mongoFilter, $or: [{ store: 'Nikaia' }, { store: { $exists: false } }] };
      } else {
        mongoFilter.store = storeFilter;
      }
    }
    const items = await Appointment.find(mongoFilter).sort({ createdAt: -1 }).lean();
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
      const sessionStore = req.session && req.session.adminStore;
      if (!appt) return res.status(404).json({ error: 'Not found' });
      if (sessionStore && sessionStore !== 'ALL' && (appt.store || 'Nikaia') !== sessionStore) return res.status(403).json({ error: 'Forbidden' });
      appt.status = status;
      appt.updatedAt = new Date().toISOString();
      return res.json(appt);
    }
    const appt = await Appointment.findByIdAndUpdate(id, { status }, { new: true }).lean();
    const sessionStore = req.session && req.session.adminStore;
    if (sessionStore && sessionStore !== 'ALL' && appt && appt.store !== sessionStore && !(sessionStore === 'Nikaia' && !appt.store)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
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
    const { name, email, phone, date, time, service, barber, store = 'Nikaia', status } = req.body || {};

    // Validate basic fields if provided
    const payload = { name, email, phone, date, time, service, barber, store };
    const errMsg = validatePayload(payload);
    if (errMsg) return res.status(400).json({ error: errMsg });

    // Check slot availability excluding current appointment
    if (useMemoryStore) {
      const current = memoryAppointments.find(a => String(a._id) === String(id));
      if (!current) return res.status(404).json({ error: 'Not found' });
      const sessionStore = req.session && req.session.adminStore;
      if (sessionStore && sessionStore !== 'ALL' && (current.store || 'Nikaia') !== sessionStore) return res.status(403).json({ error: 'Forbidden' });
      const conflict = memoryAppointments.some(a => (a.barber === barber && a.date === date && a.time === time && (a.store || 'Nikaia') === store && String(a._id) !== String(id)));
      if (conflict) return res.status(409).json({ error: 'Selected time is no longer available' });
      Object.assign(current, { name, email, phone, date, time, service, barber, store });
      if (status && ['booked', 'completed', 'cancelled'].includes(status)) current.status = status;
      current.updatedAt = new Date().toISOString();
      return res.json(current);
    }

    // For Mongo, old docs might not have store; conflict guard relies on unique barber names across stores
    const conflict = await Appointment.findOne({ barber, date, time, _id: { $ne: id } }).lean();
    if (conflict) return res.status(409).json({ error: 'Selected time is no longer available' });

    const update = { name, email, phone, date, time, service, barber, store };
    if (status && ['booked', 'completed', 'cancelled'].includes(status)) update.status = status;
    const sessionStore = req.session && req.session.adminStore;
    // Ensure the appointment belongs to the admin's store
    const existing = await Appointment.findById(id).lean();
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (sessionStore && sessionStore !== 'ALL' && existing.store !== sessionStore && !(sessionStore === 'Nikaia' && !existing.store)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const appt = await Appointment.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!appt) return res.status(404).json({ error: 'Not found' });
    res.json(appt);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// Delete appointment (admin)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    // Only master admin can delete appointments
    const sessionStore = req.session && req.session.adminStore;
    if (sessionStore !== 'ALL') {
      return res.status(403).json({ error: 'Forbidden: delete allowed only for master admin' });
    }
    if (useMemoryStore) {
      const idx = memoryAppointments.findIndex(a => String(a._id) === String(id));
      if (idx === -1) return res.status(404).json({ error: 'Not found' });
      memoryAppointments.splice(idx, 1);
      return res.status(204).send();
    }
    const existing = await Appointment.findById(id).lean();
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const result = await Appointment.findByIdAndDelete(id).lean();
    if (!result) return res.status(404).json({ error: 'Not found' });
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete appointment' });
  }
});
