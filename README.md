# Easy Booking API

## Run it
```bash
npm install
cp .env.example .env      # then open .env and check MONGO_URI
npm run seed              # sample data
npm start                 # http://localhost:3000
npm test                  # automatic tests
```
Sample logins (password `password123`): `user@example.com`, `provider1@example.com`

## Requests
Send the token in a header: `Authorization: Bearer <token>`

| Method | URL | Who | Body |
|---|---|---|---|
| POST | /auth/register | anyone | name, email, password, role (user/provider) |
| POST | /auth/login | anyone | email, password |
| POST | /slots | provider | startTime, endTime |
| GET | /slots | logged in | (shows free slots) |
| POST | /bookings | user | slotId |
| GET | /bookings | user | (your bookings) |
| DELETE | /bookings/:id | owner | |

## Error codes
400 bad input · 401 not logged in · 403 wrong role · 404 not found · 409 already booked

## Files
- `models.js` - what we store
- `app.js` - all the routes
- `server.js` - starts the app
- `seed.js` - sample data
- `app.test.js` - tests
