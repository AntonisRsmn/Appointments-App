const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session');
let MongoStore;
try {
  MongoStore = require('connect-mongo');
} catch {}
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json()); // Needed for fetch POST
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Behind a proxy (Render/Heroku/NGINX) we must trust proxy so secure cookies work
app.set('trust proxy', 1);

// Sessions (for admin auth)
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || process.env.SESSION_SECRET || 'change-me';
const useMongoStore = !!(process.env.MONGO_URI && MongoStore);
const dbName = process.env.MONGO_DB_NAME || process.env.DB_NAME || 'appointments-app';
const IS_PROD = process.env.NODE_ENV === 'production';
app.use(session({
  name: 'app_session',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: useMongoStore ? MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    dbName,
    collectionName: 'sessions',
    ttl: 60 * 60 * 24 * 7 // 7 days
  }) : undefined,
  cookie: {
    httpOnly: true,
    sameSite: IS_PROD ? 'none' : 'lax',
    secure: IS_PROD,
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));

// Database (optional). Start server even if MONGO_URI is not set.
if (process.env.MONGO_URI) {
  const dbName = process.env.MONGO_DB_NAME || process.env.DB_NAME || 'appointments-app';
  mongoose.connect(process.env.MONGO_URI, { dbName })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err.message));
} else {
  console.warn('MONGO_URI not set. Using in-memory storage for appointments.');
}

// Routes
const appointmentRoutes = require('./routes/appointments');
app.use('/appointments', appointmentRoutes);

// Favicon: serve SVG and redirect legacy .ico requests
app.get('/favicon.ico', (req, res) => res.redirect(302, '/favicon.svg'));

app.get('/', (req, res) => {
  res.render('index');
});

// Auth helpers
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.redirect('/admin/login');
}
function requireAdminForStore(store) {
  return (req, res, next) => {
    if (req.session && req.session.isAdmin && (req.session.adminStore === store || req.session.adminStore === 'ALL')) return next();
    // Redirect to unified login regardless of store
    return res.redirect('/admin/login');
  };
}
function requireAdminAll(req, res, next) {
  if (req.session && req.session.isAdmin && req.session.adminStore === 'ALL') return next();
  return res.redirect('/admin/login');
}

// Admin login/logout routes (support unified login or store-specific)
app.get('/admin/login', (req, res) => {
  res.render('login', { error: null, loginAction: '/admin/login', storeLabel: null });
});

app.get('/admin/nikaia/login', (req, res) => {
  res.render('login', { error: null, loginAction: '/admin/nikaia/login', storeLabel: 'Ολύμπου 11, Νίκαια' });
});
app.get('/admin/aigaleo/login', (req, res) => {
  res.render('login', { error: null, loginAction: '/admin/aigaleo/login', storeLabel: 'Μαρκ. Μπότσαρη 9, Αιγάλεω' });
});

// Unified login: decide destination store by password
app.post('/admin/login', async (req, res) => {
  try {
    const { password } = req.body || {};
    const isNikaia = await bcrypt.compare(password || '', bcrypt.hashSync('7080616', 10));
    const isAigaleo = !isNikaia && await bcrypt.compare(password || '', bcrypt.hashSync('7080610', 10));
    const masterPlain = process.env.ADMIN_MASTER_PASSWORD || process.env.MASTER_ADMIN_PASSWORD || '7080619';
    const isMaster = !isNikaia && !isAigaleo && await bcrypt.compare(password || '', bcrypt.hashSync(masterPlain, 10));
    if (!isNikaia && !isAigaleo && !isMaster) {
      return res.status(401).render('login', { error: 'Invalid password', loginAction: '/admin/login', storeLabel: null });
    }
    req.session.isAdmin = true;
    req.session.adminStore = isNikaia ? 'Nikaia' : (isAigaleo ? 'Aigaleo' : 'ALL');
    if (isMaster) return res.redirect('/admin/all');
    return res.redirect(isNikaia ? '/admin/nikaia' : '/admin/aigaleo');
  } catch (e) {
    console.error(e);
    res.status(500).render('login', { error: 'Login error', loginAction: '/admin/login', storeLabel: null });
  }
});

app.post('/admin/nikaia/login', async (req, res) => {
  try {
    const { password } = req.body || {};
    // Encrypted comparison via bcrypt
    const ok = await bcrypt.compare(password || '', bcrypt.hashSync('7080616', 10));
    if (!ok) return res.status(401).render('login', { error: 'Invalid password', loginAction: '/admin/nikaia/login', storeLabel: 'Nikaia' });
    req.session.isAdmin = true;
    req.session.adminStore = 'Nikaia';
    res.redirect('/admin/nikaia');
  } catch (e) {
    console.error(e);
    res.status(500).render('login', { error: 'Login error', loginAction: '/admin/nikaia/login', storeLabel: 'Nikaia' });
  }
});
app.post('/admin/aigaleo/login', async (req, res) => {
  try {
    const { password } = req.body || {};
    const ok = await bcrypt.compare(password || '', bcrypt.hashSync('7080610', 10));
    if (!ok) return res.status(401).render('login', { error: 'Invalid password', loginAction: '/admin/aigaleo/login', storeLabel: 'Aigaleo' });
    req.session.isAdmin = true;
    req.session.adminStore = 'Aigaleo';
    res.redirect('/admin/aigaleo');
  } catch (e) {
    console.error(e);
    res.status(500).render('login', { error: 'Login error', loginAction: '/admin/aigaleo/login', storeLabel: 'Aigaleo' });
  }
});

app.post('/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('app_session');
    res.redirect('/admin/login');
  });
});

// Convenience: allow GET logout as well
app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('app_session');
    res.redirect('/admin/login');
  });
});

// Admin pages per store
app.get('/admin/nikaia', requireAdminForStore('Nikaia'), (req, res) => {
  res.render('admin', { lockedStore: 'Nikaia', lockedStoreLabel: 'Ολύμπου 11, Νίκαια' });
});
app.get('/admin/aigaleo', requireAdminForStore('Aigaleo'), (req, res) => {
  res.render('admin', { lockedStore: 'Aigaleo', lockedStoreLabel: 'Μαρκ. Μπότσαρη 9, Αιγάλεω' });
});
// Aggregated admin page (all stores)
app.get('/admin/all', requireAdminAll, (req, res) => {
  // No lockedStore -> UI shows All stores filter and loads everything
  res.render('admin', { lockedStore: null, lockedStoreLabel: 'All stores' });
});

// Redirect /admin to login or to the proper store if already authenticated
app.get('/admin', (req, res) => {
  if (req.session && req.session.isAdmin && req.session.adminStore) {
    if (req.session.adminStore === 'ALL') return res.redirect('/admin/all');
    return res.redirect(req.session.adminStore === 'Nikaia' ? '/admin/nikaia' : '/admin/aigaleo');
  }
  return res.redirect('/admin/login');
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
