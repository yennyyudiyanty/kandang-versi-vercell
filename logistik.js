const express = require('express');
const router = express.Router();
const { getMany, sql } = require('../db/database');
const { authMiddleware, ownerOrAdmin } = require('../middleware/auth');
const { createNotificationForAll } = require('./notifications');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const todos = await getMany(`SELECT t.*, u.name as created_by_name, u2.name as done_by_name FROM todo_list t LEFT JOIN users u ON t.created_by = u.id LEFT JOIN users u2 ON t.done_by = u2.id WHERE t.is_done = 0 ORDER BY t.created_at DESC`);
    res.json(todos);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/done', authMiddleware, ownerOrAdmin, async (req, res) => {
  try {
    const todos = await getMany(`SELECT t.*, u.name as created_by_name FROM todo_list t LEFT JOIN users u ON t.created_by = u.id WHERE t.is_done = 1 ORDER BY t.done_at DESC LIMIT 100`);
    res.json(todos);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authMiddleware, ownerOrAdmin, async (req, res) => {
  try {
    const { title, notes, farm_target } = req.body;
    if (!title) return res.status(400).json({ error: 'Judul tugas wajib diisi' });
    const result = await sql`INSERT INTO todo_list (title, notes, farm_target, created_by) VALUES (${title}, ${notes || null}, ${farm_target || 'all'}, ${req.user.id}) RETURNING id`;
    const farmLabel = farm_target === 'farm1' ? 'Farm 1 - Kaliajeng' : farm_target === 'farm2' ? 'Farm 2 - Kebun Agung' : 'Semua Farm';
    await createNotificationForAll('Tugas Baru', `${title} - ${farmLabel}`, 'todo');
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id/done', authMiddleware, ownerOrAdmin, async (req, res) => {
  try {
    const now = new Date().toISOString();
    await sql`UPDATE todo_list SET is_done = 1, done_by = ${req.user.id}, done_at = ${now} WHERE id = ${parseInt(req.params.id)}`;
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authMiddleware, ownerOrAdmin, async (req, res) => {
  try {
    await sql`DELETE FROM todo_list WHERE id = ${parseInt(req.params.id)}`;
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
