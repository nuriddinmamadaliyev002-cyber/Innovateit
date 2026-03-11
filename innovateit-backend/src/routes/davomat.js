const pool = require('../db');
const { verifyAdmin } = require('../middleware/auth');

// ─── Davomat saqlash ───
async function handleSaveDavomat(p) {
  const admin = await verifyAdmin(p.username, p.parol);
  if (!admin) return { ok: false, error: "Ruxsat yo'q" };

  const records = JSON.parse(p.records || '[]');
  const sana    = p.sana;
  const now     = new Date().toLocaleTimeString('uz-UZ');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Shu sana + admin uchun eski yozuvlarni o'chirish
    await client.query(
      'DELETE FROM davomat WHERE sana=$1 AND admin_username=$2',
      [sana, p.username]
    );

    // Yangilarini qo'shish
    for (const rec of records) {
      await client.query(
        `INSERT INTO davomat (sana, admin_username, sinf, oquvchi_ism, status, izoh, vaqt_belgilangan)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [sana, p.username, rec.sinf, rec.ism, rec.status, rec.izoh || '', now]
      );
    }

    await client.query('COMMIT');
    return { ok: true, saved: records.length };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Davomat olish ───
async function handleGetDavomat(p) {
  const admin = await verifyAdmin(p.username, p.parol);
  if (!admin) return { ok: false, error: "Ruxsat yo'q" };

  const sana           = p.sana;
  const targetUsername = (admin.isSuper && p.adminUsername) ? p.adminUsername : p.username;

  const result = await pool.query(
    'SELECT sinf, oquvchi_ism, status, izoh FROM davomat WHERE sana=$1 AND admin_username=$2',
    [sana, targetUsername]
  );
  const records = result.rows.map(r => ({
    sinf:   r.sinf,
    ism:    r.oquvchi_ism,
    status: r.status,
    izoh:   r.izoh
  }));
  return { ok: true, records };
}

// ─── Davomat tarixi ───
async function handleGetDavomatTarix(p) {
  const admin = await verifyAdmin(p.username, p.parol);
  if (!admin) return { ok: false, error: "Ruxsat yo'q" };

  const targetUsername = (admin.isSuper && p.adminUsername) ? p.adminUsername : p.username;

  const result = await pool.query(
    'SELECT DISTINCT sana FROM davomat WHERE admin_username=$1 ORDER BY sana DESC',
    [targetUsername]
  );
  const sanalar = result.rows.map(r => r.sana);
  return { ok: true, sanalar };
}

module.exports = {
  handleSaveDavomat,
  handleGetDavomat,
  handleGetDavomatTarix
};
