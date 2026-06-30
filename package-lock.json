const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getOne, getMany, sql } = require('../db/database');
const { authMiddleware, ownerOnly, SECRET } = require('../middleware/auth');

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username dan password wajib diisi' });
    const user = await getOne('SELECT * FROM users WHERE username = $1', [username]);
    if (!user) return res.status(401).json({ error: 'Username atau password salah' });
    if (!bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Username atau password salah' });
    const token = jwt.sign({ id: user.id, name: user.name, username: user.username, role: user.role, farm: user.farm, biaya_access: user.biaya_access }, SECRET, { expiresIn: '8h' });
    res.json({ token, user: { id: user.id, name: user.name, username: user.username, role: user.role, farm: user.farm, biaya_access: user.biaya_access } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/users', authMiddleware, ownerOnly, async (req, res) => {
  try {
    const users = await getMany('SELECT id, name, username, role, farm, whatsapp, biaya_access, created_at FROM users ORDER BY role, name');
    res.json(users);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/users', authMiddleware, ownerOnly, async (req, res) => {
  try {
    const { name, username, password, role, farm, whatsapp } = req.body;
    if (!name || !username || !password || !role) return res.status(400).json({ error: 'Data tidak lengkap' });
    const existing = await getOne('SELECT id FROM users WHERE username = $1', [username]);
    if (existing) return res.status(400).json({ error: 'Username sudah dipakai' });
    const hashed = bcrypt.hashSync(password, 10);
    const result = await sql`INSERT INTO users (name, username, password, role, farm, whatsapp) VALUES (${name}, ${username}, ${hashed}, ${role}, ${farm || 'all'}, ${whatsapp || null}) RETURNING id`;
    res.json({ success: true, id: result.rows[0].id, message: 'User berhasil ditambahkan' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/users/:id/password', authMiddleware, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password baru wajib diisi' });
    if (req.user.role !== 'owner' && req.user.id !== targetId) return res.status(403).json({ error: 'Tidak bisa ubah password user lain' });
    const hashed = bcrypt.hashSync(password, 10);
    await sql`UPDATE users SET password = ${hashed} WHERE id = ${targetId}`;
    res.json({ success: true, message: 'Password berhasil diubah' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/users/:id/biaya-access', authMiddleware, ownerOnly, async (req, res) => {
  try {
    const { access } = req.body;
    await sql`UPDATE users SET biaya_access = ${access ? 1 : 0} WHERE id = ${parseInt(req.params.id)}`;
    res.json({ success: true, message: `Akses biaya ${access ? 'diberikan' : 'dicabut'}` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/users/:id', authMiddleware, ownerOnly, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    if (req.user.id === targetId) return res.status(400).json({ error: 'Tidak bisa hapus akun sendiri' });
    await sql`DELETE FROM users WHERE id = ${targetId}`;
    res.json({ success: true, message: 'User berhasil dihapus' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
