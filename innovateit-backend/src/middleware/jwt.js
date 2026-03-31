// ═══════════════════════════════════════════════════
//  JWT Middleware — token yaratish va tekshirish
// ═══════════════════════════════════════════════════
const jwt = require('jsonwebtoken');

const SECRET  = process.env.JWT_SECRET   || 'innovateit_super_secret_key_change_in_production';
const EXPIRES = process.env.JWT_EXPIRES  || '8h';   // seans muddati

// ─── Token yaratish ──────────────────────────────────────────────────────────
// payload: { username, ism, isSuper, role }
// role: 'admin' | 'buxgalter' | 'viewer'
function generateToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES });
}

// ─── requireAuth middleware ───────────────────────────────────────────────────
// allowedRoles — ruxsat etilgan rollar massivi
//   requireAuth(['admin'])                  → faqat adminlar
//   requireAuth(['admin', 'buxgalter'])     → admin yoki buxgalter
//   requireAuth(['admin', 'buxgalter', 'viewer']) → hammasi
//
// Muvaffaqiyatli bo'lsa req.user = { username, ism, isSuper, role } o'rnatadi
function requireAuth(allowedRoles = ['admin', 'buxgalter', 'viewer']) {
  return (req, res, next) => {
    // Authorization: Bearer <token>
    const header = req.headers['authorization'] || req.headers['Authorization'] || '';
    const token  = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ ok: false, error: 'Token kerak. Iltimos qayta login qiling.' });
    }

    let payload;
    try {
      payload = jwt.verify(token, SECRET);
    } catch (err) {
      const msg = err.name === 'TokenExpiredError'
        ? 'Seans muddati tugadi. Qayta login qiling.'
        : "Token noto'g'ri. Qayta login qiling.";
      return res.status(401).json({ ok: false, error: msg, expired: err.name === 'TokenExpiredError' });
    }

    // Rol tekshirish
    if (!allowedRoles.includes(payload.role)) {
      return res.status(403).json({ ok: false, error: "Bu amalni bajarishga ruxsatingiz yo'q." });
    }

    req.user = payload;   // { username, ism, isSuper, role }
    next();
  };
}

module.exports = { generateToken, requireAuth };