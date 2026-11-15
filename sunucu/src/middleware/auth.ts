import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'lojistik_os_super_gizli_anahtar_2026';

export interface TokenPayload {
  id: string;
  kullaniciAdi: string;
  rol: 'YONETICI' | 'OPERATOR' | 'KIOSK' | 'SURUCU';
  sehir: string;
  plaka?: string | null;
}

export interface YetkiliRequest extends Request {
  kullanici?: TokenPayload;
}

/**
 * JWT Token Doğrulama Middleware'i
 */
export const kimlikDogrula = (req: YetkiliRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      basarili: false,
      mesaj: 'Yetkilendirme hatası: Giriş tokenı bulunamadı. Lütfen giriş yapın.',
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const cozulmus = jwt.verify(token, JWT_SECRET) as TokenPayload;
    req.kullanici = cozulmus;
    next();
  } catch (err: any) {
    res.status(401).json({
      basarili: false,
      mesaj: 'Oturum süreniz dolmuş veya token geçersiz. Lütfen tekrar giriş yapın.',
    });
  }
};

/**
 * Rol Tabanlı Erişim Kontrolü (RBAC) Middleware'i
 */
export const rolKontrol = (...izinVerilenRoller: Array<'YONETICI' | 'OPERATOR' | 'KIOSK' | 'SURUCU'>) => {
  return (req: YetkiliRequest, res: Response, next: NextFunction): void => {
    if (!req.kullanici) {
      res.status(401).json({
        basarili: false,
        mesaj: 'Yetkilendirme hatası: Kullanıcı kimliği doğrulanamadı.',
      });
      return;
    }

    if (!izinVerilenRoller.includes(req.kullanici.rol)) {
      res.status(403).json({
        basarili: false,
        mesaj: `Erişim Engellendi: Bu işlem için '${izinVerilenRoller.join(', ')}' yetkisi gereklidir. Sizin rolünüz: ${req.kullanici.rol}`,
      });
      return;
    }

    next();
  };
};

