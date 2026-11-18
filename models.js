const mongoose = require('mongoose');
const { Schema } = mongoose;

const User = mongoose.model('User', new Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,                                   // stored hashed, never plain
  role: { type: String, enum: ['user', 'provider'], default: 'user' },
}));

const Slot = mongoose.model('Slot', new Schema({
  provider: { type: Schema.Types.ObjectId, ref: 'User' },
  startTime: Date,
  endTime: Date,
  isBooked: { type: Boolean, default: false },
}));

const Booking = mongoose.model('Booking', new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  slot: { type: Schema.Types.ObjectId, ref: 'Slot', unique: true },
}));

module.exports = { User, Slot, Booking };
