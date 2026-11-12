import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { sorgu } from '../veritabani';

export const randevuRouter = Router();

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

// POST /api/randevu/olustur - Yeni Randevu Al
randevuRouter.post('/olustur', yukle.single('evrak'), async (req: Request, res: Response): Promise<void> => {
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

    // 3. Dosya yolu kontrolü
    const evrakYolu = req.file ? `/uploads/evraklar/${req.file.filename}` : (req.body.evrakYolu || null);

    // 4. Veritabanına kaydet
    const yeniRandevuRes = await sorgu(
      `INSERT INTO randevular (
        tir_id, plaka, kalkis_sehri, varis_sehri, 
        randevu_tarihi, randevu_saati, sofor_ad_soyad, 
        sofor_telefon, evrak_yolu, durum
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'BEKLEMEDE')
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
        evrakYolu,
      ]
    );

    const yeniRandevu = yeniRandevuRes.rows[0];

    res.status(201).json({
      basarili: true,
      mesaj: 'Randevunuz başarıyla oluşturuldu.',
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

