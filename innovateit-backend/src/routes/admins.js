// ─── Admins routes ─────────────────────────────────
// GET    /api/admins     — ro'yxat (faqat superadmin)
// POST   /api/admins     — yaratish
// PUT    /api/admins     — tahrirlash
// DELETE /api/admins     — o'chirish
const { Router } = require('express');
const pool = require('../db');
const { verifyAdmin } = require('../middleware/auth');

const router = Router();
function todayUZ() { return new Date().toLocaleDateString('ru-RU'); }

router.get('/', async (req, res) => {
  const admin = await verifyAdmin(req.query.username, req.query.parol);
  if (!admin?.isSuper) return res.status(403).json({ ok: false, error: "Ruxsat yo'q" });
  const result = await pool.query('SELECT ism,username,parol,yaratilgan FROM adminlar ORDER BY id');
  res.json({ ok: true, admins: result.rows.map(r => ({ ism: r.ism, username: r.username, parol: r.parol, date: r.yaratilgan })) });
});

router.post('/', async (req, res) => {
  const { username, parol, newUsername, newParol, newIsm } = req.body;
  const admin = await verifyAdmin(username, parol);
  if (!admin?.isSuper) return res.status(403).json({ ok: false, error: "Ruxsat yo'q" });
  if (!newUsername?.trim() || !newParol?.trim() || !newIsm?.trim())
    return res.status(400).json({ ok: false, error: 'Barcha maydonlar majburiy' });
  try {
    await pool.query('INSERT INTO adminlar (ism,username,parol,yaratilgan) VALUES ($1,$2,$3,$4)',
      [newIsm.trim(), newUsername.trim(), newParol.trim(), todayUZ()]);
    res.json({ ok: true });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ ok: false, error: 'Bu username allaqachon mavjud' });
    throw err;
  }
});

router.put('/', async (req, res) => {
  const { username, parol, oldUsername, newIsm, newUsername: nu, newParol: np } = req.body;
  const admin = await verifyAdmin(username, parol);
  if (!admin?.isSuper) return res.status(403).json({ ok: false, error: "Ruxsat yo'q" });

  const q = np?.trim()
    ? 'UPDATE adminlar SET ism=$1,username=$2,parol=$3 WHERE username=$4'
    : 'UPDATE adminlar SET ism=$1,username=$2 WHERE username=$3';
  const params = np?.trim() ? [newIsm, nu, np, oldUsername] : [newIsm, nu, oldUsername];
  const result = await pool.query(q, params);
  if (result.rowCount === 0) return res.status(404).json({ ok: false, error: 'Admin topilmadi' });
  res.json({ ok: true });
});

router.delete('/', async (req, res) => {
  const { username, parol, deleteUsername } = req.body;
  const admin = await verifyAdmin(username, parol);
  if (!admin?.isSuper) return res.status(403).json({ ok: false, error: "Ruxsat yo'q" });
  const result = await pool.query('DELETE FROM adminlar WHERE username=$1', [deleteUsername?.trim()]);
  if (result.rowCount === 0) return res.status(404).json({ ok: false, error: 'Admin topilmadi' });
  res.json({ ok: true });
});

module.exports = router;
