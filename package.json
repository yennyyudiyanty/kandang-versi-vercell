const express = require('express');
const router = express.Router();
const { getMany, getOne, sql } = require('../db/database');
const { authMiddleware, ownerOnly } = require('../middleware/auth');

function canAccessBiaya(req, res, next) {
  if (req.user.role === 'owner' || req.user.biaya_access === 1) return next();
  return res.status(403).json({ error: 'Akses tidak diizinkan' });
}

router.get('/:periodId', authMiddleware, canAccessBiaya, async (req, res) => {
  try { res.json(await getMany('SELECT * FROM operational_costs WHERE period_id = $1 ORDER BY cost_date DESC, category',[parseInt(req.params.periodId)])); } catch(err){res.status(500).json({error:err.message});}
});

router.post('/', authMiddleware, canAccessBiaya, async (req, res) => {
  try {
    const {period_id,farm_id,cost_date,category,item_name,nominal} = req.body;
    if (!period_id||!farm_id||!cost_date||!category||!item_name||!nominal) return res.status(400).json({error:'Data tidak lengkap'});
    const r = await sql`INSERT INTO operational_costs (period_id,farm_id,cost_date,category,item_name,nominal,is_auto,input_by) VALUES (${period_id},${farm_id},${cost_date},${category},${item_name},${nominal},0,${req.user.id}) RETURNING id`;
    res.json({success:true,id:r.rows[0].id});
  } catch(err){res.status(500).json({error:err.message});}
});

router.delete('/:id', authMiddleware, ownerOnly, async (req, res) => {
  try {
    const cost = await getOne('SELECT * FROM operational_costs WHERE id = $1',[parseInt(req.params.id)]);
    if (cost?.is_auto) return res.status(400).json({error:'Data otomatis tidak bisa dihapus'});
    await sql`DELETE FROM operational_costs WHERE id = ${parseInt(req.params.id)}`;
    res.json({success:true});
  } catch(err){res.status(500).json({error:err.message});}
});

router.get('/:periodId/export', authMiddleware, canAccessBiaya, async (req, res) => {
  try {
    const periodId = parseInt(req.params.periodId);
    const data = await getMany('SELECT * FROM operational_costs WHERE period_id = $1 ORDER BY category, cost_date',[periodId]);
    const period = await getOne('SELECT * FROM periods WHERE id = $1',[periodId]);
    const farm = period ? await getOne('SELECT * FROM farms WHERE id = $1',[period.farm_id]) : null;
    let csv = `JJ-Rolu Farm - Biaya Operasional\nFarm:,${farm?.name||''} - ${farm?.location||''}\nPeriode:,${period?.period_number||''}\nChick In:,${period?.chick_in_date||''}\n\nTanggal,Kategori,Item Biaya,Nominal\n`;
    const grouped = {};
    data.forEach(d => { csv += `${d.cost_date},${d.category},${d.item_name},${d.nominal}\n`; grouped[d.category] = (grouped[d.category]||0) + d.nominal; });
    csv += `\nRingkasan per Kategori\n`;
    Object.entries(grouped).forEach(([k,v]) => { csv += `${k},,${v}\n`; });
    csv += `\nGRAND TOTAL,,${data.reduce((s,d)=>s+d.nominal,0)}\n`;
    if (period?.fcr > 0) csv += `\nFCR,,${period.fcr}\nTotal Pakan (zak),,${period.pakan_total_zak}\nTonase Panen (kg),,${period.tonase_panen}\n`;
    res.json({csv});
  } catch(err){res.status(500).json({error:err.message});}
});

module.exports = router;
