// ─── Teachers routes ───────────────────────────────
// GET    /api/teachers   — ro'yxat
// POST   /api/teachers   — qo'shish
// PUT    /api/teachers   — tahrirlash
// DELETE /api/teachers   — o'chirish
const { Router } = require('express');
const pool = require('../db');
const { verifyAdmin } = require('../middleware/auth');

const router = Router();
function todayUZ() { return new Date().toLocaleDateString('ru-RU'); }

router.get('/', async (req, res) => {
  const { username, parol } = req.query;
  const admin = await verifyAdmin(username, parol);
  if (!admin) return res.status(401).json({ ok: false, error: "Ruxsat yo'q" });

  const query  = admin.isSuper ? 'SELECT * FROM oqituvchilar ORDER BY id' : 'SELECT * FROM oqituvchilar WHERE admin=$1 ORDER BY id';
  const params = admin.isSuper ? [] : [username];
  const result = await pool.query(query, params);
  res.json({ ok: true, teachers: result.rows.map(r => ({
    ism: r.ism, familiya: r.familiya, fan: r.fan, telefon: r.telefon, telefon2: r.telefon2,
    kunlar: r.kunlar, sinflar: r.sinflar, boshlanish: r.boshlanish, tugash: r.tugash,
    admin: r.admin, date: r.qoshilgan
  }))});
});

router.post('/', async (req, res) => {
  const p = req.body;
  const admin = await verifyAdmin(p.username, p.parol);
  if (!admin) return res.status(401).json({ ok: false, error: "Ruxsat yo'q" });
  if (!(p.ism||'').trim()) return res.status(400).json({ ok: false, error: 'Ism kiritilmagan' });
  if (!(p.familiya||'').trim()) return res.status(400).json({ ok: false, error: 'Familiya kiritilmagan' });

  await pool.query(
    `INSERT INTO oqituvchilar (ism,familiya,fan,telefon,telefon2,kunlar,sinflar,boshlanish,tugash,admin,qoshilgan)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [p.ism.trim(), p.familiya.trim(), p.fan||'', p.telefon||'', p.telefon2||'',
     p.kunlar||'', p.sinflar||'', p.boshlanish||'', p.tugash||'', p.username, p.date||todayUZ()]
  );
  res.json({ ok: true });
});

router.put('/', async (req, res) => {
  const p = req.body;
  const admin = await verifyAdmin(p.username, p.parol);
  if (!admin) return res.status(401).json({ ok: false, error: "Ruxsat yo'q" });

  const result = await pool.query(
    `UPDATE oqituvchilar SET ism=$1,familiya=$2,fan=$3,telefon=$4,telefon2=$5,kunlar=$6,sinflar=$7,boshlanish=$8,tugash=$9
     WHERE ism=$10 AND familiya=$11 AND admin=$12`,
    [p.ism, p.familiya, p.fan, p.telefon, p.telefon2||'', p.kunlar||'', p.sinflar||'', p.boshlanish||'', p.tugash||'', p.oldIsm, p.oldFamiliya, p.username]
  );
  if (result.rowCount === 0) return res.status(404).json({ ok: false, error: "O'qituvchi topilmadi" });
  res.json({ ok: true });
});

router.delete('/', async (req, res) => {
  const { username, parol, delIsm, delFamiliya } = req.body;
  const admin = await verifyAdmin(username, parol);
  if (!admin) return res.status(401).json({ ok: false, error: "Ruxsat yo'q" });

  const result = await pool.query('DELETE FROM oqituvchilar WHERE ism=$1 AND familiya=$2 AND admin=$3', [delIsm, delFamiliya, username]);
  if (result.rowCount === 0) return res.status(404).json({ ok: false, error: "O'qituvchi topilmadi" });
  res.json({ ok: true });
});

module.exports = router;
