require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { User, Slot, Booking } = require('./models');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  await User.deleteMany({});
  await Slot.deleteMany({});
  await Booking.deleteMany({});

  const password = await bcrypt.hash('password123', 10);
  await User.create({ name: 'Test User', email: 'user@example.com', password, role: 'user' });

  for (let i = 1; i <= 3; i++) {
    const provider = await User.create({
      name: `Provider ${i}`, email: `provider${i}@example.com`, password, role: 'provider',
    });
    for (let day = 1; day <= 7; day++) {
      for (const hour of [9, 10, 11]) {
        const start = new Date();
        start.setDate(start.getDate() + day);
        start.setHours(hour, 0, 0, 0);
        const end = new Date(start.getTime() + 60 * 60 * 1000);
        await Slot.create({ provider: provider._id, startTime: start, endTime: end });
      }
    }
  }
  console.log('Done. Login with user@example.com or provider1@example.com (password: password123)');
  await mongoose.disconnect();
}
seed();
