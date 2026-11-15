import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { authFetch } from '../api';
import Logo from './Logo';
import { 
  Truck, 
  MapPin, 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  ArrowRight, 
  LogOut, 
  AlertTriangle,
  Sparkles,
  QrCode,
  X,
  Navigation,
  Check,
  HelpCircle,
  Bell,
  Radio,
  CheckCircle2,
  Inbox,
  PenTool,
  FileText,
  ShieldCheck,
  Printer
} from 'lucide-react';

export interface KullaniciBilgisi {
  id: string;
  kullaniciAdi: string;
  rol: 'YONETICI' | 'OPERATOR' | 'KIOSK' | 'SURUCU';
  sehir: 'ISTANBUL' | 'ANKARA' | 'IZMIR' | 'YOK';
  plaka?: string | null;
}

interface RandevuVerisi {
  id: string;
  tir_id: string;
  plaka: string;
  kalkis_sehri: string;
  varis_sehri: string;
  randevu_tarihi: string;
  randevu_saati: string;
  sofor_ad_soyad: string;
  sofor_telefon: string;
  evrak_yolu?: string | null;
  evrak_adi?: string | null;
  evrak_durumu?: string | null;
  qr_kod?: string | null;
  durum: string;
  is_gecikme?: boolean;
  olusturulma_tarihi?: string;
  atanan_rampa_id?: string | null;
  atanan_rampa_adi?: string | null;
  rampa_cagri_zamani?: string | null;
  cagri_durumu?: 'BEKLEMEDE' | 'CAGRILDI' | 'YANASTI' | 'TAMAMLANDI' | string | null;
  irsaliye_no?: string | null;
  yuk_cinsi?: string | null;
  tonaj_kg?: number | null;
  palet_sayisi?: number | null;
  muhur_no?: string | null;
  sofor_imzasi?: string | null;
  irsaliye_durumu?: string | null;
  irsaliye_tarihi?: string | null;
}

interface BildirimVerisi {
  id: string;
  randevu_id?: string;
  tir_id?: string;
  plaka: string;
  baslik: string;
  mesaj: string;
  tip: string;
  rampa_no?: string;
  rampa_adi?: string;
  operasyon_tipi?: string;
  okundu: boolean;
  olusturulma_tarihi: string;
}

interface SurucuPortaliProps {
  kullanici: KullaniciBilgisi;
  onCikis: () => void;
}

// Şehir Güzergah ve Mesafe Bilgileri (Lojistik Zekası)
const ROTA_BILGILERI: Record<string, { mesafe: string; sure: string; guzergah: string }> = {
  'ISTANBUL-ANKARA': { mesafe: '450 km', sure: '~5 saat', guzergah: 'O-4 Anadolu Otoyolu' },
  'ISTANBUL-IZMIR': { mesafe: '480 km', sure: '~5.5 saat', guzergah: 'O-5 Gebze-İzmir Otoyolu' },
  'ANKARA-ISTANBUL': { mesafe: '450 km', sure: '~5 saat', guzergah: 'O-4 Otoyolu' },
  'ANKARA-IZMIR': { mesafe: '590 km', sure: '~7 saat', guzergah: 'D300 / E96 Karayolu' },
  'IZMIR-ISTANBUL': { mesafe: '480 km', sure: '~5.5 saat', guzergah: 'O-5 Otoyolu' },
  'IZMIR-ANKARA': { mesafe: '590 km', sure: '~7 saat', guzergah: 'D300 / E96 Karayolu' },
};

const SEHIR_ISIMLERI: Record<string, string> = {
  ISTANBUL: 'İstanbul Terminali',
  ANKARA: 'Ankara Lojistik Üssü',
  IZMIR: 'İzmir Liman Sahası',
};

// Hızlı Zaman Aralıkları
const HIZLI_SAATLER = ['08:00', '11:00', '14:00', '17:00', '20:00', '23:00'];

export default function SurucuPortali({ kullanici, onCikis }: SurucuPortaliProps) {
  const [aktifRandevu, setAktifRandevu] = useState<RandevuVerisi | null>(null);
  const [qrVerisi, setQrVerisi] = useState<string>('');
  const [yukleniyor, setYukleniyor] = useState(true);
  const [formGonderiliyor, setFormGonderiliyor] = useState(false);
  const [hataMesaji, setHataMesaji] = useState<string | null>(null);
  const [detayModalAcik, setDetayModalAcik] = useState(false);

  // Dijital Sevk İrsaliyesi ve e-İmza State'leri
  const [irsaliyeModalAcik, setIrsaliyeModalAcik] = useState(false);
  const [irsaliyeGoruntuleModalAcik, setIrsaliyeGoruntuleModalAcik] = useState(false);
  const [cizimYapiyor, setCizimYapiyor] = useState(false);
  const [imzaAtildi, setImzaAtildi] = useState(false);
  const [imzaGonderiliyor, setImzaGonderiliyor] = useState(false);
  const [sozlesmeKabul, setSozlesmeKabul] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Bildirim ve Rampa Çağrı State'leri
  const [bildirimler, setBildirimler] = useState<BildirimVerisi[]>([]);
  const [okunmamisBildirimSayisi, setOkunmamisBildirimSayisi] = useState(0);
  const [bildirimModalAcik, setBildirimModalAcik] = useState(false);
  const [yanasmaOnaylaniyor, setYanasmaOnaylaniyor] = useState(false);
  const [sonCalinanBildirimId, setSonCalinanBildirimId] = useState<string | null>(null);

  // Kalkış Şehri
  const kalkisSehri = (kullanici.sehir === 'YOK' || !kullanici.sehir) ? 'ISTANBUL' : kullanici.sehir;
  const tumSehirler = ['ISTANBUL', 'ANKARA', 'IZMIR'];
  const olasiVarisSehirleri = tumSehirler.filter((s) => s !== kalkisSehri);

  // Form State'leri
  const [varisSehri, setVarisSehri] = useState(olasiVarisSehirleri[0] || 'ANKARA');
  
  // Varsayılan bugünün tarihi
  const bugunTarihStr = new Date().toISOString().split('T')[0];
  const yarinTarihStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const sonrakiGunTarihStr = new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0];

  const [randevuTarihi, setRandevuTarihi] = useState(bugunTarihStr);
  const [randevuSaati, setRandevuSaati] = useState('14:00');
  const [soforAdSoyad, setSoforAdSoyad] = useState(kullanici.kullaniciAdi || '');
  const [soforTelefon, setSoforTelefon] = useState('0532 555 0123');

  // Seçili Rota Özeti
  const rotaAnahtari = `${kalkisSehri}-${varisSehri}`;
  const rotaBilgisi = ROTA_BILGILERI[rotaAnahtari] || { mesafe: '450 km', sure: '~5 saat', guzergah: 'Otoyol Hattı' };

  // Canlı Sesli Uyarı (Web Audio API Çanı)
  const calCagriSesi = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.12); // E5
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.24); // G5
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch {
      // Tarayıcı otomatik oynatma kısıtlaması sessizce geçilir
    }
  };

  // Aktif randevuyu çek
  const aktifRandevuGetir = async () => {
    try {
      const res = await authFetch(`/api/randevu/aktif?tirId=${kullanici.id}&plaka=${kullanici.plaka || ''}`);
      const data = await res.json();
      if (data.basarili && data.aktifRandevu) {
        setAktifRandevu(data.aktifRandevu);
      } else {
        setAktifRandevu(null);
      }
    } catch (err) {
      console.error('Randevu getirme hatası:', err);
    } finally {
      setYukleniyor(false);
    }
  };

  // Sürücü Bildirimlerini ve Rampa Çağrılarını Çek
  const bildirimleriGetir = async () => {
    try {
      const res = await authFetch(`/api/randevu/bildirimler?tirId=${kullanici.id}&plaka=${kullanici.plaka || ''}`);
      const data = await res.json();
      if (data.basarili && data.bildirimler) {
        setBildirimler(data.bildirimler);
        setOkunmamisBildirimSayisi(data.okunmamisSayisi || 0);

        // Yeni okunmamış rampa çağrısı varsa ses çal!
        const yeniCagri = data.bildirimler.find(
          (b: BildirimVerisi) => b.tip === 'RAMPA_CAGRISI' && !b.okundu
        );
        if (yeniCagri && yeniCagri.id !== sonCalinanBildirimId) {
          setSonCalinanBildirimId(yeniCagri.id);
          calCagriSesi();
        }
      }
    } catch (err) {
      console.error('Bildirim çekme hatası:', err);
    }
  };

  // Rampaya Yanaşma Teyidi Ver
  const handleRampayaYanas = async (randevuId: string) => {
    setYanasmaOnaylaniyor(true);
    try {
      const res = await authFetch(`/api/randevu/rampa-yanas/${randevuId}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.basarili) {
        if (aktifRandevu) {
          setAktifRandevu({
            ...aktifRandevu,
            cagri_durumu: 'YANASTI',
          });
        }
        await authFetch('/api/randevu/bildirimler-hepsini-oku', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tirId: kullanici.id, plaka: kullanici.plaka }),
        });
        await bildirimleriGetir();
      }
    } catch (err) {
      console.error('Yanaşma teyit hatası:', err);
    } finally {
      setYanasmaOnaylaniyor(false);
    }
  };

  // Periyodik Canlı Takip (Her 4 saniyede bir güncellenir)
  useEffect(() => {
    aktifRandevuGetir();
    bildirimleriGetir();

    const zamanlayici = setInterval(() => {
      aktifRandevuGetir();
      bildirimleriGetir();
    }, 4000);

    return () => clearInterval(zamanlayici);
  }, [kullanici]);

  // Aktif randevu için görsel QR kod oluştur
  useEffect(() => {
    if (aktifRandevu) {
      const qrMetin = aktifRandevu.qr_kod || `QR-${aktifRandevu.plaka.replace(/\s+/g, '')}-${aktifRandevu.id.slice(0, 6)}`;
      QRCode.toDataURL(qrMetin, {
        width: 260,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((url) => setQrVerisi(url))
        .catch((err) => console.error('QR üretme hatası:', err));
    } else {
      setQrVerisi('');
    }
  }, [aktifRandevu]);

  // Yeni Randevu Oluştur (Form Gönderimi)
  const handleRandevuOlustur = async (e: React.FormEvent) => {
    e.preventDefault();
    setHataMesaji(null);

    if (!varisSehri) {
      setHataMesaji('Lütfen hedef varış terminalini seçin.');
      return;
    }
    if (!randevuTarihi || !randevuSaati) {
      setHataMesaji('Lütfen randevu tarihi ve tahmini varış saatini belirleyin.');
      return;
    }
    if (!soforAdSoyad.trim() || !soforTelefon.trim()) {
      setHataMesaji('Lütfen sürücü adı ve iletişim numarasını eksiksiz girin.');
      return;
    }

    setFormGonderiliyor(true);
    try {
      const res = await authFetch('/api/randevu/olustur', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tirId: kullanici.id,
          plaka: kullanici.plaka || '34 IST 01',
          kalkisSehri,
          varisSehri,
          randevuTarihi,
          randevuSaati,
          soforAdSoyad: soforAdSoyad.trim(),
          soforTelefon: soforTelefon.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.basarili) {
        throw new Error(data.mesaj || 'Randevu oluşturulamadı.');
      }

      setAktifRandevu(data.randevu);
    } catch (err: any) {
      setHataMesaji(err.message || 'Randevu kaydedilemedi.');
    } finally {
      setFormGonderiliyor(false);
    }
  };

  // Randevu İptali
  const handleRandevuIptal = async () => {
    if (!aktifRandevu) return;
    if (!confirm('Randevunuzu iptal edip yeni bir randevu oluşturmak istediğinize emin misiniz?')) return;

    try {
      await authFetch(`/api/randevu/iptal/${aktifRandevu.id}`, { method: 'POST' });
      setAktifRandevu(null);
      setDetayModalAcik(false);
    } catch (err) {
      console.error(err);
    }
  };

  // Dokunmatik ve Fare İmza Çizim Fonksiyonları
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e && e.touches.length > 0) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    const mouseE = e as React.MouseEvent<HTMLCanvasElement>;
    return {
      x: (mouseE.clientX - rect.left) * scaleX,
      y: (mouseE.clientY - rect.top) * scaleY,
    };
  };

  const handleCizimBasla = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const coords = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setCizimYapiyor(true);
  };

  const handleCizimYap = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!cizimYapiyor) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const coords = getCanvasCoords(e);
    ctx.lineTo(coords.x, coords.y);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    setImzaAtildi(true);
  };

  const handleCizimBitir = () => {
    setCizimYapiyor(false);
  };

  const handleImzaTemizle = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setImzaAtildi(false);
  };

  const handleIrsaliyeImzala = async () => {
    if (!canvasRef.current || !imzaAtildi) {
      alert('Lütfen dokunmatik ekrandan veya fare ile imzanızı atınız.');
      return;
    }
    if (!sozlesmeKabul) {
      alert('Lütfen yük teslim beyanını onaylayınız.');
      return;
    }
    if (!aktifRandevu) return;

    setImzaGonderiliyor(true);
    try {
      const imzaData = canvasRef.current.toDataURL('image/png');
      const res = await authFetch(`/api/randevu/irsaliye-imzala/${aktifRandevu.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imza: imzaData }),
      });
      const data = await res.json();
      if (data.basarili) {
        setIrsaliyeModalAcik(false);
        aktifRandevuGetir();
      } else {
        alert(data.mesaj || 'İmza kaydedilemedi.');
      }
    } catch (err) {
      console.error(err);
      alert('Sunucu hatası: İmza onaylanamadı.');
    } finally {
      setImzaGonderiliyor(false);
    }
  };

  if (yukleniyor) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-500 font-medium tracking-wide">Terminal verileri yükleniyor...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col antialiased text-slate-900">
      
      {/* ================= ÜST LOJİSTİK NAVBAR ================= */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 sm:px-8 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          
          {/* Sol: Logo + Araç Kimlik Rozeti */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <Logo variant="icon" size="sm" className="w-9 h-9 rounded-xl overflow-hidden shrink-0 shadow-xs" />
              <div className="hidden sm:block">
                <span className="text-sm font-bold text-slate-900 tracking-tight leading-none block">
                  Lojistik OS
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  Sürücü & Sevk Portalı
                </span>
              </div>
            </div>

            <div className="h-4 w-px bg-slate-200 hidden sm:block" />

            {/* TR Plaka Kapsülü */}
            <div className="flex items-center rounded-lg overflow-hidden border border-slate-200 bg-white shadow-2xs">
              <span className="bg-[#003399] text-white text-[10px] font-extrabold px-1.5 py-1 tracking-tight">
                TR
              </span>
              <span className="px-2.5 py-1 text-xs font-mono font-bold text-slate-900 uppercase">
                {kullanici.plaka || '34 IST 01'}
              </span>
            </div>

            {/* Terminal Konumu */}
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-medium">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>Üs: <strong className="text-slate-800">{kalkisSehri}</strong></span>
            </div>
          </div>

          {/* Sağ: Durum, Bildirim & Çıkış */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Sistem Çevrimiçi</span>
            </div>

            {/* Bildirim Zili ve Çağrı Rozeti */}
            <button
              type="button"
              onClick={() => setBildirimModalAcik(true)}
              className="relative p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 transition cursor-pointer"
              title="Operatör Mesajları ve Rampa Çağrıları"
            >
              <Bell className="w-4 h-4 text-slate-700" />
              {okunmamisBildirimSayisi > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white font-extrabold text-[9px] w-4 h-4 rounded-full flex items-center justify-center animate-bounce shadow-xs">
                  {okunmamisBildirimSayisi}
                </span>
              )}
            </button>

            <button
              onClick={onCikis}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 text-xs font-semibold transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Çıkış</span>
            </button>
          </div>

        </div>
      </header>

      {/* ================= ANA GÖVDE ================= */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col justify-center">

        {/* ================= CANLI RAMPA ÇAĞRI BANNERI ================= */}
        {aktifRandevu && (aktifRandevu.cagri_durumu === 'CAGRILDI' || aktifRandevu.atanan_rampa_adi) && (
          <div className={`mb-6 p-4 sm:p-5 rounded-3xl border shadow-lg transition-all animate-fade-in ${
            aktifRandevu.cagri_durumu === 'CAGRILDI'
              ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white border-amber-300 ring-4 ring-amber-400/30'
              : 'bg-emerald-950 text-white border-emerald-800'
          }`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
                  <Radio className="w-6 h-6 text-white animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs uppercase font-extrabold tracking-wider bg-black/25 px-2.5 py-0.5 rounded-full text-white font-mono">
                      {aktifRandevu.cagri_durumu === 'CAGRILDI' ? '🚨 ACİL RAMPA ÇAĞRISI' : '✓ RAMPA ATAMASI TAMAM'}
                    </span>
                    <span className="text-xs font-mono font-bold bg-white text-slate-900 px-2.5 py-0.5 rounded-full shadow-2xs">
                      {aktifRandevu.atanan_rampa_adi || 'Atanan Peron'}
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-extrabold text-white mt-1 leading-tight">
                    Sayın {aktifRandevu.sofor_ad_soyad}, lütfen {aktifRandevu.atanan_rampa_adi} peronuna yanaşınız!
                  </h3>

                  <p className="text-xs text-white/90 mt-1 max-w-xl">
                    {aktifRandevu.cagri_durumu === 'CAGRILDI'
                      ? 'Terminal operatörü aracınızı yükleme/boşaltma için perona çağırdı. Lütfen en geç 15 dakika içinde perona yanaşınız.'
                      : 'Perona yanaşma teyidiniz alınmıştır. Operatör yükleme/boşaltma sürecini yürütüyor.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                {aktifRandevu.cagri_durumu === 'CAGRILDI' ? (
                  <button
                    type="button"
                    disabled={yanasmaOnaylaniyor}
                    onClick={() => handleRampayaYanas(aktifRandevu.id)}
                    className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-amber-950 font-extrabold text-xs shadow-md active:scale-95 transition flex items-center gap-2 cursor-pointer"
                  >
                    {yanasmaOnaylaniyor ? (
                      <div className="w-4 h-4 border-2 border-amber-950/30 border-t-amber-950 rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
                        <span>Rampaya Yanaşıyorum (Onayla)</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="px-3 py-1.5 rounded-xl bg-emerald-800 text-emerald-200 border border-emerald-700 text-xs font-bold flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    <span>Peron Teyit Edildi</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= RESMİ SEVK İRSALİYESİ E-İMZA ÇAĞRI BANNERI ================= */}
        {aktifRandevu && (aktifRandevu.irsaliye_durumu === 'DUZENLENDI' || aktifRandevu.cagri_durumu === 'IMZA_BEKLENIYOR') && (
          <div className="mb-6 p-4 sm:p-5 rounded-3xl border shadow-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white border-blue-400 ring-4 ring-blue-400/30 animate-fade-in">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
                  <FileText className="w-6 h-6 text-white animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs uppercase font-extrabold tracking-wider bg-black/25 px-2.5 py-0.5 rounded-full text-white font-mono">
                      📋 RESMİ SEVK İRSALİYESİ HAZIR
                    </span>
                    <span className="text-xs font-mono font-bold bg-white text-slate-900 px-2.5 py-0.5 rounded-full shadow-2xs">
                      {aktifRandevu.irsaliye_no || 'LOS-IRS-2024'}
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-extrabold text-white mt-1 leading-tight">
                    Yüklemeniz Tamamlandı! Lütfen e-İmzanız ile Onaylayınız
                  </h3>

                  <p className="text-xs text-white/90 mt-1 max-w-xl">
                    Operatör {aktifRandevu.tonaj_kg ? `${aktifRandevu.tonaj_kg} kg ` : ''}{aktifRandevu.yuk_cinsi || 'Ticari Yük'} için sevk irsaliyesini düzenledi. Yola çıkış izni için lütfen parmağınızla ekrandan onaylayınız.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <button
                  type="button"
                  onClick={() => setIrsaliyeModalAcik(true)}
                  className="px-5 py-3 rounded-xl bg-white hover:bg-slate-100 text-blue-950 font-extrabold text-xs shadow-md active:scale-95 transition flex items-center gap-2 cursor-pointer"
                >
                  <PenTool className="w-4 h-4 text-blue-600" />
                  <span>İrsaliyeyi İncele & İmzala</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= RESMİ SEVK İRSALİYESİ ONAYLANDI BİLGİ ŞERİDİ ================= */}
        {aktifRandevu && aktifRandevu.irsaliye_durumu === 'IMZALANDI' && (
          <div className="mb-6 p-4 rounded-2xl border border-emerald-500/30 bg-emerald-950/60 text-white backdrop-blur-xs flex items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  ✓ Resmi Sevk İrsaliyesi e-İmzalandı & Onaylandı
                  <span className="font-mono text-[10px] bg-emerald-900/60 px-2 py-0.5 rounded text-white">{aktifRandevu.irsaliye_no}</span>
                </span>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  {aktifRandevu.varis_sehri} Terminali Kiosk'una ulaştığınızda bu irsaliyenin karekodunu okutunuz.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIrsaliyeGoruntuleModalAcik(true)}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>İrsaliyeyi Gör</span>
            </button>
          </div>
        )}

        {!aktifRandevu ? (
          /* ================= 1. DURUM: YENİ RANDEVU OLUŞTURMA ================= */
          <div className="animate-fade-in space-y-6">
            
            {/* Sayfa Başlığı ve Akış Durumu */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Rampa Randevusu Oluştur</span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Liman ve dağıtım merkezlerinde bekleme yapmadan giriş için sevk planınızı kaydedin.
                </p>
              </div>

              {/* Rota Özeti Rozeti */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs shadow-2xs self-start sm:self-auto">
                <Navigation className="w-3.5 h-3.5 text-slate-700" />
                <span className="font-semibold text-slate-900">{kalkisSehri}</span>
                <span className="text-slate-400">→</span>
                <span className="font-semibold text-slate-900">{varisSehri}</span>
                <span className="text-[11px] text-slate-400 font-mono">({rotaBilgisi.mesafe})</span>
              </div>
            </div>

            {/* Hata Uyarısı */}
            {hataMesaji && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200/80 text-red-600 text-xs font-medium flex items-start gap-2.5 animate-shake">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                <span>{hataMesaji}</span>
              </div>
            )}

            {/* Form ve Rota Bilgisi Grid'i */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* SOL FORM ALANI (8 Kolon) */}
              <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 sm:p-7">
                <form onSubmit={handleRandevuOlustur} className="space-y-6">

                  {/* ADIM 1: ROTA SEÇİMİ */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-slate-900 text-white text-[10px] flex items-center justify-center font-bold">1</span>
                        <span>Varış Limanı / Terminali</span>
                      </label>
                      <span className="text-[11px] text-slate-400">Kalkış: <strong>{kalkisSehri}</strong></span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {olasiVarisSehirleri.map((sehir) => {
                        const secili = varisSehri === sehir;
                        const info = ROTA_BILGILERI[`${kalkisSehri}-${sehir}`] || { mesafe: '450 km', sure: '~5 saat' };
                        return (
                          <button
                            key={sehir}
                            type="button"
                            onClick={() => setVarisSehri(sehir)}
                            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                              secili
                                ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-800'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-bold">{sehir}</span>
                              {secili && <Check className="w-4 h-4 text-emerald-400" />}
                            </div>
                            <p className={`text-xs ${secili ? 'text-slate-300' : 'text-slate-500'}`}>
                              {SEHIR_ISIMLERI[sehir] || 'Lojistik Terminali'}
                            </p>
                            <div className="mt-2.5 flex items-center gap-2 text-[10px] font-mono">
                              <span className={`px-1.5 py-0.5 rounded ${secili ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                {info.mesafe}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded ${secili ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                {info.sure}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* ADIM 2: TARİH & SAAT PLANLAMASI */}
                  <div className="pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-slate-900 text-white text-[10px] flex items-center justify-center font-bold">2</span>
                        <span>Randevu Zamanı</span>
                      </label>
                      <span className="text-[11px] text-slate-400">Tahmini varış saatini seçin</span>
                    </div>

                    {/* Tarih Hızlı Seçim + Manuel Giriş */}
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { etiket: 'Bugün', val: bugunTarihStr },
                          { etiket: 'Yarın', val: yarinTarihStr },
                          { etiket: 'Sonraki Gün', val: sonrakiGunTarihStr },
                        ].map((btn) => (
                          <button
                            key={btn.val}
                            type="button"
                            onClick={() => setRandevuTarihi(btn.val)}
                            className={`py-2 px-3 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                              randevuTarihi === btn.val
                                ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {btn.etiket}
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Tarih Girişi */}
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                            <Calendar className="w-4 h-4" />
                          </span>
                          <input
                            type="date"
                            required
                            min={bugunTarihStr}
                            value={randevuTarihi}
                            onChange={(e) => setRandevuTarihi(e.target.value)}
                            className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition"
                          />
                        </div>

                        {/* Saat Girişi */}
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                            <Clock className="w-4 h-4" />
                          </span>
                          <input
                            type="time"
                            required
                            value={randevuSaati}
                            onChange={(e) => setRandevuSaati(e.target.value)}
                            className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition font-mono font-semibold"
                          />
                        </div>
                      </div>

                      {/* Hızlı Saat Çipleri */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        <span className="text-[11px] text-slate-400 mr-1 font-medium">Önerilen Saatler:</span>
                        {HIZLI_SAATLER.map((saat) => (
                          <button
                            key={saat}
                            type="button"
                            onClick={() => setRandevuSaati(saat)}
                            className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium transition cursor-pointer border ${
                              randevuSaati === saat
                                ? 'bg-slate-800 text-white border-slate-800'
                                : 'bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-slate-100'
                            }`}
                          >
                            {saat}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* ADIM 3: SÜRÜCÜ VE İLETİŞİM */}
                  <div className="pt-4 border-t border-slate-100">
                    <div className="mb-3">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-slate-900 text-white text-[10px] flex items-center justify-center font-bold">3</span>
                        <span>Sürücü & İletişim Bilgileri</span>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Sürücü Adı Soyadı
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <User className="w-3.5 h-3.5" />
                          </span>
                          <input
                            type="text"
                            required
                            value={soforAdSoyad}
                            onChange={(e) => setSoforAdSoyad(e.target.value)}
                            placeholder="Sürücü Adı Soyadı"
                            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          İletişim Numarası (SMS Bildirimi İçin)
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <Phone className="w-3.5 h-3.5" />
                          </span>
                          <input
                            type="tel"
                            required
                            value={soforTelefon}
                            onChange={(e) => setSoforTelefon(e.target.value)}
                            placeholder="05xx xxx xx xx"
                            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ADIM 4: İNSANSIZ KAPI GİRİŞ PROTOKOLÜ BİLGİLENDİRMESİ */}
                  <div className="pt-4 border-t border-slate-100">
                    <div className="p-4 rounded-2xl border border-blue-200/80 bg-blue-50/70 flex items-start gap-3.5">
                      <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs font-bold text-blue-950">
                            Evraksız Hızlı Geçiş Protokolü
                          </h4>
                          <span className="text-[10px] font-bold bg-blue-200/70 text-blue-900 px-2 py-0.5 rounded-full">
                            Tam Otomatik
                          </span>
                        </div>
                        <p className="text-[11px] text-blue-900/80 leading-relaxed">
                          Tesis sahasına yük alma / boş araç statüsünde giriş yapılacağından <strong>girişte evrak yüklemeniz gerekmez.</strong> Rampa yüklemeniz tamamlandığında resmi <strong>Dijital Sevk İrsaliyeniz</strong> operatör tarafından düzenlenecek ve cep telefonunuza e-İmza onayı için gönderilecektir.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* ONAY BUTONU */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={formGonderiliyor}
                      className="w-full py-3.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white font-bold text-sm shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {formGonderiliyor ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <span>Randevuyu Onayla ve Sıraya Al</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>

                </form>
              </div>

              {/* SAĞ PANEL: ROTA VE SAHA BİLGİLENDİRMESİ (4 Kolon) */}
              <div className="lg:col-span-4 space-y-4">
                
                {/* Rota Özeti Kartı */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Rota Özeti
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">
                      Canlı Hat
                    </span>
                  </div>

                  {/* Rota Şeması */}
                  <div className="relative pl-6 space-y-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200">
                    {/* Kalkış */}
                    <div className="relative">
                      <span className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-slate-900 ring-4 ring-slate-100" />
                      <div className="text-xs font-bold text-slate-900">{kalkisSehri}</div>
                      <div className="text-[11px] text-slate-400">{SEHIR_ISIMLERI[kalkisSehri]}</div>
                    </div>

                    {/* Varış */}
                    <div className="relative">
                      <span className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-emerald-50" />
                      <div className="text-xs font-bold text-slate-900">{varisSehri}</div>
                      <div className="text-[11px] text-slate-400">{SEHIR_ISIMLERI[varisSehri]}</div>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 gap-2 text-center">
                    <div className="p-2 rounded-lg bg-slate-50">
                      <span className="block text-[10px] text-slate-400 font-medium">Toplam Mesafe</span>
                      <span className="text-xs font-mono font-bold text-slate-800">{rotaBilgisi.mesafe}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50">
                      <span className="block text-[10px] text-slate-400 font-medium">Tahmini Sürüş</span>
                      <span className="text-xs font-mono font-bold text-slate-800">{rotaBilgisi.sure}</span>
                    </div>
                  </div>

                  <div className="mt-3 text-[11px] text-slate-500 flex items-center gap-1.5">
                    <Navigation className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{rotaBilgisi.guzergah}</span>
                  </div>
                </div>

                {/* Saha Kuralları & Uyarı */}
                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-3">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                    <HelpCircle className="w-4 h-4 text-slate-600" />
                    <span>Liman & Saha Giriş Prosedürü</span>
                  </div>

                  <ul className="text-xs text-slate-600 space-y-2 leading-relaxed">
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                      <span>Randevu saatinizden <strong>en az 30 dakika önce</strong> saha bekleme parkında hazır bulunun.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                      <span>Kiosk bariyerine vardığınızda plakanız otomatik taranır veya QR kodunuzu okutabilirsiniz.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                      <span>Saha içi azami hız limiti <strong>20 km/s</strong> olup reflektörlü yelek zorunludur.</span>
                    </li>
                  </ul>
                </div>

              </div>

            </div>

          </div>
        ) : (
          /* ================= 2. DURUM: AKTİF RANDEVU KARTI (BİLET TARZI) ================= */
          <div className="max-w-2xl mx-auto w-full animate-fade-in space-y-4">
            
            {/* Üst Bilgi Rozeti */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold text-slate-700 tracking-wide uppercase">
                  Onaylanmış Sefer Randevusu
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Kayıt ID: {aktifRandevu.id.slice(0, 8)}...
              </span>
            </div>

            {/* Dijital Lojistik Taşıma Kartı */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              
              {/* Kart Üst Başlık (Monokrom Lojistik Şıklığı) */}
              <div className="bg-slate-900 text-white p-6 sm:p-7 relative overflow-hidden">
                
                {/* Arka Plan Hafif Rota Çizgisi */}
                <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 pointer-events-none flex items-center justify-center">
                  <Truck className="w-48 h-48 -mr-10 text-white" />
                </div>

                <div className="flex items-center justify-between mb-4 relative z-10">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-white text-[11px] font-semibold border border-white/15">
                    <Sparkles className="w-3 h-3 text-amber-300" />
                    <span>Aktif Rampa Geçiş Bileti</span>
                  </div>

                  <div className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-mono font-bold uppercase">
                    {aktifRandevu.durum}
                  </div>
                </div>

                {/* Büyük Rota Görünümü */}
                <div className="flex items-center justify-between gap-4 my-2 relative z-10">
                  <div>
                    <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">Kalkış</span>
                    <span className="text-2xl sm:text-3xl font-extrabold tracking-tight">{aktifRandevu.kalkis_sehri}</span>
                  </div>

                  <div className="flex-1 flex flex-col items-center px-2">
                    <div className="w-full flex items-center justify-center gap-2">
                      <div className="h-0.5 flex-1 bg-white/20" />
                      <Truck className="w-4 h-4 text-white/80 shrink-0" />
                      <div className="h-0.5 flex-1 bg-white/20" />
                    </div>
                    <span className="text-[10px] text-white/50 mt-1 font-mono">{aktifRandevu.plaka}</span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">Hedef Terminal</span>
                    <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-emerald-400">{aktifRandevu.varis_sehri}</span>
                  </div>
                </div>

              </div>

              {/* Tırtıklı Bilet Ayırıcı Çizgisi (Perforated Line) */}
              <div className="relative flex items-center justify-between bg-white px-2">
                <div className="w-4 h-4 rounded-full bg-[#fafafa] -ml-4 border-r border-slate-200" />
                <div className="flex-1 border-b-2 border-dashed border-slate-200 mx-2" />
                <div className="w-4 h-4 rounded-full bg-[#fafafa] -mr-4 border-l border-slate-200" />
              </div>

              {/* Kart Detay Alanı (4 Bilgi Bloğu) */}
              <div className="p-6 bg-white grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Tarih
                  </span>
                  <p className="text-xs sm:text-sm font-bold text-slate-800 font-mono">
                    {aktifRandevu.randevu_tarihi}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Tahmini Saat
                  </span>
                  <p className="text-xs sm:text-sm font-bold text-slate-800 font-mono">
                    {aktifRandevu.randevu_saati}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <User className="w-3 h-3" /> Sürücü
                  </span>
                  <p className="text-xs sm:text-sm font-bold text-slate-800 truncate">
                    {aktifRandevu.sofor_ad_soyad}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Phone className="w-3 h-3" /> Telefon
                  </span>
                  <p className="text-xs sm:text-sm font-bold text-slate-800 font-mono">
                    {aktifRandevu.sofor_telefon}
                  </p>
                </div>
              </div>

              {/* Rampa Ataması & Çağrı Durumu Şeridi */}
              {aktifRandevu.atanan_rampa_adi && (
                <div className="mx-6 mb-4 p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold shadow-2xs">
                      <Radio className="w-4 h-4 animate-pulse" />
                    </div>
                    <div>
                      <span className="text-[10px] text-amber-800 uppercase font-sans font-bold block leading-tight">
                        Atanan Peron / Rampa
                      </span>
                      <span className="font-extrabold text-amber-950 text-sm tracking-wide">
                        {aktifRandevu.atanan_rampa_adi}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      aktifRandevu.cagri_durumu === 'CAGRILDI'
                        ? 'bg-amber-200 text-amber-900 border border-amber-300 animate-pulse'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {aktifRandevu.cagri_durumu === 'CAGRILDI' ? '🚨 Çağrıldı (Perona İlerleyin)' : '✓ Perondasınız'}
                    </span>
                  </div>
                </div>
              )}

              {/* Alt Butonlar ve Barkod Alanı */}
              <div className="p-5 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {qrVerisi ? (
                    <img 
                      src={qrVerisi} 
                      alt="Mini QR" 
                      className="w-12 h-12 rounded-xl bg-white border border-slate-200 p-1 shadow-2xs cursor-pointer hover:scale-105 transition"
                      onClick={() => setDetayModalAcik(true)}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                      <QrCode className="w-6 h-6" />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900 block leading-none">
                        İnsansız Kiosk QR Kodu
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-100 text-purple-700">
                        {aktifRandevu.qr_kod || 'QR-AKTIF'}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 mt-0.5 block">
                      {aktifRandevu.irsaliye_durumu === 'IMZALANDI'
                        ? `✓ Sevk İrsaliyesi Onaylı (${aktifRandevu.irsaliye_no}) • Varışta Kioska Okutunuz`
                        : aktifRandevu.irsaliye_durumu === 'DUZENLENDI'
                        ? '⚠️ Sevk İrsaliyeniz Düzenlendi • e-İmza Bekleniyor'
                        : '✓ İnsansız Kapı Giriş İzni Aktif • Kapı Kioska Okutunuz'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                  {aktifRandevu.irsaliye_durumu === 'DUZENLENDI' && (
                    <button
                      type="button"
                      onClick={() => setIrsaliyeModalAcik(true)}
                      className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <PenTool className="w-3.5 h-3.5 text-blue-200" />
                      <span>İrsaliyeyi İmzala</span>
                    </button>
                  )}
                  {aktifRandevu.irsaliye_durumu === 'IMZALANDI' && (
                    <button
                      type="button"
                      onClick={() => setIrsaliyeGoruntuleModalAcik(true)}
                      className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <FileText className="w-3.5 h-3.5 text-emerald-200" />
                      <span>İrsaliyeyi Gör</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setDetayModalAcik(true)}
                    className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <QrCode className="w-3.5 h-3.5 text-amber-400" />
                    <span>QR Kodu Göster</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRandevuIptal}
                    className="flex-1 sm:flex-none px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold transition cursor-pointer"
                  >
                    İptal Et
                  </button>
                </div>
              </div>

            </div>

            {/* Hatırlatma Bilgi Notu */}
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200/80 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800">
                <strong>Zamanında Giriş:</strong> Randevu saatinizden 30 dakika önce varış terminalinde olmanız rampa atanması için kritik önem taşır.
              </div>
            </div>

          </div>
        )}

      </main>

      {/* ================= DETAYLAR & QR MODALI ================= */}
      {detayModalAcik && aktifRandevu && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl border border-slate-200 relative animate-fade-in text-center">
            
            <button
              onClick={() => setDetayModalAcik(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Canlı QR Kod Alanı */}
            <div className="mb-4">
              {qrVerisi ? (
                <div className="p-3 bg-white rounded-2xl border-2 border-slate-900/15 inline-block shadow-md">
                  <img src={qrVerisi} alt="Kapı Geçiş QR Kodu" className="w-52 h-52 mx-auto rounded-xl" />
                </div>
              ) : (
                <div className="w-48 h-48 rounded-2xl bg-slate-900 text-white flex items-center justify-center mx-auto mb-2 shadow-sm">
                  <QrCode className="w-16 h-16 animate-pulse" />
                </div>
              )}
            </div>

            {/* Kapı Geçiş Referans Kodu */}
            <div className="mb-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                İnsansız Kapı Geçiş Kodu
              </span>
              <div className="font-mono text-base font-black tracking-widest text-slate-900 bg-slate-100 py-1.5 px-3 rounded-xl border border-slate-200 inline-block shadow-2xs">
                {aktifRandevu.qr_kod || `QR-${aktifRandevu.plaka}`}
              </div>
            </div>

            {/* Sevk Evrakı Durumu */}
            <div className="mb-4 text-xs">
              {aktifRandevu.irsaliye_durumu === 'IMZALANDI' ? (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Sevk İrsaliyesi e-İmzalı ({aktifRandevu.irsaliye_no})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDetayModalAcik(false);
                      setIrsaliyeGoruntuleModalAcik(true);
                    }}
                    className="text-[11px] underline font-bold text-emerald-900 hover:text-emerald-700 cursor-pointer"
                  >
                    Görüntüle
                  </button>
                </div>
              ) : aktifRandevu.irsaliye_durumu === 'DUZENLENDI' ? (
                <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-[11px] font-medium text-left flex items-center justify-between">
                  <span>📋 İrsaliyeniz hazır, imzanızı bekliyor.</span>
                  <button
                    type="button"
                    onClick={() => {
                      setDetayModalAcik(false);
                      setIrsaliyeModalAcik(true);
                    }}
                    className="underline font-bold text-blue-800 cursor-pointer"
                  >
                    İmzala
                  </button>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-[11px] font-medium text-left">
                  ℹ️ <strong>İnsansız Kapı Geçişi:</strong> Giriş için evrak zorunluluğu yoktur. Rampa yüklemeniz tamamlandığında sevk irsaliyeniz düzenlenecektir.
                </div>
              )}
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 text-left text-xs space-y-2 border border-slate-100 mb-5 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Plaka:</span>
                <span className="font-bold text-slate-900">{aktifRandevu.plaka}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Rota:</span>
                <span className="font-bold text-slate-900">{aktifRandevu.kalkis_sehri} → {aktifRandevu.varis_sehri}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Randevu Saati:</span>
                <span className="font-bold text-slate-900">{aktifRandevu.randevu_tarihi} {aktifRandevu.randevu_saati}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Durum:</span>
                <span className="font-bold text-emerald-600">{aktifRandevu.durum}</span>
              </div>
            </div>

            <div className="space-y-2">
              {qrVerisi && (
                <a
                  href={qrVerisi}
                  download={`Kapi_QR_${aktifRandevu.plaka}.png`}
                  className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>QR Kodu Telefona İndir</span>
                </a>
              )}
              <button
                type="button"
                onClick={() => setDetayModalAcik(false)}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer"
              >
                Pencereyi Kapat
              </button>
              <button
                type="button"
                onClick={handleRandevuIptal}
                className="w-full py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold transition cursor-pointer"
              >
                Randevuyu İptal Et
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ================= RESMİ DİJİTAL SEVK İRSALİYESİ & E-İMZA MODALI ================= */}
      {irsaliyeModalAcik && aktifRandevu && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in duration-200">
            
            {/* Resmi Antetli Başlık */}
            <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/30">
                  <PenTool className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-mono tracking-widest text-blue-400 uppercase block font-bold">
                    Resmi e-İrsaliye Onay Belgesi
                  </span>
                  <h3 className="text-sm sm:text-base font-extrabold text-white">
                    Dijital Sevk İrsaliyesi İnceleme & e-İmza
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIrsaliyeModalAcik(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* İrsaliye Gövdesi - Resmi Belge Görünümü */}
            <div className="p-4 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              
              {/* Belge Anteti */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/70 space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Logo className="h-6 w-auto" />
                    <span className="text-xs font-bold text-slate-800 tracking-tight">LOS • Lojistik OS</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">İrsaliye Belge No</span>
                    <span className="font-mono font-extrabold text-blue-700 text-xs sm:text-sm bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {aktifRandevu.irsaliye_no || 'LOS-IRS-2024-001'}
                    </span>
                  </div>
                </div>

                {/* Sefer & Sevkiyat Çizelgesi */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Çıkış Limanı / Depo</span>
                    <span className="font-bold text-slate-900">{aktifRandevu.kalkis_sehri} Terminali</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Hedef / Varış Terminali</span>
                    <span className="font-bold text-emerald-700">{aktifRandevu.varis_sehri} Terminali</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Taşıyıcı Plaka & Dorse</span>
                    <span className="font-mono font-bold text-slate-900">{aktifRandevu.plaka}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Sürücü İsim & İletişim</span>
                    <span className="font-bold text-slate-900">{aktifRandevu.sofor_ad_soyad}</span>
                  </div>
                </div>

                {/* Yük ve Emtia Detayları */}
                <div className="pt-3 border-t border-slate-200 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-white p-2 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Yük Cinsi</span>
                    <span className="font-bold text-slate-900 truncate block text-[11px] sm:text-xs">
                      {aktifRandevu.yuk_cinsi || 'Muhtelif Emtia'}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Net Ağırlık</span>
                    <span className="font-mono font-bold text-slate-900 block text-[11px] sm:text-xs">
                      {aktifRandevu.tonaj_kg ? `${aktifRandevu.tonaj_kg} KG` : '21.400 KG'}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Dorse Mühür No</span>
                    <span className="font-mono font-bold text-blue-700 block text-[11px] sm:text-xs">
                      {aktifRandevu.muhur_no || 'MHR-99420'}
                    </span>
                  </div>
                </div>
              </div>

              {/* DOKUNMATİK VE FARE İMZA PEDİ */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                    <PenTool className="w-3.5 h-3.5 text-blue-600" />
                    <span>Sürücü Islak / e-İmza Alanı</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleImzaTemizle}
                    className="text-[11px] font-bold text-red-600 hover:text-red-700 underline cursor-pointer"
                  >
                    İmzayı Temizle
                  </button>
                </div>

                <div className="border-2 border-dashed border-slate-300 hover:border-slate-400 rounded-2xl bg-slate-50 relative overflow-hidden touch-none select-none">
                  <canvas
                    ref={canvasRef}
                    width={480}
                    height={160}
                    className="w-full h-36 bg-white cursor-crosshair"
                    onMouseDown={handleCizimBasla}
                    onMouseMove={handleCizimYap}
                    onMouseUp={handleCizimBitir}
                    onMouseLeave={handleCizimBitir}
                    onTouchStart={handleCizimBasla}
                    onTouchMove={handleCizimYap}
                    onTouchEnd={handleCizimBitir}
                  />

                  {!imzaAtildi && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-300 text-xs font-semibold gap-1.5">
                      <PenTool className="w-4 h-4 opacity-40" />
                      <span>Buraya parmağınızla veya fareyle imzanızı atınız</span>
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 text-center">
                  Dokunmatik ekranlı telefon veya tabletlerden parmakla imza desteklenir.
                </p>
              </div>

              {/* Yasal Beyan Onay Kutusu */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-50/60 border border-blue-200/60 text-xs text-blue-950 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sozlesmeKabul}
                  onChange={(e) => setSozlesmeKabul(e.target.checked)}
                  className="mt-0.5 rounded border-blue-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="leading-relaxed">
                  Yukarıda kayıtlı sevk irsaliyesi bilgilerini, mühür numarasını ve net yük tonajını eksiksiz teslim aldığımı; <strong>{aktifRandevu.varis_sehri}</strong> varış terminaline sevk edeceğimi beyan ve taahhüt ederim.
                </span>
              </label>

              {/* Aksiyon Butonları */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIrsaliyeModalAcik(false)}
                  className="w-1/3 py-3 px-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
                >
                  Kapat
                </button>

                <button
                  type="button"
                  disabled={!imzaAtildi || imzaGonderiliyor || !sozlesmeKabul}
                  onClick={handleIrsaliyeImzala}
                  className="w-2/3 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {imzaGonderiliyor ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                      <span>İmzala & Yola Çıkış İznini Al</span>
                    </>
                  )}
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* ================= RESMİ DİJİTAL SEVK İRSALİYESİ GÖRÜNTÜLEME MODALI ================= */}
      {irsaliyeGoruntuleModalAcik && aktifRandevu && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in duration-200">
            
            {/* Üst Bar */}
            <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Logo className="h-6 w-auto" />
                <span className="text-xs font-bold font-mono tracking-wider text-slate-300">
                  RESMİ ELEKTRONİK SEVK İRSALİYESİ (e-PoD)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIrsaliyeGoruntuleModalAcik(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Belge İçeriği */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              
              <div className="border-2 border-slate-900 rounded-2xl p-5 space-y-4 bg-white relative">
                
                {/* Onay Damgası */}
                <div className="absolute right-5 top-5 border-2 border-emerald-600 text-emerald-700 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest rotate-6 pointer-events-none">
                  ✓ e-İMZALI & ONAYLI
                </div>

                <div className="space-y-1">
                  <h2 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight">
                    T.C. ULAŞTIRMA VE ALTYAPI BAKANLIĞI STANDARTLARINDA
                  </h2>
                  <h3 className="text-xs font-bold text-slate-600 uppercase">
                    ELEKTRONİK TAŞIMA & SEVK İRSALİYESİ BELGESİ
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs pt-3 border-t border-slate-200">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">İrsaliye Belge No</span>
                    <span className="font-mono font-extrabold text-slate-900 text-sm">
                      {aktifRandevu.irsaliye_no || 'LOS-IRS-2024'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Tarih / Saat</span>
                    <span className="font-mono text-slate-800">
                      {aktifRandevu.irsaliye_tarihi 
                        ? new Date(aktifRandevu.irsaliye_tarihi).toLocaleString('tr-TR')
                        : new Date().toLocaleString('tr-TR')}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs pt-3 border-t border-slate-200">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Çıkış Noktası</span>
                    <span className="font-bold text-slate-900">{aktifRandevu.kalkis_sehri} Terminali</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Varış Noktası</span>
                    <span className="font-bold text-emerald-700">{aktifRandevu.varis_sehri} Terminali</span>
                  </div>
                </div>

                {/* Yük Bilgileri */}
                <div className="pt-3 border-t border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Taşıyıcı Araç:</span>
                    <span className="font-mono font-bold text-slate-900">{aktifRandevu.plaka}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Sürücü Ad Soyad:</span>
                    <span className="font-bold text-slate-900">{aktifRandevu.sofor_ad_soyad}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Emtia / Yük Cinsi:</span>
                    <span className="font-bold text-slate-900">{aktifRandevu.yuk_cinsi || 'Genel Sanayi Ürünleri'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Net Ağırlık / Tonaj:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {aktifRandevu.tonaj_kg ? `${aktifRandevu.tonaj_kg} KG (${(Number(aktifRandevu.tonaj_kg)/1000).toFixed(2)} Ton)` : '21.400 KG'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Palet / Koli Adedi:</span>
                    <span className="font-mono font-bold text-slate-900">{aktifRandevu.palet_sayisi || 32} Palet</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Dorse Güvenlik Mühür No:</span>
                    <span className="font-mono font-bold text-blue-700">{aktifRandevu.muhur_no || 'MHR-88421'}</span>
                  </div>
                </div>

                {/* Alt İmza Alanı */}
                <div className="pt-4 border-t-2 border-slate-900 flex items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase mb-1">
                      Sürücü e-İmza Teyidi
                    </span>
                    {aktifRandevu.sofor_imzasi ? (
                      <img 
                        src={aktifRandevu.sofor_imzasi} 
                        alt="Sürücü İmzası" 
                        className="h-14 w-auto max-w-[180px] border border-slate-200 rounded-lg p-1 bg-white shadow-2xs"
                      />
                    ) : (
                      <span className="text-xs font-mono font-bold text-slate-700 italic">
                        {aktifRandevu.sofor_ad_soyad} (Dijital İmzalı)
                      </span>
                    )}
                  </div>

                  {qrVerisi && (
                    <div className="text-center">
                      <img 
                        src={qrVerisi} 
                        alt="İrsaliye Doğrulama QR" 
                        className="w-16 h-16 mx-auto rounded-lg border border-slate-200 p-0.5"
                      />
                      <span className="text-[9px] font-mono text-slate-400 block mt-0.5">Kiosk Giriş Karekodu</span>
                    </div>
                  )}
                </div>

              </div>

              {/* Alt Butonlar */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-slate-500" />
                  <span>Yazdır / PDF Olarak Kaydet</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIrsaliyeGoruntuleModalAcik(false)}
                  className="flex-1 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer"
                >
                  Pencereyi Kapat
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* ================= BİLDİRİMLER & RAMPA ÇAĞRI MODALI ================= */}
      {bildirimModalAcik && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-200 relative animate-fade-in flex flex-col max-h-[85vh]">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">
                    Sürücü Bildirim ve Çağrı Merkezi
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Terminal operatörünün ilettiği anlık rampa mesajları
                  </span>
                </div>
              </div>

              <button
                onClick={() => setBildirimModalAcik(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Bildirim Listesi */}
            <div className="flex-1 overflow-y-auto py-3 space-y-2.5 pr-1">
              {bildirimler.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <Inbox className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-xs font-semibold">Henüz yeni bir bildiriminiz yok.</p>
                  <p className="text-[11px] text-slate-400">Operatör rampa atadığında veya sevk işlemi yaptığında burada belirecektir.</p>
                </div>
              ) : (
                bildirimler.map((b) => (
                  <div
                    key={b.id}
                    className={`p-3.5 rounded-2xl border transition-all text-xs space-y-1.5 ${
                      b.tip === 'RAMPA_CAGRISI'
                        ? 'bg-amber-50/90 border-amber-200 text-amber-950'
                        : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-bold flex items-center gap-1.5 ${
                        b.tip === 'RAMPA_CAGRISI' ? 'text-amber-900' : 'text-slate-900'
                      }`}>
                        {b.tip === 'RAMPA_CAGRISI' && <Radio className="w-3.5 h-3.5 text-amber-600 animate-pulse" />}
                        {b.baslik}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(b.olusturulma_tarihi).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="text-[11px] leading-relaxed text-slate-700">
                      {b.mesaj}
                    </p>

                    {b.rampa_adi && (
                      <div className="flex items-center justify-between pt-1 font-mono text-[10px]">
                        <span className="bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-800 font-bold">
                          {b.rampa_adi}
                        </span>
                        <span className="text-slate-500 font-sans">
                          İşlem: {b.operasyon_tipi === 'YUKLEME' ? 'Yükleme' : 'Yük Boşaltma'}
                        </span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Alt Kapat */}
            <div className="pt-3 border-t border-slate-100 flex gap-2">
              <button
                type="button"
                onClick={() => setBildirimModalAcik(false)}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer"
              >
                Tamam
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
