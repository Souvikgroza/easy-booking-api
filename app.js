const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { User, Slot, Booking } = require('./models');

const app = express();
app.use(express.json());

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

async function loginRequired(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) fail(401, 'Please log in first');

  const data = jwt.verify(token, process.env.JWT_SECRET);
  req.user = await User.findById(data.id);
  if (!req.user) fail(401, 'User not found');
  next();
}

function only(role) {
  return (req, res, next) => {
    if (req.user.role !== role) fail(403, `Only a ${role} can do this`);
    next();
  };
}


app.post('/auth/register', async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) fail(400, 'name, email and password are required');
  if (password.length < 6) fail(400, 'Password must be at least 6 characters');
  if (role && !['user', 'provider'].includes(role)) fail(400, 'role must be user or provider');
  if (await User.findOne({ email })) fail(409, 'Email already registered');

  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, password: hashed, role });
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
  res.status(201).json({ token, role: user.role });
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password || '', user.password))) {
    fail(401, 'Wrong email or password');
  }
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
  res.json({ token, role: user.role });
});

app.post('/slots', loginRequired, only('provider'), async (req, res) => {
  const start = new Date(req.body.startTime);
  const end = new Date(req.body.endTime);
  if (isNaN(start) || isNaN(end)) fail(400, 'startTime and endTime must be valid dates');
  if (end <= start) fail(400, 'endTime must be after startTime');
  if (start <= new Date()) fail(400, 'Slot must be in the future');

  const slot = await Slot.create({ provider: req.user._id, startTime: start, endTime: end });
  res.status(201).json(slot);
});

app.get('/slots', loginRequired, async (req, res) => {
  const slots = await Slot.find({ isBooked: false, startTime: { $gt: new Date() } })
    .sort('startTime')
    .populate('provider', 'name');
  res.json(slots);
});

app.post('/bookings', loginRequired, only('user'), async (req, res) => {
  const { slotId } = req.body;
  if (!mongoose.isValidObjectId(slotId)) fail(400, 'slotId is missing or invalid');

  const slot = await Slot.findOneAndUpdate(
    { _id: slotId, isBooked: false },
    { isBooked: true }
  );
  if (!slot) {
    if (!(await Slot.findById(slotId))) fail(404, 'Slot not found');
    fail(409, 'Slot is already booked');
  }

  const booking = await Booking.create({ user: req.user._id, slot: slotId });
  res.status(201).json(booking);
});

app.get('/bookings', loginRequired, async (req, res) => {
  res.json(await Booking.find({ user: req.user._id }).populate('slot'));
});

app.delete('/bookings/:id', loginRequired, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) fail(400, 'Invalid booking id');
  const booking = await Booking.findById(req.params.id);
  if (!booking) fail(404, 'Booking not found');
  if (!booking.user.equals(req.user._id)) fail(403, 'This is not your booking');

  await booking.deleteOne();
  await Slot.findByIdAndUpdate(booking.slot, { isBooked: false });
  res.json({ message: 'Booking cancelled' });
});


app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

app.use((err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message;

  if (err.code === 11000) { status = 409; message = 'Already exists or already booked'; }
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    status = 401; message = 'Invalid or expired token';
  }
  if (status === 500 && process.env.NODE_ENV !== 'test') console.error(err);

  res.status(status).json({ error: message });
});

module.exports = app;
