import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sorgu } from '../veritabani';

export const authRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'lojistik_os_super_gizli_anahtar_2026';

// /api/auth/login - Plaka veya Kullanıcı Adı ile hibrit giriş
authRouter.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { girisDegeri, sifre } = req.body;

    if (!girisDegeri || !sifre) {
      res.status(400).json({
        basarili: false,
        mesaj: 'Kullanıcı adı / Plaka ve şifre zorunludur.',
      });
      return;
    }

    const temizGiris = girisDegeri.toString().trim();

    // Kullanıcı adı veya Plakaya göre ara (büyük/küçük harf duyarsız)
    const sonuc = await sorgu(
      `SELECT * FROM kullanicilar 
       WHERE LOWER(kullanici_adi) = LOWER($1) 
          OR LOWER(REPLACE(plaka, ' ', '')) = LOWER(REPLACE($1, ' ', ''))
       LIMIT 1`,
      [temizGiris]
    );

    if (sonuc.rows.length === 0) {
      res.status(401).json({
        basarili: false,
        mesaj: 'Kullanıcı adı / Plaka veya şifre hatalı.',
      });
      return;
    }

    const kullanici = sonuc.rows[0];

    const sifreDogruMu = await bcrypt.compare(sifre, kullanici.sifre);
    if (!sifreDogruMu) {
      res.status(401).json({
        basarili: false,
        mesaj: 'Kullanıcı adı / Plaka veya şifre hatalı.',
      });
      return;
    }

    const token = jwt.sign(
      {
        id: kullanici.id,
        kullaniciAdi: kullanici.kullanici_adi,
        rol: kullanici.rol,
        sehir: kullanici.sehir,
        plaka: kullanici.plaka,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      basarili: true,
      mesaj: 'Giriş başarılı.',
      token,
      kullanici: {
        id: kullanici.id,
        kullaniciAdi: kullanici.kullanici_adi,
        rol: kullanici.rol,
        sehir: kullanici.sehir,
        plaka: kullanici.plaka,
      },
    });
  } catch (error: any) {
    console.error('Login Hatası:', error);
    res.status(500).json({
      basarili: false,
      mesaj: 'Sunucu hatası: Giriş yapılamadı.',
    });
  }
});

// /api/auth/kayit - Tır Sürücüsü Kaydı
authRouter.post('/kayit', async (req: Request, res: Response): Promise<void> => {
  try {
    const { plaka, kullaniciAdi, sifre, sehir } = req.body;

    if (!plaka || !sifre) {
      res.status(400).json({
        basarili: false,
        mesaj: 'Plaka ve şifre alanları zorunludur.',
      });
      return;
    }

    // Plaka temizleme ve formatlama (Örn: "34 IST 99" -> "34IST99" veya büyük harf)
    const temizPlaka = plaka.toString().trim().toUpperCase();
    const temizKullaniciAdi = (kullaniciAdi && kullaniciAdi.trim()) 
      ? kullaniciAdi.trim().toLowerCase() 
      : temizPlaka.replace(/\s+/g, '').toLowerCase();

    if (sifre.length < 6) {
      res.status(400).json({
        basarili: false,
        mesaj: 'Şifre en az 6 karakter olmalıdır.',
      });
      return;
    }

    const gecerliSehirler = ['ISTANBUL', 'ANKARA', 'IZMIR'];
    const secilenSehir = gecerliSehirler.includes(sehir) ? sehir : 'ISTANBUL';

    // Mükerrer plaka veya kullanıcı adı kontrolü
    const mevcutKullanici = await sorgu(
      `SELECT id, plaka, kullanici_adi FROM kullanicilar 
       WHERE LOWER(REPLACE(plaka, ' ', '')) = LOWER(REPLACE($1, ' ', ''))
          OR LOWER(kullanici_adi) = LOWER($2)
       LIMIT 1`,
      [temizPlaka, temizKullaniciAdi]
    );

    if (mevcutKullanici.rows.length > 0) {
      const kayitli = mevcutKullanici.rows[0];
      const sebep = kayitli.kullanici_adi === temizKullaniciAdi 
        ? 'Bu kullanıcı adı zaten kullanımda.' 
        : 'Bu plaka ile daha önce kayıt yapılmış.';

      res.status(409).json({
        basarili: false,
        mesaj: sebep,
      });
      return;
    }

    // Şifreyi hashle
    const sifreHash = await bcrypt.hash(sifre, 10);

    // Veritabanına yeni Tır sürücüsü ekle
    const yeniKullaniciRes = await sorgu(
      `INSERT INTO kullanicilar (kullanici_adi, sifre, rol, sehir, plaka)
       VALUES ($1, $2, 'SURUCU', $3, $4)
       RETURNING id, kullanici_adi, rol, sehir, plaka, olusturulma_tarihi`,
      [temizKullaniciAdi, sifreHash, secilenSehir, temizPlaka]
    );

    const yeniKullanici = yeniKullaniciRes.rows[0];

    // Oturum Token'ı üret
    const token = jwt.sign(
      {
        id: yeniKullanici.id,
        kullaniciAdi: yeniKullanici.kullanici_adi,
        rol: yeniKullanici.rol,
        sehir: yeniKullanici.sehir,
        plaka: yeniKullanici.plaka,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      basarili: true,
      mesaj: 'Tır kaydı başarıyla oluşturuldu.',
      token,
      kullanici: {
        id: yeniKullanici.id,
        kullaniciAdi: yeniKullanici.kullanici_adi,
        rol: yeniKullanici.rol,
        sehir: yeniKullanici.sehir,
        plaka: yeniKullanici.plaka,
      },
    });
  } catch (error: any) {
    console.error('Kayıt Hatası:', error);
    res.status(500).json({
      basarili: false,
      mesaj: 'Sunucu hatası: Kayıt işlemi gerçekleştirilemedi.',
    });
  }
});
