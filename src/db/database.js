const { sql } = require('@vercel/postgres');

async function query(text, params = []) {
  try {
    const result = await sql.query(text, params);
    return result;
  } catch (err) {
    console.error('DB Query Error:', err.message);
    throw err;
  }
}

async function getOne(text, params = []) {
  const result = await query(text, params);
  return result.rows[0] || null;
}

async function getMany(text, params = []) {
  const result = await query(text, params);
  return result.rows;
}

async function run(text, params = []) {
  const result = await query(text, params);
  return result;
}

async function initDB() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('owner','admin','petugas')),
        farm TEXT DEFAULT 'all',
        whatsapp TEXT,
        biaya_access INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS farms (
        id SERIAL PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        location TEXT NOT NULL
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS periods (
        id SERIAL PRIMARY KEY,
        farm_id INTEGER NOT NULL REFERENCES farms(id),
        period_number INTEGER NOT NULL,
        chick_in_date TEXT NOT NULL,
        doc_count INTEGER DEFAULT 0,
        doc_price INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active' CHECK(status IN ('active','closed')),
        closed_at TEXT,
        pakan_total_zak REAL DEFAULT 0,
        tonase_panen REAL DEFAULT 0,
        fcr REAL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS todo_list (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        notes TEXT,
        farm_target TEXT DEFAULT 'all',
        created_by INTEGER NOT NULL REFERENCES users(id),
        is_done INTEGER DEFAULT 0,
        done_by INTEGER,
        done_at TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS ovk_schedule (
        id SERIAL PRIMARY KEY,
        period_id INTEGER NOT NULL REFERENCES periods(id),
        day_number INTEGER NOT NULL,
        activity TEXT NOT NULL,
        scheduled_date TEXT NOT NULL,
        is_done INTEGER DEFAULT 0,
        done_at TEXT,
        notes TEXT
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS custom_schedule (
        id SERIAL PRIMARY KEY,
        period_id INTEGER NOT NULL REFERENCES periods(id),
        farm_id INTEGER NOT NULL REFERENCES farms(id),
        title TEXT NOT NULL,
        scheduled_date TEXT NOT NULL,
        reminder_type TEXT DEFAULT 'H-1',
        is_done INTEGER DEFAULT 0,
        done_at TEXT,
        notes TEXT,
        created_by INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT DEFAULT 'info',
        is_read INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS brooding_items (
        id SERIAL PRIMARY KEY,
        period_id INTEGER NOT NULL REFERENCES periods(id),
        name TEXT NOT NULL,
        quantity REAL,
        unit TEXT,
        sent_date TEXT,
        is_checked INTEGER DEFAULT 0,
        is_custom INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS sekam_stock (
        id SERIAL PRIMARY KEY,
        period_id INTEGER NOT NULL REFERENCES periods(id),
        initial_stock REAL DEFAULT 0,
        used_total REAL DEFAULT 0,
        remaining REAL DEFAULT 0
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS sekam_usage (
        id SERIAL PRIMARY KEY,
        period_id INTEGER NOT NULL REFERENCES periods(id),
        floor TEXT NOT NULL,
        quantity REAL NOT NULL,
        used_date TEXT NOT NULL,
        input_by INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS solar_stock (
        id SERIAL PRIMARY KEY,
        period_id INTEGER NOT NULL REFERENCES periods(id),
        initial_stock REAL DEFAULT 0
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS solar_transactions (
        id SERIAL PRIMARY KEY,
        period_id INTEGER NOT NULL REFERENCES periods(id),
        trans_date TEXT NOT NULL,
        quantity REAL NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('beli','bawa')),
        nominal INTEGER DEFAULT 0,
        input_by INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS daily_records (
        id SERIAL PRIMARY KEY,
        period_id INTEGER NOT NULL REFERENCES periods(id),
        record_date TEXT NOT NULL,
        pakan_zak REAL DEFAULT 0,
        karung_lembar REAL DEFAULT 0,
        sekam_zak REAL DEFAULT 0,
        pln_nominal INTEGER DEFAULT 0,
        pdam_nominal INTEGER DEFAULT 0,
        lpg_segel INTEGER DEFAULT 0,
        lpg_kosong INTEGER DEFAULT 0,
        lpg_terpakai INTEGER DEFAULT 0,
        pelet_zak REAL DEFAULT 0,
        gasolec_biji INTEGER DEFAULT 0,
        input_by INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS daily_extras (
        id SERIAL PRIMARY KEY,
        daily_record_id INTEGER NOT NULL REFERENCES daily_records(id),
        item_name TEXT NOT NULL,
        quantity REAL,
        unit TEXT
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS medicine_stock (
        id SERIAL PRIMARY KEY,
        period_id INTEGER NOT NULL REFERENCES periods(id),
        medicine_name TEXT NOT NULL,
        initial_stock REAL DEFAULT 0,
        current_stock REAL DEFAULT 0,
        unit TEXT DEFAULT 'pcs',
        price_per_unit INTEGER DEFAULT 0,
        is_custom INTEGER DEFAULT 0
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS medicine_out (
        id SERIAL PRIMARY KEY,
        medicine_stock_id INTEGER NOT NULL REFERENCES medicine_stock(id),
        period_id INTEGER NOT NULL REFERENCES periods(id),
        quantity REAL NOT NULL,
        out_date TEXT NOT NULL,
        input_by INTEGER NOT NULL REFERENCES users(id),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS kasbon (
        id SERIAL PRIMARY KEY,
        period_id INTEGER NOT NULL REFERENCES periods(id),
        farm_id INTEGER NOT NULL REFERENCES farms(id),
        abk_name TEXT NOT NULL,
        kasbon_date TEXT NOT NULL,
        nominal INTEGER NOT NULL,
        input_by INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS konsumsi_abk (
        id SERIAL PRIMARY KEY,
        period_id INTEGER NOT NULL REFERENCES periods(id),
        farm_id INTEGER NOT NULL REFERENCES farms(id),
        given_date TEXT NOT NULL,
        is_given INTEGER DEFAULT 0,
        given_by INTEGER,
        given_at TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS konsumsi_schedule (
        id SERIAL PRIMARY KEY,
        farm_id INTEGER NOT NULL UNIQUE REFERENCES farms(id),
        day_of_week INTEGER NOT NULL,
        updated_by INTEGER,
        updated_at TEXT
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS logistik_abk (
        id SERIAL PRIMARY KEY,
        period_id INTEGER NOT NULL REFERENCES periods(id),
        farm_id INTEGER NOT NULL REFERENCES farms(id),
        item_name TEXT NOT NULL,
        quantity REAL NOT NULL,
        nominal INTEGER DEFAULT 0,
        input_by INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS master_prices (
        id SERIAL PRIMARY KEY,
        item_name TEXT NOT NULL,
        item_code TEXT UNIQUE NOT NULL,
        price_per_unit INTEGER DEFAULT 0,
        unit TEXT NOT NULL,
        updated_by INTEGER,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS operational_costs (
        id SERIAL PRIMARY KEY,
        period_id INTEGER NOT NULL REFERENCES periods(id),
        farm_id INTEGER NOT NULL REFERENCES farms(id),
        cost_date TEXT NOT NULL,
        category TEXT NOT NULL,
        item_name TEXT NOT NULL,
        nominal INTEGER NOT NULL,
        is_auto INTEGER DEFAULT 0,
        source_table TEXT,
        input_by INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS closing_checklist (
        id SERIAL PRIMARY KEY,
        period_id INTEGER NOT NULL REFERENCES periods(id),
        planned_date TEXT,
        finish_date TEXT,
        pembersihan_done INTEGER DEFAULT 0,
        pembersihan_done_at TEXT,
        sanchin_done INTEGER DEFAULT 0,
        sanchin_done_at TEXT,
        bensin_liter REAL DEFAULT 0,
        bensin_date TEXT,
        bensin_nominal INTEGER DEFAULT 0,
        bensin_done INTEGER DEFAULT 0,
        bensin_done_at TEXT,
        konsumsi_done INTEGER DEFAULT 0,
        konsumsi_done_at TEXT
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS recording_images (
        id SERIAL PRIMARY KEY,
        period_id INTEGER NOT NULL REFERENCES periods(id),
        farm_id INTEGER NOT NULL REFERENCES farms(id),
        image_data TEXT NOT NULL,
        image_name TEXT,
        uploaded_by INTEGER NOT NULL REFERENCES users(id),
        uploaded_at TIMESTAMP DEFAULT NOW()
      )
    `;

    const farmCount = await getOne('SELECT COUNT(*) as count FROM farms');
    if (parseInt(farmCount.count) === 0) {
      await sql`INSERT INTO farms (code, name, location) VALUES ('farm1', 'Farm 1', 'Kaliajeng')`;
      await sql`INSERT INTO farms (code, name, location) VALUES ('farm2', 'Farm 2', 'Kebun Agung')`;
      console.log('Default farms created');
    }

    const schedCount = await getOne('SELECT COUNT(*) as count FROM konsumsi_schedule');
    if (parseInt(schedCount.count) === 0) {
      await sql`INSERT INTO konsumsi_schedule (farm_id, day_of_week) VALUES (1, 3)`;
      await sql`INSERT INTO konsumsi_schedule (farm_id, day_of_week) VALUES (2, 1)`;
    }

    const priceCount = await getOne('SELECT COUNT(*) as count FROM master_prices');
    if (parseInt(priceCount.count) === 0) {
      const prices = [
        ['Pakan','pakan','zak'],['Sekam','sekam','zak'],['Karung','karung','lembar'],
        ['LPG','lpg','tabung'],['Pelet','pelet','zak'],['Gasolec','gasolec','biji'],
        ['Solar','solar','liter'],['Beras','beras','kg'],['Mie','mie','buah'],
        ['Telur','telur','biji'],['Minyak Goreng','minyak','liter'],
        ['Teh','teh','pak'],['Kopi','kopi','pak'],['Gula','gula','kg']
      ];
      for (const [name, code, unit] of prices) {
        await sql`INSERT INTO master_prices (item_name, item_code, unit) VALUES (${name}, ${code}, ${unit}) ON CONFLICT (item_code) DO NOTHING`;
      }
    }

    console.log('Database initialized successfully');
  } catch (err) {
    console.error('DB init error:', err.message);
    throw err;
  }
}

module.exports = { sql, query, getOne, getMany, run, initDB };
