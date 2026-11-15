import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const havuz = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:lojistiksaas@db.nkilyhxlygprpjcsltef.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 1000 * 60 * 10, // 10 dakika boşta kalırsa kapat
  keepAlive: true,
});

// Boşta kalan bağlantı koptuğunda sunucunun çökmesini engelle
havuz.on('error', (err) => {
  console.warn('Havuzdaki pasif bağlantı kapandı veya yenilendi:', err.message);
});

// Sunucu ayağa kalktığında ilk bağlantıları kur ve şemayı güncelle
async function semaHazirla() {
  try {
    await havuz.query(`
      ALTER TABLE randevular 
        ADD COLUMN IF NOT EXISTS irsaliye_no VARCHAR(50),
        ADD COLUMN IF NOT EXISTS yuk_cinsi VARCHAR(100),
        ADD COLUMN IF NOT EXISTS tonaj_kg NUMERIC,
        ADD COLUMN IF NOT EXISTS palet_sayisi INTEGER,
        ADD COLUMN IF NOT EXISTS muhur_no VARCHAR(50),
        ADD COLUMN IF NOT EXISTS sofor_imzasi TEXT,
        ADD COLUMN IF NOT EXISTS irsaliye_tarihi TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS irsaliye_durumu VARCHAR(30) DEFAULT 'YOK';
    `);
    console.log('✓ Supabase randevular tablosu irsaliye ve e-imza sütunları hazır.');
  } catch (err: any) {
    console.warn('Şema güncelleme bildirimi:', err.message);
  }
}

Promise.all([
  havuz.query('SELECT 1'),
  havuz.query('SELECT 1'),
  havuz.query('SELECT 1'),
  havuz.query('SELECT 1'),
]).then(() => {
  console.log('✓ Supabase 4 bağlantılı sıcak havuz hazır.');
  semaHazirla();
}).catch((err) => {
  console.error('Havuz ön ısıtma hatası:', err.message);
});

export const sorgu = (metin: string, parametreler?: any[]) => havuz.query(metin, parametreler);

export default havuz;

