const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session');
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

// Sessions (for admin auth)
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || process.env.SESSION_SECRET || 'change-me';
app.use(session({
  name: 'app_session',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false // set true if behind HTTPS proxy
  }
}));

// Database (optional). Start server even if MONGO_URI is not set.
if (process.env.MONGO_URI) {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err.message));
} else {
  console.warn('MONGO_URI not set. Using in-memory storage for appointments.');
}

// Routes
const appointmentRoutes = require('./routes/appointments');
app.use('/appointments', appointmentRoutes);

app.get('/', (req, res) => {
  res.render('index');
});

// Auth helpers
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.redirect('/admin/login');
}

// Admin login/logout routes
app.get('/admin/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/admin/login', async (req, res) => {
  try {
    const { password } = req.body || {};
    const hash = process.env.ADMIN_PASSWORD_HASH;
    if (!hash) {
      return res.status(500).send('Admin not configured. Please set ADMIN_PASSWORD_HASH in .env');
    }
    const ok = await bcrypt.compare(password || '', hash);
    if (!ok) {
      return res.status(401).render('login', { error: 'Invalid password' });
    }
    req.session.isAdmin = true;
    res.redirect('/admin');
  } catch (e) {
    console.error(e);
    res.status(500).render('login', { error: 'Login error' });
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

// Admin page
app.get('/admin', requireAdmin, (req, res) => {
  res.render('admin');
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
