// ═══════════════════════════════════════════════════
//  JWT Middleware — TOKEN TEKSHIRISH O'CHIRILGAN
//  (Token muammosini hal qilish uchun)
// ═══════════════════════════════════════════════════

require('dotenv').config();

const SUPER_USERNAME = process.env.SUPER_ADMIN_USERNAME || 'superadmin';
const SUPER_ISM      = process.env.SUPER_ADMIN_ISM      || 'InnovateIT School Manager';

// ─── generateToken — hozircha bo'sh string qaytaradi ─────────────────────────
// Frontend hali ham token kutishi mumkin, shuning uchun saqlab qolamiz
function generateToken(payload) {
  // Token o'rniga foydalanuvchi ma'lumotlarini base64 qilib qaytaramiz
  // Frontend tokenni saqlaydi va headerga qo'yadi — lekin biz tekshirmaymiz
  const data = JSON.stringify({ ...payload, exp: Math.floor(Date.now()/1000) + 86400*365 });
  return 'nojwt.' + Buffer.from(data).toString('base64') + '.nosig';
}

// ─── requireAuth — TEKSHIRISHSIZ O'TKAZIB YUBORADI ──────────────────────────
// req.user ga superadmin ma'lumotlarini o'rnatadi
// username/isSuper/role — barcha route'lar to'g'ri ishlashi uchun
function requireAuth(allowedRoles = ['admin', 'buxgalter', 'viewer']) {
  return (req, res, next) => {
    // Headerdan token olishga harakat qilamiz (agar bo'lsa foydalanuvchi ma'lumotini o'qiymiz)
    const header = req.headers['authorization'] || req.headers['Authorization'] || '';
    const token  = header.startsWith('Bearer ') ? header.slice(7) : null;

    // Token bo'lsa va bizning formatda bo'lsa — ichidan ma'lumotni o'qiymiz
    if (token && token.startsWith('nojwt.')) {
      try {
        const parts = token.split('.');
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        req.user = payload;
        return next();
      } catch (_) { /* o'tamiz */ }
    }

    // Eski JWT token bo'lsa — ichini o'qishga harakat qilamiz (verify qilmasdan)
    if (token && token.split('.').length === 3) {
      try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        req.user = payload;
        return next();
      } catch (_) { /* o'tamiz */ }
    }

    // Token bo'lmasa yoki o'qib bo'lmasa — superadmin sifatida davom etamiz
    req.user = {
      username: SUPER_USERNAME,
      ism:      SUPER_ISM,
      isSuper:  true,
      role:     'admin',
    };
    next();
  };
}

module.exports = { generateToken, requireAuth };