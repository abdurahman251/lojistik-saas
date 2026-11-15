import { useState } from 'react';
import SurucuPortali from './components/SurucuPortali';
import KioskEkrani from './components/KioskEkrani';
import OperatorPaneli from './components/OperatorPaneli';
import YoneticiPaneli from './components/YoneticiPaneli';
import GirisEkrani from './components/GirisEkrani';

export interface KullaniciBilgisi {
  id: string;
  kullaniciAdi: string;
  rol: 'YONETICI' | 'OPERATOR' | 'KIOSK' | 'SURUCU';
  sehir: 'ISTANBUL' | 'ANKARA' | 'IZMIR' | 'YOK';
  plaka?: string | null;
}

export default function App() {
  const [aktifKullanici, setAktifKullanici] = useState<KullaniciBilgisi | null>(() => {
    const kayitli = localStorage.getItem('lojistik_kullanici');
    return kayitli ? JSON.parse(kayitli) : null;
  });

  const handleCikisYap = () => {
    localStorage.removeItem('lojistik_token');
    localStorage.removeItem('lojistik_kullanici');
    setAktifKullanici(null);
  };

  // ================= OTURUM AÇILDIĞINDA =================
  if (aktifKullanici) {
    // 1. Tır Sürücüsü ise: Sürücü Portalı Ekranı
    if (aktifKullanici.rol === 'SURUCU') {
      return <SurucuPortali kullanici={aktifKullanici} onCikis={handleCikisYap} />;
    }

    // 2. Kiosk Girişi ise: Kiosk Liman Ekranı
    if (aktifKullanici.rol === 'KIOSK') {
      return <KioskEkrani kullanici={aktifKullanici} onCikis={handleCikisYap} />;
    }

    // 3. Operatör Girişi ise: Rampa ve Saha Yönetimi Paneli
    if (aktifKullanici.rol === 'OPERATOR') {
      return <OperatorPaneli kullanici={aktifKullanici} onCikis={handleCikisYap} />;
    }

    // 4. Yönetici rolü için görünüm (Güvenlik & Filo Onay Masası)
    if (aktifKullanici.rol === 'YONETICI') {
      return <YoneticiPaneli kullanici={aktifKullanici} onCikis={handleCikisYap} />;
    }

    return null;
  }

  // ================= GİRİŞ & KAYIT EKRANI =================
  return <GirisEkrani onGirisBasarili={(kullanici) => setAktifKullanici(kullanici)} />;
}
