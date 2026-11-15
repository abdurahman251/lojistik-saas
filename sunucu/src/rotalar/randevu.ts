import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { sorgu } from '../veritabani';
import { kimlikDogrula } from '../middleware/auth';

export const randevuRouter = Router();

// Randevu işlemlerinde oturum doğrulaması zorunludur
randevuRouter.use(kimlikDogrula);

// Evrak yükleme için Multer yapılandırması
const yuklemeDizini = path.join(__dirname, '../../uploads/evraklar');
if (!fs.existsSync(yuklemeDizini)) {
  fs.mkdirSync(yuklemeDizini, { recursive: true });
}

const depolama = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, yuklemeDizini);
  },
  filename: (req, file, cb) => {
    const benzersizEk = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const uzanti = path.extname(file.originalname);
    cb(null, `evrak-${benzersizEk}${uzanti}`);
  },
});

const yukle = multer({
  storage: depolama,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
});

// GET /api/randevu/aktif - Sürücünün aktif randevusunu sorgula
randevuRouter.get('/aktif', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tirId, plaka } = req.query;

    if (!tirId && !plaka) {
      res.status(400).json({ basarili: false, mesaj: 'tirId veya plaka gereklidir.' });
      return;
    }

    const temizPlaka = plaka ? plaka.toString().trim() : '';

    const sonuc = await sorgu(
      `SELECT * FROM randevular 
       WHERE (tir_id = $1 OR LOWER(REPLACE(plaka, ' ', '')) = LOWER(REPLACE($2, ' ', '')))
         AND durum NOT IN ('TAMAMLANDI', 'IPTAL')
       ORDER BY olusturulma_tarihi DESC 
       LIMIT 1`,
      [tirId || null, temizPlaka]
    );

    if (sonuc.rows.length === 0) {
      res.json({ basarili: true, aktifRandevu: null });
      return;
    }

    res.json({
      basarili: true,
      aktifRandevu: sonuc.rows[0],
    });
  } catch (error: any) {
    console.error('Aktif Randevu Sorgu Hatası:', error);
    res.status(500).json({ basarili: false, mesaj: 'Aktif randevu sorgulanamadı.' });
  }
});

// POST /api/randevu/olustur - Yeni Randevu Al (Temiz, evraksız hızlı kayıt)
randevuRouter.post('/olustur', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      tirId,
      plaka,
      kalkisSehri,
      varisSehri,
      randevuTarihi,
      randevuSaati,
      soforAdSoyad,
      soforTelefon,
    } = req.body;

    if (!plaka || !kalkisSehri || !varisSehri || !randevuTarihi || !randevuSaati || !soforAdSoyad || !soforTelefon) {
      res.status(400).json({
        basarili: false,
        mesaj: 'Lütfen tüm zorunlu rota, tarih, saat ve sürücü alanlarını doldurun.',
      });
      return;
    }

    const temizPlaka = plaka.toString().trim().toUpperCase();

    // 1. Mükerrer Randevu Engeli: Aynı plakanın bitmemiş aktif randevusu var mı?
    const aktifKontrol = await sorgu(
      `SELECT id, durum FROM randevular 
       WHERE LOWER(REPLACE(plaka, ' ', '')) = LOWER(REPLACE($1, ' ', ''))
         AND durum NOT IN ('TAMAMLANDI', 'IPTAL')
       LIMIT 1`,
      [temizPlaka]
    );

    if (aktifKontrol.rows.length > 0) {
      res.status(400).json({
        basarili: false,
        mesaj: 'Bu araca ait henüz tamamlanmamış aktif bir randevu bulunmaktadır.',
      });
      return;
    }

    // 2. Rota ve Şehir Kilidi: Kalkış şehri ile varış şehri aynı olamaz
    if (kalkisSehri === varisSehri) {
      res.status(400).json({
        basarili: false,
        mesaj: 'Kalkış ve varış şehri aynı olamaz.',
      });
      return;
    }

    // 3. Benzersiz İnsansız Kapı QR Kodu Üret (Örn: QR-34IST01-8F3A2)
    const benzersizEk = Math.random().toString(36).substring(2, 7).toUpperCase();
    const qrKod = `QR-${temizPlaka.replace(/\s+/g, '')}-${benzersizEk}`;

    // 4. Veritabanına kaydet (İrsaliye sahada operatör tarafından doldurulup sürücü tarafından e-imzalanacak)
    const yeniRandevuRes = await sorgu(
      `INSERT INTO randevular (
        tir_id, plaka, kalkis_sehri, varis_sehri, 
        randevu_tarihi, randevu_saati, sofor_ad_soyad, 
        sofor_telefon, evrak_durumu, qr_kod, durum, irsaliye_durumu
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'GEREKLI_DEGIL', $9, 'BEKLEMEDE', 'YOK')
      RETURNING *`,
      [
        tirId || null,
        temizPlaka,
        kalkisSehri,
        varisSehri,
        randevuTarihi,
        randevuSaati,
        soforAdSoyad,
        soforTelefon,
        qrKod,
      ]
    );

    const yeniRandevu = yeniRandevuRes.rows[0];

    res.status(201).json({
      basarili: true,
      mesaj: 'Randevunuz başarıyla oluşturuldu. Kapıda QR kodunuzu okutarak içeri girebilirsiniz.',
      randevu: yeniRandevu,
    });
  } catch (error: any) {
    console.error('Randevu Oluşturma Hatası:', error);
    res.status(500).json({
      basarili: false,
      mesaj: 'Sunucu hatası: Randevu oluşturulamadı.',
    });
  }
});

// POST /api/randevu/irsaliye-imzala/:id - Sürücünün Resmi Sevk İrsaliyesini e-İmza ile Onaylaması
randevuRouter.post('/irsaliye-imzala/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { imza } = req.body;

    if (!imza) {
      res.status(400).json({ basarili: false, mesaj: 'Dijital imza verisi gereklidir.' });
      return;
    }

    // Randevuyu kontrol et
    const randevuRes = await sorgu('SELECT * FROM randevular WHERE id = $1', [id]);
    if (randevuRes.rows.length === 0) {
      res.status(404).json({ basarili: false, mesaj: 'Randevu bulunamadı.' });
      return;
    }

    const randevu = randevuRes.rows[0];

    // İmzayı veritabanına kaydet ve tırı YOLDA durumuna geçir
    const guncelRes = await sorgu(
      `UPDATE randevular 
       SET sofor_imzasi = $1, 
           irsaliye_durumu = 'IMZALANDI', 
           durum = 'YOLDA', 
           cikis_zamani = NOW(), 
           cagri_durumu = 'SEVK_EDILDI'
       WHERE id = $2
       RETURNING *`,
      [imza, id]
    );

    const guncelRandevu = guncelRes.rows[0];

    // Sürücüye bildirim oluştur
    await sorgu(
      `INSERT INTO bildirimler (
        randevu_id, tir_id, plaka, baslik, mesaj, tip, operasyon_tipi
      ) VALUES ($1, $2, $3, $4, $5, 'SEVK_EDILDI', 'YUKLEME')`,
      [
        id,
        randevu.tir_id,
        randevu.plaka,
        `✓ İrsaliye Onaylandı • ${randevu.varis_sehri} İstikametine Yoldasınız`,
        `Sayın ${randevu.sofor_ad_soyad}, ${randevu.irsaliye_no || 'Resmi'} numaralı sevk irsaliyeniz e-imzanız ile başarıyla onaylandı. ${randevu.varis_sehri} varış terminali Kiosk'unda bu irsaliyenin karekodunu okutunuz. İyi yolculuklar!`,
      ]
    );

    res.json({
      basarili: true,
      mesaj: 'Sevk irsaliyesi başarıyla imzalandı ve yola çıkışınız onaylandı.',
      randevu: guncelRandevu,
    });
  } catch (error: any) {
    console.error('İrsaliye İmza Hatası:', error);
    res.status(500).json({ basarili: false, mesaj: 'İrsaliye imzalama işlemi başarısız oldu.' });
  }
});

// POST /api/randevu/iptal/:id - Randevuyu İptal Et (Test kolaylığı için)
randevuRouter.post('/iptal/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await sorgu(`UPDATE randevular SET durum = 'IPTAL' WHERE id = $1`, [id]);
    res.json({ basarili: true, mesaj: 'Randevu iptal edildi.' });
  } catch (error: any) {
    res.status(500).json({ basarili: false, mesaj: 'Randevu iptal edilemedi.' });
  }
});

// GET /api/randevu/bildirimler - Sürücünün Çağrı ve Mesaj Bildirimleri
randevuRouter.get('/bildirimler', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tirId, plaka } = req.query;

    if (!tirId && !plaka) {
      res.status(400).json({ basarili: false, mesaj: 'tirId veya plaka gereklidir.' });
      return;
    }

    const temizPlaka = plaka ? plaka.toString().trim() : '';

    const sonuc = await sorgu(
      `SELECT * FROM bildirimler 
       WHERE (tir_id = $1 OR LOWER(REPLACE(plaka, ' ', '')) = LOWER(REPLACE($2, ' ', '')))
       ORDER BY olusturulma_tarihi DESC 
       LIMIT 30`,
      [tirId || null, temizPlaka]
    );

    const okunmamisSayisi = sonuc.rows.filter((b) => !b.okundu).length;

    res.json({
      basarili: true,
      bildirimler: sonuc.rows,
      okunmamisSayisi,
    });
  } catch (error: any) {
    console.error('Bildirim Sorgu Hatası:', error);
    res.status(500).json({ basarili: false, mesaj: 'Bildirimler alınamadı.' });
  }
});

// POST /api/randevu/bildirim-okundu/:id - Bildirimi Okundu Yap
randevuRouter.post('/bildirim-okundu/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await sorgu(`UPDATE bildirimler SET okundu = TRUE WHERE id = $1`, [id]);
    res.json({ basarili: true });
  } catch (err: any) {
    res.status(500).json({ basarili: false, mesaj: 'Bildirim güncellenemedi.' });
  }
});

// POST /api/randevu/rampa-yanas/:id - Sürücü "Rampaya Yanaşıyorum" Çağrı Teyidi
randevuRouter.post('/rampa-yanas/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const guncel = await sorgu(
      `UPDATE randevular SET cagri_durumu = 'YANASTI' WHERE id = $1 RETURNING *`,
      [id]
    );

    if (guncel.rows.length === 0) {
      res.status(404).json({ basarili: false, mesaj: 'Randevu bulunamadı.' });
      return;
    }

    res.json({
      basarili: true,
      mesaj: 'Rampaya yanaşma teyidiniz operatöre iletildi. İyi çalışmalar!',
      randevu: guncel.rows[0],
    });
  } catch (err: any) {
    console.error('Rampaya yanaşma hatası:', err);
    res.status(500).json({ basarili: false, mesaj: 'Rampaya yanaşma teyidi kaydedilemedi.' });
  }
});

