const express = require('express');
const router = express.Router();
const { getMany, getOne, sql } = require('../db/database');
const { authMiddleware, ownerOnly, ownerOrAdmin } = require('../middleware/auth');
const { createNotificationForAll } = require('./notifications');

const OVK_SCHEDULE = [
  {day:3,activity:'Kapur'},{day:7,activity:'Jamu'},{day:8,activity:'Jamu'},
  {day:9,activity:'Jamu'},{day:10,activity:'Vaksin'},{day:11,activity:'Vaksin'},
  {day:15,activity:'Seser Sekam Lantai Atas'},{day:20,activity:'Seser Sekam Lantai Bawah'},
  {day:30,activity:'Rhodovit'},{day:31,activity:'Rhodovit'},{day:32,activity:'Rhodovit'}
];

const DEFAULT_MEDICINES = ['Fortevit 100gr','Paramed 100gr','Vitastress 250gr','Sulfur Badak','Therapy 250gr','Rhodivit 100gr','Gumbonal 100gr'];
const DEFAULT_BROODING = [{name:'Pocari',unit:'botol'},{name:'Sekam',unit:'zak'},{name:'Koran',unit:'lembar'},{name:'Konsentrat',unit:'zak'},{name:'Konsumsi ABK',unit:'paket'}];

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days - 1);
  return d.toISOString().split('T')[0];
}

router.get('/farm/:farmId', authMiddleware, async (req, res) => {
  try {
    const data = await getMany('SELECT p.*, f.name as farm_name, f.location FROM periods p JOIN farms f ON p.farm_id = f.id WHERE p.farm_id = $1 ORDER BY p.period_number DESC', [parseInt(req.params.farmId)]);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const data = await getOne('SELECT p.*, f.name as farm_name, f.location FROM periods p JOIN farms f ON p.farm_id = f.id WHERE p.id = $1', [parseInt(req.params.id)]);
    if (!data) return res.status(404).json({ error: 'Periode tidak ditemukan' });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authMiddleware, ownerOrAdmin, async (req, res) => {
  try {
    const { farm_id, chick_in_date, doc_count, doc_price } = req.body;
    if (!farm_id || !chick_in_date) return res.status(400).json({ error: 'Farm dan tanggal CI wajib diisi' });

    const lastP = await getOne('SELECT MAX(period_number) as max_num FROM periods WHERE farm_id = $1', [farm_id]);
    const newNum = (parseInt(lastP.max_num) || 0) + 1;

    const pResult = await sql`INSERT INTO periods (farm_id, period_number, chick_in_date, doc_count, doc_price) VALUES (${farm_id}, ${newNum}, ${chick_in_date}, ${doc_count||0}, ${doc_price||0}) RETURNING id`;
    const periodId = pResult.rows[0].id;

    for (const item of OVK_SCHEDULE) {
      const scheduledDate = addDays(chick_in_date, item.day);
      await sql`INSERT INTO ovk_schedule (period_id, day_number, activity, scheduled_date) VALUES (${periodId}, ${item.day}, ${item.activity}, ${scheduledDate})`;
    }

    for (const med of DEFAULT_MEDICINES) {
      await sql`INSERT INTO medicine_stock (period_id, medicine_name) VALUES (${periodId}, ${med})`;
    }

    for (const item of DEFAULT_BROODING) {
      await sql`INSERT INTO brooding_items (period_id, name, unit) VALUES (${periodId}, ${item.name}, ${item.unit})`;
    }

    await sql`INSERT INTO sekam_stock (period_id) VALUES (${periodId})`;
    await sql`INSERT INTO solar_stock (period_id) VALUES (${periodId})`;
    await sql`INSERT INTO closing_checklist (period_id) VALUES (${periodId})`;

    const farm = await getOne('SELECT * FROM farms WHERE id = $1', [farm_id]);
    const h3Date = new Date(chick_in_date);
    h3Date.setDate(h3Date.getDate() - 3);
    const today = new Date(); today.setHours(0,0,0,0);

    if (h3Date >= today) {
      const ciFormatted = new Date(chick_in_date).toLocaleDateString('id-ID', {day:'numeric',month:'long',year:'numeric'});
      await createNotificationForAll(`H-3 Sebelum Chick In - ${farm.name}`, `3 hari lagi Chick In di ${farm.name} - ${farm.location} pada ${ciFormatted}. Pastikan persiapan brooding sudah siap.`, 'warning');
    }

    res.json({ success: true, id: periodId, period_number: newNum });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/ovk', authMiddleware, async (req, res) => {
  try {
    const data = await getMany('SELECT * FROM ovk_schedule WHERE period_id = $1 ORDER BY day_number', [parseInt(req.params.id)]);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id/ovk/:ovkId/done', authMiddleware, async (req, res) => {
  try {
    const now = new Date().toISOString();
    await sql`UPDATE ovk_schedule SET is_done = 1, done_at = ${now} WHERE id = ${parseInt(req.params.ovkId)} AND period_id = ${parseInt(req.params.id)}`;
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/brooding-items', authMiddleware, async (req, res) => {
  try {
    const data = await getMany('SELECT * FROM brooding_items WHERE period_id = $1 ORDER BY id', [parseInt(req.params.id)]);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id/brooding-items/:itemId', authMiddleware, ownerOrAdmin, async (req, res) => {
  try {
    const { quantity, sent_date, is_checked } = req.body;
    await sql`UPDATE brooding_items SET quantity = ${quantity||null}, sent_date = ${sent_date||null}, is_checked = ${is_checked?1:0} WHERE id = ${parseInt(req.params.itemId)} AND period_id = ${parseInt(req.params.id)}`;
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/brooding-items', authMiddleware, ownerOrAdmin, async (req, res) => {
  try {
    const { name, unit } = req.body;
    if (!name) return res.status(400).json({ error: 'Nama barang wajib diisi' });
    const result = await sql`INSERT INTO brooding_items (period_id, name, unit, is_custom) VALUES (${parseInt(req.params.id)}, ${name}, ${unit||'unit'}, 1) RETURNING id`;
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/close', authMiddleware, ownerOnly, async (req, res) => {
  try {
    const { pakan_total_zak, tonase_panen } = req.body;
    if (!tonase_panen || tonase_panen <= 0) return res.status(400).json({ error: 'Tonase panen wajib diisi sebelum menutup periode' });
    const fcr = pakan_total_zak && tonase_panen ? parseFloat(((pakan_total_zak * 50) / tonase_panen).toFixed(3)) : 0;
    const now = new Date().toISOString();
    await sql`UPDATE periods SET status = 'closed', closed_at = ${now}, pakan_total_zak = ${pakan_total_zak||0}, tonase_panen = ${tonase_panen}, fcr = ${fcr} WHERE id = ${parseInt(req.params.id)}`;
    res.json({ success: true, fcr });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id/pakan', authMiddleware, ownerOnly, async (req, res) => {
  try {
    const { pakan_total_zak } = req.body;
    await sql`UPDATE periods SET pakan_total_zak = ${pakan_total_zak||0} WHERE id = ${parseInt(req.params.id)}`;
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
