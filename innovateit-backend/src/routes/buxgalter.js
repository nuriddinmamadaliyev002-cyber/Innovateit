// ─── Buxgalter routes ──────────────────────────────
// GET  /api/buxgalter/students         — o'quvchilar (buxgalter uchun)
// GET  /api/buxgalter/tolovlar         — to'lovlar
// POST /api/buxgalter/tolovlar         — to'lov saqlash
// POST /api/buxgalter/init-oy          — oyni boshlash
// GET  /api/buxgalter                  — ro'yxat + biriktirmalar
// POST /api/buxgalter                  — yaratish
// PUT  /api/buxgalter                  — tahrirlash
// DELETE /api/buxgalter                — o'chirish
// POST /api/buxgalter/biriktiruv       — admin biriktirish
// DELETE /api/buxgalter/biriktiruv     — admin ajratish
const { Router } = require('express');
const pool = require('../db');
const { hashPassword }  = require('../middleware/auth');
const { requireAuth }   = require('../middleware/jwt');

const router = Router();

// Barcha buxgalter routerlari authentifikatsiya talab qiladi
// Har bir route ichida rol tekshiriladi
function todayUZ() { return new Date().toLocaleDateString('ru-RU'); }



// GET /api/buxgalter/students
router.get('/students', requireAuth(['admin','buxgalter']), async (req, res) => {
  const { oy } = req.query;
  const auth = req.user;  // requireAuth middleware
  const username = auth?.username || '';
  if (!oy) return res.status(400).json({ ok: false, error: 'oy parametri kerak' });

  try {
    const bindRes = await pool.query('SELECT admin_username FROM buxgalter_adminlar WHERE buxgalter_username=$1', [username]);
    const boundAdmins = bindRes.rows.map(r => r.admin_username);
    const hasFilter = boundAdmins.length > 0;
    const adminFilter = hasFilter ? 'AND admin = ANY($2)' : '';

    const activeRes = await pool.query(
      `SELECT ism,familiya,maktab,sinf,telefon,telefon2,admin,boshlagan FROM oquvchilar
       WHERE boshlagan IS NOT NULL AND boshlagan!='' AND LEFT(boshlagan,7)<=$1 ${adminFilter} ORDER BY maktab,sinf,familiya,ism`,
      hasFilter ? [oy, boundAdmins] : [oy]
    );
    const nofaolRes = await pool.query(
      `SELECT ism,familiya,maktab,sinf,telefon,telefon2,admin,boshlagan,chiqgan FROM nofaol_oquvchilar
       WHERE boshlagan IS NOT NULL AND boshlagan!='' AND chiqgan IS NOT NULL AND chiqgan!=''
         AND LEFT(boshlagan,7)<=$1
         AND CASE WHEN SUBSTRING(chiqgan,3,1)='.' THEN CONCAT(RIGHT(chiqgan,4),'-',SUBSTRING(chiqgan,4,2)) ELSE LEFT(chiqgan,7) END>=$1
         ${adminFilter} ORDER BY maktab,sinf,familiya,ism`,
      hasFilter ? [oy, boundAdmins] : [oy]
    );
    res.json({ ok: true, students: [
      ...activeRes.rows.map(r => ({ ...r, maktab:r.maktab||'', sinf:r.sinf||'', telefon:r.telefon||'', telefon2:r.telefon2||'', admin:r.admin||'', boshlagan:r.boshlagan||'', nofaol:false })),
      ...nofaolRes.rows.map(r => ({ ...r, maktab:r.maktab||'', sinf:r.sinf||'', telefon:r.telefon||'', telefon2:r.telefon2||'', admin:r.admin||'', boshlagan:r.boshlagan||'', nofaol:true }))
    ]});
  } catch (err) { res.status(500).json({ ok: false, error: 'DB xatoligi: ' + err.message }); }
});

// GET /api/buxgalter/tolovlar
router.get('/tolovlar', requireAuth(['admin','buxgalter']), async (req, res) => {
  const { oy } = req.query;
  const auth = req.user;  // requireAuth middleware
  if (!oy) return res.status(400).json({ ok: false, error: 'oy parametri kerak' });

  const result = await pool.query('SELECT * FROM tolovlar WHERE oy=$1 ORDER BY maktab,sinf,oquvchi_familiya', [oy]);
  res.json({ ok: true, tolovlar: result.rows });
});

// kvitansiya_fayl ni normalize qilish:
// Eski format: "fayl.jpg" (string) → yangi format: ["fayl.jpg","fayl2.png"] (JSON array)
// DB da TEXT saqlanadi, ichida JSON array yoziladi.
function normalizeKvitFiles(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
    if (typeof parsed === 'string' && parsed) return [parsed];
  } catch {}
  // Eski string format (bitta fayl nomi)
  if (typeof raw === 'string' && raw.trim()) return [raw.trim()];
  return [];
}

function serializeKvitFiles(files) {
  const arr = (Array.isArray(files) ? files : []).filter(Boolean);
  if (arr.length === 0) return '';
  return JSON.stringify(arr);
}

// POST /api/buxgalter/tolovlar
router.post('/tolovlar', requireAuth(['admin','buxgalter']), async (req, res) => {
  const p = req.body;
  const auth = req.user;  // requireAuth middleware

  const oy = p.oy, ism = (p.oquvchi_ism||'').trim(), familiya = (p.oquvchi_familiya||'').trim(), adminU = (p.admin_username||'').trim();
  if (!oy || !ism || !familiya) return res.status(400).json({ ok: false, error: 'Majburiy maydonlar yetishmaydi' });

  // kvitansiya_fayl: array yoki string qabul qilib, JSON array sifatida saqlash
  const kvFiles = serializeKvitFiles(normalizeKvitFiles(p.kvitansiya_fayl));

  try {
    await pool.query(
      `INSERT INTO tolovlar (oy,oquvchi_ism,oquvchi_familiya,maktab,sinf,telefon,admin_username,tarif,qaydnoma,gaplashilgan_vaqt,tolov_kerak,tolov_qildi,tolov_sanasi,kvitansiya_fayl,yangilangan)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (oy,oquvchi_ism,oquvchi_familiya,admin_username) DO UPDATE SET
         tarif=EXCLUDED.tarif, qaydnoma=EXCLUDED.qaydnoma, gaplashilgan_vaqt=EXCLUDED.gaplashilgan_vaqt,
         tolov_kerak=EXCLUDED.tolov_kerak, tolov_qildi=EXCLUDED.tolov_qildi, tolov_sanasi=EXCLUDED.tolov_sanasi,
         kvitansiya_fayl=EXCLUDED.kvitansiya_fayl, yangilangan=EXCLUDED.yangilangan`,
      [oy, ism, familiya, p.maktab||'', p.sinf||'', p.telefon||'', adminU,
       parseInt(p.tarif)||0, p.qaydnoma||'', p.gaplashilgan_vaqt||'',
       parseInt(p.tolov_kerak)||0, parseInt(p.tolov_qildi)||0,
       p.tolov_sanasi||'', kvFiles, todayUZ()]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ ok: false, error: 'DB xatoligi: ' + err.message }); }
});

// POST /api/buxgalter/init-oy
router.post('/init-oy', requireAuth(['admin','buxgalter']), async (req, res) => {
  const p = req.body;
  const auth = req.user;  // requireAuth middleware
  if (!p.oy) return res.status(400).json({ ok: false, error: 'oy kerak' });

  try {
    const activeQ  = await pool.query(`SELECT ism,familiya,maktab,sinf,telefon,admin,boshlagan FROM oquvchilar WHERE boshlagan IS NOT NULL AND boshlagan!='' AND LEFT(boshlagan,7)<=$1`, [p.oy]);
    const nofaolQ  = await pool.query(`SELECT ism,familiya,maktab,sinf,telefon,admin,boshlagan FROM nofaol_oquvchilar WHERE boshlagan IS NOT NULL AND boshlagan!='' AND chiqgan IS NOT NULL AND chiqgan!='' AND LEFT(boshlagan,7)<=$1 AND CASE WHEN SUBSTRING(chiqgan,3,1)='.' THEN CONCAT(RIGHT(chiqgan,4),'-',SUBSTRING(chiqgan,4,2)) ELSE LEFT(chiqgan,7) END>=$1`, [p.oy]);
    const all = [...activeQ.rows, ...nofaolQ.rows];
    let inserted = 0;
    for (const s of all) {
      let tarif = 0, tolov_kerak = 0;
      if (p.oldingi_oy) {
        const prev = await pool.query(`SELECT tarif,tolov_kerak FROM tolovlar WHERE oy=$1 AND oquvchi_ism=$2 AND oquvchi_familiya=$3 AND admin_username=$4 LIMIT 1`, [p.oldingi_oy, s.ism, s.familiya, s.admin]);
        if (prev.rows.length > 0) { tarif = prev.rows[0].tarif||0; tolov_kerak = prev.rows[0].tolov_kerak||0; }
      }
      await pool.query(`INSERT INTO tolovlar (oy,oquvchi_ism,oquvchi_familiya,maktab,sinf,telefon,admin_username,tarif,tolov_kerak) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`,
        [p.oy, s.ism, s.familiya, s.maktab||'', s.sinf||'', s.telefon||'', s.admin||'', tarif, tolov_kerak]);
      inserted++;
    }
    res.json({ ok: true, count: inserted });
  } catch (err) { res.status(500).json({ ok: false, error: 'DB xatoligi: ' + err.message }); }
});

// GET /api/buxgalter — biriktirmalar + ro'yxat
router.get('/', requireAuth(['admin']), async (req, res) => {
  if (!req.user?.isSuper) return res.status(403).json({ ok: false, error: "Faqat superadmin" });

  const adminsRes = await pool.query(`SELECT a.ism,a.username,b.buxgalter_username FROM adminlar a LEFT JOIN buxgalter_adminlar b ON a.username=b.admin_username ORDER BY a.ism`);
  const buxRes    = await pool.query(`SELECT bx.ism,bx.username,ARRAY_AGG(ba.admin_username) FILTER (WHERE ba.admin_username IS NOT NULL) as adminlar FROM buxgalterlar bx LEFT JOIN buxgalter_adminlar ba ON bx.username=ba.buxgalter_username GROUP BY bx.ism,bx.username ORDER BY bx.ism`);
  res.json({ ok: true, adminlar: adminsRes.rows, buxgalterlar: buxRes.rows });
});

// POST /api/buxgalter — yaratish
router.post('/', requireAuth(['admin']), async (req, res) => {
  const { newUsername, newParol, newIsm } = req.body;
  if (!req.user?.isSuper) return res.status(403).json({ ok: false, error: "Faqat superadmin" });
  if (!newUsername?.trim() || !newParol?.trim() || !newIsm?.trim()) return res.status(400).json({ ok: false, error: 'Barcha maydonlar majburiy' });
  try {
    const hashed = await hashPassword(newParol.trim());
    await pool.query('INSERT INTO buxgalterlar (ism,username,parol,yaratilgan) VALUES ($1,$2,$3,$4)', [newIsm.trim(), newUsername.trim(), hashed, todayUZ()]);
    res.json({ ok: true });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ ok: false, error: 'Bu username allaqachon mavjud' });
    throw err;
  }
});

// PUT /api/buxgalter — tahrirlash
router.put('/', requireAuth(['admin']), async (req, res) => {
  const { oldUsername, newIsm, newUsername: nu, newParol: np } = req.body;
  if (!req.user?.isSuper) return res.status(403).json({ ok: false, error: "Faqat superadmin" });
  if (!oldUsername || !newIsm || !nu) return res.status(400).json({ ok: false, error: 'Majburiy maydonlar yetishmaydi' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (np?.trim()) {
      const hashed = await hashPassword(np.trim());
      await client.query('UPDATE buxgalterlar SET ism=$1,username=$2,parol=$3 WHERE username=$4', [newIsm, nu, hashed, oldUsername]);
    } else {
      await client.query('UPDATE buxgalterlar SET ism=$1,username=$2 WHERE username=$3', [newIsm, nu, oldUsername]);
    }
    if (nu !== oldUsername) {
      await client.query('UPDATE buxgalter_adminlar SET buxgalter_username=$1 WHERE buxgalter_username=$2', [nu, oldUsername]);
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ ok: false, error: 'Bu username allaqachon mavjud' });
    throw err;
  } finally { client.release(); }
});

// DELETE /api/buxgalter
router.delete('/', requireAuth(['admin']), async (req, res) => {
  const { deleteUsername } = req.body;
  if (!req.user?.isSuper) return res.status(403).json({ ok: false, error: "Faqat superadmin" });
  const result = await pool.query('DELETE FROM buxgalterlar WHERE username=$1', [deleteUsername?.trim()]);
  if (result.rowCount === 0) return res.status(404).json({ ok: false, error: 'Buxgalter topilmadi' });
  res.json({ ok: true });
});

// POST /api/buxgalter/biriktiruv
router.post('/biriktiruv', requireAuth(['admin']), async (req, res) => {
  const { buxUsername, adminUsername } = req.body;
  if (!req.user?.isSuper) return res.status(403).json({ ok: false, error: "Ruxsat yo'q" });
  if (!buxUsername || !adminUsername) return res.status(400).json({ ok: false, error: 'buxUsername va adminUsername kerak' });
  await pool.query(`INSERT INTO buxgalter_adminlar (buxgalter_username,admin_username) VALUES ($1,$2) ON CONFLICT (admin_username) DO UPDATE SET buxgalter_username=$1`, [buxUsername, adminUsername]);
  res.json({ ok: true });
});

// DELETE /api/buxgalter/biriktiruv
router.delete('/biriktiruv', requireAuth(['admin']), async (req, res) => {
  const { adminUsername } = req.body;
  if (!req.user?.isSuper) return res.status(403).json({ ok: false, error: "Ruxsat yo'q" });
  if (!adminUsername) return res.status(400).json({ ok: false, error: 'adminUsername kerak' });
  await pool.query('DELETE FROM buxgalter_adminlar WHERE admin_username=$1', [adminUsername]);
  res.json({ ok: true });
});

module.exports = router;