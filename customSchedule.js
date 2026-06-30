const express = require('express');
const router = express.Router();
const { getMany, getOne, sql } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const data = await getMany('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50', [req.user.id]);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/unread-count', authMiddleware, async (req, res) => {
  try {
    const result = await getOne('SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = 0', [req.user.id]);
    res.json({ count: parseInt(result.count) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id/read', authMiddleware, async (req, res) => {
  try {
    await sql`UPDATE notifications SET is_read = 1 WHERE id = ${parseInt(req.params.id)} AND user_id = ${req.user.id}`;
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/read-all', authMiddleware, async (req, res) => {
  try {
    await sql`UPDATE notifications SET is_read = 1 WHERE user_id = ${req.user.id}`;
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

async function createNotificationForAll(title, message, type = 'info') {
  try {
    const users = await getMany('SELECT id FROM users');
    for (const u of users) {
      await sql`INSERT INTO notifications (user_id, title, message, type) VALUES (${u.id}, ${title}, ${message}, ${type})`;
    }
  } catch (err) { console.error('Notif error:', err.message); }
}

module.exports = { router, createNotificationForAll };
