const express = require('express');
const router = express.Router();
const { getMany, sql } = require('../db/database');
const { authMiddleware, ownerOrAdmin } = require('../middleware/auth');

router.get('/period/:periodId', authMiddleware, async (req, res) => {
  try { res.json(await getMany('SELECT * FROM custom_schedule WHERE period_id = $1 ORDER BY scheduled_date',[parseInt(req.params.periodId)])); } catch(err){res.status(500).json({error:err.message});}
});
router.post('/', authMiddleware, ownerOrAdmin, async (req, res) => {
  try {
    const {period_id,farm_id,title,scheduled_date,reminder_type,notes} = req.body;
    if (!period_id||!farm_id||!title||!scheduled_date) return res.status(400).json({error:'Data tidak lengkap'});
    const r = await sql`INSERT INTO custom_schedule (period_id,farm_id,title,scheduled_date,reminder_type,notes,created_by) VALUES (${period_id},${farm_id},${title},${scheduled_date},${reminder_type||'H-1'},${notes||null},${req.user.id}) RETURNING id`;
    res.json({success:true,id:r.rows[0].id});
  } catch(err){res.status(500).json({error:err.message});}
});
router.put('/:id/done', authMiddleware, ownerOrAdmin, async (req, res) => {
  try { await sql`UPDATE custom_schedule SET is_done = 1, done_at = ${new Date().toISOString()} WHERE id = ${parseInt(req.params.id)}`; res.json({success:true}); } catch(err){res.status(500).json({error:err.message});}
});
router.delete('/:id', authMiddleware, ownerOrAdmin, async (req, res) => {
  try { await sql`DELETE FROM custom_schedule WHERE id = ${parseInt(req.params.id)}`; res.json({success:true}); } catch(err){res.status(500).json({error:err.message});}
});
module.exports = router;
