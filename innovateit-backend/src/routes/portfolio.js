// ─── Portfolio Routes ──────────────────────────────
// GET    /api/portfolio/viewers               — viewer ro'yxati (superadmin)
// POST   /api/portfolio/viewers               — viewer yaratish (superadmin)
// PUT    /api/portfolio/viewers               — viewer tahrirlash (superadmin)
// DELETE /api/portfolio/viewers               — viewer o'chirish (superadmin)
// GET    /api/portfolio/teachers              — barcha o'qituvchilar (superadmin + viewer)
// GET    /api/portfolio/teacher/:id           — bitta o'qituvchi to'liq profili
// POST   /api/portfolio/teacher/:id           — profil saqlash/yangilash (superadmin)
// POST   /api/portfolio/teacher/:id/sertifikat — fayl yuklash (superadmin, max 10)
// DELETE /api/portfolio/teacher/:id/sertifikat/:filename — fayl o'chirish (superadmin)

const { Router } = require('express');
const pool       = require('../db');
const { verifyAdmin, verifyViewer } = require('../middleware/auth');
const multer     = require('multer');
const path       = require('path');
const fs         = require('fs');

const router = Router();
const MAX_SERTIFIKAT = 10;

// ─── Uploads papkasi ───
const UPLOAD_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ─── Multer (sertifikat fayllari uchun) ───
const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    let ext = path.extname(file.originalname).toLowerCase();
    if (!ext) {
      const m = {
        'image/jpeg': '.jpg', 'image/png': '.png',
        'image/gif': '.gif',  'image/webp': '.webp',
        'application/pdf': '.pdf'
      };
      ext = m[file.mimetype] || '.jpg';
    }
    cb(null, `sert_${Date.now()}_${Math.random().toString(36).slice(2, 7)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf'];
    const mimes   = ['image/jpeg','image/png','image/gif','image/webp','image/bmp','application/pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, (ext ? allowed.includes(ext) : false) || mimes.includes(file.mimetype));
  }
});

function todayUZ() { return new Date().toLocaleDateString('ru-RU'); }

// ═══════════════════════════════════
//  PORTFOLIO VIEWERS (superadmin)
// ═══════════════════════════════════

// GET /api/portfolio/viewers
router.get('/viewers', async (req, res) => {
  const admin = await verifyAdmin(req.query.username, req.query.parol);
  if (!admin?.isSuper) return res.status(403).json({ ok: false, error: "Faqat superadmin" });

  const r = await pool.query(
    'SELECT id,ism,username,parol,yaratilgan FROM portfolio_viewers ORDER BY id'
  );
  res.json({ ok: true, viewers: r.rows });
});

// POST /api/portfolio/viewers
router.post('/viewers', async (req, res) => {
  const { username, parol, newIsm, newUsername, newParol } = req.body;
  const admin = await verifyAdmin(username, parol);
  if (!admin?.isSuper) return res.status(403).json({ ok: false, error: "Faqat superadmin" });
  if (!newIsm?.trim() || !newUsername?.trim() || !newParol?.trim())
    return res.status(400).json({ ok: false, error: 'Barcha maydonlar majburiy' });

  try {
    await pool.query(
      'INSERT INTO portfolio_viewers (ism,username,parol,yaratilgan) VALUES ($1,$2,$3,$4)',
      [newIsm.trim(), newUsername.trim(), newParol.trim(), todayUZ()]
    );
    res.json({ ok: true });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ ok: false, error: 'Bu username allaqachon mavjud' });
    throw err;
  }
});

// PUT /api/portfolio/viewers
router.put('/viewers', async (req, res) => {
  const { username, parol, oldUsername, newIsm, newUsername: nu, newParol: np } = req.body;
  const admin = await verifyAdmin(username, parol);
  if (!admin?.isSuper) return res.status(403).json({ ok: false, error: "Faqat superadmin" });
  if (!oldUsername?.trim() || !nu?.trim() || !newIsm?.trim())
    return res.status(400).json({ ok: false, error: 'Majburiy maydonlar yetishmaydi' });

  const q = np?.trim()
    ? 'UPDATE portfolio_viewers SET ism=$1,username=$2,parol=$3 WHERE username=$4'
    : 'UPDATE portfolio_viewers SET ism=$1,username=$2 WHERE username=$3';
  const params = np?.trim()
    ? [newIsm.trim(), nu.trim(), np.trim(), oldUsername.trim()]
    : [newIsm.trim(), nu.trim(), oldUsername.trim()];

  const r = await pool.query(q, params);
  if (r.rowCount === 0) return res.status(404).json({ ok: false, error: 'Viewer topilmadi' });
  res.json({ ok: true });
});

// DELETE /api/portfolio/viewers
router.delete('/viewers', async (req, res) => {
  const { username, parol, deleteUsername } = req.body;
  const admin = await verifyAdmin(username, parol);
  if (!admin?.isSuper) return res.status(403).json({ ok: false, error: "Faqat superadmin" });

  const r = await pool.query(
    'DELETE FROM portfolio_viewers WHERE username=$1',
    [deleteUsername?.trim()]
  );
  if (r.rowCount === 0) return res.status(404).json({ ok: false, error: 'Viewer topilmadi' });
  res.json({ ok: true });
});

// ═══════════════════════════════════
//  O'QITUVCHILAR PORTFOLIO
// ═══════════════════════════════════

// GET /api/portfolio/teachers — o'qituvchilar ro'yxati
// Superadmin: barchasi + har bir o'qituvchi uchun biriktirilgan viewer_username lari
// Viewer:     faqat o'ziga biriktirilgan o'qituvchilar
router.get('/teachers', async (req, res) => {
  const { username, parol } = req.query;
  const admin  = await verifyAdmin(username, parol);
  const viewer = (!admin?.isSuper) ? await verifyViewer(username, parol) : null;
  if (!admin?.isSuper && !viewer) return res.status(403).json({ ok: false, error: "Ruxsat yo'q" });

  let r;
  if (viewer && !admin?.isSuper) {
    // Viewer — faqat o'ziga biriktirilgan o'qituvchilar
    r = await pool.query(`
      SELECT
        o.id, o.ism, o.familiya, o.fan, o.telefon, o.qoshilgan,
        p.fish, p.universitet, p.sertifikatlar, p.ish_tajribasi,
        COUNT(DISTINCT s.id)::int AS sert_soni
      FROM oqituvchilar o
      INNER JOIN viewer_teachers vt ON o.id = vt.teacher_id AND vt.viewer_username = $1
      LEFT JOIN oqituvchi_portfolio p ON o.id = p.oqituvchi_id
      LEFT JOIN oqituvchi_sertifikat_fayllar s ON o.id = s.oqituvchi_id
      GROUP BY o.id, p.fish, p.universitet, p.sertifikatlar, p.ish_tajribasi
      ORDER BY o.id
    `, [username]);
  } else {
    // Superadmin — hammasi + har biri uchun biriktirilgan viewer usernamelari
    r = await pool.query(`
      SELECT
        o.id, o.ism, o.familiya, o.fan, o.telefon, o.qoshilgan,
        p.fish, p.universitet, p.sertifikatlar, p.ish_tajribasi,
        COUNT(DISTINCT s.id)::int AS sert_soni,
        COALESCE(
          json_agg(DISTINCT vt.viewer_username) FILTER (WHERE vt.viewer_username IS NOT NULL),
          '[]'
        ) AS biriktirilgan_viewers
      FROM oqituvchilar o
      LEFT JOIN oqituvchi_portfolio p ON o.id = p.oqituvchi_id
      LEFT JOIN oqituvchi_sertifikat_fayllar s ON o.id = s.oqituvchi_id
      LEFT JOIN viewer_teachers vt ON o.id = vt.teacher_id
      GROUP BY o.id, p.fish, p.universitet, p.sertifikatlar, p.ish_tajribasi
      ORDER BY o.id
    `);
  }
  res.json({ ok: true, teachers: r.rows });
});

// GET /api/portfolio/teacher/:id — bitta o'qituvchi to'liq profili
router.get('/teacher/:id', async (req, res) => {
  const { username, parol } = req.query;
  const admin  = await verifyAdmin(username, parol);
  const viewer = (!admin?.isSuper) ? await verifyViewer(username, parol) : null;
  if (!admin?.isSuper && !viewer) return res.status(403).json({ ok: false, error: "Ruxsat yo'q" });

  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ ok: false, error: "Noto'g'ri id" });

  const [teacherR, portfolioR, sertR] = await Promise.all([
    pool.query('SELECT * FROM oqituvchilar WHERE id=$1', [id]),
    pool.query('SELECT * FROM oqituvchi_portfolio WHERE oqituvchi_id=$1', [id]),
    pool.query(
      'SELECT id,fayl_nomi,asl_nomi,yuklangan FROM oqituvchi_sertifikat_fayllar WHERE oqituvchi_id=$1 ORDER BY id',
      [id]
    )
  ]);

  if (teacherR.rows.length === 0) return res.status(404).json({ ok: false, error: "O'qituvchi topilmadi" });

  res.json({
    ok: true,
    teacher:      teacherR.rows[0],
    portfolio:    portfolioR.rows[0] || null,
    sertifikatlar: sertR.rows
  });
});

// POST /api/portfolio/teacher/:id — profil saqlash/yangilash (superadmin)
router.post('/teacher/:id', async (req, res) => {
  const { username, parol, fish, universitet, sertifikatlar, ish_tajribasi } = req.body;
  const admin = await verifyAdmin(username, parol);
  if (!admin?.isSuper) return res.status(403).json({ ok: false, error: "Faqat superadmin" });

  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ ok: false, error: "Noto'g'ri id" });

  const found = await pool.query('SELECT id FROM oqituvchilar WHERE id=$1', [id]);
  if (found.rows.length === 0) return res.status(404).json({ ok: false, error: "O'qituvchi topilmadi" });

  await pool.query(`
    INSERT INTO oqituvchi_portfolio
      (oqituvchi_id, fish, universitet, sertifikatlar, ish_tajribasi, yangilangan)
    VALUES ($1,$2,$3,$4,$5,$6)
    ON CONFLICT (oqituvchi_id) DO UPDATE SET
      fish=$2, universitet=$3, sertifikatlar=$4, ish_tajribasi=$5, yangilangan=$6
  `, [id, fish||'', universitet||'', sertifikatlar||'', ish_tajribasi||'', todayUZ()]);

  res.json({ ok: true });
});

// POST /api/portfolio/teacher/:id/sertifikat — fayl yuklash
router.post('/teacher/:id/sertifikat', upload.single('file'), async (req, res) => {
  const { username, parol } = req.body;
  const admin = await verifyAdmin(username, parol);
  if (!admin?.isSuper) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(403).json({ ok: false, error: "Faqat superadmin" });
  }
  if (!req.file) return res.status(400).json({ ok: false, error: 'Fayl yuklanmadi' });

  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(400).json({ ok: false, error: "Noto'g'ri id" });
  }

  // Mavjud sertifikat sonini tekshirish
  const count = await pool.query(
    'SELECT COUNT(*)::int AS cnt FROM oqituvchi_sertifikat_fayllar WHERE oqituvchi_id=$1', [id]
  );
  if (count.rows[0].cnt >= MAX_SERTIFIKAT) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(400).json({ ok: false, error: `Maksimal ${MAX_SERTIFIKAT} ta sertifikat yuklanishi mumkin` });
  }

  await pool.query(
    'INSERT INTO oqituvchi_sertifikat_fayllar (oqituvchi_id,fayl_nomi,asl_nomi,yuklangan) VALUES ($1,$2,$3,$4)',
    [id, req.file.filename, req.file.originalname, todayUZ()]
  );

  res.json({ ok: true, filename: req.file.filename, asl_nomi: req.file.originalname });
});

// DELETE /api/portfolio/teacher/:id/sertifikat/:filename — fayl o'chirish
router.delete('/teacher/:id/sertifikat/:filename', async (req, res) => {
  const { username, parol } = req.body;
  const admin = await verifyAdmin(username, parol);
  if (!admin?.isSuper) return res.status(403).json({ ok: false, error: "Faqat superadmin" });

  const id       = parseInt(req.params.id);
  const filename = req.params.filename;

  const r = await pool.query(
    'DELETE FROM oqituvchi_sertifikat_fayllar WHERE oqituvchi_id=$1 AND fayl_nomi=$2 RETURNING fayl_nomi',
    [id, filename]
  );
  if (r.rowCount === 0) return res.status(404).json({ ok: false, error: 'Sertifikat topilmadi' });

  const fp = path.join(UPLOAD_DIR, filename);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);

  res.json({ ok: true });
});

// GET /api/portfolio/viewer-teachers/:viewerUsername — viewer uchun biriktirilgan teacher ID lari
router.get('/viewer-teachers/:viewerUsername', async (req, res) => {
  const { username, parol } = req.query;
  const admin = await verifyAdmin(username, parol);
  if (!admin?.isSuper) return res.status(403).json({ ok: false, error: "Faqat superadmin" });

  const r = await pool.query(
    'SELECT teacher_id FROM viewer_teachers WHERE viewer_username=$1',
    [req.params.viewerUsername]
  );
  res.json({ ok: true, teacher_ids: r.rows.map(row => row.teacher_id) });
});

// POST /api/portfolio/viewer-teachers — o'qituvchini viewerga biriktirish
router.post('/viewer-teachers', async (req, res) => {
  const { username, parol, viewerUsername, teacherId } = req.body;
  const admin = await verifyAdmin(username, parol);
  if (!admin?.isSuper) return res.status(403).json({ ok: false, error: "Faqat superadmin" });
  if (!viewerUsername || !teacherId) return res.status(400).json({ ok: false, error: "viewerUsername va teacherId majburiy" });

  try {
    await pool.query(
      'INSERT INTO viewer_teachers (viewer_username, teacher_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [viewerUsername, parseInt(teacherId)]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// DELETE /api/portfolio/viewer-teachers — o'qituvchini viewerdan ajratish
router.delete('/viewer-teachers', async (req, res) => {
  const { username, parol, viewerUsername, teacherId } = req.body;
  const admin = await verifyAdmin(username, parol);
  if (!admin?.isSuper) return res.status(403).json({ ok: false, error: "Faqat superadmin" });
  if (!viewerUsername || !teacherId) return res.status(400).json({ ok: false, error: "viewerUsername va teacherId majburiy" });

  await pool.query(
    'DELETE FROM viewer_teachers WHERE viewer_username=$1 AND teacher_id=$2',
    [viewerUsername, parseInt(teacherId)]
  );
  res.json({ ok: true });
});

module.exports = router;