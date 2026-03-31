// ─── Teachers routes ───────────────────────────────
// GET    /api/teachers              — ro'yxat
// POST   /api/teachers              — qo'shish
// PUT    /api/teachers              — tahrirlash
// DELETE /api/teachers              — o'chirish
// POST   /api/teachers/maktab       — superadmin: maktab biriktirish
// DELETE /api/teachers/maktab       — superadmin: maktabdan ajratish
const { Router } = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/jwt');

const router = Router();
router.use(requireAuth(['admin']));
function todayUZ() { return new Date().toLocaleDateString('ru-RU'); }

// ─── GET /api/teachers ───
router.get('/', async (req, res) => {
  const { username, isSuper } = req.user;

  let rows;
  if (isSuper) {
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
  const { username, isSuper } = req.user;
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
  const { username, isSuper } = req.user;

  // id orqali yoki ism+familiya+admin orqali topish
  let whereClause, params;
  if (p.id) {
    whereClause = 'WHERE id=$10';
    params = [p.ism, p.familiya, p.fan, p.telefon, p.telefon2||'',
              p.kunlar||'', p.sinflar||'', p.boshlanish||'', p.tugash||'', p.id];
  } else {
    whereClause = isSuper
      ? 'WHERE ism=$10 AND familiya=$11'
      : 'WHERE ism=$10 AND familiya=$11 AND admin=$12';
    params = isSuper
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
  const { delIsm, delFamiliya, delId } = req.body;
  const { username, isSuper } = req.user;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Faqat shu admin bilan bog'lanishni uzish (o'qituvchi boshqa maktabda qolishi mumkin)
    let teacherId = delId;
    if (!teacherId) {
      const found = isSuper
        ? await client.query('SELECT id FROM oqituvchilar WHERE ism=$1 AND familiya=$2 LIMIT 1', [delIsm, delFamiliya])
        : await client.query('SELECT o.id FROM oqituvchilar o INNER JOIN oqituvchi_maktablar om ON o.id=om.oqituvchi_id WHERE o.ism=$1 AND o.familiya=$2 AND om.admin_username=$3 LIMIT 1', [delIsm, delFamiliya, username]);
      if (found.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ ok: false, error: "O'qituvchi topilmadi" }); }
      teacherId = found.rows[0].id;
    }

    if (isSuper) {
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
// body: { username, teacherId, adminUsername }
router.post('/maktab', async (req, res) => {
  const { teacherId, adminUsername } = req.body;
  
  if (!req.user.isSuper) return res.status(403).json({ ok: false, error: "Faqat superadmin uchun" });
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
// body: { username, teacherId, adminUsername }
router.delete('/maktab', async (req, res) => {
  const { teacherId, adminUsername } = req.body;
  
  if (!req.user.isSuper) return res.status(403).json({ ok: false, error: "Faqat superadmin uchun" });
  if (!teacherId || !adminUsername) return res.status(400).json({ ok: false, error: 'teacherId va adminUsername kerak' });

  const result = await pool.query(
    'DELETE FROM oqituvchi_maktablar WHERE oqituvchi_id=$1 AND admin_username=$2',
    [teacherId, adminUsername]
  );
  if (result.rowCount === 0) return res.status(404).json({ ok: false, error: "Bog'lanish topilmadi" });
  res.json({ ok: true });
});

// ─── POST /api/teachers/merge — superadmin: ikki o'qituvchini birlashtirish ───
// body: {
//   username,
//   keepId,   — saqlanadigan o'qituvchi ID
//   removeId, — o'chiriladigan o'qituvchi ID
//   ism, familiya, telefon, telefon2  — qaysi ma'lumotlar saqlansin
// }
router.post('/merge', async (req, res) => {
  const { keepId, removeId, ism, familiya, telefon, telefon2 } = req.body;

  
  if (!req.user.isSuper) return res.status(403).json({ ok: false, error: 'Faqat superadmin uchun' });
  if (!keepId || !removeId) return res.status(400).json({ ok: false, error: 'keepId va removeId kerak' });
  if (keepId === removeId) return res.status(400).json({ ok: false, error: 'Bir xil o\'qituvchi tanlangan' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Ikkalasi ham mavjudligini tekshirish
    const both = await client.query(
      'SELECT id, ism, familiya FROM oqituvchilar WHERE id = ANY($1)',
      [[keepId, removeId]]
    );
    if (both.rows.length < 2) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, error: 'O\'qituvchilardan biri topilmadi' });
    }

    // 1. Saqlanadigan o'qituvchi ma'lumotlarini yangilash
    await client.query(
      `UPDATE oqituvchilar SET ism=$1, familiya=$2, telefon=$3, telefon2=$4 WHERE id=$5`,
      [(ism||'').trim(), (familiya||'').trim(), (telefon||'').trim(), (telefon2||'').trim(), keepId]
    );

    // 2. oqituvchi_maktablar: removeId maktablarini keepId ga ko'chirish (takrorlanmasin)
    await client.query(`
      INSERT INTO oqituvchi_maktablar (oqituvchi_id, admin_username)
      SELECT $1, admin_username FROM oqituvchi_maktablar WHERE oqituvchi_id = $2
      ON CONFLICT (oqituvchi_id, admin_username) DO NOTHING
    `, [keepId, removeId]);

    // 3. oqituvchilar_davomat: removeId → keepId (ism bilan saqlanadi, yangisini yozamiz)
    //    ism/familiya TEXT sifatida saqlanadi — yangilangan ism bilan almashtiramiz
    const newFullIsm = (ism||'').trim() + ' ' + (familiya||'').trim();
    const keepRow = both.rows.find(r => r.id == keepId);
    const removeRow = both.rows.find(r => r.id == removeId);
    const removeFullIsm = removeRow.ism + ' ' + removeRow.familiya;

    // oqituvchilar_davomat da ism maydoni "Ism Familiya" yoki faqat "Ism" bo'lishi mumkin
    await client.query(`
      UPDATE oqituvchilar_davomat
      SET oqituvchi_ism = $1
      WHERE oqituvchi_ism = $2 OR oqituvchi_ism = $3 OR oqituvchi_ism = $4
    `, [newFullIsm, removeFullIsm, removeRow.ism, removeRow.familiya]);

    // 4. dars_jadvali: teacher_ism + teacher_familiya orqali yangilash
    await client.query(`
      UPDATE dars_jadvali
      SET teacher_ism = $1, teacher_familiya = $2
      WHERE teacher_ism = $3 AND teacher_familiya = $4
    `, [(ism||'').trim(), (familiya||'').trim(), removeRow.ism, removeRow.familiya]);

    // 5. oqituvchi_portfolio: removeId → keepId (agar keepId da portfolio yo'q bo'lsa ko'chir)
    const keepPortfolio = await client.query(
      'SELECT id FROM oqituvchi_portfolio WHERE oqituvchi_id = $1', [keepId]
    );
    if (keepPortfolio.rows.length === 0) {
      // keepId da portfolio yo'q — removeid nikini ko'chiramiz
      await client.query(
        'UPDATE oqituvchi_portfolio SET oqituvchi_id = $1 WHERE oqituvchi_id = $2',
        [keepId, removeId]
      );
    }
    // Aks holda removeId portfolio o'chib ketadi (CASCADE bilan)

    // 6. oqituvchi_sertifikat_fayllar: removeId fayllarini keepId ga ko'chirish
    await client.query(
      'UPDATE oqituvchi_sertifikat_fayllar SET oqituvchi_id = $1 WHERE oqituvchi_id = $2',
      [keepId, removeId]
    );

    // 7. viewer_teachers: removeId → keepId
    await client.query(`
      INSERT INTO viewer_teachers (viewer_username, teacher_id)
      SELECT viewer_username, $1 FROM viewer_teachers WHERE teacher_id = $2
      ON CONFLICT (viewer_username, teacher_id) DO NOTHING
    `, [keepId, removeId]);

    // 8. removeId o'qituvchini o'chirish (CASCADE: oqituvchi_maktablar, viewer_teachers, oqituvchi_portfolio, sertifikatlar ham o'chadi)
    await client.query('DELETE FROM oqituvchilar WHERE id = $1', [removeId]);

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('merge xatolik:', err.message);
    res.status(500).json({ ok: false, error: 'Server xatoligi: ' + err.message });
  } finally {
    client.release();
  }
});

module.exports = router;