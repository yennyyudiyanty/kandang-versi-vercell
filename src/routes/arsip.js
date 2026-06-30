const express = require('express');
const router = express.Router();
const { getMany, getOne, sql } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

function canAccess(req, res, next) {
  if (req.user.role === 'owner' || req.user.biaya_access === 1) return next();
  return res.status(403).json({ error: 'Akses tidak diizinkan' });
}

router.get('/recording/:periodId', authMiddleware, canAccess, async (req, res) => {
  try { res.json(await getMany('SELECT id,farm_id,image_name,uploaded_at,uploaded_by FROM recording_images WHERE period_id = $1 ORDER BY uploaded_at DESC',[parseInt(req.params.periodId)])); } catch(err){res.status(500).json({error:err.message});}
});
router.get('/recording/:periodId/:imageId', authMiddleware, canAccess, async (req, res) => {
  try {
    const data = await getOne('SELECT * FROM recording_images WHERE id = $1 AND period_id = $2',[parseInt(req.params.imageId),parseInt(req.params.periodId)]);
    if (!data) return res.status(404).json({error:'Gambar tidak ditemukan'});
    res.json(data);
  } catch(err){res.status(500).json({error:err.message});}
});
router.post('/recording', authMiddleware, canAccess, async (req, res) => {
  try {
    const {period_id,farm_id,image_data,image_name} = req.body;
    if (!period_id||!farm_id||!image_data) return res.status(400).json({error:'Data tidak lengkap'});
    if (image_data.length > 7*1024*1024) return res.status(400).json({error:'Ukuran gambar terlalu besar (maks 5MB)'});
    const r = await sql`INSERT INTO recording_images (period_id,farm_id,image_data,image_name,uploaded_by) VALUES (${period_id},${farm_id},${image_data},${image_name||'Recording'},${req.user.id}) RETURNING id`;
    res.json({success:true,id:r.rows[0].id});
  } catch(err){res.status(500).json({error:err.message});}
});
router.delete('/recording/:id', authMiddleware, canAccess, async (req, res) => {
  try { await sql`DELETE FROM recording_images WHERE id = ${parseInt(req.params.id)}`; res.json({success:true}); } catch(err){res.status(500).json({error:err.message});}
});
module.exports = router;
