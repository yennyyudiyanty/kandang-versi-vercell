const express = require('express');
const router = express.Router();
const { getOne, getMany, sql } = require('../db/database');
const { authMiddleware, ownerOrAdmin } = require('../middleware/auth');
const { createNotificationForAll } = require('./notifications');

router.get('/:periodId', authMiddleware, async (req, res) => {
  try { res.json(await getOne('SELECT * FROM closing_checklist WHERE period_id = $1',[parseInt(req.params.periodId)]) || {}); } catch(err){res.status(500).json({error:err.message});}
});
router.put('/:periodId/planned-date', authMiddleware, ownerOrAdmin, async (req, res) => {
  try {
    const {planned_date} = req.body;
    if (!planned_date) return res.status(400).json({error:'Tanggal wajib diisi'});
    await sql`UPDATE closing_checklist SET planned_date = ${planned_date} WHERE period_id = ${parseInt(req.params.periodId)}`;
    const h3 = new Date(planned_date); h3.setDate(h3.getDate()-3);
    const today = new Date(); today.setHours(0,0,0,0);
    if (h3 >= today) {
      const period = await getOne('SELECT p.*, f.name as farm_name, f.location FROM periods p JOIN farms f ON p.farm_id = f.id WHERE p.id = $1',[parseInt(req.params.periodId)]);
      if (period) {
        const dateFormatted = new Date(planned_date).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
        await createNotificationForAll(`H-3 Persiapan Closing - ${period.farm_name}`,`3 hari lagi jadwal pembersihan kandang ${period.farm_name} - ${period.location} pada ${dateFormatted}`,'warning');
      }
    }
    res.json({success:true});
  } catch(err){res.status(500).json({error:err.message});}
});
router.put('/:periodId/check/:type', authMiddleware, ownerOrAdmin, async (req, res) => {
  try {
    const type = req.params.type;
    if (!['pembersihan','sanchin','bensin','konsumsi'].includes(type)) return res.status(400).json({error:'Tipe tidak valid'});
    const now = new Date().toISOString();
    await sql.query(`UPDATE closing_checklist SET ${type}_done = 1, ${type}_done_at = $1 WHERE period_id = $2`,[now,parseInt(req.params.periodId)]);
    res.json({success:true});
  } catch(err){res.status(500).json({error:err.message});}
});
router.put('/:periodId/bensin', authMiddleware, ownerOrAdmin, async (req, res) => {
  try {
    const {bensin_liter,bensin_nominal,bensin_date} = req.body;
    if (!bensin_liter||!bensin_date) return res.status(400).json({error:'Data tidak lengkap'});
    const now = new Date().toISOString();
    await sql`UPDATE closing_checklist SET bensin_liter = ${bensin_liter}, bensin_nominal = ${bensin_nominal||0}, bensin_date = ${bensin_date}, bensin_done = 1, bensin_done_at = ${now} WHERE period_id = ${parseInt(req.params.periodId)}`;
    res.json({success:true});
  } catch(err){res.status(500).json({error:err.message});}
});
router.put('/:periodId/finish-date', authMiddleware, ownerOrAdmin, async (req, res) => {
  try {
    const {finish_date} = req.body;
    if (!finish_date) return res.status(400).json({error:'Tanggal selesai wajib diisi'});
    await sql`UPDATE closing_checklist SET finish_date = ${finish_date} WHERE period_id = ${parseInt(req.params.periodId)}`;
    res.json({success:true});
  } catch(err){res.status(500).json({error:err.message});}
});
module.exports = router;
