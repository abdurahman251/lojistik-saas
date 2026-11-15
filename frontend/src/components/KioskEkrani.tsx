import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { authFetch } from '../api';
import Logo from './Logo';
import { 
  Search,
  RotateCcw,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  MapPin,
  X,
  Keyboard,
  ArrowRight,
  Delete,
  Camera,
  QrCode,
  ShieldCheck,
  FileText,
  Check,
  Sparkles,
  Clock,
  Truck,
  Printer
} from 'lucide-react';

export interface KullaniciBilgisi {
  id: string;
  kullaniciAdi: string;
  rol: 'YONETICI' | 'OPERATOR' | 'KIOSK' | 'SURUCU';
  sehir: 'ISTANBUL' | 'ANKARA' | 'IZMIR' | 'YOK';
  plaka?: string | null;
}

interface AracRandevusu {
  id: string;
  tir_id: string;
  plaka: string;
  kalkis_sehri: string;
  varis_sehri: string;
  randevu_tarihi: string;
  randevu_saati: string;
  sofor_ad_soyad: string;
  sofor_telefon?: string;
  durum: string;
  evrak_yolu?: string | null;
  evrak_adi?: string | null;
  evrak_durumu?: string | null;
  qr_kod?: string | null;
  giris_turu?: string | null;
  irsaliye_no?: string | null;
  yuk_cinsi?: string | null;
  tonaj_kg?: number | null;
  palet_sayisi?: number | null;
  muhur_no?: string | null;
  sofor_imzasi?: string | null;
  irsaliye_durumu?: string | null;
  irsaliye_tarihi?: string | null;
}

interface GeriBildirim {
  tip: 'VAKTINDE' | 'GECIKMELI' | 'HATA';
  baslik: string;
  mesaj: string;
  asama?: 'KALKIS' | 'VARIS';
  gecikmeDakika?: number;
  randevu?: any;
}

interface KioskEkraniProps {
  kullanici: KullaniciBilgisi;
  onCikis: () => void;
}

export default function KioskEkrani({ kullanici, onCikis }: KioskEkraniProps) {
  const kioskSehir = (kullanici.sehir === 'YOK' || !kullanici.sehir) ? 'ISTANBUL' : kullanici.sehir;

  const sehirIsimleri: Record<string, string> = {
    ISTANBUL: 'İstanbul Terminali',
    ANKARA: 'Ankara Lojistik Üssü',
    IZMIR: 'İzmir Liman Kapısı',
  };
  const sehirGosterim = sehirIsimleri[kioskSehir] || `${kioskSehir} Kapısı`;

  // Durumlar
  const [plakaGirdisi, setPlakaGirdisi] = useState('');
  const [saatMetni, setSaatMetni] = useState('');
  const [klavyeAcik, setKlavyeAcik] = useState(false);
  const [aktifSekme, setAktifSekme] = useState<'kalkis' | 'yaklasan'>('kalkis');
  
  const [kalkisYapacaklar, setKalkisYapacaklar] = useState<AracRandevusu[]>([]);
  const [yaklasanAraclar, setYaklasanAraclar] = useState<AracRandevusu[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [sorgulaniyor, setSorgulaniyor] = useState(false);
  const [geriBildirim, setGeriBildirim] = useState<GeriBildirim | null>(null);

  // İnsansız Kapı QR Okuyucu State'leri
  const [qrModalAcik, setQrModalAcik] = useState(false);
  const [kameraAktif, setKameraAktif] = useState(false);
  const [manuelQrGirdisi, setManuelQrGirdisi] = useState('');
  const [qrTaranıyor, setQrTaranıyor] = useState(false);
  const [qrSonuc, setQrSonuc] = useState<any | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Görevli İrsaliye İnceleme Modalı State
  const [evrakModalArac, setEvrakModalArac] = useState<AracRandevusu | null>(null);
  const [modalQrVerisi, setModalQrVerisi] = useState<string>('');

  // İrsaliye Modalı Açıldığında Karekod Üret
  useEffect(() => {
    if (evrakModalArac) {
      const qrMetin = evrakModalArac.qr_kod || `QR-${evrakModalArac.plaka.replace(/\s+/g, '')}`;
      QRCode.toDataURL(qrMetin, { width: 140, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } })
        .then((url) => setModalQrVerisi(url))
        .catch(() => setModalQrVerisi(''));
    } else {
      setModalQrVerisi('');
    }
  }, [evrakModalArac]);

  const inputRef = useRef<HTMLInputElement>(null);

  // Kamera Başlat / Kapat
  const kameraBaslat = async () => {
    try {
      setKameraAktif(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setKameraAktif(false);
    }
  };

  const kameraDurdur = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setKameraAktif(false);
  };

  const handleQrModalKapat = () => {
    kameraDurdur();
    setQrModalAcik(false);
    setQrSonuc(null);
    setManuelQrGirdisi('');
  };

  const handleQrOku = async (kod: string) => {
    if (!kod.trim()) return;
    setQrTaranıyor(true);
    setQrSonuc(null);
    try {
      const res = await authFetch('/api/kiosk/qr-oku', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrKod: kod.trim(),
          kioskSehir,
        }),
      });
      const data = await res.json();
      setQrSonuc(data);
      if (data.basarili) {
        araclariGetir();
      }
    } catch {
      setQrSonuc({
        basarili: false,
        durumTipi: 'HATA',
        mesaj: 'Kiosk QR servisiyle bağlantı kurulamadı.',
      });
    } finally {
      setQrTaranıyor(false);
    }
  };

  // Canlı Saat
  useEffect(() => {
    const saatGuncelle = () => {
      const simdi = new Date();
      const saat = simdi.getHours().toString().padStart(2, '0');
      const dakika = simdi.getMinutes().toString().padStart(2, '0');
      const saniye = simdi.getSeconds().toString().padStart(2, '0');
      setSaatMetni(`${saat}:${dakika}:${saniye}`);
    };

    saatGuncelle();
    const zamanlayici = setInterval(saatGuncelle, 1000);
    return () => clearInterval(zamanlayici);
  }, []);

  // Araç Listesini Çek
  const araclariGetir = async () => {
    try {
      setYukleniyor(true);
      const res = await authFetch(`/api/kiosk/arac-listesi?sehir=${kioskSehir}`);
      const data = await res.json();
      if (data.basarili) {
        setKalkisYapacaklar(data.kalkisYapacaklar || []);
        setYaklasanAraclar(data.yaklasanAraclar || []);

        if (data.kalkisYapacaklar.length === 0 && data.yaklasanAraclar.length > 0) {
          setAktifSekme('yaklasan');
        }
      }
    } catch (err) {
      console.error('Kiosk araç listesi hatası:', err);
    } finally {
      setYukleniyor(false);
    }
  };

  useEffect(() => {
    araclariGetir();
    const periyodik = setInterval(araclariGetir, 8000);
    return () => clearInterval(periyodik);
  }, [kioskSehir]);

  // Sanal Klavye Tuşları
  const tuslarRakam = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
  const tuslarHarf1 = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'];
  const tuslarHarf2 = ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'];
  const tuslarHarf3 = ['Z', 'X', 'C', 'V', 'B', 'N', 'M'];

  const handleTusTikla = (harf: string) => {
    if (plakaGirdisi.length < 12) {
      setPlakaGirdisi((onceki) => onceki + harf);
    }
  };

  const handleSil = () => {
    setPlakaGirdisi((onceki) => onceki.slice(0, -1));
  };

  // Doğrulama & Onay
  const handleSorgulaVeOnayla = async (hedefPlaka?: string) => {
    const sorgulanacakPlaka = (hedefPlaka || plakaGirdisi).trim();

    if (!sorgulanacakPlaka) {
      setGeriBildirim({
        tip: 'HATA',
        baslik: 'Plaka Girilmedi',
        mesaj: 'Lütfen araç plakasını yazın veya listeden bir araç seçin.',
      });
      return;
    }

    setSorgulaniyor(true);
    try {
      const res = await authFetch('/api/kiosk/giris-kontrol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plaka: sorgulanacakPlaka,
          kioskSehir,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.basarili) {
        setGeriBildirim({
          tip: 'HATA',
          baslik: 'Geçiş Onaylanmadı',
          mesaj: data.mesaj || 'Bu araç için geçerli randevu kaydı bulunamadı.',
        });
        return;
      }

      if (data.durumTipi === 'GECIKMELI') {
        setGeriBildirim({
          tip: 'GECIKMELI',
          baslik: data.asama === 'KALKIS' ? 'Gecikmeli Çıkış Onaylandı' : 'Gecikmeli Giriş Onaylandı',
          mesaj: data.mesaj,
          asama: data.asama,
          gecikmeDakika: data.gecikmeDakika,
          randevu: data.randevu,
        });
      } else {
        setGeriBildirim({
          tip: 'VAKTINDE',
          baslik: data.asama === 'KALKIS' ? 'Kalkış Onaylandı • İyi Yolculuklar' : 'Liman Girişi Onaylandı',
          mesaj: data.mesaj,
          asama: data.asama,
          randevu: data.randevu,
        });
      }

      setPlakaGirdisi('');
      araclariGetir();
    } catch (err: any) {
      setGeriBildirim({
        tip: 'HATA',
        baslik: 'Bağlantı Hatası',
        mesaj: 'Terminal sunucusuna ulaşılamadı.',
      });
    } finally {
      setSorgulaniyor(false);
    }
  };

  const aktifListe = aktifSekme === 'kalkis' ? kalkisYapacaklar : yaklasanAraclar;
  const toplamBekleyen = kalkisYapacaklar.length + yaklasanAraclar.length;

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col justify-between text-slate-900 antialiased selection:bg-slate-200">
      
      {/* ================= ÜST SADE NAVBAR ================= */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          
          <div className="flex items-center gap-3">
            <Logo variant="icon" size="sm" className="w-8 h-8 rounded-lg overflow-hidden shrink-0" />
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-none">
                {sehirGosterim}
              </h1>
              <span className="text-[11px] text-slate-400 mt-0.5 inline-flex items-center gap-1 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Bariyer Kapı Otomasyonu</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Saat</span>
              <span className="text-sm font-bold font-mono text-slate-800">{saatMetni || '12:00:00'}</span>
            </div>

            <div className="h-6 w-px bg-slate-200" />

            <button
              onClick={onCikis}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Çıkış</span>
            </button>
          </div>

        </div>
      </header>

      {/* ================= ANA KONTROL ALANI ================= */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8 flex flex-col justify-center">
        
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6 animate-fade-in">
          
          {/* Başlık */}
          <div className="text-center space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Bariyer Geçiş Doğrulama
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Araç plakasını yazarak veya aşağıdaki listeden seçerek geçişi onaylayın.
            </p>
          </div>

          {/* İki Farklı Geçiş Modu Seçeneği */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setQrModalAcik(true);
                kameraBaslat();
              }}
              className="flex items-center justify-center gap-2.5 p-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs shadow-sm hover:shadow transition group cursor-pointer text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center group-hover:scale-105 transition shrink-0">
                <Camera className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold leading-tight flex items-center gap-1.5">
                  <span>İnsansız Kapı QR Okuyucu</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping" />
                </div>
                <div className="text-[10px] text-emerald-100 font-normal">Kamera / Hızlı QR ile Otomatik Geçiş</div>
              </div>
            </button>

            <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700">
              <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="text-left min-w-0">
                <div className="text-xs font-bold leading-tight text-slate-800">Görevli & Plaka Doğrulama</div>
                <div className="text-[10px] text-slate-500 font-normal truncate">Manuel plaka girişi veya evrak denetimi</div>
              </div>
            </div>
          </div>

          {/* PLAKA GİRİŞ ALANI (TÜRKİYE PLAKA GÖRÜNÜMÜ) */}
          <div className="space-y-2">
            <div className="relative border-2 border-slate-200 rounded-xl flex items-stretch h-14 sm:h-16 bg-white overflow-hidden focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-900/10 transition-all duration-200">
              {/* TR Bandı */}
              <div className="bg-slate-900 text-white w-10 sm:w-12 flex flex-col items-center justify-center font-bold text-xs select-none shrink-0 tracking-tight">
                <span>TR</span>
              </div>

              {/* Input */}
              <input
                ref={inputRef}
                type="text"
                value={plakaGirdisi}
                onChange={(e) => setPlakaGirdisi(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSorgulaVeOnayla();
                }}
                placeholder="34 ABC 123"
                autoFocus
                className="w-full text-center font-mono text-xl sm:text-2xl font-bold tracking-widest text-slate-900 placeholder:text-slate-300 placeholder:font-normal focus:outline-none uppercase bg-transparent px-3"
              />

              {/* Temizle Butonu */}
              {plakaGirdisi && (
                <button
                  type="button"
                  onClick={() => { setPlakaGirdisi(''); inputRef.current?.focus(); }}
                  className="px-3.5 text-slate-400 hover:text-slate-700 transition flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Sanal Klavye Aç/Kapa Butonu */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setKlavyeAcik(!klavyeAcik)}
                className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1.5 py-1 px-2 rounded-md hover:bg-slate-100 transition cursor-pointer font-medium"
              >
                <Keyboard className="w-3.5 h-3.5 text-slate-400" />
                <span>{klavyeAcik ? 'Dokunmatik Klavyeyi Gizle' : 'Dokunmatik Klavye'}</span>
              </button>
            </div>
          </div>

          {/* DOKUNMATİK SANAL KLAVYE (İsteğe bağlı açılır) */}
          {klavyeAcik && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5 animate-fade-in select-none">
              {/* Rakamlar */}
              <div className="grid grid-cols-10 gap-1">
                {tuslarRakam.map((tus) => (
                  <button
                    key={tus}
                    type="button"
                    onClick={() => handleTusTikla(tus)}
                    className="h-9 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 active:scale-95 text-xs sm:text-sm font-bold text-slate-800 transition cursor-pointer shadow-2xs"
                  >
                    {tus}
                  </button>
                ))}
              </div>

              {/* Harfler Satır 1 */}
              <div className="grid grid-cols-10 gap-1">
                {tuslarHarf1.map((tus) => (
                  <button
                    key={tus}
                    type="button"
                    onClick={() => handleTusTikla(tus)}
                    className="h-9 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 active:scale-95 text-xs sm:text-sm font-bold text-slate-800 transition cursor-pointer shadow-2xs"
                  >
                    {tus}
                  </button>
                ))}
              </div>

              {/* Harfler Satır 2 */}
              <div className="grid grid-cols-9 gap-1 px-2">
                {tuslarHarf2.map((tus) => (
                  <button
                    key={tus}
                    type="button"
                    onClick={() => handleTusTikla(tus)}
                    className="h-9 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 active:scale-95 text-xs sm:text-sm font-bold text-slate-800 transition cursor-pointer shadow-2xs"
                  >
                    {tus}
                  </button>
                ))}
              </div>

              {/* Harfler Satır 3 + Sil */}
              <div className="grid grid-cols-10 gap-1">
                <div className="col-span-1" />
                {tuslarHarf3.map((tus) => (
                  <button
                    key={tus}
                    type="button"
                    onClick={() => handleTusTikla(tus)}
                    className="h-9 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 active:scale-95 text-xs sm:text-sm font-bold text-slate-800 transition cursor-pointer shadow-2xs"
                  >
                    {tus}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleSil}
                  className="col-span-2 h-9 rounded-lg bg-slate-200 hover:bg-slate-300 active:scale-95 text-xs font-bold text-slate-700 transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Delete className="w-3.5 h-3.5" />
                  <span>Sil</span>
                </button>
              </div>
            </div>
          )}

          {/* ONAY BUTONU */}
          <button
            type="button"
            disabled={sorgulaniyor}
            onClick={() => handleSorgulaVeOnayla()}
            className="w-full py-3.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white font-bold text-sm shadow-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {sorgulaniyor ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Bariyer Geçişini Doğrula ve Aç</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </>
            )}
          </button>

          {/* ================= KUYRUKTAKİ ARAÇLAR (HIZLI SEÇİM) ================= */}
          <div className="pt-5 border-t border-slate-100 space-y-3">
            
            {/* Sekme Geçişi & Başlık */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200/60">
                <button
                  type="button"
                  onClick={() => setAktifSekme('kalkis')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                    aktifSekme === 'kalkis'
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Yükleme / Kalkış Girişi ({kalkisYapacaklar.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAktifSekme('yaklasan')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                    aktifSekme === 'yaklasan'
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Yaklaşan / Varış Araçları ({yaklasanAraclar.length})
                </button>
              </div>

              <button
                type="button"
                onClick={araclariGetir}
                title="Listeyi Yenile"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${yukleniyor ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Hızlı Seçim Listesi */}
            {aktifListe.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center text-xs text-slate-400">
                {aktifSekme === 'kalkis' 
                  ? 'Şu anda kalkış kapısında yükleme girişi için bekleyen araç yok.' 
                  : 'Şu anda terminalinize yaklaşmakta olan veya boşaltma bekleyen araç yok.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {aktifListe.map((arac) => {
                  const secili = plakaGirdisi === arac.plaka.replace(/\s+/g, '');
                  return (
                    <div
                      key={arac.id}
                      className={`p-3 rounded-xl border text-left transition flex flex-col justify-between gap-2.5 ${
                        secili
                          ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-mono font-bold text-sm tracking-wide flex items-center gap-1.5 flex-wrap">
                            <span>{arac.plaka}</span>
                            {arac.qr_kod && (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                                secili ? 'bg-white/20 text-slate-200' : 'bg-slate-100 text-slate-500'
                              }`}>
                                QR
                              </span>
                            )}
                          </div>
                          <div className={`text-[11px] flex items-center gap-1 mt-0.5 ${secili ? 'text-slate-300' : 'text-slate-500'}`}>
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate">{arac.kalkis_sehri} → {arac.varis_sehri}</span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                            secili ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {arac.randevu_saati}
                          </span>
                        </div>
                      </div>

                      {/* Sevk İrsaliyesi & Evrak Durumu */}
                      <div className="pt-2 border-t border-slate-100/30 flex items-center justify-between gap-1 text-[11px]">
                        {arac.irsaliye_durumu === 'IMZALANDI' ? (
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>İmzalı İrsaliye</span>
                            </span>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEvrakModalArac(arac);
                              }}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition cursor-pointer ${
                                secili ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                              }`}
                              title="Resmi İrsaliyeyi Görüntüle"
                            >
                              <FileText className="w-3 h-3 text-blue-500" />
                              <span>İncele</span>
                            </button>
                          </div>
                        ) : arac.durum === 'YOLDA' ? (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 ${
                            secili ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            <Clock className="w-3 h-3 text-amber-500" />
                            <span>İmza Bekliyor</span>
                          </span>
                        ) : (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 ${
                            secili ? 'bg-blue-500/20 text-blue-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}>
                            <Truck className="w-3 h-3 text-blue-500" />
                            <span>Yük Alma Girişi</span>
                          </span>
                        )}

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setPlakaGirdisi(arac.plaka.replace(/\s+/g, ''))}
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer ${
                              secili ? 'bg-white text-slate-900' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            Seç
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setManuelQrGirdisi(arac.qr_kod || arac.plaka);
                              setQrModalAcik(true);
                              handleQrOku(arac.qr_kod || arac.plaka);
                            }}
                            className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 shadow-2xs transition cursor-pointer"
                            title="QR İle Doğrula"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>QR Geç</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>

        </div>

      </main>

      {/* ================= ALT BİLGİ ================= */}
      <footer className="text-center py-4 text-xs text-slate-400">
        <span>Lojistik OS • Kiosk Terminali • Toplam {toplamBekleyen} Kayıt</span>
      </footer>

      {/* ================= GERİ BİLDİRİM / ANINDA DOĞRULAMA MODALI ================= */}
      {geriBildirim && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-7 max-w-sm w-full shadow-xl border border-slate-200 text-center relative animate-fade-in">
            
            <button
              onClick={() => setGeriBildirim(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* İkon */}
            {geriBildirim.tip === 'VAKTINDE' && (
              <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3.5 border border-emerald-100">
                <CheckCircle2 className="w-7 h-7 stroke-[2.2]" />
              </div>
            )}

            {geriBildirim.tip === 'GECIKMELI' && (
              <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-3.5 border border-amber-100">
                <AlertTriangle className="w-7 h-7 stroke-[2.2]" />
              </div>
            )}

            {geriBildirim.tip === 'HATA' && (
              <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-3.5 border border-red-100">
                <XCircle className="w-7 h-7 stroke-[2.2]" />
              </div>
            )}

            {/* Başlık */}
            <h3 className={`text-base sm:text-lg font-bold tracking-tight mb-1.5 ${
              geriBildirim.tip === 'VAKTINDE' ? 'text-emerald-700' :
              geriBildirim.tip === 'GECIKMELI' ? 'text-amber-700' : 'text-red-700'
            }`}>
              {geriBildirim.baslik}
            </h3>

            <p className="text-xs text-slate-600 leading-relaxed mb-5">
              {geriBildirim.mesaj}
            </p>

            {/* Sefer Özeti */}
            {geriBildirim.randevu && (
              <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-1.5 text-left border border-slate-100 mb-5 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">Plaka:</span>
                  <span className="font-bold text-slate-900">{geriBildirim.randevu.plaka}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">Rota:</span>
                  <span className="font-semibold text-slate-800">{geriBildirim.randevu.kalkis_sehri} → {geriBildirim.randevu.varis_sehri}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">İşlem:</span>
                  <span className="font-bold text-slate-900">
                    {geriBildirim.asama === 'KALKIS' ? 'Kalkış Terminal Çıkışı' : 'Liman Girişi'}
                  </span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setGeriBildirim(null)}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer"
            >
              Tamam
            </button>

          </div>
        </div>
      )}

      {/* ================= İNSANSIZ KAPI QR OKUYUCU MODALI ================= */}
      {qrModalAcik && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-slate-900 text-white rounded-3xl max-w-lg w-full border border-slate-800 shadow-2xl p-6 sm:p-7 relative space-y-5 my-8">
            
            {/* Kapat Butonu */}
            <button
              onClick={handleQrModalKapat}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Başlık */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <span>İnsansız Kapı • QR Okuyucu</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </h3>
                <p className="text-xs text-slate-400">
                  Kamera karşısına sürücünün QR kodunu veya randevu barkodunu tutun.
                </p>
              </div>
            </div>

            {/* Kamera Görünümü (Viewfinder) */}
            <div className="relative rounded-2xl overflow-hidden bg-black border border-slate-800 h-56 sm:h-64 flex items-center justify-center group">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${kameraAktif ? 'block' : 'hidden'}`}
              />

              {/* Lazer Tarama Efekti */}
              {kameraAktif && (
                <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6">
                  <div className="w-full flex justify-between">
                    <div className="w-8 h-8 border-t-2 border-l-2 border-emerald-400 rounded-tl-lg" />
                    <div className="w-8 h-8 border-t-2 border-r-2 border-emerald-400 rounded-tr-lg" />
                  </div>

                  {/* Hareketli Lazer Çizgisi */}
                  <div className="w-full h-0.5 bg-emerald-400 shadow-[0_0_12px_#34d399] animate-pulse" />

                  <div className="w-full flex justify-between">
                    <div className="w-8 h-8 border-b-2 border-l-2 border-emerald-400 rounded-bl-lg" />
                    <div className="w-8 h-8 border-b-2 border-r-2 border-emerald-400 rounded-br-lg" />
                  </div>
                </div>
              )}

              {!kameraAktif && (
                <div className="text-center p-6 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800/80 text-slate-400 flex items-center justify-center mx-auto">
                    <Camera className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-300">Kamera Kapalı veya İzin Verilmedi</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Aşağıdan kamerayı başlatabilir veya manuel QR/Plaka girebilirsiniz.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={kameraBaslat}
                    className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition cursor-pointer"
                  >
                    Kamerayı Başlat
                  </button>
                </div>
              )}

              {/* Canlı Durum İndikatörü */}
              {kameraAktif && (
                <div className="absolute bottom-2 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md text-[10px] font-mono text-emerald-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>Kamera Aktif • QR Bekleniyor</span>
                </div>
              )}
            </div>

            {/* Manuel QR Girişi */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
                Manuel QR Kodu veya Plaka
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manuelQrGirdisi}
                  onChange={(e) => setManuelQrGirdisi(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleQrOku(manuelQrGirdisi);
                  }}
                  placeholder="Örn: QR-34IST01-... veya 34 IST 01"
                  className="flex-1 bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  disabled={qrTaranıyor || !manuelQrGirdisi.trim()}
                  onClick={() => handleQrOku(manuelQrGirdisi)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  {qrTaranıyor ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Search className="w-3.5 h-3.5" />
                      <span>Doğrula</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Hızlı Test Simülatörü (Kamerası Olmayan Cihazlar İçin) */}
            {toplamBekleyen > 0 && (
              <div className="pt-2 border-t border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-semibold flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    Hızlı Test Simülatörü:
                  </span>
                  <span>Bekleyen Araçlar ({toplamBekleyen})</span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                  {aktifListe.map((arac) => (
                    <button
                      key={arac.id}
                      type="button"
                      onClick={() => {
                        setManuelQrGirdisi(arac.qr_kod || arac.plaka);
                        handleQrOku(arac.qr_kod || arac.plaka);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-mono text-slate-200 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <span>{arac.plaka}</span>
                      <span className="text-[9px] text-emerald-400 font-sans">⚡ Okut</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Doğrulama Sonucu / Hata Kartı */}
            {qrSonuc && (
              <div
                className={`p-4 rounded-2xl border text-xs space-y-2 animate-fade-in ${
                  qrSonuc.basarili
                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                    : qrSonuc.durumTipi === 'EVRAK_EKSIK'
                    ? 'bg-red-950/70 border-red-500/50 text-red-200'
                    : 'bg-amber-950/60 border-amber-500/40 text-amber-200'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {qrSonuc.basarili ? (
                    <div className="w-7 h-7 rounded-lg bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0 font-bold">
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-lg bg-red-500 text-white flex items-center justify-center shrink-0">
                      <XCircle className="w-4 h-4" />
                    </div>
                  )}

                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="font-bold text-sm tracking-tight text-white flex items-center justify-between">
                      <span>
                        {qrSonuc.basarili
                          ? '✓ BARIYER AÇILIYOR • GEÇİŞ ONAYLANDI'
                          : qrSonuc.durumTipi === 'EVRAK_EKSIK'
                          ? '⛔ GEÇİŞ ENGELLENDİ: EKSİK EVRAK'
                          : 'UYARI: GEÇİŞ VERİLMEDİ'}
                      </span>
                      {qrSonuc.basarili && (
                        <span className="text-[10px] font-mono bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-300">
                          KAPI AÇIK
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] leading-relaxed opacity-90">
                      {qrSonuc.mesaj}
                    </p>

                    {qrSonuc.rampaYonlendirmesi && (
                      <div className="bg-black/40 p-2.5 rounded-xl border border-emerald-500/30 text-[11px] text-emerald-300 font-mono mt-1">
                        <strong>Yönlendirme:</strong> {qrSonuc.rampaYonlendirmesi}
                      </div>
                    )}

                    {qrSonuc.guvenlikYonergesi && (
                      <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1 font-mono">
                        <span>ℹ️</span> {qrSonuc.guvenlikYonergesi}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Alt Butonlar */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={handleQrModalKapat}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
              >
                Kapat
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ================= RESMİ DİJİTAL SEVK İRSALİYESİ GÖRÜNTÜLEME MODALI ================= */}
      {evrakModalArac && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto">
            
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
                onClick={() => setEvrakModalArac(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Belge İçeriği */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              
              <div className="border-2 border-slate-900 rounded-2xl p-5 space-y-4 bg-white relative">
                
                {/* Onay Damgası */}
                {evrakModalArac.irsaliye_durumu === 'IMZALANDI' ? (
                  <div className="absolute right-5 top-5 border-2 border-emerald-600 text-emerald-700 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest rotate-6 pointer-events-none bg-emerald-50/60 shadow-xs">
                    ✓ e-İMZALI & ONAYLI
                  </div>
                ) : evrakModalArac.durum === 'BEKLEMEDE' ? (
                  <div className="absolute right-5 top-5 border-2 border-blue-600 text-blue-700 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest rotate-6 pointer-events-none bg-blue-50/60 shadow-xs">
                    ✓ BOŞ GİRİŞ / YÜK ALMA
                  </div>
                ) : (
                  <div className="absolute right-5 top-5 border-2 border-amber-600 text-amber-700 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest rotate-6 pointer-events-none bg-amber-50/60 shadow-xs">
                    ⏳ İMZA BEKLENİYOR
                  </div>
                )}

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
                      {evrakModalArac.irsaliye_no || 'LOS-IRS-2024'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Tarih / Saat</span>
                    <span className="font-mono text-slate-800">
                      {evrakModalArac.irsaliye_tarihi 
                        ? new Date(evrakModalArac.irsaliye_tarihi).toLocaleString('tr-TR')
                        : new Date().toLocaleString('tr-TR')}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs pt-3 border-t border-slate-200">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Çıkış Noktası</span>
                    <span className="font-bold text-slate-900">{evrakModalArac.kalkis_sehri} Terminali</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Varış Noktası</span>
                    <span className="font-bold text-emerald-700">{evrakModalArac.varis_sehri} Terminali</span>
                  </div>
                </div>

                {/* Yük Bilgileri */}
                <div className="pt-3 border-t border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Taşıyıcı Araç:</span>
                    <span className="font-mono font-bold text-slate-900">{evrakModalArac.plaka}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Sürücü Ad Soyad:</span>
                    <span className="font-bold text-slate-900">{evrakModalArac.sofor_ad_soyad || 'Sürücü'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Emtia / Yük Cinsi:</span>
                    <span className="font-bold text-slate-900">{evrakModalArac.yuk_cinsi || 'Genel Sanayi Ürünleri & Emtia'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Net Ağırlık / Tonaj:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {evrakModalArac.tonaj_kg ? `${evrakModalArac.tonaj_kg} KG (${(Number(evrakModalArac.tonaj_kg)/1000).toFixed(2)} Ton)` : '21.400 KG'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Palet / Koli Adedi:</span>
                    <span className="font-mono font-bold text-slate-900">{evrakModalArac.palet_sayisi || 32} Palet</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Dorse Güvenlik Mühür No:</span>
                    <span className="font-mono font-bold text-blue-700">{evrakModalArac.muhur_no || 'MHR-88421'}</span>
                  </div>
                </div>

                {/* Alt İmza Alanı */}
                <div className="pt-4 border-t-2 border-slate-900 flex items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase mb-1">
                      Sürücü e-İmza Teyidi
                    </span>
                    {evrakModalArac.sofor_imzasi ? (
                      <img 
                        src={evrakModalArac.sofor_imzasi} 
                        alt="Sürücü İmzası" 
                        className="h-14 w-auto max-w-[180px] border border-slate-200 rounded-lg p-1 bg-white shadow-2xs"
                      />
                    ) : (
                      <span className="text-xs font-mono font-bold text-slate-700 italic">
                        {evrakModalArac.sofor_ad_soyad || 'Sürücü'} ({evrakModalArac.durum === 'BEKLEMEDE' ? 'Yük Alma Öncesi' : 'İmza Bekleniyor'})
                      </span>
                    )}
                  </div>

                  {modalQrVerisi && (
                    <div className="text-center">
                      <img 
                        src={modalQrVerisi} 
                        alt="İrsaliye Doğrulama QR" 
                        className="w-16 h-16 mx-auto rounded-lg border border-slate-200 p-0.5"
                      />
                      <span className="text-[9px] font-mono text-slate-400 block mt-0.5">Kiosk Giriş Karekodu</span>
                    </div>
                  )}
                </div>

              </div>

              {/* Alt Butonlar */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-slate-500" />
                    <span>Yazdır / PDF Kaydet</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const temizPlaka = evrakModalArac.plaka.replace(/\s+/g, '');
                      setPlakaGirdisi(temizPlaka);
                      setEvrakModalArac(null);
                      handleSorgulaVeOnayla(temizPlaka);
                    }}
                    className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                    <span>İrsaliyeyi Onayla & Bariyeri Aç</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setEvrakModalArac(null)}
                  className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition cursor-pointer"
                >
                  Pencereyi Kapat
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
