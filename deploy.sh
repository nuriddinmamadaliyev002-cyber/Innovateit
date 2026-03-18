#!/bin/bash
# ═══════════════════════════════════════════════════
#  InnovateIT School — Deploy skript
#  Ishlatish: bash deploy.sh
#  Git pull dan keyin shu skriptni ishlatish kifoya
# ═══════════════════════════════════════════════════

set -e  # Xato bo'lsa to'xta

echo ""
echo "🚀 InnovateIT deploy boshlandi..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ─── 1. Kodlarni yangilash ───
echo ""
echo "📥 1. GitHub dan kod yangilanmoqda..."
cd /var/www/Innovateit
git pull origin main
echo "✅ Kod yangilandi"

# ─── 2. Backend dependencies ───
echo ""
echo "📦 2. Backend dependencies tekshirilmoqda..."
cd /var/www/Innovateit/innovateit-backend
npm install --production --silent
echo "✅ Dependencies tayyor"

# ─── 3. Database: jadvallar va ruxsatlar ───
echo ""
echo "🗄️  3. Database jadvallar va ruxsatlar yangilanmoqda..."

sudo -u postgres psql -d innovateit << 'SQL'

-- ─── Jadvallar mavjud bo'lmasa yaratish ───
CREATE TABLE IF NOT EXISTS adminlar (
    id         SERIAL PRIMARY KEY,
    ism        TEXT        NOT NULL,
    username   TEXT        NOT NULL UNIQUE,
    parol      TEXT        NOT NULL,
    yaratilgan TEXT        DEFAULT TO_CHAR(NOW(), 'DD.MM.YYYY')
);

CREATE TABLE IF NOT EXISTS oquvchilar (
    id         SERIAL PRIMARY KEY,
    ism        TEXT NOT NULL,
    familiya   TEXT NOT NULL,
    maktab     TEXT,
    sinf       TEXT,
    telefon    TEXT,
    telefon2   TEXT,
    tug        TEXT,
    manzil     TEXT,
    admin      TEXT,
    qoshilgan  TEXT,
    boshlagan  TEXT
);

CREATE TABLE IF NOT EXISTS nofaol_oquvchilar (
    id         SERIAL PRIMARY KEY,
    ism        TEXT NOT NULL,
    familiya   TEXT NOT NULL,
    maktab     TEXT,
    sinf       TEXT,
    telefon    TEXT,
    telefon2   TEXT,
    tug        TEXT,
    manzil     TEXT,
    admin      TEXT,
    qoshilgan  TEXT,
    boshlagan  TEXT,
    chiqgan    TEXT,
    izoh       TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS davomat (
    id               SERIAL PRIMARY KEY,
    sana             TEXT NOT NULL,
    admin_username   TEXT NOT NULL,
    sinf             TEXT,
    oquvchi_ism      TEXT,
    status           TEXT,
    izoh             TEXT,
    vaqt_belgilangan TEXT
);

CREATE TABLE IF NOT EXISTS oqituvchilar (
    id         SERIAL PRIMARY KEY,
    ism        TEXT NOT NULL,
    familiya   TEXT NOT NULL,
    fan        TEXT,
    telefon    TEXT,
    telefon2   TEXT,
    kunlar     TEXT,
    sinflar    TEXT,
    boshlanish TEXT,
    tugash     TEXT,
    admin      TEXT,
    qoshilgan  TEXT
);

CREATE TABLE IF NOT EXISTS oqituvchilar_davomat (
    id               SERIAL PRIMARY KEY,
    sana             TEXT NOT NULL,
    admin_username   TEXT NOT NULL,
    oqituvchi_ism    TEXT,
    fan              TEXT,
    status           TEXT,
    izoh             TEXT,
    vaqt_belgilangan TEXT,
    dars_soat        INTEGER DEFAULT 0,
    dars_daqiqa      INTEGER DEFAULT 0,
    kech_minut       INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS dars_jadvali (
    id               SERIAL PRIMARY KEY,
    admin_username   TEXT NOT NULL,
    teacher_ism      TEXT NOT NULL,
    teacher_familiya TEXT NOT NULL,
    fan              TEXT,
    sinflar          TEXT,
    kunlar           TEXT,
    boshlanish       TEXT,
    tugash           TEXT
);

-- ─── O'qituvchi — Maktab (many-to-many) ───
CREATE TABLE IF NOT EXISTS oqituvchi_maktablar (
    id               SERIAL PRIMARY KEY,
    oqituvchi_id     INTEGER NOT NULL REFERENCES oqituvchilar(id) ON DELETE CASCADE,
    admin_username   TEXT NOT NULL,
    biriktirilgan    TEXT DEFAULT TO_CHAR(NOW(), 'DD.MM.YYYY'),
    UNIQUE(oqituvchi_id, admin_username)
);

-- ─── Mavjud oqituvchilar.admin => oqituvchi_maktablar ga ko'chirish ───
INSERT INTO oqituvchi_maktablar (oqituvchi_id, admin_username)
SELECT id, admin
FROM oqituvchilar
WHERE admin IS NOT NULL AND admin != ''
ON CONFLICT DO NOTHING;

-- ─── Ustunlar mavjud bo'lmasa qo'shish ───
ALTER TABLE oqituvchilar_davomat ADD COLUMN IF NOT EXISTS dars_soat   INTEGER DEFAULT 0;
ALTER TABLE oqituvchilar_davomat ADD COLUMN IF NOT EXISTS dars_daqiqa INTEGER DEFAULT 0;
ALTER TABLE oqituvchilar_davomat ADD COLUMN IF NOT EXISTS kech_minut  INTEGER DEFAULT 0;

-- ─── Indekslar ───
CREATE INDEX IF NOT EXISTS idx_oquvchilar_admin    ON oquvchilar(admin);
CREATE INDEX IF NOT EXISTS idx_nofaol_admin        ON nofaol_oquvchilar(admin);
CREATE INDEX IF NOT EXISTS idx_davomat_sana_admin  ON davomat(sana, admin_username);
CREATE INDEX IF NOT EXISTS idx_oqituvchilar_admin  ON oqituvchilar(admin);
CREATE INDEX IF NOT EXISTS idx_tdavomat_sana_admin ON oqituvchilar_davomat(sana, admin_username);
CREATE INDEX IF NOT EXISTS idx_oqitmak_oqitid      ON oqituvchi_maktablar(oqituvchi_id);
CREATE INDEX IF NOT EXISTS idx_oqitmak_admin       ON oqituvchi_maktablar(admin_username);

-- ─── RUXSATLAR (eng muhimi!) ───
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO innovateit_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO innovateit_user;
GRANT USAGE ON SCHEMA public TO innovateit_user;

-- Kelajakda yaratilgan jadvallar uchun ham
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON TABLES TO innovateit_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON SEQUENCES TO innovateit_user;

SQL

echo "✅ Database tayyor"

# ─── 4. Frontend fayllarni yangilash ───
echo ""
echo "🌐 4. Frontend fayllar yangilanmoqda..."
rsync -av --delete \
  /var/www/Innovateit/innovateit-frontend/ \
  /var/www/innovateit-frontend/ \
  --exclude='.git' \
  --exclude='.gitignore'
echo "✅ Frontend yangilandi"

# ─── 5. Backend qayta ishga tushirish ───
echo ""
echo "🔄 5. Backend qayta ishga tushirilmoqda..."
pm2 restart innovateit-backend
sleep 2
pm2 status
echo "✅ Backend qayta ishga tushdi"

# ─── 6. Tekshirish ───
echo ""
echo "🔍 6. API tekshirilmoqda..."
sleep 1
HEALTH=$(curl -s http://127.0.0.1:3001/health 2>/dev/null || echo "xato")
if echo "$HEALTH" | grep -q '"ok":true'; then
  echo "✅ API ishlayapti: $HEALTH"
else
  echo "⚠️  API javob bermadi: $HEALTH"
  echo "   Loglarni tekshiring: pm2 logs innovateit-backend --lines 20"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Deploy muvaffaqiyatli yakunlandi!"
echo "🌐 https://innovateitschool.uz"
echo ""