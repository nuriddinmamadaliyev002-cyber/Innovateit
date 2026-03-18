// ─── Teachers routes ───────────────────────────────
// GET    /api/teachers              — ro'yxat
// POST   /api/teachers              — qo'shish
// PUT    /api/teachers              — tahrirlash
// DELETE /api/teachers              — o'chirish
// POST   /api/teachers/maktab       — superadmin: maktab biriktirish
// DELETE /api/teachers/maktab       — superadmin: maktabdan ajratish
const { Router } = require('express');
const pool = require('../db');
const { verifyAdmin } = require('../middleware/auth');

const router = Router();
function todayUZ() { return new Date().toLocaleDateString('ru-RU'); }

// ─── GET /api/teachers ───
router.get('/', async (req, res) => {
  const { username, parol } = req.query;
  const admin = await verifyAdmin(username, parol);
  if (!admin) return res.status(401).json({ ok: false, error: "Ruxsat yo'q" });

  let rows;
  if (admin.isSuper) {
    // Superadmin: barcha o'qituvchilar + ularning biriktirilgan maktablari
    const result = await pool.query(`
      SELECT
        o.id, o.ism, o.familiya, o.fan, o.telefon, o.telefon2,
        o.kunlar, o.sinflar, o.boshlanish, o.tugash, o.qoshilgan,
        COALESCE(
          ARRAY_AGG(om.admin_username ORDER BY om.admin_username)
          FILTER (WHERE om.admin_username IS NOT NULL),
          '{}'
        ) AS maktablar
      FROM oqituvchilar o
      LEFT JOIN oqituvchi_maktablar om ON o.id = om.oqituvchi_id
      GROUP BY o.id
      ORDER BY o.id
    `);
    rows = result.rows;
  } else {
    // Oddiy admin: faqat o'ziga biriktirilgan o'qituvchilar
    const result = await pool.query(`
      SELECT
        o.id, o.ism, o.familiya, o.fan, o.telefon, o.telefon2,
        o.kunlar, o.sinflar, o.boshlanish, o.tugash, o.qoshilgan,
        ARRAY[$1] AS maktablar
      FROM oqituvchilar o
      INNER JOIN oqituvchi_maktablar om
        ON o.id = om.oqituvchi_id AND om.admin_username = $1
      ORDER BY o.id
    `, [username]);
    rows = result.rows;
  }

  res.json({
    ok: true,
    teachers: rows.map(r => ({
      id:         r.id,
      ism:        r.ism,
      familiya:   r.familiya,
      fan:        r.fan,
      telefon:    r.telefon,
      telefon2:   r.telefon2,
      kunlar:     r.kunlar,
      sinflar:    r.sinflar,
      boshlanish: r.boshlanish,
      tugash:     r.tugash,
      date:       r.qoshilgan,
      maktablar:  r.maktablar || []   // ['admin1', 'admin2', ...]
    }))
  });
});

// ─── POST /api/teachers — qo'shish ───
router.post('/', async (req, res) => {
  const p = req.body;
  const admin = await verifyAdmin(p.username, p.parol);
  if (!admin) return res.status(401).json({ ok: false, error: "Ruxsat yo'q" });
  if (!(p.ism||'').trim())     return res.status(400).json({ ok: false, error: 'Ism kiritilmagan' });
  if (!(p.familiya||'').trim()) return res.status(400).json({ ok: false, error: 'Familiya kiritilmagan' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // O'qituvchi qo'shish
    const ins = await client.query(
      `INSERT INTO oqituvchilar (ism,familiya,fan,telefon,telefon2,kunlar,sinflar,boshlanish,tugash,admin,qoshilgan)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [p.ism.trim(), p.familiya.trim(), p.fan||'', p.telefon||'', p.telefon2||'',
       p.kunlar||'', p.sinflar||'', p.boshlanish||'', p.tugash||'', p.username, p.date||todayUZ()]
    );
    const teacherId = ins.rows[0].id;

    // Shu admin bilan avtomatik biriktirish
    await client.query(
      `INSERT INTO oqituvchi_maktablar (oqituvchi_id, admin_username) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [teacherId, p.username]
    );

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally { client.release(); }
});

// ─── PUT /api/teachers — tahrirlash ───
router.put('/', async (req, res) => {
  const p = req.body;
  const admin = await verifyAdmin(p.username, p.parol);
  if (!admin) return res.status(401).json({ ok: false, error: "Ruxsat yo'q" });

  // id orqali yoki ism+familiya+admin orqali topish
  let whereClause, params;
  if (p.id) {
    whereClause = 'WHERE id=$10';
    params = [p.ism, p.familiya, p.fan, p.telefon, p.telefon2||'',
              p.kunlar||'', p.sinflar||'', p.boshlanish||'', p.tugash||'', p.id];
  } else {
    whereClause = admin.isSuper
      ? 'WHERE ism=$10 AND familiya=$11'
      : 'WHERE ism=$10 AND familiya=$11 AND admin=$12';
    params = admin.isSuper
      ? [p.ism, p.familiya, p.fan, p.telefon, p.telefon2||'', p.kunlar||'', p.sinflar||'', p.boshlanish||'', p.tugash||'', p.oldIsm, p.oldFamiliya]
      : [p.ism, p.familiya, p.fan, p.telefon, p.telefon2||'', p.kunlar||'', p.sinflar||'', p.boshlanish||'', p.tugash||'', p.oldIsm, p.oldFamiliya, p.username];
  }

  const result = await pool.query(
    `UPDATE oqituvchilar SET ism=$1,familiya=$2,fan=$3,telefon=$4,telefon2=$5,kunlar=$6,sinflar=$7,boshlanish=$8,tugash=$9 ${whereClause}`,
    params
  );
  if (result.rowCount === 0) return res.status(404).json({ ok: false, error: "O'qituvchi topilmadi" });
  res.json({ ok: true });
});

// ─── DELETE /api/teachers — o'chirish (admin o'z o'qituvchisini) ───
router.delete('/', async (req, res) => {
  const { username, parol, delIsm, delFamiliya, delId } = req.body;
  const admin = await verifyAdmin(username, parol);
  if (!admin) return res.status(401).json({ ok: false, error: "Ruxsat yo'q" });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Faqat shu admin bilan bog'lanishni uzish (o'qituvchi boshqa maktabda qolishi mumkin)
    let teacherId = delId;
    if (!teacherId) {
      const found = admin.isSuper
        ? await client.query('SELECT id FROM oqituvchilar WHERE ism=$1 AND familiya=$2 LIMIT 1', [delIsm, delFamiliya])
        : await client.query('SELECT o.id FROM oqituvchilar o INNER JOIN oqituvchi_maktablar om ON o.id=om.oqituvchi_id WHERE o.ism=$1 AND o.familiya=$2 AND om.admin_username=$3 LIMIT 1', [delIsm, delFamiliya, username]);
      if (found.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ ok: false, error: "O'qituvchi topilmadi" }); }
      teacherId = found.rows[0].id;
    }

    if (admin.isSuper) {
      // Superadmin: to'liq o'chirish (CASCADE bilan oqituvchi_maktablar ham tozalanadi)
      await client.query('DELETE FROM oqituvchilar WHERE id=$1', [teacherId]);
    } else {
      // Oddiy admin: faqat o'z maktabidan ajratish
      await client.query('DELETE FROM oqituvchi_maktablar WHERE oqituvchi_id=$1 AND admin_username=$2', [teacherId, username]);
    }

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally { client.release(); }
});

// ─── POST /api/teachers/maktab — superadmin: maktab biriktirish ───
// body: { username, parol, teacherId, adminUsername }
router.post('/maktab', async (req, res) => {
  const { username, parol, teacherId, adminUsername } = req.body;
  const admin = await verifyAdmin(username, parol);
  if (!admin?.isSuper) return res.status(403).json({ ok: false, error: "Faqat superadmin uchun" });
  if (!teacherId || !adminUsername) return res.status(400).json({ ok: false, error: 'teacherId va adminUsername kerak' });

  // O'qituvchi mavjudligini tekshirish
  const found = await pool.query('SELECT id FROM oqituvchilar WHERE id=$1', [teacherId]);
  if (found.rows.length === 0) return res.status(404).json({ ok: false, error: "O'qituvchi topilmadi" });

  // Admin mavjudligini tekshirish
  const adminFound = await pool.query('SELECT username FROM adminlar WHERE username=$1', [adminUsername]);
  if (adminFound.rows.length === 0) return res.status(404).json({ ok: false, error: 'Admin topilmadi' });

  try {
    await pool.query(
      `INSERT INTO oqituvchi_maktablar (oqituvchi_id, admin_username) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [teacherId, adminUsername]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── DELETE /api/teachers/maktab — superadmin: maktabdan ajratish ───
// body: { username, parol, teacherId, adminUsername }
router.delete('/maktab', async (req, res) => {
  const { username, parol, teacherId, adminUsername } = req.body;
  const admin = await verifyAdmin(username, parol);
  if (!admin?.isSuper) return res.status(403).json({ ok: false, error: "Faqat superadmin uchun" });
  if (!teacherId || !adminUsername) return res.status(400).json({ ok: false, error: 'teacherId va adminUsername kerak' });

  const result = await pool.query(
    'DELETE FROM oqituvchi_maktablar WHERE oqituvchi_id=$1 AND admin_username=$2',
    [teacherId, adminUsername]
  );
  if (result.rowCount === 0) return res.status(404).json({ ok: false, error: "Bog'lanish topilmadi" });
  res.json({ ok: true });
});

module.exports = router;