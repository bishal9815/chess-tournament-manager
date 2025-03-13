const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const session = require('express-session');
require('dotenv').config();
const connectDB = require('./lib/db');
const { protect } = require('./lib/auth');

// Import routes
const authRoutes = require('./app/routes/auth');
const tournamentRoutes = require('./app/routes/tournaments');
const playerRoutes = require('./app/routes/players');
const googleRoutes = require('./app/routes/google');
const statisticsRoutes = require('./app/routes/statistics');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, '../public')));

// Session middleware
app.use(session({
  secret: process.env.JWT_SECRET || 'your_jwt_secret_key_here',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/players', protect, playerRoutes);
app.use('/api/google', googleRoutes);
app.use('/api/statistics', protect, statisticsRoutes);

// Health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// Frontend routes
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/register.html'));
});

app.get('/test-google-auth', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/test-google-auth.html'));
});

app.get('/tournaments', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/tournaments.html'));
});

app.get('/tournament-details', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/tournament-details.html'));
});

app.get('/tournament-guide', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/tournament-guide.html'));
});

// Terms of Service page
app.get('/terms-of-service', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/terms-of-service.html'));
});

// Privacy Policy page
app.get('/privacy-policy', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/privacy-policy.html'));
});

// Data Deletion page
app.get('/data-deletion', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/data-deletion.html'));
});

// Profile page
app.get('/profile', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/profile.html'));
});

// Statistics page
app.get('/statistics', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/statistics.html'));
});

// Add custom Google OAuth callback handler
app.get('/oauth2/callback', (req, res) => {
  console.log('Received callback at /oauth2/callback, redirecting to /api/auth/google/callback');
  const queryString = new URLSearchParams(req.query).toString();
  res.redirect(`/api/auth/google/callback?${queryString}`);
});

app.get('/auth/google/callback', (req, res) => {
  console.log('Received callback at /auth/google/callback, redirecting to /api/auth/google/callback');
  const queryString = new URLSearchParams(req.query).toString();
  res.redirect(`/api/auth/google/callback?${queryString}`);
});

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  // Set static folder
  app.use(express.static('client/build'));
  
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    status: 'error',
    message: err.message || 'Internal Server Error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 