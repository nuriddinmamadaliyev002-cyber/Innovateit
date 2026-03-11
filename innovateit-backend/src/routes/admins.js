const pool = require('../db');
const { verifyAdmin } = require('../middleware/auth');

function todayUZ() {
  return new Date().toLocaleDateString('ru-RU');
}

// ─── Adminlarni olish (faqat superadmin) ───
async function handleGetAdmins(p) {
  const admin = await verifyAdmin(p.username, p.parol);
  if (!admin || !admin.isSuper) return { ok: false, error: "Ruxsat yo'q" };

  const result = await pool.query('SELECT ism, username, parol, yaratilgan FROM adminlar ORDER BY id');
  const admins = result.rows.map(r => ({
    ism:      r.ism,
    username: r.username,
    parol:    r.parol,
    date:     r.yaratilgan
  }));
  return { ok: true, admins };
}

// ─── Admin yaratish ───
async function handleCreateAdmin(p) {
  const admin = await verifyAdmin(p.username, p.parol);
  if (!admin || !admin.isSuper) return { ok: false, error: "Ruxsat yo'q" };

  const newUsername = (p.newUsername || '').trim();
  const newParol    = (p.newParol    || '').trim();
  const newIsm      = (p.newIsm      || '').trim();

  if (!newUsername || !newParol || !newIsm) return { ok: false, error: "Barcha maydonlar majburiy" };

  try {
    await pool.query(
      'INSERT INTO adminlar (ism, username, parol, yaratilgan) VALUES ($1,$2,$3,$4)',
      [newIsm, newUsername, newParol, todayUZ()]
    );
  } catch (err) {
    if (err.code === '23505') return { ok: false, error: "Bu username allaqachon mavjud" };
    throw err;
  }
  return { ok: true };
}

// ─── Adminni tahrirlash ───
async function handleEditAdmin(p) {
  const admin = await verifyAdmin(p.username, p.parol);
  if (!admin || !admin.isSuper) return { ok: false, error: "Ruxsat yo'q" };

  const oldUsername = (p.oldUsername || '').trim();
  const newIsm      = (p.newIsm      || '').trim();
  const newUsername = (p.newUsername || '').trim();
  const newParol    = (p.newParol    || '').trim();

  let query, params;
  if (newParol) {
    query  = 'UPDATE adminlar SET ism=$1, username=$2, parol=$3 WHERE username=$4';
    params = [newIsm, newUsername, newParol, oldUsername];
  } else {
    query  = 'UPDATE adminlar SET ism=$1, username=$2 WHERE username=$3';
    params = [newIsm, newUsername, oldUsername];
  }

  const result = await pool.query(query, params);
  if (result.rowCount === 0) return { ok: false, error: "Admin topilmadi" };
  return { ok: true };
}

// ─── Adminni o'chirish ───
async function handleDeleteAdmin(p) {
  const admin = await verifyAdmin(p.username, p.parol);
  if (!admin || !admin.isSuper) return { ok: false, error: "Ruxsat yo'q" };

  const result = await pool.query(
    'DELETE FROM adminlar WHERE username=$1',
    [(p.deleteUsername || '').trim()]
  );
  if (result.rowCount === 0) return { ok: false, error: "Admin topilmadi" };
  return { ok: true };
}

module.exports = {
  handleGetAdmins,
  handleCreateAdmin,
  handleEditAdmin,
  handleDeleteAdmin
};
