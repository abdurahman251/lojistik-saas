import { Request, Response, NextFunction } from 'express';

interface DenemeKaydi {
  hataliSayisi: number;
  kilitZamani: number | null; // Kilitlendiği timestamp
}

// IP veya kullanıcı adına göre hatalı denemeleri bellekte tut
const denemeHafizasi = new Map<string, DenemeKaydi>();

const MAX_HATALI_DENEME = 5;
const KILIT_SURESI_MS = 15 * 60 * 1000; // 15 dakika

/**
 * İstemcinin IP adresini veya giriş değerini anahtar yapar
 */
const anahtarUret = (req: Request): string => {
  const ip = req.ip || req.socket.remoteAddress || 'bilinmeyen-ip';
  const giris = (req.body && req.body.girisDegeri) ? req.body.girisDegeri.toString().trim().toLowerCase() : '';
  return `${ip}::${giris}`;
};

/**
 * Giriş öncesi kilitli mi kontrol eder
 */
export const girisRateLimiter = (req: Request, res: Response, next: NextFunction): void => {
  const anahtar = anahtarUret(req);
  const kayit = denemeHafizasi.get(anahtar);

  if (kayit && kayit.kilitZamani) {
    const gecenSure = Date.now() - kayit.kilitZamani;
    if (gecenSure < KILIT_SURESI_MS) {
      const kalanDakika = Math.ceil((KILIT_SURESI_MS - gecenSure) / 60000);
      res.status(429).json({
        basarili: false,
        kilitli: true,
        mesaj: `Güvenlik Uyarısı: 5 kez üst üste hatalı giriş yapıldı. Hesabınız ${kalanDakika} dakika süreyle kilitlenmiştir. Lütfen daha sonra tekrar deneyin.`,
      });
      return;
    } else {
      // Kilit süresi dolmuş, sıfırla
      denemeHafizasi.delete(anahtar);
    }
  }

  next();
};

/**
 * Hatalı giriş yapıldığında sayacı artırır
 */
export const hataliGirisKaydet = (req: Request): { kilitlendi: boolean; kalanHak: number } => {
  const anahtar = anahtarUret(req);
  const simdi = Date.now();
  const mevcut = denemeHafizasi.get(anahtar) || { hataliSayisi: 0, kilitZamani: null };

  mevcut.hataliSayisi += 1;

  if (mevcut.hataliSayisi >= MAX_HATALI_DENEME) {
    mevcut.kilitZamani = simdi;
    denemeHafizasi.set(anahtar, mevcut);
    return { kilitlendi: true, kalanHak: 0 };
  }

  denemeHafizasi.set(anahtar, mevcut);
  return { kilitlendi: false, kalanHak: MAX_HATALI_DENEME - mevcut.hataliSayisi };
};

/**
 * Başarılı giriş yapıldığında sayacı sıfırlar
 */
export const basariliGirisSifirla = (req: Request): void => {
  const anahtar = anahtarUret(req);
  denemeHafizasi.delete(anahtar);
};

