-- ═══════════════════════════════════════════════════
--  InnovateIT School — PostgreSQL Schema
-- ═══════════════════════════════════════════════════

-- Database yaratish (terminaldan: createdb innovateit)

-- ─── Adminlar ───
CREATE TABLE IF NOT EXISTS adminlar (
    id         SERIAL PRIMARY KEY,
    ism        TEXT        NOT NULL,
    username   TEXT        NOT NULL UNIQUE,
    parol      TEXT        NOT NULL,
    yaratilgan TEXT        DEFAULT TO_CHAR(NOW(), 'DD.MM.YYYY')
);

-- ─── Faol O'quvchilar ───
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
    admin      TEXT,   -- admin username
    qoshilgan  TEXT,   -- ko'rinish uchun sana (DD.MM.YYYY)
    boshlagan  TEXT    -- o'qishni boshlagan sana (YYYY-MM-DD)
);

-- ─── Nofaol O'quvchilar ───
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
    chiqgan    TEXT,    -- safdan chiqgan sana
    izoh       TEXT     DEFAULT ''  -- chiqish sababi
);

-- ─── O'quvchilar Davomati ───
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

-- ─── O'qituvchilar ───
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

-- ─── O'qituvchilar Davomati ───
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

-- ─── O'qituvchi — Maktab bog'lanish (many-to-many) ───
CREATE TABLE IF NOT EXISTS oqituvchi_maktablar (
    id               SERIAL PRIMARY KEY,
    oqituvchi_id     INTEGER NOT NULL REFERENCES oqituvchilar(id) ON DELETE CASCADE,
    admin_username   TEXT NOT NULL,
    biriktirilgan    TEXT DEFAULT TO_CHAR(NOW(), 'DD.MM.YYYY'),
    UNIQUE(oqituvchi_id, admin_username)
);

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO innovateit_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO innovateit_user;
GRANT USAGE ON SCHEMA public TO innovateit_user;


-- ─── Indekslar (tezlik uchun) ───
CREATE INDEX IF NOT EXISTS idx_oquvchilar_admin    ON oquvchilar(admin);
CREATE INDEX IF NOT EXISTS idx_nofaol_admin        ON nofaol_oquvchilar(admin);
CREATE INDEX IF NOT EXISTS idx_davomat_sana_admin  ON davomat(sana, admin_username);
CREATE INDEX IF NOT EXISTS idx_oqituvchilar_admin  ON oqituvchilar(admin);
CREATE INDEX IF NOT EXISTS idx_tdavomat_sana_admin ON oqituvchilar_davomat(sana, admin_username);
CREATE INDEX IF NOT EXISTS idx_oqitmak_oqitid      ON oqituvchi_maktablar(oqituvchi_id);
CREATE INDEX IF NOT EXISTS idx_oqitmak_admin       ON oqituvchi_maktablar(admin_username);

-- ─── Buxgalterlar ───
CREATE TABLE IF NOT EXISTS buxgalterlar (
    id         SERIAL PRIMARY KEY,
    ism        TEXT NOT NULL,
    username   TEXT NOT NULL UNIQUE,
    parol      TEXT NOT NULL,
    yaratilgan TEXT DEFAULT TO_CHAR(NOW(), 'DD.MM.YYYY')
);

-- ─── Oylik To'lovlar ───
CREATE TABLE IF NOT EXISTS tolovlar (
    id                SERIAL PRIMARY KEY,
    oy                TEXT NOT NULL,          -- '2025-03' format
    oquvchi_ism       TEXT NOT NULL,
    oquvchi_familiya  TEXT NOT NULL,
    maktab            TEXT DEFAULT '',
    sinf              TEXT DEFAULT '',
    telefon           TEXT DEFAULT '',
    admin_username    TEXT DEFAULT '',
    tarif             INTEGER DEFAULT 0,
    qaydnoma          TEXT DEFAULT '',
    gaplashilgan_vaqt TEXT DEFAULT '',
    tolov_kerak       INTEGER DEFAULT 0,
    tolov_qildi       INTEGER DEFAULT 0,
    tolov_sanasi      TEXT DEFAULT '',
    kvitansiya_fayl   TEXT DEFAULT '',
    yangilangan       TEXT DEFAULT '',
    UNIQUE(oy, oquvchi_ism, oquvchi_familiya, admin_username)
);

GRANT ALL PRIVILEGES ON TABLE buxgalterlar TO innovateit_user;
GRANT ALL PRIVILEGES ON TABLE tolovlar     TO innovateit_user;
GRANT ALL PRIVILEGES ON SEQUENCE buxgalterlar_id_seq TO innovateit_user;
GRANT ALL PRIVILEGES ON SEQUENCE tolovlar_id_seq     TO innovateit_user;

CREATE INDEX IF NOT EXISTS idx_tolovlar_oy     ON tolovlar(oy);
CREATE INDEX IF NOT EXISTS idx_tolovlar_admin  ON tolovlar(admin_username);

-- ─── Buxgalter — Admin biriktirish ───
CREATE TABLE IF NOT EXISTS buxgalter_adminlar (
    id                  SERIAL PRIMARY KEY,
    buxgalter_username  TEXT NOT NULL,
    admin_username      TEXT NOT NULL,
    UNIQUE(admin_username)  -- bir admin faqat bitta buxgaltergagina
);
GRANT ALL PRIVILEGES ON TABLE buxgalter_adminlar TO innovateit_user;
GRANT ALL PRIVILEGES ON SEQUENCE buxgalter_adminlar_id_seq TO innovateit_user;
CREATE INDEX IF NOT EXISTS idx_bux_admin ON buxgalter_adminlar(buxgalter_username);





-- ─── Portfolio ko'ruvchilar ───
CREATE TABLE IF NOT EXISTS portfolio_viewers (
    id          SERIAL PRIMARY KEY,
    ism         TEXT NOT NULL,
    username    TEXT NOT NULL UNIQUE,
    parol       TEXT NOT NULL,
    yaratilgan  TEXT DEFAULT TO_CHAR(NOW(), 'DD.MM.YYYY')
);
-- ─── O'qituvchi portfolio (1:1 oqituvchilar bilan) ───
CREATE TABLE IF NOT EXISTS oqituvchi_portfolio (
    id              SERIAL PRIMARY KEY,
    oqituvchi_id    INTEGER NOT NULL REFERENCES oqituvchilar(id) ON DELETE CASCADE,
    fish            TEXT DEFAULT '',
    universitet     TEXT DEFAULT '',
    sertifikatlar   TEXT DEFAULT '',
    ish_tajribasi   TEXT DEFAULT '',
    yangilangan     TEXT DEFAULT TO_CHAR(NOW(), 'DD.MM.YYYY'),
    UNIQUE(oqituvchi_id)
);

ALTER TABLE oqituvchi_portfolio ADD COLUMN IF NOT EXISTS display_order INTEGER;
ALTER TABLE oqituvchi_portfolio ADD COLUMN IF NOT EXISTS avatar TEXT DEFAULT '';

-- ─── O'qituvchi sertifikat fayllari (max 10) ───
CREATE TABLE IF NOT EXISTS oqituvchi_sertifikat_fayllar (
    id              SERIAL PRIMARY KEY,
    oqituvchi_id    INTEGER NOT NULL REFERENCES oqituvchilar(id) ON DELETE CASCADE,
    fayl_nomi       TEXT NOT NULL,
    asl_nomi        TEXT DEFAULT '',
    yuklangan       TEXT DEFAULT TO_CHAR(NOW(), 'DD.MM.YYYY')
);
-- ─── Ruxsatlar ───
GRANT ALL PRIVILEGES ON TABLE portfolio_viewers                TO innovateit_user;
GRANT ALL PRIVILEGES ON TABLE oqituvchi_portfolio              TO innovateit_user;
GRANT ALL PRIVILEGES ON TABLE oqituvchi_sertifikat_fayllar     TO innovateit_user;
GRANT ALL PRIVILEGES ON SEQUENCE portfolio_viewers_id_seq               TO innovateit_user;
GRANT ALL PRIVILEGES ON SEQUENCE oqituvchi_portfolio_id_seq             TO innovateit_user;
GRANT ALL PRIVILEGES ON SEQUENCE oqituvchi_sertifikat_fayllar_id_seq   TO innovateit_user;
-- ─── Indekslar ───
CREATE INDEX IF NOT EXISTS idx_portfolio_teacher ON oqituvchi_portfolio(oqituvchi_id);
CREATE INDEX IF NOT EXISTS idx_sert_teacher      ON oqituvchi_sertifikat_fayllar(oqituvchi_id);
CREATE INDEX IF NOT EXISTS idx_pviewer_username  ON portfolio_viewers(username);



-- ─── Viewer — O'qituvchi biriktirish ───
-- Har bir viewer faqat o'ziga biriktirilgan o'qituvchilarni ko'radi
CREATE TABLE IF NOT EXISTS viewer_teachers (
    id               SERIAL PRIMARY KEY,
    viewer_username  TEXT NOT NULL,
    teacher_id       INTEGER NOT NULL REFERENCES oqituvchilar(id) ON DELETE CASCADE,
    biriktirilgan    TEXT DEFAULT TO_CHAR(NOW(), 'DD.MM.YYYY'),
    UNIQUE(viewer_username, teacher_id)
);
GRANT ALL PRIVILEGES ON TABLE viewer_teachers TO innovateit_user;
GRANT ALL PRIVILEGES ON SEQUENCE viewer_teachers_id_seq TO innovateit_user;
CREATE INDEX IF NOT EXISTS idx_vt_viewer  ON viewer_teachers(viewer_username);
CREATE INDEX IF NOT EXISTS idx_vt_teacher ON viewer_teachers(teacher_id);