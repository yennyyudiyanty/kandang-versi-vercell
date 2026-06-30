const express = require('express');
const router = express.Router();
const { getMany, getOne, sql } = require('../db/database');
const { authMiddleware, ownerOrAdmin } = require('../middleware/auth');

router.get('/solar-stock/:periodId', authMiddleware, async (req, res) => {
  try { res.json(await getOne('SELECT * FROM solar_stock WHERE period_id = $1', [parseInt(req.params.periodId)]) || {initial_stock:0}); } catch(err){res.status(500).json({error:err.message});}
});
router.put('/solar-stock/:periodId', authMiddleware, ownerOrAdmin, async (req, res) => {
  try { await sql`UPDATE solar_stock SET initial_stock = ${req.body.initial_stock||0} WHERE period_id = ${parseInt(req.params.periodId)}`; res.json({success:true}); } catch(err){res.status(500).json({error:err.message});}
});
router.get('/solar/:periodId', authMiddleware, async (req, res) => {
  try { res.json(await getMany('SELECT * FROM solar_transactions WHERE period_id = $1 ORDER BY trans_date DESC', [parseInt(req.params.periodId)])); } catch(err){res.status(500).json({error:err.message});}
});
router.post('/solar', authMiddleware, async (req, res) => {
  try {
    const {period_id,trans_date,quantity,type,nominal} = req.body;
    if (!period_id||!trans_date||!quantity||!type) return res.status(400).json({error:'Data tidak lengkap'});
    const r = await sql`INSERT INTO solar_transactions (period_id,trans_date,quantity,type,nominal,input_by) VALUES (${period_id},${trans_date},${quantity},${type},${nominal||0},${req.user.id}) RETURNING id`;
    res.json({success:true,id:r.rows[0].id});
  } catch(err){res.status(500).json({error:err.message});}
});

router.get('/sekam-stock/:periodId', authMiddleware, async (req, res) => {
  try { res.json(await getOne('SELECT * FROM sekam_stock WHERE period_id = $1',[parseInt(req.params.periodId)]) || {initial_stock:0,used_total:0,remaining:0}); } catch(err){res.status(500).json({error:err.message});}
});
router.put('/sekam-stock/:periodId', authMiddleware, ownerOrAdmin, async (req, res) => {
  try {
    const {initial_stock} = req.body;
    const cur = await getOne('SELECT * FROM sekam_stock WHERE period_id = $1',[parseInt(req.params.periodId)]);
    const used = cur?.used_total || 0;
    await sql`UPDATE sekam_stock SET initial_stock = ${initial_stock}, remaining = ${initial_stock - used} WHERE period_id = ${parseInt(req.params.periodId)}`;
    res.json({success:true});
  } catch(err){res.status(500).json({error:err.message});}
});
router.get('/sekam-usage/:periodId', authMiddleware, async (req, res) => {
  try { res.json(await getMany('SELECT * FROM sekam_usage WHERE period_id = $1 ORDER BY used_date DESC',[parseInt(req.params.periodId)])); } catch(err){res.status(500).json({error:err.message});}
});
router.post('/sekam-usage', authMiddleware, async (req, res) => {
  try {
    const {period_id,floor,quantity,used_date} = req.body;
    if (!period_id||!floor||!quantity||!used_date) return res.status(400).json({error:'Data tidak lengkap'});
    const r = await sql`INSERT INTO sekam_usage (period_id,floor,quantity,used_date,input_by) VALUES (${period_id},${floor},${quantity},${used_date},${req.user.id}) RETURNING id`;
    const stock = await getOne('SELECT * FROM sekam_stock WHERE period_id = $1',[period_id]);
    if (stock) {
      const newUsed = (stock.used_total||0) + quantity;
      await sql`UPDATE sekam_stock SET used_total = ${newUsed}, remaining = ${(stock.initial_stock||0) - newUsed} WHERE period_id = ${period_id}`;
    }
    res.json({success:true,id:r.rows[0].id});
  } catch(err){res.status(500).json({error:err.message});}
});

router.get('/harian/:periodId', authMiddleware, async (req, res) => {
  try { res.json(await getMany('SELECT * FROM daily_records WHERE period_id = $1 ORDER BY record_date DESC',[parseInt(req.params.periodId)])); } catch(err){res.status(500).json({error:err.message});}
});
router.post('/harian', authMiddleware, async (req, res) => {
  try {
    const {period_id,record_date,pakan_zak,karung_lembar,sekam_zak,pln_nominal,pdam_nominal,lpg_segel,lpg_kosong,lpg_terpakai,pelet_zak,gasolec_biji,extras} = req.body;
    if (!period_id||!record_date) return res.status(400).json({error:'Data tidak lengkap'});
    const r = await sql`INSERT INTO daily_records (period_id,record_date,pakan_zak,karung_lembar,sekam_zak,pln_nominal,pdam_nominal,lpg_segel,lpg_kosong,lpg_terpakai,pelet_zak,gasolec_biji,input_by) VALUES (${period_id},${record_date},${pakan_zak||0},${karung_lembar||0},${sekam_zak||0},${pln_nominal||0},${pdam_nominal||0},${lpg_segel||0},${lpg_kosong||0},${lpg_terpakai||0},${pelet_zak||0},${gasolec_biji||0},${req.user.id}) RETURNING id`;
    if (extras?.length) for (const e of extras) await sql`INSERT INTO daily_extras (daily_record_id,item_name,quantity) VALUES (${r.rows[0].id},${e.item_name},${e.quantity||0})`;
    res.json({success:true,id:r.rows[0].id});
  } catch(err){res.status(500).json({error:err.message});}
});

router.get('/obat/:periodId', authMiddleware, async (req, res) => {
  try { res.json(await getMany('SELECT * FROM medicine_stock WHERE period_id = $1 ORDER BY id',[parseInt(req.params.periodId)])); } catch(err){res.status(500).json({error:err.message});}
});
router.put('/obat/:id', authMiddleware, ownerOrAdmin, async (req, res) => {
  try {
    const {initial_stock,price_per_unit} = req.body;
    const cur = await getOne('SELECT * FROM medicine_stock WHERE id = $1',[parseInt(req.params.id)]);
    if (!cur) return res.status(404).json({error:'Obat tidak ditemukan'});
    const used = cur.initial_stock - cur.current_stock;
    await sql`UPDATE medicine_stock SET initial_stock = ${initial_stock||0}, current_stock = ${Math.max(0,initial_stock-used)}, price_per_unit = ${price_per_unit||0} WHERE id = ${parseInt(req.params.id)}`;
    res.json({success:true});
  } catch(err){res.status(500).json({error:err.message});}
});
router.post('/obat', authMiddleware, ownerOrAdmin, async (req, res) => {
  try {
    const {period_id,medicine_name,is_custom} = req.body;
    if (!period_id||!medicine_name) return res.status(400).json({error:'Data tidak lengkap'});
    const r = await sql`INSERT INTO medicine_stock (period_id,medicine_name,initial_stock,current_stock,is_custom) VALUES (${period_id},${medicine_name},0,0,${is_custom?1:0}) RETURNING id`;
    res.json({success:true,id:r.rows[0].id});
  } catch(err){res.status(500).json({error:err.message});}
});
router.post('/obat-keluar', authMiddleware, ownerOrAdmin, async (req, res) => {
  try {
    const {medicine_stock_id,period_id,quantity,out_date,notes} = req.body;
    if (!medicine_stock_id||!quantity||!out_date) return res.status(400).json({error:'Data tidak lengkap'});
    const stock = await getOne('SELECT * FROM medicine_stock WHERE id = $1',[parseInt(medicine_stock_id)]);
    if (!stock) return res.status(404).json({error:'Stok tidak ditemukan'});
    if (quantity > stock.current_stock) return res.status(400).json({error:`Melebihi stok (${stock.current_stock})`});
    await sql`INSERT INTO medicine_out (medicine_stock_id,period_id,quantity,out_date,input_by,notes) VALUES (${medicine_stock_id},${period_id},${quantity},${out_date},${req.user.id},${notes||null})`;
    await sql`UPDATE medicine_stock SET current_stock = current_stock - ${quantity} WHERE id = ${parseInt(medicine_stock_id)}`;
    res.json({success:true});
  } catch(err){res.status(500).json({error:err.message});}
});

router.get('/kasbon/:periodId', authMiddleware, async (req, res) => {
  try { res.json(await getMany('SELECT * FROM kasbon WHERE period_id = $1 ORDER BY kasbon_date DESC',[parseInt(req.params.periodId)])); } catch(err){res.status(500).json({error:err.message});}
});
router.post('/kasbon', authMiddleware, ownerOrAdmin, async (req, res) => {
  try {
    const {period_id,farm_id,abk_name,kasbon_date,nominal} = req.body;
    if (!period_id||!farm_id||!abk_name||!kasbon_date||!nominal) return res.status(400).json({error:'Data tidak lengkap'});
    const r = await sql`INSERT INTO kasbon (period_id,farm_id,abk_name,kasbon_date,nominal,input_by) VALUES (${period_id},${farm_id},${abk_name},${kasbon_date},${nominal},${req.user.id}) RETURNING id`;
    res.json({success:true,id:r.rows[0].id});
  } catch(err){res.status(500).json({error:err.message});}
});

router.get('/konsumsi-schedule/:farmId', authMiddleware, async (req, res) => {
  try { res.json(await getOne('SELECT * FROM konsumsi_schedule WHERE farm_id = $1',[parseInt(req.params.farmId)])); } catch(err){res.status(500).json({error:err.message});}
});
router.put('/konsumsi-schedule/:farmId', authMiddleware, ownerOrAdmin, async (req, res) => {
  try { await sql`UPDATE konsumsi_schedule SET day_of_week = ${req.body.day_of_week}, updated_by = ${req.user.id} WHERE farm_id = ${parseInt(req.params.farmId)}`; res.json({success:true}); } catch(err){res.status(500).json({error:err.message});}
});
router.get('/konsumsi/:periodId', authMiddleware, async (req, res) => {
  try { res.json(await getMany('SELECT * FROM konsumsi_abk WHERE period_id = $1 AND is_given = 1 ORDER BY given_date DESC',[parseInt(req.params.periodId)])); } catch(err){res.status(500).json({error:err.message});}
});
router.post('/konsumsi/tandai', authMiddleware, ownerOrAdmin, async (req, res) => {
  try {
    const {period_id,farm_id,given_date} = req.body;
    const now = new Date().toISOString();
    const existing = await getOne('SELECT id FROM konsumsi_abk WHERE period_id = $1 AND given_date = $2',[period_id,given_date]);
    if (existing) { await sql`UPDATE konsumsi_abk SET is_given = 1, given_by = ${req.user.id}, given_at = ${now} WHERE id = ${existing.id}`; }
    else { await sql`INSERT INTO konsumsi_abk (period_id,farm_id,given_date,is_given,given_by,given_at) VALUES (${period_id},${farm_id},${given_date},1,${req.user.id},${now})`; }
    res.json({success:true});
  } catch(err){res.status(500).json({error:err.message});}
});

router.get('/logistik-abk/:periodId', authMiddleware, async (req, res) => {
  try { res.json(await getMany('SELECT * FROM logistik_abk WHERE period_id = $1 ORDER BY created_at DESC',[parseInt(req.params.periodId)])); } catch(err){res.status(500).json({error:err.message});}
});
router.post('/logistik-abk', authMiddleware, ownerOrAdmin, async (req, res) => {
  try {
    const {period_id,farm_id,item_name,quantity,nominal} = req.body;
    if (!period_id||!farm_id||!item_name||!quantity) return res.status(400).json({error:'Data tidak lengkap'});
    const r = await sql`INSERT INTO logistik_abk (period_id,farm_id,item_name,quantity,nominal,input_by) VALUES (${period_id},${farm_id},${item_name},${quantity},${nominal||0},${req.user.id}) RETURNING id`;
    res.json({success:true,id:r.rows[0].id});
  } catch(err){res.status(500).json({error:err.message});}
});

router.get('/master-harga', authMiddleware, ownerOrAdmin, async (req, res) => {
  try { res.json(await getMany('SELECT * FROM master_prices ORDER BY item_name')); } catch(err){res.status(500).json({error:err.message});}
});
router.put('/master-harga/:id', authMiddleware, ownerOrAdmin, async (req, res) => {
  try { await sql`UPDATE master_prices SET price_per_unit = ${req.body.price_per_unit||0}, updated_by = ${req.user.id}, updated_at = NOW() WHERE id = ${parseInt(req.params.id)}`; res.json({success:true}); } catch(err){res.status(500).json({error:err.message});}
});

module.exports = router;
