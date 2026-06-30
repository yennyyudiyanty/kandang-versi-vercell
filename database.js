const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'jjrolu-farm-secret-2026';

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token tidak ditemukan' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token tidak valid atau sudah expired' });
  }
}

function ownerOnly(req, res, next) {
  if (req.user.role !== 'owner') return res.status(403).json({ error: 'Hanya owner yang bisa mengakses' });
  next();
}

function ownerOrAdmin(req, res, next) {
  if (!['owner','admin'].includes(req.user.role)) return res.status(403).json({ error: 'Akses ditolak' });
  next();
}

module.exports = { authMiddleware, ownerOnly, ownerOrAdmin, SECRET };
