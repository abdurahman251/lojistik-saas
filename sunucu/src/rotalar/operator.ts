import { Router, Request, Response } from 'express';
import { sorgu } from '../veritabani';

export const operatorRouter = Router();

// GET /api/operator/durum?sehir=ISTANBUL
operatorRouter.get('/durum', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sehir } = req.query;

    if (!sehir) {
      res.status(400).json({ basarili: false, mesaj: 'Operatör şehri belirtilmelidir.' });
      return;
    }

    const temizSehir = sehir.toString().trim().toUpperCase();

    // 1. Bu şehre ait 8 Rampa ve atanmış tır bilgileri
    const rampalarRes = await sorgu(
      `SELECT r.id, r.ad, r.numara, r.sehir, r.durum, r.su_anki_randevu_id, 
              r.operasyon_tipi, r.islem_baslangic,
              rnd.plaka, rnd.sofor_ad_soyad, rnd.sofor_telefon, rnd.kalkis_sehri, rnd.varis_sehri
       FROM rampalar r
       LEFT JOIN randevular rnd ON r.su_anki_randevu_id = rnd.id
       WHERE r.sehir = $1
       ORDER BY r.numara ASC`,
      [temizSehir]
    );

    // 2. Sahada Bekleyen Tırlar (Kiosk onayı almış, rampa ataması bekleyen araçlar)
    const sahadaRes = await sorgu(
      `SELECT id, tir_id, plaka, kalkis_sehri, varis_sehri, 
              randevu_tarihi, randevu_saati, sofor_ad_soyad, sofor_telefon, 
              durum, kiosk_giris_saati, is_gecikme
       FROM randevular 
       WHERE (varis_sehri = $1 OR kalkis_sehri = $1)
         AND durum = 'SAHADA'
       ORDER BY kiosk_giris_saati ASC NULLS LAST, olusturulma_tarihi ASC`,
      [temizSehir]
    );

    // 3. Yoldaki Araçlar (Diğer şehirlerden bu şehre doğru seyahat eden kargolar)
    const yoldaRes = await sorgu(
      `SELECT id, tir_id, plaka, kalkis_sehri, varis_sehri, 
              randevu_tarihi, randevu_saati, sofor_ad_soyad, sofor_telefon, 
              durum, cikis_zamani, is_gecikme
       FROM randevular 
       WHERE varis_sehri = $1 
         AND durum = 'YOLDA'
       ORDER BY cikis_zamani ASC NULLS LAST`,
      [temizSehir]
    );

    const doluRampaSayisi = rampalarRes.rows.filter((r) => r.durum === 'DOLU').length;
    const musaitRampaSayisi = 8 - doluRampaSayisi;
    const dolulukYuzdesi = Math.round((doluRampaSayisi / 8) * 100);

    res.json({
      basarili: true,
      sehir: temizSehir,
      istatistikler: {
        sahadaSayisi: sahadaRes.rows.length,
        doluRampaSayisi,
        musaitRampaSayisi,
        yoldaSayisi: yoldaRes.rows.length,
        dolulukYuzdesi,
      },
      rampalar: rampalarRes.rows,
      sahadakiTirlar: sahadaRes.rows,
      yoldakiTirlar: yoldaRes.rows,
    });
  } catch (error: any) {
    console.error('Operatör Durum Sorgu Hatası:', error);
    res.status(500).json({ basarili: false, mesaj: 'Operatör saha durumu sorgulanamadı.' });
  }
});

// POST /api/operator/rampa-ata
// Body: { rampaId, randevuId, operasyonTipi }
operatorRouter.post('/rampa-ata', async (req: Request, res: Response): Promise<void> => {
  try {
    const { rampaId, randevuId, operasyonTipi } = req.body;

    if (!rampaId || !randevuId) {
      res.status(400).json({ basarili: false, mesaj: 'rampaId ve randevuId zorunludur.' });
      return;
    }

    // Rampanın müsait olup olmadığını kontrol et
    const rampaKontrol = await sorgu('SELECT * FROM rampalar WHERE id = $1', [rampaId]);
    if (rampaKontrol.rows.length === 0) {
      res.status(404).json({ basarili: false, mesaj: 'Rampa bulunamadı.' });
      return;
    }
    if (rampaKontrol.rows[0].durum === 'DOLU') {
      res.status(400).json({ basarili: false, mesaj: 'Seçilen rampa şu anda doludur!' });
      return;
    }

    // Randevuyu kontrol et
    const randevuKontrol = await sorgu('SELECT * FROM randevular WHERE id = $1', [randevuId]);
    if (randevuKontrol.rows.length === 0) {
      res.status(404).json({ basarili: false, mesaj: 'Randevu bulunamadı.' });
      return;
    }

    const randevu = randevuKontrol.rows[0];
    const rampa = rampaKontrol.rows[0];

    // Operasyon tipini belirle:
    // Eğer araç varış terminalindeyse varsayılan YUK_BOSALTMA, kalkış terminalindeyse YUKLEME
    const tip = operasyonTipi || (randevu.varis_sehri === rampa.sehir ? 'YUK_BOSALTMA' : 'YUKLEME');

    // 1. Rampayı güncelle
    await sorgu(
      `UPDATE rampalar 
       SET durum = 'DOLU', 
           su_anki_randevu_id = $1, 
           operasyon_tipi = $2, 
           islem_baslangic = NOW()
       WHERE id = $3`,
      [randevuId, tip, rampaId]
    );

    // 2. Randevu durumunu OPERASYONDA yap
    await sorgu(
      `UPDATE randevular 
       SET durum = 'OPERASYONDA' 
       WHERE id = $1`,
      [randevuId]
    );

    res.json({
      basarili: true,
      mesaj: `${randevu.plaka} aracı ${rampa.ad} istasyonuna başarıyla atandı (${tip === 'YUK_BOSALTMA' ? 'Yük Boşaltma' : 'Yükleme'}).`,
    });
  } catch (error: any) {
    console.error('Rampa Atama Hatası:', error);
    res.status(500).json({ basarili: false, mesaj: 'Rampa atama işlemi gerçekleştirilemedi.' });
  }
});

// POST /api/operator/operasyon-tamamla
// Body: { rampaId }
operatorRouter.post('/operasyon-tamamla', async (req: Request, res: Response): Promise<void> => {
  try {
    const { rampaId } = req.body;

    if (!rampaId) {
      res.status(400).json({ basarili: false, mesaj: 'rampaId zorunludur.' });
      return;
    }

    const rampaRes = await sorgu('SELECT * FROM rampalar WHERE id = $1', [rampaId]);
    if (rampaRes.rows.length === 0) {
      res.status(404).json({ basarili: false, mesaj: 'Rampa bulunamadı.' });
      return;
    }

    const rampa = rampaRes.rows[0];
    const randevuId = rampa.su_anki_randevu_id;

    if (!randevuId) {
      res.status(400).json({ basarili: false, mesaj: 'Bu rampada aktif bir işlem bulunmuyor.' });
      return;
    }

    const randevuRes = await sorgu('SELECT * FROM randevular WHERE id = $1', [randevuId]);
    const randevu = randevuRes.rows[0];

    // Rampayı boşalt
    await sorgu(
      `UPDATE rampalar 
       SET durum = 'BOS', 
           su_anki_randevu_id = NULL, 
           operasyon_tipi = NULL, 
           islem_baslangic = NULL
       WHERE id = $1`,
      [rampaId]
    );

    // Eğer işlem yük boşaltma ise (veya varış noktasındaysa), sefer tamamen tamamlanır!
    if (rampa.operasyon_tipi === 'YUK_BOSALTMA' || (randevu && randevu.varis_sehri === rampa.sehir)) {
      // Randevuyu TAMAMLANDI yap
      await sorgu(
        `UPDATE randevular 
         SET durum = 'TAMAMLANDI', 
             islem_bitis_zamani = NOW()
         WHERE id = $1`,
        [randevuId]
      );

      // Tırın mevcut konumunu (sehir) bu şehir olarak güncelle (artık bu şehirden yeni randevu alabilir)
      if (randevu && randevu.plaka) {
        await sorgu(
          `UPDATE kullanicilar 
           SET sehir = $1 
           WHERE LOWER(REPLACE(plaka, ' ', '')) = LOWER(REPLACE($2, ' ', ''))`,
          [rampa.sehir, randevu.plaka]
        );
      }

      res.json({
        basarili: true,
        mesaj: `Operasyon tamamlandı! Yük başarıyla boşaltıldı ve araç (${randevu?.plaka}) ${rampa.sehir} merkezinde yeni görevlere hazır hale getirildi.`,
      });
      return;
    }

    // Eğer işlem yükleme ise, araç sevk edilir ve YOLDA olur!
    await sorgu(
      `UPDATE randevular 
       SET durum = 'YOLDA', 
           cikis_zamani = NOW()
       WHERE id = $1`,
      [randevuId]
    );

    res.json({
      basarili: true,
      mesaj: `Yükleme tamamlandı! ${randevu?.plaka} aracı ${randevu?.varis_sehri} istikametine yola çıkarıldı.`,
    });
  } catch (error: any) {
    console.error('Operasyon Tamamlama Hatası:', error);
    res.status(500).json({ basarili: false, mesaj: 'Operasyon tamamlanamadı.' });
  }
});

