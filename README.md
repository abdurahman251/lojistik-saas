# Lojistik OS - Bulut Tabanlı Lojistik ve Rampa Yönetim Sistemi

Modern lojistik merkezleri, liman terminalleri, sürücüler ve operatörler için geliştirilmiş yeni nesil SaaS yönetim platformu.

## 🚀 Teknolojiler
- **Frontend:** React, Vite, Tailwind CSS, Lucide React
- **Backend:** Node.js, Express, TypeScript, Multer, Socket.io
- **Veritabanı:** Supabase (PostgreSQL)

## 📦 Proje Yapısı
- `frontend/` - React Vite istemci arayüzü (Login, Sürücü Portalı, Kiosk Doğrulama, Operatör Saha ve Rampa Yönetimi)
- `sunucu/` - Node.js Express API sunucusu (Kimlik doğrulama, randevu yönetimi, kiosk kapı kontrolleri, rampa atamaları)

## ⚙️ Kurulum ve Çalıştırma

### 1. Bağımlılıkları Yükleyin
```bash
# Sunucu bağımlılıkları
cd sunucu
npm install

# Frontend bağımlılıkları
cd ../frontend
npm install
```

### 2. Ortam Değişkenleri
`sunucu/.env` dosyasını oluşturup Supabase bağlantı bilginizi girin:
```env
DATABASE_URL="postgresql://postgres:[SIFRE]@db.nkilyhxlygprpjcsltef.supabase.co:5432/postgres"
JWT_SECRET="lojistik_os_super_gizli_anahtar_2026"
PORT=5000
```

### 3. Uygulamayı Başlatın
Ayrı terminallerde veya kök dizinden:
```bash
# Kök dizinden
npm run sunucu   # Port 5000
npm run frontend # Port 5173
```
