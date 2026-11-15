import { Router, Request, Response } from 'express';
import { sorgu } from '../veritabani';
import { kimlikDogrula, rolKontrol } from '../middleware/auth';

export const kioskRouter = Router();

// Güvenlik Kalkanı: Sadece KIOSK, OPERATOR ve YONETICI yetkisine sahip kullanıcılar erişebilir
kioskRouter.use(kimlikDogrula);
kioskRouter.use(rolKontrol('KIOSK', 'OPERATOR', 'YONETICI'));

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

    // 1 & 2. Kalkış ve Yaklaşan araçları sevk irsaliyesi ve QR detaylarıyla paralel olarak çek
    const [kalkisRes, yaklasanRes] = await Promise.all([
      sorgu(
        `SELECT id, tir_id, plaka, kalkis_sehri, varis_sehri, 
                randevu_tarihi, randevu_saati, sofor_ad_soyad, sofor_telefon, 
                durum, is_gecikme, gecikme_suresi, evrak_yolu, evrak_adi, evrak_durumu, qr_kod, giris_turu,
                irsaliye_no, yuk_cinsi, tonaj_kg, palet_sayisi, muhur_no, sofor_imzasi, irsaliye_durumu, irsaliye_tarihi
         FROM randevular 
         WHERE kalkis_sehri = $1 
           AND durum = 'BEKLEMEDE'
         ORDER BY olusturulma_tarihi ASC`,
        [temizSehir]
      ),
      sorgu(
        `SELECT id, tir_id, plaka, kalkis_sehri, varis_sehri, 
                randevu_tarihi, randevu_saati, sofor_ad_soyad, sofor_telefon, 
                durum, is_gecikme, gecikme_suresi, evrak_yolu, evrak_adi, evrak_durumu, qr_kod, giris_turu,
                irsaliye_no, yuk_cinsi, tonaj_kg, palet_sayisi, muhur_no, sofor_imzasi, irsaliye_durumu, irsaliye_tarihi
         FROM randevular 
         WHERE varis_sehri = $1 
           AND durum = 'YOLDA'
         ORDER BY cikis_zamani ASC NULLS LAST, olusturulma_tarihi ASC`,
        [temizSehir]
      )
    ]);

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

    // 1. Plakaya ait açık randevuyu bul
    const randevuRes = await sorgu(
      `SELECT * FROM randevular 
       WHERE LOWER(REPLACE(plaka, ' ', '')) = LOWER(REPLACE($1, ' ', ''))
         AND durum IN ('BEKLEMEDE', 'SAHADA', 'OPERASYONDA', 'YOLDA')
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

    // Zaten sahada veya rampada kontrolü
    if (randevu.durum === 'SAHADA') {
      res.json({
        basarili: true,
        durumTipi: 'VAKTINDE',
        asama: randevu.kalkis_sehri === temizKioskSehir ? 'KALKIS' : 'VARIS',
        mesaj: `Bu araç (${temizPlaka}) zaten ${temizKioskSehir} sahasına giriş yapmıştır. Operatörün rampa ataması beklenmektedir.`,
        randevu,
      });
      return;
    }

    if (randevu.durum === 'OPERASYONDA') {
      res.json({
        basarili: true,
        durumTipi: 'VAKTINDE',
        asama: randevu.kalkis_sehri === temizKioskSehir ? 'KALKIS' : 'VARIS',
        mesaj: `Bu araç (${temizPlaka}) şu anda peron/rampa operasyonundadır.`,
        randevu,
      });
      return;
    }

    // 2. KONTROL 1: Tır Kalkış Yapacak Şehirde mi? (Yükleme İçin Saha Girişi)
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

      // Tır kalkış terminalinde sahaya kabul edilir -> Durum SAHADA olur!
      // Operatör "Yüklenecek" olarak görür, rampaya atar ve yükleme bittikten sonra YOLDA yapar.
      const guncelRandevuRes = await sorgu(
        `UPDATE randevular 
         SET durum = 'SAHADA', 
             kiosk_giris_saati = NOW(),
             is_gecikme = $1,
             gecikme_suresi = $2,
             giris_turu = COALESCE(giris_turu, 'NORMAL')
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
          mesaj: `Giriş yapıldı fakat 30 dakikalık tolerans süresini aştığınız için 'Gecikme İhlali' (${gecikmeDakika} dk) kaydedildi. Yükleme için ${temizKioskSehir} sahasına kabul edildi. Operatör yükleme rampası atayacaktır.`,
          randevu: guncelRandevu,
          gecikmeDakika,
        });
      } else {
        res.json({
          basarili: true,
          durumTipi: 'VAKTINDE',
          asama: 'KALKIS',
          mesaj: `Saha girişi onaylandı! ${temizPlaka} aracı yükleme için ${temizKioskSehir} sahasına kabul edildi. Lütfen operatörün yükleme rampası atamasını bekleyin.`,
          randevu: guncelRandevu,
        });
      }
      return;
    }

    // KONTROL 1.B: Kalkış Şehrinde Yükleme Tamamlanmış ve Araç Çıkış Yapıyor
    if (randevu.kalkis_sehri === temizKioskSehir && randevu.durum === 'YOLDA') {
      res.json({
        basarili: true,
        durumTipi: 'VAKTINDE',
        asama: 'KALKIS',
        mesaj: `Çıkış Onaylandı! Yükleme operasyonu tamamlanmış olan ${temizPlaka} aracı ${temizKioskSehir} terminalinden ayrılıyor. Hedef: ${randevu.varis_sehri}. İyi yolculuklar!`,
        randevu,
      });
      return;
    }

    // 3. KONTROL 2: Tır Varış Yapacağı Şehirde mi? (Varış / Saha Giriş Onayı)
    if (randevu.varis_sehri === temizKioskSehir) {
      // Araç kalkış yapmadan varış yerine gelemez!
      if (randevu.durum === 'BEKLEMEDE') {
        res.status(400).json({
          basarili: false,
          durumTipi: 'HATA',
          mesaj: `Usulsüz Giriş: Bu araç henüz kalkış terminalinde (${randevu.kalkis_sehri}) yükleme yapıp yola çıkmadı! Önce ${randevu.kalkis_sehri} terminaline giriş yapmalıdır.`,
        });
        return;
      }

      // Tır yolda ve hedef şehir Kiosk'una vardı -> Durum SAHADA olur!
      const guncelRandevuRes = await sorgu(
        `UPDATE randevular 
         SET durum = 'SAHADA', 
             kiosk_giris_saati = NOW(),
             giris_turu = COALESCE(giris_turu, 'NORMAL')
         WHERE id = $1
         RETURNING *`,
        [randevu.id]
      );

      res.json({
        basarili: true,
        durumTipi: 'VAKTINDE',
        asama: 'VARIS',
        mesaj: `Varış onaylandı! ${temizKioskSehir} terminal sahasına giriş yapıldı. Lütfen operatörün boşaltma rampası atamasını bekleyin.`,
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

// POST /api/kiosk/qr-oku - İnsansız Kapı Otomatik QR Kod Doğrulama
kioskRouter.post('/qr-oku', async (req: Request, res: Response): Promise<void> => {
  try {
    const { qrKod, kioskSehir } = req.body;

    if (!qrKod || !kioskSehir) {
      res.status(400).json({
        basarili: false,
        durumTipi: 'HATA',
        mesaj: 'QR Kod ve Kiosk Şehri zorunludur.',
      });
      return;
    }

    const temizKod = qrKod.toString().trim().toUpperCase();
    const temizKioskSehir = kioskSehir.toString().trim().toUpperCase();

    // 1. QR Kod ile veya Plaka ile açık randevuyu bul
    const randevuRes = await sorgu(
      `SELECT * FROM randevular 
       WHERE (UPPER(qr_kod) = $1 OR UPPER(REPLACE(plaka, ' ', '')) = UPPER(REPLACE($1, ' ', '')) OR id::text = $1)
         AND durum IN ('BEKLEMEDE', 'SAHADA', 'OPERASYONDA', 'YOLDA')
       ORDER BY olusturulma_tarihi DESC 
       LIMIT 1`,
      [temizKod]
    );

    if (randevuRes.rows.length === 0) {
      res.status(404).json({
        basarili: false,
        durumTipi: 'GECERSIZ_QR',
        mesaj: `⚠️ Tanımsız veya süresi dolmuş QR Kod! (${temizKod}) Lütfen güvenlik personeline başvurunuz.`,
      });
      return;
    }

    const randevu = randevuRes.rows[0];

    // Zaten sahada veya rampada kontrolü
    if (randevu.durum === 'SAHADA') {
      res.json({
        basarili: true,
        durumTipi: 'BILGI',
        mesaj: `ℹ️ ${randevu.plaka} aracı zaten ${temizKioskSehir} terminal sahasında bulunmaktadır. Operatörün rampa ataması bekleniyor.`,
        randevu,
        rampaYonlendirmesi: 'Lütfen saha bekleme peronunda operatörün yönlendirmesini bekleyin.',
      });
      return;
    }

    if (randevu.durum === 'OPERASYONDA') {
      res.json({
        basarili: true,
        durumTipi: 'BILGI',
        mesaj: `ℹ️ ${randevu.plaka} aracı şu anda rampa operasyonundadır.`,
        randevu,
      });
      return;
    }

    // 2. Şehir ve Kapı Doğrulaması
    // Durum A: Kalkış Yapacak Şehirde (Yük Alma / Boş Giriş - BEKLEMEDE -> SAHADA)
    if (randevu.kalkis_sehri === temizKioskSehir && randevu.durum === 'BEKLEMEDE') {
      const guncelle = await sorgu(
        `UPDATE randevular 
         SET durum = 'SAHADA', 
             kiosk_giris_saati = NOW(), 
             giris_turu = 'QR_OTOMATIK' 
         WHERE id = $1 
         RETURNING *`,
        [randevu.id]
      );

      res.json({
        basarili: true,
        durumTipi: 'KALKIS_KABUL_EDILDI',
        mesaj: `✓ Randevu Doğrulandı! ${randevu.plaka} tırı yükleme operasyonu için ${temizKioskSehir} sahasına kabul edildi. Otomatik bariyer açılıyor.`,
        randevu: guncelle.rows[0],
        hedefTerminal: randevu.varis_sehri,
        rampaYonlendirmesi: `${temizKioskSehir} Saha Bekleme Alanına Geçiniz. Operatör yükleme rampası atayacaktır.`,
        guvenlikYonergesi: 'Saha içi hız sınırı 20 km/s. Yükleme öncesi araç takozunu takınız ve reflektörlü yelek giyiniz.',
      });
      return;
    }

    // Durum B: Kalkış Terminalinden Çıkış (Yükleme Tamamlandı - İrsaliye ve e-İmza Kontrolü)
    if (randevu.kalkis_sehri === temizKioskSehir && (randevu.durum === 'YOLDA' || randevu.durum === 'YUKLENDI_IMZA_BEKLIYOR')) {
      if (randevu.irsaliye_durumu !== 'IMZALANDI') {
        res.status(400).json({
          basarili: false,
          durumTipi: 'IMZA_BEKLENIYOR',
          randevu,
          mesaj: `⚠️ İrsaliye İmza Bekliyor: ${randevu.plaka} tırının sevk irsaliyesi (${randevu.irsaliye_no || 'Belge'}) sürücü tarafından henüz e-imza ile onaylanmamıştır. Lütfen cep telefonunuzdan onaylayınız.`,
        });
        return;
      }

      res.json({
        basarili: true,
        durumTipi: 'CIKIS_ONAYLANDI',
        mesaj: `✓ Çıkış Onaylandı! İmzalı Resmi Sevk İrsaliyesi (${randevu.irsaliye_no}) ile ${randevu.plaka} aracı ${temizKioskSehir} terminalinden ayrılıyor. Otomatik bariyer açılıyor.`,
        randevu,
        hedefTerminal: randevu.varis_sehri,
        rampaYonlendirmesi: `${randevu.varis_sehri} istikametine güvenli sürüşler dileriz.`,
        guvenlikYonergesi: 'Otoyol hız kurallarına ve takograf sınırlarına riayet ediniz. İyi yolculuklar!',
      });
      return;
    }

    // Durum C: Varış Yapılacak Şehirde (Yüklü Araç Girişi - Sevk İrsaliyesi Doğrulanarak Kabul Edilir)
    if (randevu.varis_sehri === temizKioskSehir && randevu.durum === 'YOLDA') {
      if (randevu.irsaliye_durumu !== 'IMZALANDI') {
        res.status(400).json({
          basarili: false,
          durumTipi: 'IRSALIYE_IMZASIZ',
          randevu,
          mesaj: `⚠️ Sevk İrsaliyesi İmzasız: ${randevu.plaka} tırının kalkış limanından sevk belgesi e-imza ile onaylanmamış! Lütfen gişe personeline başvurunuz.`,
        });
        return;
      }

      const guncelle = await sorgu(
        `UPDATE randevular 
         SET durum = 'SAHADA', 
             kiosk_giris_saati = NOW(), 
             giris_turu = 'QR_OTOMATIK' 
         WHERE id = $1 
         RETURNING *`,
        [randevu.id]
      );

      const irsaliyeMetni = randevu.irsaliye_no ? `[${randevu.irsaliye_no}]` : '';
      const yukMetni = randevu.tonaj_kg ? `${randevu.tonaj_kg} kg ${randevu.yuk_cinsi || 'Ticari Yük'}` : (randevu.yuk_cinsi || 'Ticari Emtia');

      res.json({
        basarili: true,
        durumTipi: 'VARIS_KABUL_EDILDI',
        mesaj: `✓ ${randevu.kalkis_sehri} Çıkışlı Sevk İrsaliyesi ${irsaliyeMetni} Doğrulandı! Yük: ${yukMetni} (Mühür: ${randevu.muhur_no || 'Tam'}) • Sürücü e-İmza Onaylı. ${temizKioskSehir} terminaline kabul edildi. Otomatik bariyer açılıyor.`,
        randevu: guncelle.rows[0],
        rampaYonlendirmesi: `${temizKioskSehir} Saha Bekleme Alanına Geçiniz. Operatör boşaltma rampası atayacaktır.`,
        guvenlikYonergesi: 'Saha içi hız sınırı 20 km/s. Baret ve reflektörlü yelek takılması zorunludur.',
      });
      return;
    }

    // Hatalı Kapı / Yanlış Şehir
    res.status(400).json({
      basarili: false,
      durumTipi: 'YANLIS_SEHIR',
      mesaj: `⚠️ Hatalı Kapı! Bu tırın rotası (${randevu.kalkis_sehri} -> ${randevu.varis_sehri}) şeklindedir. Şu anki terminal: ${temizKioskSehir}`,
    });
  } catch (error: any) {
    console.error('Kiosk QR Okuma Hatası:', error);
    res.status(500).json({ basarili: false, mesaj: 'QR okuma işlemi sırasında sunucu hatası oluştu.' });
  }
});

// POST /api/kiosk/evrak-onayla/:id - Kiosk Görevlisinin Evrakı Onaylaması
kioskRouter.post('/evrak-onayla/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const sonuc = await sorgu(
      `UPDATE randevular SET evrak_durumu = 'ONAYLANDI' WHERE id = $1 RETURNING *`,
      [id]
    );

    if (sonuc.rows.length === 0) {
      res.status(404).json({ basarili: false, mesaj: 'Randevu kaydı bulunamadı.' });
      return;
    }

    res.json({
      basarili: true,
      mesaj: `${sonuc.rows[0].plaka} tırının sevk evrakı onaylandı.`,
      randevu: sonuc.rows[0],
    });
  } catch (error: any) {
    console.error('Evrak Onay Hatası:', error);
    res.status(500).json({ basarili: false, mesaj: 'Evrak onaylanamadı.' });
  }
});
