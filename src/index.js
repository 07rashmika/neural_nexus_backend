require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth_routes');
const profileRoutes = require('./routes/profile_routes');
const sectorRoutes = require('./routes/sector_routes');
const nodeRoutes = require('./routes/node_routes');
const gameRoutes = require('./routes/game_routes');
const dailyRoutes = require('./routes/daily_challenge_routes');

const { pool } = require('./db/pool');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// ─── Global Middleware ────────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});

// ─── Routes ──────────────────────────────────────────────────────────────────

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/sectors', sectorRoutes);
app.use('/api/nodes', nodeRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/daily', dailyRoutes);

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ success: true, status: 'ONLINE', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ success: false, status: 'DB_UNREACHABLE' });
  }
});

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error('[Unhandled]', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server online on port ${PORT}`);
  console.log(`ENV: ${process.env.NODE_ENV || 'development'}`);
});