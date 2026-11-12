import { Client } from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:lojistiksaas@db.nkilyhxlygprpjcsltef.supabase.co:5432/postgres';

async function baslat() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✓ Supabase PostgreSQL veritabanına başarıyla bağlanıldı.');

    // Mevcut tabloları kontrol et
    const tablolarRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('Mevcut public tablolar:', tablolarRes.rows.map(r => r.table_name));

    // kullanicilar tablosunu oluştur
    await client.query(`
      CREATE TABLE IF NOT EXISTS kullanicilar (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        kullanici_adi VARCHAR(50) UNIQUE NOT NULL,
        sifre VARCHAR(255) NOT NULL,
        rol VARCHAR(20) NOT NULL,
        sehir VARCHAR(20) NOT NULL DEFAULT 'YOK',
        plaka VARCHAR(20) UNIQUE,
        olusturulma_tarihi TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('✓ kullanicilar tablosu hazır.');

    // Kullanıcıları seed et (şifreler: 123456)
    const standartSifreHash = await bcrypt.hash('123456', 10);

    const kullanicilar = [
      { kullanici_adi: 'admin', sifre: standartSifreHash, rol: 'YONETICI', sehir: 'YOK', plaka: null },
      { kullanici_adi: 'operator_ist', sifre: standartSifreHash, rol: 'OPERATOR', sehir: 'ISTANBUL', plaka: null },
      { kullanici_adi: 'operator_ank', sifre: standartSifreHash, rol: 'OPERATOR', sehir: 'ANKARA', plaka: null },
      { kullanici_adi: 'operator_izm', sifre: standartSifreHash, rol: 'OPERATOR', sehir: 'IZMIR', plaka: null },
      { kullanici_adi: 'kiosk_ist', sifre: standartSifreHash, rol: 'KIOSK', sehir: 'ISTANBUL', plaka: null },
      { kullanici_adi: 'kiosk_ank', sifre: standartSifreHash, rol: 'KIOSK', sehir: 'ANKARA', plaka: null },
      { kullanici_adi: 'kiosk_izm', sifre: standartSifreHash, rol: 'KIOSK', sehir: 'IZMIR', plaka: null },
      { kullanici_adi: 'tir_01', sifre: standartSifreHash, rol: 'SURUCU', sehir: 'ISTANBUL', plaka: '34IST01' },
      { kullanici_adi: 'tir_02', sifre: standartSifreHash, rol: 'SURUCU', sehir: 'ISTANBUL', plaka: '34IST02' },
    ];

    for (const k of kullanicilar) {
      await client.query(`
        INSERT INTO kullanicilar (kullanici_adi, sifre, rol, sehir, plaka)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (kullanici_adi) DO UPDATE SET
          sifre = EXCLUDED.sifre,
          rol = EXCLUDED.rol,
          sehir = EXCLUDED.sehir,
          plaka = EXCLUDED.plaka;
      `, [k.kullanici_adi, k.sifre, k.rol, k.sehir, k.plaka]);
    }

    console.log('✓ Test kullanıcıları başarıyla eklendi / güncellendi.');
    await client.end();
  } catch (err: any) {
    console.error('Hata:', err.message);
    process.exit(1);
  }
}

baslat();

