require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { initDB, getOne, sql } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(express.json({ limit: '10mb' }));

let dbReady = false;

async function setupDB() {
  await initDB();

  const userCount = await getOne('SELECT COUNT(*) as count FROM users');
  if (parseInt(userCount.count) === 0) {
    await sql`INSERT INTO users (name, username, password, role, farm) VALUES ('Owner 1', 'owner1', ${bcrypt.hashSync('owner123',10)}, 'owner', 'all')`;
    await sql`INSERT INTO users (name, username, password, role, farm) VALUES ('Owner 2', 'owner2', ${bcrypt.hashSync('owner456',10)}, 'owner', 'all')`;
    await sql`INSERT INTO users (name, username, password, role, farm) VALUES ('Admin', 'admin1', ${bcrypt.hashSync('admin123',10)}, 'admin', 'all')`;
    await sql`INSERT INTO users (name, username, password, role, farm) VALUES ('Petugas', 'petugas1', ${bcrypt.hashSync('petugas123',10)}, 'petugas', 'all')`;
    console.log('Default users created');
  }

  dbReady = true;
  console.log('DB ready');
}

let setupPromise = null;
function ensureDB() {
  if (!setupPromise) {
    setupPromise = setupDB()
      .then(() => { startScheduler(); })
      .catch((err) => {
        console.error('DB setup error:', err.message);
        setupPromise = null;
        throw err;
      });
  }
  return setupPromise;
}

app.use(async (req, res, next) => {
  if (req.path === '/ping' || req.path === '/') return next();
  try {
    await ensureDB();
    next();
  } catch (err) {
    res.status(503).json({ error: 'Database belum siap: ' + err.message });
  }
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/notifications', require('./routes/notifications').router);
app.use('/api/todo', require('./routes/todo'));
app.use('/api/periods', require('./routes/periods'));
app.use('/api/logistik', require('./routes/logistik'));
app.use('/api/biaya', require('./routes/biaya'));
app.use('/api/closing', require('./routes/closing'));
app.use('/api/arsip', require('./routes/arsip'));
app.use('/api/custom-schedule', require('./routes/customSchedule'));

app.get('/api/farms', async (req, res) => {
  try {
    const { getMany } = require('./db/database');
    const farms = await getMany('SELECT * FROM farms');
    res.json(farms);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/ping', async (req, res) => {
  try {
    await ensureDB();
    res.json({ status: 'ok', db: true, time: new Date().toISOString() });
  } catch (err) {
    res.json({ status: 'ok', db: false, error: err.message, time: new Date().toISOString() });
  }
});
app.get('/', (req, res) => res.json({ message: 'JJ-Rolu Farm API', version: '1.0.0', db: dbReady }));

async function checkDailyNotifications() {
  if (!dbReady) return;
  try {
    const { getMany } = require('./db/database');
    const today = new Date();
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const h3 = new Date(today); h3.setDate(h3.getDate() + 3);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const h3Str = h3.toISOString().split('T')[0];
    const { createNotificationForAll } = require('./routes/notifications');

    const ovkTomorrow = await getMany(
      `SELECT o.*, f.name as farm_name, f.location FROM ovk_schedule o JOIN periods p ON o.period_id = p.id JOIN farms f ON p.farm_id = f.id WHERE o.scheduled_date = $1 AND o.is_done = 0 AND p.status = 'active'`,
      [tomorrowStr]
    );
    for (const ovk of ovkTomorrow) {
      const dateFormatted = new Date(ovk.scheduled_date).toLocaleDateString('id-ID', {day:'numeric',month:'long',year:'numeric'});
      await createNotificationForAll(`H-1 Jadwal OVK: ${ovk.activity}`, `Besok ${dateFormatted} jadwal ${ovk.activity} di ${ovk.farm_name} - ${ovk.location}`, 'schedule');
    }

    const ciH3 = await getMany(
      `SELECT p.*, f.name as farm_name, f.location FROM periods p JOIN farms f ON p.farm_id = f.id WHERE p.chick_in_date = $1 AND p.status = 'active'`,
      [h3Str]
    );
    for (const p of ciH3) {
      const dateFormatted = new Date(p.chick_in_date).toLocaleDateString('id-ID', {day:'numeric',month:'long',year:'numeric'});
      await createNotificationForAll(`H-3 Sebelum Chick In - ${p.farm_name}`, `3 hari lagi Chick In di ${p.farm_name} - ${p.location} pada ${dateFormatted}`, 'warning');
    }

    const closingH3 = await getMany(
      `SELECT c.*, f.name as farm_name, f.location FROM closing_checklist c JOIN periods p ON c.period_id = p.id JOIN farms f ON p.farm_id = f.id WHERE c.planned_date = $1 AND p.status = 'active' AND c.pembersihan_done = 0`,
      [h3Str]
    );
    for (const c of closingH3) {
      const dateFormatted = new Date(c.planned_date).toLocaleDateString('id-ID', {day:'numeric',month:'long',year:'numeric'});
      await createNotificationForAll(`H-3 Persiapan Closing - ${c.farm_name}`, `3 hari lagi jadwal pembersihan kandang ${c.farm_name} - ${c.location} pada ${dateFormatted}`, 'warning');
    }

    console.log(`[${new Date().toLocaleString('id-ID')}] Notifikasi harian diperiksa`);
  } catch (err) { console.error('Scheduler error:', err.message); }
}

function startScheduler() {
  const now = new Date();
  const next7AM = new Date();
  next7AM.setHours(7, 0, 0, 0);
  if (now >= next7AM) next7AM.setDate(next7AM.getDate() + 1);
  const msUntil7AM = next7AM - now;
  setTimeout(() => {
    checkDailyNotifications();
    setInterval(checkDailyNotifications, 24 * 60 * 60 * 1000);
  }, msUntil7AM);
  console.log(`Scheduler aktif - berikutnya: ${next7AM.toLocaleString('id-ID')}`);
}

if (require.main === module) {
  ensureDB();
  app.listen(PORT, () => {
    console.log(`JJ-Rolu Farm Server berjalan di port ${PORT}`);
  });
}

module.exports = app;
