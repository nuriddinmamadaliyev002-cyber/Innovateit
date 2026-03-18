// ─── Students routes ───────────────────────────────
// GET    /api/students           — ro'yxat
// POST   /api/students           — qo'shish
// PUT    /api/students           — tahrirlash
// DELETE /api/students           — o'chirish
// POST   /api/students/inactive  — nofaolga o'tkazish
// GET    /api/students/inactive  — nofaollar ro'yxati
// POST   /api/students/activate  — faolga qaytarish
// PUT    /api/students/inactive  — nofaolni tahrirlash
// DELETE /api/students/inactive  — nofaolni o'chirish
const { Router } = require('express');
const pool = require('../db');
const { verifyAdmin } = require('../middleware/auth');

const router = Router();

function todayUZ() { return new Date().toLocaleDateString('ru-RU'); }

// ─── GET /api/students ───
router.get('/', async (req, res) => {
  const { username, parol } = req.query;
  const admin = await verifyAdmin(username, parol);
  if (!admin) return res.status(401).json({ ok: false, error: "Ruxsat yo'q" });

  const query  = admin.isSuper ? 'SELECT * FROM oquvchilar ORDER BY id' : 'SELECT * FROM oquvchilar WHERE admin=$1 ORDER BY id';
  const params = admin.isSuper ? [] : [username];
  const result = await pool.query(query, params);
  res.json({ ok: true, students: result.rows.map(r => ({
    ism: r.ism, familiya: r.familiya, maktab: r.maktab, sinf: r.sinf,
    telefon: r.telefon, telefon2: r.telefon2, tug: r.tug, manzil: r.manzil,
    admin: r.admin, date: r.qoshilgan, boshlagan: r.boshlagan
  }))});
});

// ─── POST /api/students ───
router.post('/', async (req, res) => {
  const p = req.body;
  const admin = await verifyAdmin(p.username, p.parol);
  if (!admin) return res.status(401).json({ ok: false, error: "Ruxsat yo'q" });

  await pool.query(
    `INSERT INTO oquvchilar (ism,familiya,maktab,sinf,telefon,telefon2,tug,manzil,admin,qoshilgan,boshlagan)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [p.ism, p.familiya, p.maktab, p.sinf, p.telefon, p.telefon2||'',
     p.tug, p.manzil||'', p.username, p.date||todayUZ(), p.boshlagan||'']
  );
  res.json({ ok: true });
});

// ─── PUT /api/students ───
router.put('/', async (req, res) => {
  const p = req.body;
  const admin = await verifyAdmin(p.username, p.parol);
  if (!admin) return res.status(401).json({ ok: false, error: "Ruxsat yo'q" });

  const result = await pool.query(
    `UPDATE oquvchilar SET ism=$1,familiya=$2,maktab=$3,sinf=$4,telefon=$5,telefon2=$6,tug=$7,manzil=$8,boshlagan=$9
     WHERE ism=$10 AND familiya=$11 ${!admin.isSuper ? 'AND admin=$12' : ''}`,
    admin.isSuper
      ? [p.ism, p.familiya, p.maktab, p.sinf, p.telefon, p.telefon2||'', p.tug, p.manzil||'', p.boshlagan||'', p.oldIsm, p.oldFamiliya]
      : [p.ism, p.familiya, p.maktab, p.sinf, p.telefon, p.telefon2||'', p.tug, p.manzil||'', p.boshlagan||'', p.oldIsm, p.oldFamiliya, p.username]
  );
  if (result.rowCount === 0) return res.status(404).json({ ok: false, error: "O'quvchi topilmadi" });
  res.json({ ok: true });
});

// ─── DELETE /api/students ───
router.delete('/', async (req, res) => {
  const p = req.body;
  const admin = await verifyAdmin(p.username, p.parol);
  if (!admin) return res.status(401).json({ ok: false, error: "Ruxsat yo'q" });

  const result = await pool.query(
    `DELETE FROM oquvchilar WHERE ism=$1 AND familiya=$2 ${!admin.isSuper ? 'AND admin=$3' : ''}`,
    admin.isSuper ? [p.delIsm, p.delFamiliya] : [p.delIsm, p.delFamiliya, p.username]
  );
  if (result.rowCount === 0) return res.status(404).json({ ok: false, error: "O'quvchi topilmadi" });
  res.json({ ok: true });
});

// ─── POST /api/students/inactive — nofaolga o'tkazish ───
router.post('/inactive', async (req, res) => {
  const p = req.body;
  const admin = await verifyAdmin(p.username, p.parol);
  if (!admin) return res.status(401).json({ ok: false, error: "Ruxsat yo'q" });

  const izoh = (p.izoh || '').trim();
  if (!izoh) return res.status(400).json({ ok: false, error: 'Chiqish sababi (izoh) majburiy' });
  if (izoh.length < 10) return res.status(400).json({ ok: false, error: "Chiqish sababi kamida 10 ta belgi bo'lishi kerak" });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const findResult = await client.query(
      `SELECT * FROM oquvchilar WHERE ism=$1 AND familiya=$2 ${!admin.isSuper ? 'AND admin=$3' : ''} LIMIT 1`,
      admin.isSuper ? [p.delIsm, p.delFamiliya] : [p.delIsm, p.delFamiliya, p.username]
    );
    if (findResult.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ ok: false, error: "O'quvchi topilmadi" }); }
    const s = findResult.rows[0];
    await client.query(
      `INSERT INTO nofaol_oquvchilar (ism,familiya,maktab,sinf,telefon,telefon2,tug,manzil,admin,qoshilgan,boshlagan,chiqgan,izoh)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [s.ism, s.familiya, s.maktab, s.sinf, s.telefon, s.telefon2, s.tug, s.manzil, s.admin, s.qoshilgan, s.boshlagan, p.chiqgan||todayUZ(), izoh]
    );
    await client.query('DELETE FROM oquvchilar WHERE id=$1', [s.id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
});

// ─── GET /api/students/inactive ───
router.get('/inactive', async (req, res) => {
  const { username, parol } = req.query;
  const admin = await verifyAdmin(username, parol);
  if (!admin) return res.status(401).json({ ok: false, error: "Ruxsat yo'q" });

  const query  = admin.isSuper ? 'SELECT * FROM nofaol_oquvchilar ORDER BY id' : 'SELECT * FROM nofaol_oquvchilar WHERE admin=$1 ORDER BY id';
  const params = admin.isSuper ? [] : [username];
  const result = await pool.query(query, params);
  res.json({ ok: true, students: result.rows.map(r => ({
    ism: r.ism, familiya: r.familiya, maktab: r.maktab, sinf: r.sinf,
    telefon: r.telefon, telefon2: r.telefon2, tug: r.tug, manzil: r.manzil,
    admin: r.admin, date: r.qoshilgan, boshlagan: r.boshlagan, chiqgan: r.chiqgan, izoh: r.izoh||''
  }))});
});

// ─── POST /api/students/activate — faolga qaytarish ───
router.post('/activate', async (req, res) => {
  const p = req.body;
  const admin = await verifyAdmin(p.username, p.parol);
  if (!admin) return res.status(401).json({ ok: false, error: "Ruxsat yo'q" });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const findResult = await client.query(
      `SELECT * FROM nofaol_oquvchilar WHERE ism=$1 AND familiya=$2 ${!admin.isSuper ? 'AND admin=$3' : ''} LIMIT 1`,
      admin.isSuper ? [p.delIsm, p.delFamiliya] : [p.delIsm, p.delFamiliya, p.username]
    );
    if (findResult.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ ok: false, error: "O'quvchi topilmadi" }); }
    const s = findResult.rows[0];
    await client.query(
      `INSERT INTO oquvchilar (ism,familiya,maktab,sinf,telefon,telefon2,tug,manzil,admin,qoshilgan,boshlagan)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [s.ism, s.familiya, s.maktab, s.sinf, s.telefon, s.telefon2, s.tug, s.manzil, s.admin, s.qoshilgan, s.boshlagan]
    );
    await client.query('DELETE FROM nofaol_oquvchilar WHERE id=$1', [s.id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
});

// ─── PUT /api/students/inactive — nofaolni tahrirlash ───
router.put('/inactive', async (req, res) => {
  const p = req.body;
  const admin = await verifyAdmin(p.username, p.parol);
  if (!admin) return res.status(401).json({ ok: false, error: "Ruxsat yo'q" });

  const chiqgan = (p.chiqgan||'').trim();
  const izoh    = (p.izoh||'').trim();
  if (!chiqgan) return res.status(400).json({ ok: false, error: 'Chiqgan sana majburiy' });
  if (!izoh || izoh.length < 10) return res.status(400).json({ ok: false, error: "Chiqish sababi kamida 10 ta belgi bo'lishi kerak" });

  const result = await pool.query(
    `UPDATE nofaol_oquvchilar SET chiqgan=$1, izoh=$2 WHERE ism=$3 AND familiya=$4 ${!admin.isSuper ? 'AND admin=$5' : ''}`,
    admin.isSuper ? [chiqgan, izoh, p.delIsm, p.delFamiliya] : [chiqgan, izoh, p.delIsm, p.delFamiliya, p.username]
  );
  if (result.rowCount === 0) return res.status(404).json({ ok: false, error: "O'quvchi topilmadi" });
  res.json({ ok: true });
});

// ─── DELETE /api/students/inactive ───
router.delete('/inactive', async (req, res) => {
  const p = req.body;
  const admin = await verifyAdmin(p.username, p.parol);
  if (!admin) return res.status(401).json({ ok: false, error: "Ruxsat yo'q" });

  const result = await pool.query(
    `DELETE FROM nofaol_oquvchilar WHERE ism=$1 AND familiya=$2 ${!admin.isSuper ? 'AND admin=$3' : ''}`,
    admin.isSuper ? [p.delIsm, p.delFamiliya] : [p.delIsm, p.delFamiliya, p.username]
  );
  if (result.rowCount === 0) return res.status(404).json({ ok: false, error: "O'quvchi topilmadi" });
  res.json({ ok: true });
});

module.exports = router;
