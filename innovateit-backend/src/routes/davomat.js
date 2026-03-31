// ─── Davomat routes ────────────────────────────────
const { Router }      = require('express');
const pool            = require('../db');
const { requireAuth } = require('../middleware/jwt');

const router = Router();
router.use(requireAuth(['admin']));

// O'quvchilar davomati saqlash
router.post('/', async (req, res) => {
  const p = req.body;
  const { username } = req.user;
  const records = JSON.parse(p.records || '[]');
  const now = new Date().toLocaleTimeString('uz-UZ');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM davomat WHERE sana=$1 AND admin_username=$2', [p.sana, username]);
    for (const rec of records) {
      await client.query(
        `INSERT INTO davomat (sana,admin_username,sinf,oquvchi_ism,status,izoh,vaqt_belgilangan) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [p.sana, username, rec.sinf, rec.ism, rec.status, rec.izoh||'', now]
      );
    }
    await client.query('COMMIT');
    res.json({ ok: true, saved: records.length });
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
});

// O'quvchilar davomati olish
router.get('/', async (req, res) => {
  const { sana, adminUsername } = req.query;
  const { username, isSuper } = req.user;
  const target = (isSuper && adminUsername) ? adminUsername : username;
  const result = await pool.query(
    'SELECT sinf,oquvchi_ism,status,izoh FROM davomat WHERE sana=$1 AND admin_username=$2',
    [sana, target]
  );
  res.json({ ok: true, records: result.rows.map(r => ({ sinf: r.sinf, ism: r.oquvchi_ism, status: r.status, izoh: r.izoh })) });
});

// Sanalar tarixi
router.get('/tarix', async (req, res) => {
  const { adminUsername } = req.query;
  const { username, isSuper } = req.user;
  const target = (isSuper && adminUsername) ? adminUsername : username;
  const result = await pool.query('SELECT DISTINCT sana FROM davomat WHERE admin_username=$1 ORDER BY sana DESC', [target]);
  res.json({ ok: true, sanalar: result.rows.map(r => r.sana) });
});

// Range bo'yicha
router.get('/range', async (req, res) => {
  const { from, to, adminUsername } = req.query;
  const { username, isSuper } = req.user;
  if (!from || !to) return res.status(400).json({ ok: false, error: 'from va to sanalar kerak' });
  const target = (isSuper && adminUsername) ? adminUsername : username;
  const result = await pool.query(
    'SELECT sana,sinf,oquvchi_ism,status,izoh FROM davomat WHERE admin_username=$1 ORDER BY sinf,oquvchi_ism,sana',
    [target]
  );
  function parseUZ(uz) { const [d,m,y] = uz.split('.'); return new Date(`${y}-${m}-${d}`); }
  const fromDate = new Date(from); fromDate.setHours(0,0,0,0);
  const toDate   = new Date(to);   toDate.setHours(23,59,59,999);
  const filtered = result.rows.filter(r => { const d = parseUZ(r.sana); return d >= fromDate && d <= toDate; });
  res.json({ ok: true, records: filtered.map(r => ({ sana: r.sana, sinf: r.sinf, ism: r.oquvchi_ism, status: r.status, izoh: r.izoh||'' })) });
});

// O'qituvchi davomat saqlash
router.post('/teacher', async (req, res) => {
  const p = req.body;
  const { username } = req.user;
  const records = JSON.parse(p.records || '[]');
  const now = new Date().toLocaleTimeString('uz-UZ');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM oqituvchilar_davomat WHERE sana=$1 AND admin_username=$2', [p.sana, username]);
    for (const rec of records) {
      await client.query(
        `INSERT INTO oqituvchilar_davomat (sana,admin_username,oqituvchi_ism,fan,status,izoh,vaqt_belgilangan,dars_soat,dars_daqiqa,kech_minut)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [p.sana, username, rec.ism, rec.fan||'', rec.status, rec.izoh||'', now, rec.dars_soat||0, rec.dars_daqiqa||0, rec.kech_minut||0]
      );
    }
    await client.query('COMMIT');
    res.json({ ok: true, saved: records.length });
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
});

// O'qituvchi davomat olish
router.get('/teacher', async (req, res) => {
  const { sana } = req.query;
  const { username } = req.user;
  const result = await pool.query(
    'SELECT oqituvchi_ism,fan,status,izoh,dars_soat,dars_daqiqa,kech_minut FROM oqituvchilar_davomat WHERE sana=$1 AND admin_username=$2',
    [sana, username]
  );
  res.json({ ok: true, records: result.rows.map(r => ({
    ism: r.oqituvchi_ism, fan: r.fan, status: r.status, izoh: r.izoh,
    dars_soat: r.dars_soat||0, dars_daqiqa: r.dars_daqiqa||0, kech_minut: r.kech_minut||0
  }))});
});

module.exports = router;