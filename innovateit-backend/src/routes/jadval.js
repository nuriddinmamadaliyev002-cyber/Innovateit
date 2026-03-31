// ─── Jadval routes ─────────────────────────────────
const { Router }      = require('express');
const pool            = require('../db');
const { requireAuth } = require('../middleware/jwt');

const router = Router();
router.use(requireAuth(['admin']));

router.get('/', async (req, res) => {
  const { adminUsername } = req.query;
  const { username, isSuper } = req.user;
  const target = !isSuper ? username : (adminUsername || username);
  const result = await pool.query(
    `SELECT id,teacher_ism,teacher_familiya,fan,sinflar,kunlar,boshlanish,tugash
     FROM dars_jadvali WHERE admin_username=$1 ORDER BY teacher_ism,teacher_familiya,boshlanish`,
    [target]
  );
  res.json({ ok: true, jadvallar: result.rows });
});

router.post('/', async (req, res) => {
  const p = req.body;
  const { username } = req.user;
  if (!p.teacher_ism || !p.teacher_familiya) return res.status(400).json({ ok: false, error: "O'qituvchi ismi kerak" });
  if (!p.sinflar) return res.status(400).json({ ok: false, error: 'Sinflar kerak' });
  if (!p.kunlar)  return res.status(400).json({ ok: false, error: 'Kunlar kerak' });

  if (p.id) {
    const result = await pool.query(
      `UPDATE dars_jadvali SET teacher_ism=$1,teacher_familiya=$2,fan=$3,sinflar=$4,kunlar=$5,boshlanish=$6,tugash=$7
       WHERE id=$8 AND admin_username=$9`,
      [p.teacher_ism, p.teacher_familiya, p.fan||'', p.sinflar, p.kunlar, p.boshlanish||'', p.tugash||'', p.id, username]
    );
    if (result.rowCount === 0) return res.status(404).json({ ok: false, error: 'Jadval topilmadi' });
  } else {
    await pool.query(
      `INSERT INTO dars_jadvali (admin_username,teacher_ism,teacher_familiya,fan,sinflar,kunlar,boshlanish,tugash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [username, p.teacher_ism, p.teacher_familiya, p.fan||'', p.sinflar, p.kunlar, p.boshlanish||'', p.tugash||'']
    );
  }
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  const { username } = req.user;
  const result = await pool.query('DELETE FROM dars_jadvali WHERE id=$1 AND admin_username=$2', [req.params.id, username]);
  if (result.rowCount === 0) return res.status(404).json({ ok: false, error: 'Jadval topilmadi' });
  res.json({ ok: true });
});

module.exports = router;