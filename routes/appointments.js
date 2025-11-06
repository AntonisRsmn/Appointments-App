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

// Config: Services catalog per store
const SERVICES_BASE = [
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

// Translation tables (Greek -> English)
const CATEGORY_EL_TO_EN = {
  'Κούρεμα Αντρικό': "Men's Haircuts",
  'Μούσι': 'Beard',
  'Θεραπείες Μαλλιών Και Τριχωτού Κεφαλής': 'Hair & Scalp Treatments',
  'Σχηματισμός Και Αποτρίχωση Φρυδιών': 'Eyebrow Shaping & Hair Removal',
  'Κούρεμα Παιδικό': 'Kids Haircut',
  'Θεραπείες Προσώπου': 'Facial Treatments',
  'Αποτρίχωση Με Κερί Και Κλωστή': 'Waxing & Threading'
};
const SERVICE_EL_TO_EN = {
  'Κούρεμα με shaver ή trimmer': 'Haircut with shaver or trimmer',
  'Κούρεμα Αντρικό': "Men's Haircut",
  'Buzz cut': 'Buzz cut',
  'Κούρεμα Συνταξιούχων': 'Senior Haircut',
  'Κούρεμα κλασικό (μόνο χτένα & ψαλίδι)': 'Classic Haircut (comb & scissors only)',
  'Fade Refresh': 'Fade Refresh',
  'Περιποίηση γενειάδας πολυτελείας': 'Luxury Beard Grooming',
  'Τριμάρισμα γενειάδας & σχήμα': 'Beard Trim & Shape',
  'Κούρεμα με shaver ή trimmer & Περιποίηση γενειάδας': 'Haircut with shaver/trimmer & Beard Care',
  'Παραδοσιακό Ξύρισμα': 'Traditional Shave',
  'Λούσιμο': 'Wash',
  'Σχηματισμός Φρυδιών': 'Eyebrow Shaping',
  'Καθαρισμός Φρυδιών': 'Eyebrow Tidy',
  'Κούρεμα Παιδικό': 'Kids Haircut',
  'Καθαρισμός Προσώπου': 'Face Cleansing',
  'Καθαρισμός αυτιών': 'Ear Cleaning',
  'Πακέτο Γενικής Περιποίησης': 'Total Care Package',
  'Αποτρίχωση με κερί μύτη-αυτιά': 'Waxing (nose & ears)',
  'Αποτρίχωση με Κερί Πρόσωπο': 'Face Waxing'
};

function invert(obj) {
  const out = {};
  Object.keys(obj).forEach(k => { out[obj[k]] = k; });
  return out;
}
const CATEGORY_EN_TO_EL = invert(CATEGORY_EL_TO_EN);
const SERVICE_EN_TO_EL = invert(SERVICE_EL_TO_EN);

function toEN_Category(label) {
  return CATEGORY_EL_TO_EN[label] || label;
}
function toEN_Service(name) {
  return SERVICE_EL_TO_EN[name] || name;
}
function toEL_Service(name) {
  return SERVICE_EN_TO_EL[name] || name;
}

// Aigaleo-specific overrides based on provided pricing
const AIGALEO_OVERRIDES = {
  'men-shaver-trimmer': { price: 15 },
  'men-haircut': { price: 13 },
  'buzz-cut': { price: 12 },
  'senior-haircut': { price: 12 },
  'haircut-plus-beard': { price: 17 },
  'wash': { price: 3 },
  'kids-haircut': { price: 11 },
  // keep fade-refresh at 10 as per screenshot
};

function getServicesForStore(store = 'Nikaia') {
  const list = SERVICES_BASE.map(s => ({ ...s }));
  if (store === 'Aigaleo') {
    // For Aigaleo, only show the "Κούρεμα Αντρικό" category with store-specific pricing
    return list
      .filter(s => s.category === 'Κούρεμα Αντρικό')
      .map(s => ({ ...s, ...(AIGALEO_OVERRIDES[s.id] || {}) }));
  }
  return list;
}
// Store opening hours
// - Weekly schedule allows per-day differences (0=Sun..6=Sat). Use null when closed.
// - If a store doesn't define a weekly schedule for a day, fallback to STORE_DEFAULT_HOURS.
const STORE_DEFAULT_HOURS = {
  Nikaia: { open: '10:00', close: '20:00' },
  Aigaleo: { open: '12:00', close: '21:00' }
};
const STORE_WEEKLY_HOURS = {
  Nikaia: {
    0: null, // Sunday: Closed
    1: null, // Monday: Closed
    2: { open: '10:00', close: '20:00' }, // Tuesday
    3: { open: '10:00', close: '18:00' }, // Wednesday
    4: { open: '10:00', close: '20:00' }, // Thursday
    5: { open: '10:00', close: '20:00' }, // Friday
    6: { open: '10:00', close: '18:00' }  // Saturday
  },
  Aigaleo: {
    0: { open: '12:00', close: '18:00' }, // Sunday
    1: null, // Monday: Closed
    2: { open: '12:00', close: '21:00' }, // Tuesday
    3: { open: '11:00', close: '19:00' }, // Wednesday
    4: { open: '12:00', close: '21:00' }, // Thursday
    5: { open: '12:00', close: '21:00' }, // Friday
    6: { open: '10:00', close: '18:00' }  // Saturday
  }
};
const BASE_STEP_MINUTES = 15; // smallest granularity

function getStoreHoursForDate(store = 'Nikaia', dateStr) {
  // dateStr: YYYY-MM-DD
  try {
    const d = new Date(`${dateStr}T00:00:00`);
    const dow = d.getDay(); // 0=Sun..6=Sat
    const weekly = STORE_WEEKLY_HOURS[store];
    const cfg = weekly ? weekly[dow] : undefined;
    if (cfg === null) return null; // closed
    const base = cfg || STORE_DEFAULT_HOURS[store] || STORE_DEFAULT_HOURS.Nikaia;
    return { openMins: toMinutes(base.open), closeMins: toMinutes(base.close) };
  } catch (e) {
    // Fallback: use default hours if date parsing fails
    const base = STORE_DEFAULT_HOURS[store] || STORE_DEFAULT_HOURS.Nikaia;
    return { openMins: toMinutes(base.open), closeMins: toMinutes(base.close) };
  }
}

const useMemoryStore = !process.env.MONGO_URI;
const memoryAppointments = [];
let memoryIdCounter = 1;

function toMinutes(hhmm) {
  const [hh, mm] = (hhmm || '').split(':').map(Number);
  return (hh * 60) + (mm || 0);
}
function toHHMM(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function overlaps(startA, durA, startB, durB) {
  const a0 = toMinutes(startA);
  const a1 = a0 + durA;
  const b0 = toMinutes(startB);
  const b1 = b0 + durB;
  return a0 < b1 && b0 < a1;
}
function generateCandidateStarts(durationMinutes, store = 'Nikaia', date) {
  const step = (durationMinutes % 30 === 0) ? 30 : BASE_STEP_MINUTES; // 30m services on :00/:30, otherwise 15m grid
  const hours = getStoreHoursForDate(store, date);
  if (!hours) return [];
  const { openMins: open, closeMins: close } = hours;
  const latestStart = close - durationMinutes;
  const out = [];
  for (let t = open; t <= latestStart; t += step) {
    out.push(toHHMM(t));
  }
  return out;
}
function isValidSlot(time, store = 'Nikaia', date) {
  if (!/^\d{2}:\d{2}$/.test(time)) return false;
  const m = toMinutes(time);
  const mins = m % 60;
  if (![0, 15, 30, 45].includes(mins)) return false;
  const hours = getStoreHoursForDate(store, date);
  if (!hours) return false; // closed day
  const { openMins, closeMins } = hours;
  return m >= openMins && m < closeMins;
}

function getBarbersForStore(store = 'Nikaia') {
  return STORES[store] || [];
}

function getServiceByName(store, serviceName) {
  const list = getServicesForStore(store);
  // Try direct match, EL<->EN translation match
  const elName = toEL_Service(serviceName);
  const enAlt = toEN_Service(serviceName);
  return list.find(s => s.name === serviceName || s.name === elName || toEN_Service(s.name) === serviceName || toEN_Service(s.name) === enAlt);
}

function parseServiceList(service) {
  if (Array.isArray(service)) return service.filter(Boolean).map(s => String(s).trim()).filter(Boolean);
  if (typeof service === 'string') return service.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

function getTotalDurationForServices(store, serviceField) {
  const names = parseServiceList(serviceField);
  if (!names.length && typeof serviceField === 'string' && serviceField) {
    const svc = getServiceByName(store, serviceField);
    return (svc && svc.durationMinutes) || 30;
  }
  let total = 0;
  names.forEach(n => {
    const svc = getServiceByName(store, n);
    total += (svc && svc.durationMinutes) || 30;
  });
  return total || 30;
}

async function getAppointmentsForDate(date, store = 'Nikaia', barbers = null) {
  if (useMemoryStore) {
    let items = memoryAppointments.filter(a => a.date === date && (a.store || 'Nikaia') === store);
    if (barbers && Array.isArray(barbers)) items = items.filter(a => barbers.includes(a.barber));
    return items;
  }
  const base = { date };
  if (store === 'Nikaia') {
    Object.assign(base, { $or: [{ store: 'Nikaia' }, { store: { $exists: false } }] });
  } else {
    base.store = store;
  }
  if (barbers && Array.isArray(barbers) && barbers.length) {
    base.barber = { $in: barbers };
  }
    const items = await Appointment.find(base).lean();
    const toKey = (x) => `${x.date || ''}T${x.time || '00:00'}`;
    const barberOrder = (rec) => {
      const st = rec?.store || 'Nikaia';
      const list = getBarbersForStore(st);
      const idx = list.indexOf(rec?.barber || '');
      return idx >= 0 ? (idx + 1) : 0; // 1-based index like labels
    };
    items.sort((a, b) => {
      const ka = toKey(a);
      const kb = toKey(b);
      if (ka !== kb) return ka.localeCompare(kb);
      const sa = (a.store || 'Nikaia');
      const sb = (b.store || 'Nikaia');
      if (sa !== sb) return sa.localeCompare(sb);
      const ib = barberOrder(b) - barberOrder(a);
      if (ib !== 0) return ib;
      return (a.barber || '').localeCompare(b.barber || '');
    });
    return items;
}

function validatePayload({ name, email, phone, date, time, service, barber, store = 'Nikaia' }) {
  const hasService = Array.isArray(service) ? service.length > 0 : !!service;
  if (!name || !email || !phone || !date || !time || !hasService || !barber) {
    return 'Missing required fields';
  }
  const validBarbers = getBarbersForStore(store);
  if (!validBarbers.includes(barber)) {
    return 'Invalid barber';
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return 'Invalid date format';
  }
  if (!/^\d{2}:\d{2}$/.test(time) || !isValidSlot(time, store, date)) {
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

async function isSlotAvailable(date, time, barber, store = 'Nikaia', durationMinutes = 30) {
  // Fetch all appointments for this date+barber in this store and check interval overlap
  if (useMemoryStore) {
    const items = memoryAppointments.filter(a => a.date === date && a.barber === barber && (a.store || 'Nikaia') === store);
    return !items.some(a => {
      const apptStore = a.store || 'Nikaia';
      const svc = getServiceByName(apptStore, a.service);
      const dur = (svc && svc.durationMinutes) || 30;
      return overlaps(time, durationMinutes, a.time, dur);
    });
  }
  const query = { date, barber };
  if (store === 'Nikaia') {
    Object.assign(query, { $or: [{ store: 'Nikaia' }, { store: { $exists: false } }] });
  } else {
    query.store = store;
  }
  const existingList = await Appointment.find(query).lean();
  return !existingList.some(a => {
    const apptStore = a.store || 'Nikaia';
    const dur = getTotalDurationForServices(apptStore, a.service);
    return overlaps(time, durationMinutes, a.time, dur);
  });
}

// GET stores
router.get('/stores', (req, res) => {
  res.json(Object.keys(STORES));
});

// GET services catalog grouped by category
router.get('/services', (req, res) => {
  const store = req.query.store || 'Nikaia';
  const catalog = getServicesForStore(store);
  // Always return English labels to the client UI
  const byCat = catalog.reduce((acc, s) => {
    const catEN = toEN_Category(s.category);
    const nameEN = toEN_Service(s.name);
    acc[catEN] = acc[catEN] || [];
    acc[catEN].push({ id: s.id, name: nameEN, durationMinutes: s.durationMinutes, price: s.price });
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
    const durationParam = parseInt(req.query.duration, 10);
    if (!date || !barber) {
      return res.status(400).json({ error: 'date and barber are required' });
    }
    const validBarbers = getBarbersForStore(store);
    const isAny = (barber === 'ANY' || barber === 'Anyone');
    if (!isAny && !validBarbers.includes(barber)) {
      return res.status(400).json({ error: 'Invalid barber' });
    }

  const duration = Number.isFinite(durationParam) && durationParam > 0 ? durationParam : 30;
    const candidates = generateCandidateStarts(duration, store, date);
    if (!candidates.length) {
      // store closed on this date
      return res.json([]);
    }

    // Fetch all appointments for that date/store and relevant barbers in ONE query
    const targetBarbers = isAny ? validBarbers : [barber];
    const appts = await getAppointmentsForDate(date, store, targetBarbers);
    const byBarber = new Map();
    targetBarbers.forEach(b => byBarber.set(b, []));
    for (const a of appts) {
      if (!byBarber.has(a.barber)) byBarber.set(a.barber, []);
      byBarber.get(a.barber).push(a);
    }

    // Helper to test a single barber's availability using in-memory overlaps
    const isFreeForBarber = (b, t) => {
      const list = byBarber.get(b) || [];
      for (const a of list) {
        const apptStore = a.store || 'Nikaia';
        const dur = getTotalDurationForServices(apptStore, a.service);
        if (overlaps(t, duration, a.time, dur)) return false;
      }
      return true;
    };

    if (isAny) {
      const results = candidates.filter(t => targetBarbers.some(b => isFreeForBarber(b, t)));
      return res.json(results);
    } else {
      const results = candidates.filter(t => isFreeForBarber(barber, t));
      return res.json(results);
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch slots' });
  }
});

// Fetch single appointment for faster edit modal load
router.get('/item/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (useMemoryStore) {
      const appt = memoryAppointments.find(a => String(a._id) === String(id));
      if (!appt) return res.status(404).json({ error: 'Not found' });
      const sessionStore = req.session && req.session.adminStore;
      if (sessionStore && sessionStore !== 'ALL' && (appt.store || 'Nikaia') !== sessionStore) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      return res.json(appt);
    }
    const appt = await Appointment.findById(id).lean();
    if (!appt) return res.status(404).json({ error: 'Not found' });
    const sessionStore = req.session && req.session.adminStore;
    if (sessionStore && sessionStore !== 'ALL' && appt && appt.store !== sessionStore && !(sessionStore === 'Nikaia' && !appt.store)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(appt);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch appointment' });
  }
});

// POST book an appointment
router.post('/book', async (req, res) => {
  try {
    const payload = { ...(req.body || {}) };
    if (!payload.store) payload.store = 'Nikaia';
  let { name, email, phone, date, time, service, barber, store } = payload;

  // Resolve total duration for one or more services
  const durationMinutes = getTotalDurationForServices(store, service);
    // Enforce store hours (start within hours and finish before close)
    const hours = getStoreHoursForDate(store, date);
    if (!hours || !isValidSlot(time, store, date) || (toMinutes(time) + durationMinutes > hours.closeMins)) {
      return res.status(400).send('Invalid time slot');
    }

    // If barber is ANY/Anyone, pick a barber who is free for the full duration
    if (barber === 'ANY' || barber === 'Anyone') {
      const candidates = getBarbersForStore(store);
      let chosen = null;
      for (const b of candidates) {
        // eslint-disable-next-line no-await-in-loop
        const free = await isSlotAvailable(date, time, b, store, durationMinutes);
        if (free) { chosen = b; break; }
      }
      if (!chosen) {
        return res.status(409).send('Selected time is no longer available');
      }
      barber = chosen;
      payload.barber = chosen;
    }

  const error = validatePayload({ name, email, phone, date, time, service, barber, store });
    if (error) return res.status(400).send(error);

    const available = await isSlotAvailable(date, time, barber, store, durationMinutes);
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
        // Store combined service string if array provided
        const serviceStr = Array.isArray(service) ? service.join(', ') : String(service || '');
        await new Appointment({ name, email, phone, date, time, service: serviceStr, barber, store, status: 'booked' }).save();
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
    const { date, barber, status } = req.query;
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
    if (status && ['booked','completed','cancelled'].includes(status)) filter.status = status;

    if (useMemoryStore) {
      let items = memoryAppointments.slice();
      if (date) items = items.filter(a => a.date === date);
      if (barber) items = items.filter(a => a.barber === barber);
      if (filter.status) items = items.filter(a => a.status === filter.status);
      if (storeFilter) items = items.filter(a => (a.store || 'Nikaia') === storeFilter);
      // Sort by date asc then time asc; for identical date+time, newest created first (createdAt desc)
      const toKey = (x) => `${x.date || ''}T${x.time || '00:00'}`;
      items.sort((a, b) => {
        const ka = toKey(a);
        const kb = toKey(b);
        if (ka !== kb) return ka.localeCompare(kb);
        const ca = a?.createdAt || a?.updatedAt || '';
        const cb = b?.createdAt || b?.updatedAt || '';
        return String(cb).localeCompare(String(ca));
      });
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
    // Use DB sort: date asc, time asc, createdAt desc (newest first within same slot)
    const items = await Appointment.find(mongoFilter).sort({ date: 1, time: 1, createdAt: -1 }).lean();
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

    // Enforce store hours for the selected service duration
  const durationMinutes = getTotalDurationForServices(store, service);
    const hours = getStoreHoursForDate(store, date);
    if (!hours || !isValidSlot(time, store, date) || (toMinutes(time) + durationMinutes > hours.closeMins)) {
      return res.status(400).json({ error: 'Invalid time slot' });
    }

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

  const update = { name, email, phone, date, time, service: Array.isArray(service) ? service.join(', ') : service, barber, store };
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
