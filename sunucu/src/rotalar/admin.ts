import { Router, Response } from 'express';
import { sorgu } from '../veritabani';
import { kimlikDogrula, rolKontrol, YetkiliRequest } from '../middleware/auth';

export const adminRouter = Router();

// Tüm yönetici rotalarını koru: Sadece YONETICI erişebilir
adminRouter.use(kimlikDogrula);
adminRouter.use(rolKontrol('YONETICI'));

/**
 * GET /api/admin/suruculer
 * Sürücüleri ve onay durumlarını listeler
 */
adminRouter.get('/suruculer', async (req: YetkiliRequest, res: Response): Promise<void> => {
  try {
    const [bekleyenRes, onayliRes, redRes] = await Promise.all([
      sorgu(
        `SELECT id, kullanici_adi, plaka, sehir, rol, onay_durumu, olusturulma_tarihi 
         FROM kullanicilar 
         WHERE rol = 'SURUCU' AND onay_durumu = 'BEKLEMEDE' 
         ORDER BY olusturulma_tarihi DESC`
      ),
      sorgu(
        `SELECT id, kullanici_adi, plaka, sehir, rol, onay_durumu, olusturulma_tarihi 
         FROM kullanicilar 
         WHERE rol = 'SURUCU' AND onay_durumu = 'ONAYLANDI' 
         ORDER BY olusturulma_tarihi DESC 
         LIMIT 50`
      ),
      sorgu(
        `SELECT id, kullanici_adi, plaka, sehir, rol, onay_durumu, olusturulma_tarihi 
         FROM kullanicilar 
         WHERE rol = 'SURUCU' AND onay_durumu = 'REDDEDILDI' 
         ORDER BY olusturulma_tarihi DESC 
         LIMIT 20`
      ),
    ]);

    res.json({
      basarili: true,
      istatistik: {
        bekleyenSayisi: bekleyenRes.rows.length,
        onayliSayisi: onayliRes.rows.length,
        redSayisi: redRes.rows.length,
      },
      bekleyenler: bekleyenRes.rows,
      onaylananlar: onayliRes.rows,
      reddedilenler: redRes.rows,
    });
  } catch (error: any) {
    console.error('Yönetici Sürücü Listesi Hatası:', error);
    res.status(500).json({ basarili: false, mesaj: 'Sürücü listesi alınamadı.' });
  }
});

/**
 * POST /api/admin/surucu-onayla/:id
 * Sürücü başvurusunu onaylar
 */
adminRouter.post('/surucu-onayla/:id', async (req: YetkiliRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const sonuc = await sorgu(
      `UPDATE kullanicilar 
       SET onay_durumu = 'ONAYLANDI' 
       WHERE id = $1 AND rol = 'SURUCU' 
       RETURNING id, kullanici_adi, plaka, onay_durumu`,
      [id]
    );

    if (sonuc.rows.length === 0) {
      res.status(404).json({ basarili: false, mesaj: 'Onaylanacak sürücü bulunamadı.' });
      return;
    }

    res.json({
      basarili: true,
      mesaj: `${sonuc.rows[0].plaka || sonuc.rows[0].kullanici_adi} tırının kaydı başarıyla onaylandı. Artık sisteme giriş yapabilir.`,
      kullanici: sonuc.rows[0],
    });
  } catch (error: any) {
    console.error('Sürücü Onay Hatası:', error);
    res.status(500).json({ basarili: false, mesaj: 'Sürücü onaylanamadı.' });
  }
});

/**
 * POST /api/admin/surucu-reddet/:id
 * Sürücü başvurusunu reddeder
 */
adminRouter.post('/surucu-reddet/:id', async (req: YetkiliRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const sonuc = await sorgu(
      `UPDATE kullanicilar 
       SET onay_durumu = 'REDDEDILDI' 
       WHERE id = $1 AND rol = 'SURUCU' 
       RETURNING id, kullanici_adi, plaka, onay_durumu`,
      [id]
    );

    if (sonuc.rows.length === 0) {
      res.status(404).json({ basarili: false, mesaj: 'Reddedilecek sürücü bulunamadı.' });
      return;
    }

    res.json({
      basarili: true,
      mesaj: `${sonuc.rows[0].plaka || sonuc.rows[0].kullanici_adi} tırının başvurusu reddedildi.`,
      kullanici: sonuc.rows[0],
    });
  } catch (error: any) {
    console.error('Sürücü Red Hatası:', error);
    res.status(500).json({ basarili: false, mesaj: 'Sürücü reddedilemedi.' });
  }
});

/**
 * DELETE /api/admin/surucu-sil/:id
 * Sürücüyü sistemden tamamen siler
 */
adminRouter.delete('/surucu-sil/:id', async (req: YetkiliRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const sonuc = await sorgu(
      `DELETE FROM kullanicilar 
       WHERE id = $1 AND rol = 'SURUCU' 
       RETURNING id, kullanici_adi, plaka`,
      [id]
    );

    if (sonuc.rows.length === 0) {
      res.status(404).json({ basarili: false, mesaj: 'Silinecek sürücü bulunamadı.' });
      return;
    }

    res.json({
      basarili: true,
      mesaj: 'Sürücü kaydı sistemden silindi.',
    });
  } catch (error: any) {
    console.error('Sürücü Silme Hatası:', error);
    res.status(500).json({ basarili: false, mesaj: 'Sürücü silinemedi.' });
  }
});

