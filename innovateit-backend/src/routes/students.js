const pool = require('../db');
const { verifyAdmin } = require('../middleware/auth');

function todayUZ() {
  return new Date().toLocaleDateString('ru-RU'); // DD.MM.YYYY format
}

// ─── O'quvchilarni olish ───
async function handleGetStudents(p) {
  const admin = await verifyAdmin(p.username, p.parol);
  if (!admin) return { ok: false, error: "Ruxsat yo'q" };

  let query  = 'SELECT * FROM oquvchilar ORDER BY id';
  let params = [];

  if (!admin.isSuper) {
    query  = 'SELECT * FROM oquvchilar WHERE admin = $1 ORDER BY id';
    params = [p.username];
  }

  const result = await pool.query(query, params);
  const students = result.rows.map(r => ({
    ism:       r.ism,
    familiya:  r.familiya,
    maktab:    r.maktab,
    sinf:      r.sinf,
    telefon:   r.telefon,
    telefon2:  r.telefon2,
    tug:       r.tug,
    manzil:    r.manzil,
    admin:     r.admin,
    date:      r.qoshilgan,
    boshlagan: r.boshlagan
  }));
  return { ok: true, students };
}

// ─── O'quvchi qo'shish ───
async function handleAddStudent(p) {
  const admin = await verifyAdmin(p.username, p.parol);
  if (!admin) return { ok: false, error: "Ruxsat yo'q" };

  await pool.query(
    `INSERT INTO oquvchilar
      (ism, familiya, maktab, sinf, telefon, telefon2, tug, manzil, admin, qoshilgan, boshlagan)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      p.ism, p.familiya, p.maktab, p.sinf,
      p.telefon, p.telefon2 || '',
      p.tug, p.manzil || '',
      p.username,
      p.date || todayUZ(),
      p.boshlagan || ''
    ]
  );
  return { ok: true };
}

// ─── O'quvchini tahrirlash ───
async function handleEditStudent(p) {
  const admin = await verifyAdmin(p.username, p.parol);
  if (!admin) return { ok: false, error: "Ruxsat yo'q" };

  const result = await pool.query(
    `UPDATE oquvchilar SET
      ism=$1, familiya=$2, maktab=$3, sinf=$4,
      telefon=$5, telefon2=$6, tug=$7, manzil=$8, boshlagan=$9
     WHERE ism=$10 AND familiya=$11
     ${!admin.isSuper ? 'AND admin=$12' : ''}`,
    admin.isSuper
      ? [p.ism, p.familiya, p.maktab, p.sinf, p.telefon, p.telefon2||'', p.tug, p.manzil||'', p.boshlagan||'', p.oldIsm, p.oldFamiliya]
      : [p.ism, p.familiya, p.maktab, p.sinf, p.telefon, p.telefon2||'', p.tug, p.manzil||'', p.boshlagan||'', p.oldIsm, p.oldFamiliya, p.username]
  );
  if (result.rowCount === 0) return { ok: false, error: "O'quvchi topilmadi" };
  return { ok: true };
}

// ─── O'quvchini o'chirish (to'g'ridan-to'g'ri) ───
async function handleDeleteStudent(p) {
  const admin = await verifyAdmin(p.username, p.parol);
  if (!admin) return { ok: false, error: "Ruxsat yo'q" };

  const result = await pool.query(
    `DELETE FROM oquvchilar WHERE ism=$1 AND familiya=$2
     ${!admin.isSuper ? 'AND admin=$3' : ''}`,
    admin.isSuper ? [p.delIsm, p.delFamiliya] : [p.delIsm, p.delFamiliya, p.username]
  );
  if (result.rowCount === 0) return { ok: false, error: "O'quvchi topilmadi" };
  return { ok: true };
}

// ─── Nofaol ro'yxatga o'tkazish ───
async function handleMoveToInactive(p) {
  const admin = await verifyAdmin(p.username, p.parol);
  if (!admin) return { ok: false, error: "Ruxsat yo'q" };

  // Izoh majburiy tekshiruv
  const izoh = (p.izoh || '').trim();
  if (!izoh) return { ok: false, error: "Chiqish sababi (izoh) majburiy" };
  if (izoh.length < 10) return { ok: false, error: "Chiqish sababi kamida 10 ta belgi bo'lishi kerak" };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Faol jadvaldagi o'quvchini topish
    const findResult = await client.query(
      `SELECT * FROM oquvchilar WHERE ism=$1 AND familiya=$2
       ${!admin.isSuper ? 'AND admin=$3' : ''} LIMIT 1`,
      admin.isSuper ? [p.delIsm, p.delFamiliya] : [p.delIsm, p.delFamiliya, p.username]
    );

    if (findResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return { ok: false, error: "O'quvchi topilmadi" };
    }

    const s = findResult.rows[0];

    // Nofaol jadvaliga qo'shish
    await client.query(
      `INSERT INTO nofaol_oquvchilar
        (ism, familiya, maktab, sinf, telefon, telefon2, tug, manzil, admin, qoshilgan, boshlagan, chiqgan, izoh)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [s.ism, s.familiya, s.maktab, s.sinf, s.telefon, s.telefon2,
       s.tug, s.manzil, s.admin, s.qoshilgan, s.boshlagan,
       p.chiqgan || todayUZ(), izoh]
    );

    // Faol jadvalddan o'chirish
    await client.query('DELETE FROM oquvchilar WHERE id=$1', [s.id]);

    await client.query('COMMIT');
    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Nofaol o'quvchilarni olish ───
async function handleGetNofaol(p) {
  const admin = await verifyAdmin(p.username, p.parol);
  if (!admin) return { ok: false, error: "Ruxsat yo'q" };

  let query  = 'SELECT * FROM nofaol_oquvchilar ORDER BY id';
  let params = [];

  if (!admin.isSuper) {
    query  = 'SELECT * FROM nofaol_oquvchilar WHERE admin=$1 ORDER BY id';
    params = [p.username];
  }

  const result = await pool.query(query, params);
  const students = result.rows.map(r => ({
    ism:       r.ism,
    familiya:  r.familiya,
    maktab:    r.maktab,
    sinf:      r.sinf,
    telefon:   r.telefon,
    telefon2:  r.telefon2,
    tug:       r.tug,
    manzil:    r.manzil,
    admin:     r.admin,
    date:      r.qoshilgan,
    boshlagan: r.boshlagan,
    chiqgan:   r.chiqgan,
    izoh:      r.izoh || ''
  }));
  return { ok: true, students };
}

// ─── Nofaoldan faolga qaytarish ───
async function handleMoveToActive(p) {
  const admin = await verifyAdmin(p.username, p.parol);
  if (!admin) return { ok: false, error: "Ruxsat yo'q" };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const findResult = await client.query(
      `SELECT * FROM nofaol_oquvchilar WHERE ism=$1 AND familiya=$2
       ${!admin.isSuper ? 'AND admin=$3' : ''} LIMIT 1`,
      admin.isSuper ? [p.delIsm, p.delFamiliya] : [p.delIsm, p.delFamiliya, p.username]
    );

    if (findResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return { ok: false, error: "O'quvchi topilmadi" };
    }

    const s = findResult.rows[0];

    await client.query(
      `INSERT INTO oquvchilar
        (ism, familiya, maktab, sinf, telefon, telefon2, tug, manzil, admin, qoshilgan, boshlagan)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [s.ism, s.familiya, s.maktab, s.sinf, s.telefon, s.telefon2,
       s.tug, s.manzil, s.admin, s.qoshilgan, s.boshlagan]
    );

    await client.query('DELETE FROM nofaol_oquvchilar WHERE id=$1', [s.id]);

    await client.query('COMMIT');
    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  handleGetStudents,
  handleAddStudent,
  handleEditStudent,
  handleDeleteStudent,
  handleMoveToInactive,
  handleGetNofaol,
  handleMoveToActive
};
// ─── Nofaol o'quvchini tahrirlash (chiqgan sana + izoh) ───
async function handleEditNofaol(p) {
  const admin = await verifyAdmin(p.username, p.parol);
  if (!admin) return { ok: false, error: "Ruxsat yo'q" };

  const chiqgan = (p.chiqgan || '').trim();
  const izoh    = (p.izoh    || '').trim();

  if (!chiqgan) return { ok: false, error: "Chiqgan sana majburiy" };
  if (!izoh)    return { ok: false, error: "Chiqish sababi majburiy" };
  if (izoh.length < 10) return { ok: false, error: "Chiqish sababi kamida 10 ta belgi bo'lishi kerak" };

  const result = await pool.query(
    `UPDATE nofaol_oquvchilar SET chiqgan=$1, izoh=$2
     WHERE ism=$3 AND familiya=$4 ${!admin.isSuper ? 'AND admin=$5' : ''}`,
    admin.isSuper
      ? [chiqgan, izoh, p.delIsm, p.delFamiliya]
      : [chiqgan, izoh, p.delIsm, p.delFamiliya, p.username]
  );
  if (result.rowCount === 0) return { ok: false, error: "O'quvchi topilmadi" };
  return { ok: true };
}

// ─── Nofaol o'quvchini o'chirish ───
async function handleDeleteNofaol(p) {
  const admin = await verifyAdmin(p.username, p.parol);
  if (!admin) return { ok: false, error: "Ruxsat yo'q" };

  const result = await pool.query(
    `DELETE FROM nofaol_oquvchilar WHERE ism=$1 AND familiya=$2 ${!admin.isSuper ? 'AND admin=$3' : ''}`,
    admin.isSuper ? [p.delIsm, p.delFamiliya] : [p.delIsm, p.delFamiliya, p.username]
  );
  if (result.rowCount === 0) return { ok: false, error: "O'quvchi topilmadi" };
  return { ok: true };
}

// ─── Export yangilash ───
Object.assign(module.exports, { handleEditNofaol, handleDeleteNofaol });