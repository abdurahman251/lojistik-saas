import { Router, Request, Response } from 'express';
import { sorgu } from '../veritabani';

export const kioskRouter = Router();

// GET /api/kiosk/arac-listesi?sehir=ISTANBUL
// Hem kalkış yapacakları hem de yolda yaklaşanları ayrı ayrı döner
kioskRouter.get('/arac-listesi', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sehir } = req.query;

    if (!sehir) {
      res.status(400).json({ basarili: false, mesaj: 'Kiosk şehri belirtilmelidir.' });
      return;
    }

    const temizSehir = sehir.toString().trim().toUpperCase();

    // 1. Kalkış Yapacak Araçlar: Tır bu şehirde, henüz kalkış onayı almamış (BEKLEMEDE)
    const kalkisRes = await sorgu(
      `SELECT id, tir_id, plaka, kalkis_sehri, varis_sehri, 
              randevu_tarihi, randevu_saati, sofor_ad_soyad, sofor_telefon, 
              durum, is_gecikme, gecikme_suresi
       FROM randevular 
       WHERE kalkis_sehri = $1 
         AND durum = 'BEKLEMEDE'
       ORDER BY olusturulma_tarihi ASC`,
      [temizSehir]
    );

    // 2. Yaklaşan Araçlar: Başka şehirden kalkışı onaylanmış, bu şehre gelmekte olan (YOLDA)
    const yaklasanRes = await sorgu(
      `SELECT id, tir_id, plaka, kalkis_sehri, varis_sehri, 
              randevu_tarihi, randevu_saati, sofor_ad_soyad, sofor_telefon, 
              durum, is_gecikme, gecikme_suresi
       FROM randevular 
       WHERE varis_sehri = $1 
         AND durum = 'YOLDA'
       ORDER BY cikis_zamani ASC NULLS LAST, olusturulma_tarihi ASC`,
      [temizSehir]
    );

    res.json({
      basarili: true,
      kalkisYapacaklar: kalkisRes.rows,
      yaklasanAraclar: yaklasanRes.rows,
      toplamBekleyen: kalkisRes.rows.length + yaklasanRes.rows.length,
    });
  } catch (error: any) {
    console.error('Kiosk Araç Listesi Hatası:', error);
    res.status(500).json({ basarili: false, mesaj: 'Kiosk araç listesi alınamadı.' });
  }
});

// Eski endpoint uyumluluğu için
kioskRouter.get('/yaklasan-araclar', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sehir } = req.query;
    if (!sehir) {
      res.status(400).json({ basarili: false, mesaj: 'Kiosk şehri belirtilmelidir.' });
      return;
    }
    const temizSehir = sehir.toString().trim().toUpperCase();

    const kalkisRes = await sorgu(
      `SELECT * FROM randevular WHERE kalkis_sehri = $1 AND durum = 'BEKLEMEDE'`,
      [temizSehir]
    );
    const yaklasanRes = await sorgu(
      `SELECT * FROM randevular WHERE varis_sehri = $1 AND durum = 'YOLDA'`,
      [temizSehir]
    );

    res.json({
      basarili: true,
      kalkisYapacaklar: kalkisRes.rows,
      yaklasanAraclar: yaklasanRes.rows,
      araclar: [...kalkisRes.rows, ...yaklasanRes.rows],
      toplamBekleyen: kalkisRes.rows.length + yaklasanRes.rows.length,
    });
  } catch (error: any) {
    res.status(500).json({ basarili: false, mesaj: 'Hata oluştu.' });
  }
});

// POST /api/kiosk/giris-kontrol
// Body: { plaka, kioskSehir }
kioskRouter.post('/giris-kontrol', async (req: Request, res: Response): Promise<void> => {
  try {
    const { plaka, kioskSehir } = req.body;

    if (!plaka || !kioskSehir) {
      res.status(400).json({
        basarili: false,
        durumTipi: 'HATA',
        mesaj: 'Plaka ve Kiosk şehri zorunludur.',
      });
      return;
    }

    const temizPlaka = plaka.toString().trim().toUpperCase();
    const temizKioskSehir = kioskSehir.toString().trim().toUpperCase();

    // 1. Plakaya ait açık randevuyu bul (BEKLEMEDE veya YOLDA)
    const randevuRes = await sorgu(
      `SELECT * FROM randevular 
       WHERE LOWER(REPLACE(plaka, ' ', '')) = LOWER(REPLACE($1, ' ', ''))
         AND durum IN ('BEKLEMEDE', 'YOLDA')
       ORDER BY olusturulma_tarihi DESC 
       LIMIT 1`,
      [temizPlaka]
    );

    if (randevuRes.rows.length === 0) {
      res.status(404).json({
        basarili: false,
        durumTipi: 'HATA',
        mesaj: `Bu plaka adına (${temizPlaka}) aktif bir randevu bulunamadı!`,
      });
      return;
    }

    const randevu = randevuRes.rows[0];

    // 2. KONTROL 1: Tır Kalkış Yapacak Şehirde mi? (Kalkış Onayı)
    if (randevu.kalkis_sehri === temizKioskSehir && randevu.durum === 'BEKLEMEDE') {
      // Randevu zamanı tolerans kontrolü (30 dakika)
      const simdikiZaman = new Date();
      let isGecikme = false;
      let gecikmeDakika = 0;

      try {
        const [saatStr, dakikaStr] = (randevu.randevu_saati || '00:00').split(':');
        const randevuZamani = new Date(randevu.randevu_tarihi);
        randevuZamani.setHours(parseInt(saatStr, 10), parseInt(dakikaStr, 10), 0, 0);

        const farkMilisaniye = simdikiZaman.getTime() - randevuZamani.getTime();
        const farkDakika = Math.floor(farkMilisaniye / (1000 * 60));

        if (farkDakika > 30) {
          isGecikme = true;
          gecikmeDakika = farkDakika;

          await sorgu(
            `INSERT INTO ihlal_kayitlari (randevu_id, plaka, ihlal_tipi, aciklama)
             VALUES ($1, $2, 'Kalkış Gecikme İhlali', $3)`,
            [randevu.id, temizPlaka, `Randevu saatinden ${gecikmeDakika} dakika sonra kalkış kapısına geldi.`]
          );
        }
      } catch (e) {
        console.warn('Saat kontrolü atlandı:', e);
      }

      // Tır kalkış onayını aldı -> Durum YOLDA olur!
      // cikis_zamani kaydedilir -> Artık hedef şehir Kiosk'unda "YAKLAŞAN ARAÇLAR" listesine düşer!
      const guncelRandevuRes = await sorgu(
        `UPDATE randevular 
         SET durum = 'YOLDA', 
             cikis_zamani = NOW(),
             is_gecikme = $1,
             gecikme_suresi = $2
         WHERE id = $3
         RETURNING *`,
        [isGecikme, gecikmeDakika, randevu.id]
      );

      const guncelRandevu = guncelRandevuRes.rows[0];

      if (isGecikme) {
        res.json({
          basarili: true,
          durumTipi: 'GECIKMELI',
          asama: 'KALKIS',
          mesaj: `Kalkış yapıldı fakat 30 dakikalık tolerans süresini aştığınız için 'Gecikme İhlali' (${gecikmeDakika} dk) mühürlendi. Araç yola çıktı. ${randevu.varis_sehri} Kiosk ekranına iletildi.`,
          randevu: guncelRandevu,
          gecikmeDakika,
        });
      } else {
        res.json({
          basarili: true,
          durumTipi: 'VAKTINDE',
          asama: 'KALKIS',
          mesaj: `Kalkış onaylandı! Araç yola çıktı. Hedef terminal (${randevu.varis_sehri}) Kiosk ekranına 'Yaklaşan Araç' olarak iletildi.`,
          randevu: guncelRandevu,
        });
      }
      return;
    }

    // 3. KONTROL 2: Tır Varış Yapacağı Şehirde mi? (Varış / Saha Giriş Onayı)
    if (randevu.varis_sehri === temizKioskSehir) {
      // Araç kalkış yapmadan varış yerine gelemez!
      if (randevu.durum === 'BEKLEMEDE') {
        res.status(400).json({
          basarili: false,
          durumTipi: 'HATA',
          mesaj: `Usulsüz Giriş: Bu araç henüz kalkış terminalinden (${randevu.kalkis_sehri}) onay alıp yola çıkmadı! Önce ${randevu.kalkis_sehri} Kiosk kapısından geçmelidir.`,
        });
        return;
      }

      // Tır yolda ve hedef şehir Kiosk'una vardı -> Durum SAHADA olur!
      const guncelRandevuRes = await sorgu(
        `UPDATE randevular 
         SET durum = 'SAHADA', 
             kiosk_giris_saati = NOW()
         WHERE id = $1
         RETURNING *`,
        [randevu.id]
      );

      res.json({
        basarili: true,
        durumTipi: 'VAKTINDE',
        asama: 'VARIS',
        mesaj: `Varış onaylandı! ${temizKioskSehir} liman sahasına giriş yapıldı. Lütfen operatörün rampa atamasını bekleyin.`,
        randevu: guncelRandevuRes.rows[0],
      });
      return;
    }

    // 4. KONTROL 3: Rota Dışı Şehir Girişi
    await sorgu(
      `INSERT INTO ihlal_kayitlari (randevu_id, plaka, ihlal_tipi, aciklama)
       VALUES ($1, $2, 'Yanlış Şehir Girişi', $3)`,
      [randevu.id, temizPlaka, `Araç rotası (${randevu.kalkis_sehri} -> ${randevu.varis_sehri}) dışında ${temizKioskSehir} terminaline geldi.`]
    );

    res.status(400).json({
      basarili: false,
      durumTipi: 'HATA',
      mesaj: `Yanlış Şehir! Bu aracın rotası (${randevu.kalkis_sehri} -> ${randevu.varis_sehri}) şeklindedir. ${temizKioskSehir} Kiosk yetkisi yoktur.`,
    });
  } catch (error: any) {
    console.error('Kiosk Giriş Kontrol Hatası:', error);
    res.status(500).json({
      basarili: false,
      durumTipi: 'HATA',
      mesaj: 'Sunucu hatası: Kiosk doğrulaması yapılamadı.',
    });
  }
});
