const pool = require('../db');
const { verifyAdmin } = require('../middleware/auth');

// ─── Jadvallarni olish ───
async function handleGetJadvallar(p) {
  const admin = await verifyAdmin(p.username, p.parol);
  if (!admin) return { ok: false, error: "Ruxsat yo'q" };

  const targetUsername = (!admin.isSuper) ? p.username
    : (p.adminUsername || p.username);

  const result = await pool.query(
    `SELECT id, teacher_ism, teacher_familiya, fan, sinflar, kunlar, boshlanish, tugash
     FROM dars_jadvali
     WHERE admin_username = $1
     ORDER BY teacher_ism, teacher_familiya, boshlanish`,
    [targetUsername]
  );

  return { ok: true, jadvallar: result.rows };
}

// ─── Jadval saqlash (qo'shish yoki yangilash) ───
async function handleSaveJadval(p) {
  const admin = await verifyAdmin(p.username, p.parol);
  if (!admin) return { ok: false, error: "Ruxsat yo'q" };

  const {
    teacher_ism, teacher_familiya, fan,
    sinflar, kunlar, boshlanish, tugash
  } = p;

  if (!teacher_ism || !teacher_familiya)
    return { ok: false, error: "O'qituvchi ismi kerak" };
  if (!sinflar) return { ok: false, error: "Sinflar kerak" };
  if (!kunlar)  return { ok: false, error: "Kunlar kerak"  };

  // Agar id berilgan bo'lsa — update, aks holda insert
  if (p.id) {
    const result = await pool.query(
      `UPDATE dars_jadvali SET
        teacher_ism=$1, teacher_familiya=$2, fan=$3,
        sinflar=$4, kunlar=$5, boshlanish=$6, tugash=$7
       WHERE id=$8 AND admin_username=$9`,
      [teacher_ism, teacher_familiya, fan||'',
       sinflar, kunlar, boshlanish||'', tugash||'',
       p.id, p.username]
    );
    if (result.rowCount === 0) return { ok: false, error: "Jadval topilmadi" };
  } else {
    await pool.query(
      `INSERT INTO dars_jadvali
        (admin_username, teacher_ism, teacher_familiya, fan, sinflar, kunlar, boshlanish, tugash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [p.username, teacher_ism, teacher_familiya, fan||'',
       sinflar, kunlar, boshlanish||'', tugash||'']
    );
  }

  return { ok: true };
}

// ─── Jadval o'chirish ───
async function handleDeleteJadval(p) {
  const admin = await verifyAdmin(p.username, p.parol);
  if (!admin) return { ok: false, error: "Ruxsat yo'q" };

  if (!p.id) return { ok: false, error: "id kerak" };

  const result = await pool.query(
    'DELETE FROM dars_jadvali WHERE id=$1 AND admin_username=$2',
    [p.id, p.username]
  );
  if (result.rowCount === 0) return { ok: false, error: "Jadval topilmadi" };
  return { ok: true };
}

module.exports = {
  handleGetJadvallar,
  handleSaveJadval,
  handleDeleteJadval
};