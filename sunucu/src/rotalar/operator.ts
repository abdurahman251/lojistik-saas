import { Router, Request, Response } from 'express';
import { sorgu } from '../veritabani';
import { kimlikDogrula, rolKontrol } from '../middleware/auth';

export const operatorRouter = Router();

// Güvenlik Kalkanı: Sadece OPERATOR ve YONETICI yetkisine sahip kullanıcılar erişebilir
operatorRouter.use(kimlikDogrula);
operatorRouter.use(rolKontrol('OPERATOR', 'YONETICI'));

// GET /api/operator/durum?sehir=ISTANBUL
operatorRouter.get('/durum', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sehir } = req.query;

    if (!sehir) {
      res.status(400).json({ basarili: false, mesaj: 'Operatör şehri belirtilmelidir.' });
      return;
    }

    const temizSehir = sehir.toString().trim().toUpperCase();

    // 1-4. Tüm verileri paralel olarak çek (Sıralı bekleyerek gecikme yaşanmasın)
    const [rampalarRes, sahadaRes, yoldaRes, ihlallerRes] = await Promise.all([
      // 1. Rampalar
      sorgu(
        `SELECT r.id, r.ad, r.numara, r.sehir, r.durum, r.su_anki_randevu_id, 
                r.operasyon_tipi, r.islem_baslangic,
                rnd.plaka, rnd.sofor_ad_soyad, rnd.sofor_telefon, rnd.kalkis_sehri, rnd.varis_sehri
         FROM rampalar r
         LEFT JOIN randevular rnd ON r.su_anki_randevu_id = rnd.id
         WHERE r.sehir = $1
         ORDER BY r.numara ASC`,
        [temizSehir]
      ),
      // 2. Sahada Bekleyen Tırlar
      sorgu(
        `SELECT id, tir_id, plaka, kalkis_sehri, varis_sehri, 
                randevu_tarihi, randevu_saati, sofor_ad_soyad, sofor_telefon, 
                durum, kiosk_giris_saati, is_gecikme
         FROM randevular 
         WHERE (varis_sehri = $1 OR kalkis_sehri = $1)
           AND durum = 'SAHADA'
         ORDER BY kiosk_giris_saati ASC NULLS LAST, olusturulma_tarihi ASC`,
        [temizSehir]
      ),
      // 3. Yoldaki Araçlar
      sorgu(
        `SELECT id, tir_id, plaka, kalkis_sehri, varis_sehri, 
                randevu_tarihi, randevu_saati, sofor_ad_soyad, sofor_telefon, 
                durum, cikis_zamani, is_gecikme
         FROM randevular 
         WHERE varis_sehri = $1 
           AND durum = 'YOLDA'
         ORDER BY cikis_zamani ASC NULLS LAST`,
        [temizSehir]
      ),
      // 4. İhlal Kayıtları
      sorgu(
        `SELECT * FROM ihlal_kayitlari 
         ORDER BY tarih DESC 
         LIMIT 15`
      )
    ]);

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
        ihlalSayisi: ihlallerRes.rows.length,
      },
      rampalar: rampalarRes.rows,
      sahadakiTirlar: sahadaRes.rows,
      yoldakiTirlar: yoldaRes.rows,
      ihlaller: ihlallerRes.rows,
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

    // 2. Randevu durumunu OPERASYONDA yap ve çağrı bilgilerini mühürle
    await sorgu(
      `UPDATE randevular 
       SET durum = 'OPERASYONDA',
           atanan_rampa_id = $2,
           atanan_rampa_adi = $3,
           rampa_cagri_zamani = NOW(),
           cagri_durumu = 'CAGRILDI'
       WHERE id = $1`,
      [randevuId, rampaId, rampa.ad]
    );

    // 3. Sürücüye Rampa Çağrı Bildirimi / Mesajı Gönder (Veritabanı Entegrasyonu)
    const cagriMesaj = `Sayın ${randevu.sofor_ad_soyad || 'Sürücü'}, ${randevu.plaka} aracınız ${rampa.sehir} terminalinde ${rampa.ad} peronuna atanmıştır. Lütfen en geç 15 dakika içinde perona yanaşınız! (İşlem Türü: ${tip === 'YUKLEME' ? 'Yükleme' : 'Yük Boşaltma'})`;

    await sorgu(
      `INSERT INTO bildirimler (
        randevu_id, tir_id, plaka, baslik, mesaj, tip, rampa_no, rampa_adi, operasyon_tipi
      ) VALUES ($1, $2, $3, $4, $5, 'RAMPA_CAGRISI', $6, $7, $8)`,
      [
        randevuId,
        randevu.tir_id,
        randevu.plaka,
        `🚨 RAMPA ÇAĞRISI: ${rampa.ad}`,
        cagriMesaj,
        rampa.numara ? rampa.numara.toString() : '1',
        rampa.ad,
        tip,
      ]
    );

    res.json({
      basarili: true,
      mesaj: `${randevu.plaka} aracı ${rampa.ad} istasyonuna başarıyla atandı (${tip === 'YUK_BOSALTMA' ? 'Yük Boşaltma' : 'Yükleme'}). Sürücüye rampa çağrı bildirimi iletildi.`,
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
             cagri_durumu = 'TAMAMLANDI',
             islem_bitis_zamani = NOW()
         WHERE id = $1`,
        [randevuId]
      );

      // Sürücüye tamamlanma bildirimi
      await sorgu(
        `INSERT INTO bildirimler (
          randevu_id, tir_id, plaka, baslik, mesaj, tip, rampa_adi, operasyon_tipi
        ) VALUES ($1, $2, $3, $4, $5, 'OPERASYON_TAMAMLANDI', $6, 'YUK_BOSALTMA')`,
        [
          randevuId,
          randevu?.tir_id,
          randevu?.plaka,
          '✓ Yük Boşaltma Tamamlandı',
          `Sayın ${randevu?.sofor_ad_soyad || 'Sürücü'}, ${randevu?.plaka} aracınızın ${rampa.ad} peronundaki boşaltma işlemi tamamlanmıştır. Terminalden çıkış yapabilirsiniz.`,
          rampa.ad
        ]
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

    // Eğer işlem yükleme ise, operatör resmi dijital sevk irsaliyesini oluşturur ve sürücü onayına sunar!
    const { yukCinsi, tonajKg, paletSayisi, muhurNo } = req.body;

    const rastgeleEk = Math.floor(1000 + Math.random() * 9000);
    const irsaliyeNo = `LOS-IRS-${new Date().getFullYear()}-${rastgeleEk}`;
    const netYukCinsi = yukCinsi || 'Endüstriyel Yedek Parça & Muhtelif Emtia';
    const netTonaj = tonajKg ? Number(tonajKg) : 21400;
    const netPalet = paletSayisi ? Number(paletSayisi) : 32;
    const netMuhur = muhurNo || `MHR-${Math.floor(10000 + Math.random() * 90000)}`;

    await sorgu(
      `UPDATE randevular 
       SET irsaliye_no = $1, 
           yuk_cinsi = $2, 
           tonaj_kg = $3, 
           palet_sayisi = $4, 
           muhur_no = $5, 
           irsaliye_tarihi = NOW(), 
           irsaliye_durumu = 'DUZENLENDI', 
           durum = 'YUKLENDI_IMZA_BEKLIYOR', 
           cagri_durumu = 'IMZA_BEKLENIYOR'
       WHERE id = $6`,
      [irsaliyeNo, netYukCinsi, netTonaj, netPalet, netMuhur, randevuId]
    );

    // Sürücüye irsaliye imzalama çağrı bildirimi gönder
    await sorgu(
      `INSERT INTO bildirimler (
        randevu_id, tir_id, plaka, baslik, mesaj, tip, rampa_adi, operasyon_tipi
      ) VALUES ($1, $2, $3, $4, $5, 'IRSALIYE_HAZIR', $6, 'YUKLEME')`,
      [
        randevuId,
        randevu?.tir_id,
        randevu?.plaka,
        `📋 Sevk İrsaliyeniz Hazır (${irsaliyeNo})`,
        `Sayın ${randevu?.sofor_ad_soyad || 'Sürücü'}, ${randevu?.plaka} aracınızın ${rampa.ad} peronundaki yüklemesi tamamlanmıştır. Net: ${netTonaj} kg (${netYukCinsi}). Lütfen cep telefonunuzdan e-imzanız ile onaylayarak ${randevu?.varis_sehri} istikametine yola çıkınız.`,
        rampa.ad
      ]
    );

    res.json({
      basarili: true,
      mesaj: `Yükleme tamamlandı ve Resmi Sevk İrsaliyesi (${irsaliyeNo}) oluşturuldu. Sürücü e-imza onayına iletildi.`,
      irsaliyeNo,
    });
  } catch (error: any) {
    console.error('Operasyon Tamamlama Hatası:', error);
    res.status(500).json({ basarili: false, mesaj: 'Operasyon tamamlanamadı.' });
  }
});

