# 🚀 InnovateIT School — Digital Ocean Deploy Guide

## Arxitektura
```
innovateitschool.uz
    ├── /          → /var/www/innovateit-frontend  (static HTML/CSS/JS)
    └── /api       → Node.js :3001  (Express backend)
                          ↓
                     PostgreSQL (innovateit DB)
```

---

## 1️⃣ Dropletga kirish

```bash
ssh root@YOUR_DROPLET_IP
```

---

## 2️⃣ Node.js o'rnatish (agar yo'q bo'lsa)

```bash
# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Tekshirish
node -v   # v20.x.x bo'lishi kerak
npm -v
```

---

## 3️⃣ PM2 o'rnatish (global)

```bash
sudo npm install -g pm2
```

---

## 4️⃣ Nginx o'rnatish (agar yo'q bo'lsa)

```bash
sudo apt update
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

---

## 5️⃣ PostgreSQL: Database va User yaratish

```bash
# PostgreSQL ga kirish
sudo -u postgres psql

# Quyidagilarni psql ichida yozing:
CREATE DATABASE innovateit;
CREATE USER innovateit_user WITH PASSWORD 'KUCHLI_PAROL_YOZ';
GRANT ALL PRIVILEGES ON DATABASE innovateit TO innovateit_user;
\c innovateit
GRANT ALL ON SCHEMA public TO innovateit_user;
\q
```

---

## 6️⃣ Backend fayllarini serverga yuklash

Lokal kompyuteringizda `innovateit-backend` papkasi tayyor.
Uni serverga ko'chirish:

```bash
# Lokal terminalda (droplet IP ni almashtiring):
scp -r ./innovateit-backend root@YOUR_DROPLET_IP:/var/www/

# Yoki GitHub orqali:
# 1) GitHub'ga push qiling
# 2) Dropletda:
cd /var/www
git clone https://github.com/SIZNING_REPO/innovateit-backend.git
```

---

## 7️⃣ Backend sozlash

```bash
cd /var/www/innovateit-backend

# Dependencies o'rnatish
npm install --production

# .env fayl yaratish
cp .env.example .env
nano .env
```

`.env` ichida quyidagilarni to'ldiring:
```env
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=innovateit
DB_USER=innovateit_user
DB_PASSWORD=KUCHLI_PAROL_YOZ     # 5-qadamdagi parol
SUPER_ADMIN_USERNAME=superadmin
SUPER_ADMIN_PAROL=25145771
SUPER_ADMIN_ISM=InnovateIT School Manager
```

---

## 8️⃣ Database jadvallarini yaratish

```bash
# Schema yuklash
sudo -u postgres psql -d innovateit < /var/www/innovateit-backend/schema.sql

# Tekshirish
sudo -u postgres psql -d innovateit -c "\dt"
# Chiqishi: adminlar, oquvchilar, nofaol_oquvchilar, davomat, oqituvchilar, oqituvchilar_davomat
```

---

## 9️⃣ PM2 bilan ishga tushirish

```bash
cd /var/www/innovateit-backend

# Log papkasini yaratish
sudo mkdir -p /var/log/innovateit
sudo chown $USER:$USER /var/log/innovateit

# PM2 bilan ishga tushirish
pm2 start ecosystem.config.js

# Tekshirish
pm2 status
pm2 logs innovateit-backend --lines 20

# Server rebootda ham avtomatik ishlasin
pm2 startup
# (chiqgan buyruqni nusxalab ishlatting)
pm2 save
```

Konsolda ko'rinishi kerak:
```
✅ InnovateIT Backend ishga tushdi: http://127.0.0.1:3001
✅ PostgreSQL ulanish muvaffaqiyatli
```

---

## 🔟 Nginx sozlash

```bash
# Yangi config yaratish
sudo nano /etc/nginx/sites-available/innovateitschool
```

Quyidagi konfiguratsiyani yozing:

```nginx
server {
    listen 80;
    server_name innovateitschool.uz www.innovateitschool.uz;

    # ─── Frontend (static fayllar) ───
    root /var/www/innovateit-frontend;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # ─── Backend API ───
    location /api {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
        proxy_connect_timeout 5s;

        # CORS (Nginx darajasida)
        add_header Access-Control-Allow-Origin  "https://innovateitschool.uz" always;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type" always;

        if ($request_method = OPTIONS) {
            return 204;
        }
    }

    # ─── Kesh (statik fayllar) ───
    location ~* \.(css|js|png|ico|woff2?)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}
```

Config ni yoqish:
```bash
sudo ln -s /etc/nginx/sites-available/innovateitschool /etc/nginx/sites-enabled/
sudo nginx -t          # xatolarni tekshirish
sudo systemctl reload nginx
```

---

## 1️⃣1️⃣ Frontend fayllarni yuklash

```bash
# Frontend papkasini yaratish
sudo mkdir -p /var/www/innovateit-frontend
sudo chown $USER:$USER /var/www/innovateit-frontend

# Lokal kompyuterdan yuklash:
scp -r ./Admin_panel/* root@YOUR_DROPLET_IP:/var/www/innovateit-frontend/
```

---

## 1️⃣2️⃣ Frontend JS fayllarida API URL ni o'zgartirish ⚠️

**Bu eng muhim qadam!** Har bir JS faylda API manzilini yangilang:

```bash
# Serverda:
cd /var/www/innovateit-frontend/js

# Eski GAS URL ni yangi URL ga almashtirish (barcha JS fayllarda)
OLD="https://script.google.com/macros/s/AKfycbzPxt1L57qhkwgwHz8qDXgqRg8qFV81dHH1QPMkFezQENr6S33bn07dLpK_l7fOw1pmHg/exec"
NEW="/api"

sed -i "s|$OLD|$NEW|g" app.js
sed -i "s|$OLD|$NEW|g" davomat.js
sed -i "s|$OLD|$NEW|g" nofaol.js
sed -i "s|$OLD|$NEW|g" oqituvchilar.js
sed -i "s|$OLD|$NEW|g" oqituvchilar-davomat.js

# Tekshirish (hech narsa chiqmasligi kerak):
grep -r "script.google.com" .
```

---

## 1️⃣3️⃣ SSL (HTTPS) — Certbot bilan

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d innovateitschool.uz -d www.innovateitschool.uz

# Avtomatik yangilanish tekshirish
sudo certbot renew --dry-run
```

---

## 1️⃣4️⃣ Tekshirish

```bash
# API health check
curl https://innovateitschool.uz/api?action=login\&username=superadmin\&parol=25145771

# Javob bo'lishi kerak:
# {"ok":true,"ism":"InnovateIT School Manager","isSuper":true}
```

---

## 🔧 Foydali PM2 buyruqlari

```bash
pm2 status                           # holatini ko'rish
pm2 logs innovateit-backend          # real-time loglar
pm2 logs innovateit-backend --lines 50  # oxirgi 50 qator
pm2 restart innovateit-backend       # qayta ishga tushirish
pm2 stop innovateit-backend          # to'xtatish
```

---

## ❓ Muammolar

**Backend ishlamayapti:**
```bash
pm2 logs innovateit-backend --err --lines 30
```

**DB ga ulanmayapti:**
```bash
sudo -u postgres psql -d innovateit -c "SELECT current_user;"
```

**Nginx xatosi:**
```bash
sudo nginx -t
sudo journalctl -u nginx --since "5 minutes ago"
```

**Port band:**
```bash
sudo ss -tlnp | grep 3001
```
