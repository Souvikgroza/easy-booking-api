process.env.JWT_SECRET = 'test_secret';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('./app');
const { Booking } = require('./models');

let db, providerToken, user1Token, user2Token, slotId, bookingId;

const signup = async (name, role) =>
  (await request(app).post('/auth/register').send({ name, email: `${name}@test.com`, password: 'secret1', role })).body.token;
const auth = (token) => ({ Authorization: `Bearer ${token}` });
const tomorrow = () => {
  const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return { startTime: start, endTime: new Date(start.getTime() + 60 * 60 * 1000) };
};

beforeAll(async () => {
  db = await MongoMemoryServer.create();
  await mongoose.connect(db.getUri());
  await Booking.init(); 

  providerToken = await signup('doctor', 'provider');
  user1Token = await signup('anna', 'user');
  user2Token = await signup('ben', 'user');
});

afterAll(async () => {
  await mongoose.disconnect();
  await db.stop();
});

test('login works, wrong password fails', async () => {
  const ok = await request(app).post('/auth/login').send({ email: 'anna@test.com', password: 'secret1' });
  expect(ok.status).toBe(200);
  const bad = await request(app).post('/auth/login').send({ email: 'anna@test.com', password: 'nope' });
  expect(bad.status).toBe(401);
});

test('user gets 403 creating a slot, provider succeeds', async () => {
  const asUser = await request(app).post('/slots').set(auth(user1Token)).send(tomorrow());
  expect(asUser.status).toBe(403);

  const asProvider = await request(app).post('/slots').set(auth(providerToken)).send(tomorrow());
  expect(asProvider.status).toBe(201);
  slotId = asProvider.body._id;
});

test('bad dates are rejected', async () => {
  const res = await request(app).post('/slots').set(auth(providerToken)).send({ startTime: 'abc', endTime: 'xyz' });
  expect(res.status).toBe(400);
});

test('booking a slot removes it from the list', async () => {
  const res = await request(app).post('/bookings').set(auth(user1Token)).send({ slotId });
  expect(res.status).toBe(201);
  bookingId = res.body._id;

  const list = await request(app).get('/slots').set(auth(user1Token));
  expect(list.body.find((s) => s._id === slotId)).toBeUndefined();
});

test('double booking gets 409', async () => {
  const res = await request(app).post('/bookings').set(auth(user2Token)).send({ slotId });
  expect(res.status).toBe(409);
});

test('cancelling puts the slot back in the list', async () => {
  const res = await request(app).delete(`/bookings/${bookingId}`).set(auth(user1Token));
  expect(res.status).toBe(200);

  const list = await request(app).get('/slots').set(auth(user1Token));
  expect(list.body.find((s) => s._id === slotId)).toBeDefined();
});

test('two bookings at the same moment: one wins, one gets 409', async () => {
  const [a, b] = await Promise.all([
    request(app).post('/bookings').set(auth(user1Token)).send({ slotId }),
    request(app).post('/bookings').set(auth(user2Token)).send({ slotId }),
  ]);
  expect([a.status, b.status].sort()).toEqual([201, 409]);
});
