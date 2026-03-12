const pool = require('../db');
const { verifyAdmin } = require('../middleware/auth');

function todayUZ() {
  return new Date().toLocaleDateString('ru-RU');
}

// ─── O'qituvchilarni olish ───
async function handleGetTeachers(p) {
  const admin = await verifyAdmin(p.username, p.parol);
  if (!admin) return { ok: false, error: "Ruxsat yo'q" };

  let query  = 'SELECT * FROM oqituvchilar ORDER BY id';
  let params = [];

  if (!admin.isSuper) {
    query  = 'SELECT * FROM oqituvchilar WHERE admin=$1 ORDER BY id';
    params = [p.username];
  }

  try {
    const result = await pool.query(query, params);
    const teachers = result.rows.map(r => ({
      ism:        r.ism,
      familiya:   r.familiya,
      fan:        r.fan,
      telefon:    r.telefon,
      telefon2:   r.telefon2,
      kunlar:     r.kunlar,
      sinflar:    r.sinflar,
      boshlanish: r.boshlanish,
      tugash:     r.tugash,
      admin:      r.admin,
      date:       r.qoshilgan
    }));
    return { ok: true, teachers };
  } catch (err) {
    console.error('[getTeachers] DB xatolik:', err.message);
    return { ok: false, error: 'DB xatoligi: ' + err.message };
  }
}

// ─── O'qituvchi qo'shish ───
async function handleAddTeacher(p) {
  const admin = await verifyAdmin(p.username, p.parol);
  if (!admin) return { ok: false, error: "Ruxsat yo'q" };

  const ism      = (p.ism      || '').trim();
  const familiya = (p.familiya || '').trim();
  const fan      = (p.fan      || '').trim();
  const telefon  = (p.telefon  || '').trim();
  const telefon2 = (p.telefon2 || '').trim();
  const kunlar   = (p.kunlar   || '');
  const sinflar  = (p.sinflar  || '');
  const boshlanish = (p.boshlanish || '');
  const tugash   = (p.tugash   || '');
  const date     = (p.date     || todayUZ());

  if (!ism)     return { ok: false, error: "Ism kiritilmagan" };
  if (!familiya) return { ok: false, error: "Familiya kiritilmagan" };

  try {
    await pool.query(
      `INSERT INTO oqituvchilar
        (ism, familiya, fan, telefon, telefon2, kunlar, sinflar, boshlanish, tugash, admin, qoshilgan)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [ism, familiya, fan, telefon, telefon2, kunlar, sinflar, boshlanish, tugash, p.username, date]
    );
    return { ok: true };
  } catch (err) {
    console.error('[addTeacher] DB xatolik:', err.message);
    // Agar ustun topilmasa — soddalashtirilgan INSERT bilan urinib ko'r
    if (err.message && err.message.includes('column')) {
      try {
        await pool.query(
          `INSERT INTO oqituvchilar (ism, familiya, fan, telefon, telefon2, admin, qoshilgan)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [ism, familiya, fan, telefon, telefon2, p.username, date]
        );
        return { ok: true };
      } catch (err2) {
        return { ok: false, error: 'DB xatoligi: ' + err2.message };
      }
    }
    return { ok: false, error: 'DB xatoligi: ' + err.message };
  }
}

// ─── O'qituvchini tahrirlash ───
async function handleEditTeacher(p) {
  const admin = await verifyAdmin(p.username, p.parol);
  if (!admin) return { ok: false, error: "Ruxsat yo'q" };

  try {
    const result = await pool.query(
      `UPDATE oqituvchilar SET
        ism=$1, familiya=$2, fan=$3, telefon=$4, telefon2=$5,
        kunlar=$6, sinflar=$7, boshlanish=$8, tugash=$9
       WHERE ism=$10 AND familiya=$11 AND admin=$12`,
      [
        p.ism, p.familiya, p.fan,
        p.telefon, p.telefon2 || '',
        p.kunlar || '', p.sinflar || '',
        p.boshlanish || '', p.tugash || '',
        p.oldIsm, p.oldFamiliya, p.username
      ]
    );
    if (result.rowCount === 0) return { ok: false, error: "O'qituvchi topilmadi" };
    return { ok: true };
  } catch (err) {
    console.error('[editTeacher] DB xatolik:', err.message);
    return { ok: false, error: 'DB xatoligi: ' + err.message };
  }
}

// ─── O'qituvchini o'chirish ───
async function handleDeleteTeacher(p) {
  const admin = await verifyAdmin(p.username, p.parol);
  if (!admin) return { ok: false, error: "Ruxsat yo'q" };

  try {
    const result = await pool.query(
      'DELETE FROM oqituvchilar WHERE ism=$1 AND familiya=$2 AND admin=$3',
      [p.delIsm, p.delFamiliya, p.username]
    );
    if (result.rowCount === 0) return { ok: false, error: "O'qituvchi topilmadi" };
    return { ok: true };
  } catch (err) {
    console.error('[deleteTeacher] DB xatolik:', err.message);
    return { ok: false, error: 'DB xatoligi: ' + err.message };
  }
}

// ─── O'qituvchilar davomati saqlash ───
async function handleSaveTeacherDavomat(p) {
  const admin = await verifyAdmin(p.username, p.parol);
  if (!admin) return { ok: false, error: "Ruxsat yo'q" };

  const records = JSON.parse(p.records || '[]');
  const sana    = p.sana;
  const now     = new Date().toLocaleTimeString('uz-UZ');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'DELETE FROM oqituvchilar_davomat WHERE sana=$1 AND admin_username=$2',
      [sana, p.username]
    );
    for (const rec of records) {
      await client.query(
        `INSERT INTO oqituvchilar_davomat
          (sana, admin_username, oqituvchi_ism, fan, status, izoh, vaqt_belgilangan, dars_soat, dars_daqiqa)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [sana, p.username, rec.ism, rec.fan || '', rec.status, rec.izoh || '', now,
         rec.dars_soat || 0, rec.dars_daqiqa || 0]
      );
    }
    await client.query('COMMIT');
    return { ok: true, saved: records.length };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[saveTeacherDavomat] xatolik:', err.message);
    return { ok: false, error: 'DB xatoligi: ' + err.message };
  } finally {
    client.release();
  }
}

// ─── O'qituvchilar davomati olish ───
async function handleGetTeacherDavomat(p) {
  const admin = await verifyAdmin(p.username, p.parol);
  if (!admin) return { ok: false, error: "Ruxsat yo'q" };

  try {
    const result = await pool.query(
      `SELECT oqituvchi_ism, fan, status, izoh, dars_soat, dars_daqiqa FROM oqituvchilar_davomat
       WHERE sana=$1 AND admin_username=$2`,
      [p.sana, p.username]
    );
    const records = result.rows.map(r => ({
      ism:        r.oqituvchi_ism,
      fan:        r.fan,
      status:     r.status,
      izoh:       r.izoh,
      dars_soat:   r.dars_soat   || 0,
      dars_daqiqa: r.dars_daqiqa || 0
    }));
    return { ok: true, records };
  } catch (err) {
    return { ok: false, error: 'DB xatoligi: ' + err.message };
  }
}

module.exports = {
  handleGetTeachers,
  handleAddTeacher,
  handleEditTeacher,
  handleDeleteTeacher,
  handleSaveTeacherDavomat,
  handleGetTeacherDavomat
};