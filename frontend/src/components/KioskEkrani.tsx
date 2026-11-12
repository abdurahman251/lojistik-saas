import { useState, useEffect } from 'react';
import { 
  Truck, 
  Search, 
  Check, 
  RotateCcw, 
  LogOut, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  MapPin, 
  Delete,
  X,
  PlaneTakeoff,
  PlaneLanding
} from 'lucide-react';

interface KullaniciBilgisi {
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
  durum: string;
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
  const kioskSehir = kullanici.sehir === 'YOK' ? 'ISTANBUL' : kullanici.sehir;

  // Şehir İsim Formatlama
  const sehirIsimleri: Record<string, string> = {
    ISTANBUL: 'İstanbul',
    ANKARA: 'Ankara',
    IZMIR: 'İzmir',
  };
  const sehirGosterim = sehirIsimleri[kioskSehir] || kioskSehir;

  // Durumlar
  const [plakaGirdisi, setPlakaGirdisi] = useState('');
  const [saatMetni, setSaatMetni] = useState('');
  
  // Sol Panel Sekmesi: 'kalkis' (Kalkış Yapacaklar) | 'yaklasan' (Yaklaşan Araçlar)
  const [aktifSekme, setAktifSekme] = useState<'kalkis' | 'yaklasan'>('kalkis');
  const [kalkisYapacaklar, setKalkisYapacaklar] = useState<AracRandevusu[]>([]);
  const [yaklasanAraclar, setYaklasanAraclar] = useState<AracRandevusu[]>([]);

  const [yukleniyor, setYukleniyor] = useState(false);
  const [sorgulaniyor, setSorgulaniyor] = useState(false);
  const [geriBildirim, setGeriBildirim] = useState<GeriBildirim | null>(null);

  // Canlı Saat Sayacı (Her saniye güncellenir)
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

  // Araç Listesini Çek (Kalkış Yapacaklar & Yaklaşanlar)
  const araclariGetir = async () => {
    try {
      setYukleniyor(true);
      const res = await fetch(`/api/kiosk/arac-listesi?sehir=${kioskSehir}`);
      const data = await res.json();
      if (data.basarili) {
        setKalkisYapacaklar(data.kalkisYapacaklar || []);
        setYaklasanAraclar(data.yaklasanAraclar || []);

        // Eğer kalkış yapacak araç yok ama yaklaşan varsa varsayılan sekmeyi yaklaşan yap
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
    // 8 saniyede bir otomatik yenile
    const periyodik = setInterval(araclariGetir, 8000);
    return () => clearInterval(periyodik);
  }, [kioskSehir]);

  // Sanal Klavye Tuşları
  const tuslarSatir1 = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
  const tuslarSatir2 = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'];
  const tuslarSatir3 = ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Z'];
  const tuslarSatir4 = ['X', 'C', 'V', 'B', 'N', 'M'];

  const handleTusTikla = (harf: string) => {
    if (plakaGirdisi.length < 12) {
      setPlakaGirdisi((onceki) => onceki + harf);
    }
  };

  const handleSil = () => {
    setPlakaGirdisi((onceki) => onceki.slice(0, -1));
  };

  const handleTemizle = () => {
    setPlakaGirdisi('');
  };

  // Kiosk Doğrulama & Onay
  const handleSorgulaVeOnayla = async (hedefPlaka?: string) => {
    const sorgulanacakPlaka = (hedefPlaka || plakaGirdisi).trim();

    if (!sorgulanacakPlaka) {
      setGeriBildirim({
        tip: 'HATA',
        baslik: 'PLAKA GEREKLİ',
        mesaj: 'Lütfen dokunmatik klavyeyi kullanarak veya listeden bir plaka seçin.',
      });
      return;
    }

    setSorgulaniyor(true);
    try {
      const res = await fetch('/api/kiosk/giris-kontrol', {
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
          baslik: 'GİRİŞ ONAYLANMADI',
          mesaj: data.mesaj || 'Bu plaka adına bu şehir için aktif bir randevu bulunamadı veya rotanız hatalı!',
        });
        return;
      }

      if (data.durumTipi === 'GECIKMELI') {
        setGeriBildirim({
          tip: 'GECIKMELI',
          baslik: data.asama === 'KALKIS' ? 'KALKIŞ GECİKME İHLALİ MÜHÜRLENDİ' : 'GECİKME İHLALİ MÜHÜRLENDİ',
          mesaj: data.mesaj,
          asama: data.asama,
          gecikmeDakika: data.gecikmeDakika,
          randevu: data.randevu,
        });
      } else {
        setGeriBildirim({
          tip: 'VAKTINDE',
          baslik: data.asama === 'KALKIS' ? 'KALKIŞ ONAYLANDI' : 'GİRİŞ ONAYLANDI',
          mesaj: data.mesaj,
          asama: data.asama,
          randevu: data.randevu,
        });
      }

      // Başarılı işlem sonrası plakayı temizle ve listeyi tazele
      setPlakaGirdisi('');
      araclariGetir();
    } catch (err: any) {
      setGeriBildirim({
        tip: 'HATA',
        baslik: 'BAĞLANTI HATASI',
        mesaj: 'Kiosk doğrulama servisine ulaşılamadı.',
      });
    } finally {
      setSorgulaniyor(false);
    }
  };

  const aktifListe = aktifSekme === 'kalkis' ? kalkisYapacaklar : yaklasanAraclar;
  const toplamBekleyen = kalkisYapacaklar.length + yaklasanAraclar.length;

  return (
    <div 
      className="min-h-screen flex flex-col justify-between bg-[#f8fafc] text-slate-800 select-none overflow-x-hidden"
      style={{
        backgroundImage: `
          linear-gradient(rgba(148, 163, 184, 0.08) 1px, transparent 1px),
          linear-gradient(90deg, rgba(148, 163, 184, 0.08) 1px, transparent 1px)
        `,
        backgroundSize: '32px 32px',
      }}
    >
      {/* ================= ÜST NAVBAR ================= */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-6 sm:px-10 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        {/* Sol Logo ve Kiosk Başlığı */}
        <div className="flex items-center gap-3.5">
          <div className="relative">
            <div className="w-11 h-11 rounded-2xl bg-[#145dfa] flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Truck className="w-6 h-6 stroke-[2.2]" />
            </div>
            <span className="w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full absolute -bottom-0.5 -right-0.5 animate-pulse" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                {sehirGosterim} <span className="text-slate-400 font-normal">·</span> Liman Kiosk
              </h1>
            </div>
            <p className="text-xs text-slate-400 font-medium flex items-center gap-1.5 mt-0.5">
              <span>Akıllı Doğrulama Sistemi</span>
              <span>·</span>
              <span className="text-emerald-600 font-semibold">Çevrimiçi</span>
            </p>
          </div>
        </div>

        {/* Sağ: SAAT ve BEKLEYEN Sayaçları */}
        <div className="flex items-center gap-6">
          {/* Canlı Saat */}
          <div className="text-right">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              SAAT
            </span>
            <span className="font-mono text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              {saatMetni || '20:00:45'}
            </span>
          </div>

          {/* Bekleyen Araç Sayacı */}
          <div className="text-right pl-5 border-l border-slate-200/80">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              BEKLEYEN
            </span>
            <span className="font-mono text-xl sm:text-2xl font-extrabold text-emerald-600">
              {toplamBekleyen}
            </span>
          </div>
        </div>
      </header>

      {/* ================= ANA İÇERİK BÖLÜMÜ ================= */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 flex flex-col lg:flex-row gap-6 items-start justify-center">
        {/* SOL SÜTUN: KALKIŞ YAPACAKLAR VE YAKLAŞAN ARAÇLAR SEKMELİ PANEL */}
        <div className="w-full lg:w-[370px] shrink-0">
          {/* İki Sekmeli Seçici (Kalkış Yapacaklar & Yaklaşan Araçlar) */}
          <div className="bg-slate-200/60 p-1 rounded-2xl flex items-center gap-1 mb-3">
            <button
              type="button"
              onClick={() => setAktifSekme('kalkis')}
              className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                aktifSekme === 'kalkis'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PlaneTakeoff className="w-3.5 h-3.5" />
              <span>Kalkış Yapacaklar</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                aktifSekme === 'kalkis' ? 'bg-blue-100 text-blue-700' : 'bg-slate-300/60 text-slate-600'
              }`}>
                {kalkisYapacaklar.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setAktifSekme('yaklasan')}
              className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                aktifSekme === 'yaklasan'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PlaneLanding className="w-3.5 h-3.5" />
              <span>Yaklaşan Araçlar</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                aktifSekme === 'yaklasan' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-300/60 text-slate-600'
              }`}>
                {yaklasanAraclar.length}
              </span>
            </button>
          </div>

          {/* Sekme Alt Başlığı */}
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-1.5 text-slate-400 font-bold text-xs uppercase tracking-wider">
              <span>🗎</span>
              <span>
                {aktifSekme === 'kalkis' 
                  ? `${sehirGosterim}'dan Kalkacak Araçlar` 
                  : `${sehirGosterim}'a Yaklaşan Araçlar`}
              </span>
            </div>
            <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] border ${
              aktifSekme === 'kalkis' 
                ? 'bg-blue-50 border-blue-200/60 text-blue-600' 
                : 'bg-emerald-50 border-emerald-200/60 text-emerald-600'
            }`}>
              {aktifListe.length} AKTİF
            </span>
          </div>

          {/* Kartlar Listesi */}
          <div className="space-y-3">
            {aktifListe.length === 0 ? (
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-7 text-center border border-slate-200/80 text-slate-400 text-xs">
                {aktifSekme === 'kalkis' ? (
                  <>
                    <PlaneTakeoff className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-600">{sehirGosterim}'dan kalkış yapacak bekleyen araç yok.</p>
                    <p className="text-[11px] text-slate-400 mt-1">Sürücüler randevu aldığında buraya düşer.</p>
                  </>
                ) : (
                  <>
                    <PlaneLanding className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-600">{sehirGosterim}'a doğru yolda olan yaklaşan araç yok.</p>
                    <p className="text-[11px] text-slate-400 mt-1">Kalkış kapısından onay alan araçlar buraya düşer.</p>
                  </>
                )}
              </div>
            ) : (
              aktifListe.map((arac) => (
                <div
                  key={arac.id}
                  className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 hover:shadow-md transition flex items-center justify-between animate-fade-in"
                >
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      PLAKA
                    </span>
                    <h3 className="font-extrabold text-xl text-slate-900 tracking-tight font-mono">
                      {arac.plaka}
                    </h3>
                    <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50/80 text-blue-700 text-[11px] font-semibold border border-blue-100">
                      <MapPin className="w-3 h-3 text-blue-500" />
                      <span>{arac.kalkis_sehri}</span>
                      <span className="text-blue-300 font-normal">&gt;</span>
                      <span>{arac.varis_sehri}</span>
                    </div>

                    {/* Statü etiketi */}
                    <div className="mt-1.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        arac.durum === 'BEKLEMEDE' 
                          ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                      }`}>
                        {arac.durum === 'BEKLEMEDE' ? 'Kalkış Onayı Bekliyor' : 'Yolda (Yaklaşıyor)'}
                      </span>
                    </div>
                  </div>

                  {/* Yeşil Onay / Hızlı Seç Butonu */}
                  <button
                    type="button"
                    title="Plakayı klavyeye aktar"
                    onClick={() => {
                      setPlakaGirdisi(arac.plaka.replace(/\s+/g, ''));
                    }}
                    className="w-11 h-11 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 transition cursor-pointer shrink-0 ml-3"
                  >
                    <Check className="w-6 h-6 stroke-[2.5]" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* SAĞ / ORTA SÜTUN: MANUEL DOĞRULAMA KARTI & SANAL DOKUNMATİK KLAVYE */}
        <div className="w-full max-w-[620px] bg-white rounded-[32px] p-6 sm:p-9 shadow-xl shadow-slate-200/50 border border-slate-200/80">
          {/* Başlık */}
          <div className="text-center mb-6">
            <span className="text-[11px] font-bold text-[#145dfa] tracking-widest uppercase block mb-1">
              MANUEL DOĞRULAMA
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Plakanızı Giriniz
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Aşağıdaki klavyeyi kullanarak araç plakanızı yazın
            </p>
          </div>

          {/* TÜRKİYE PLAKA GÖRÜNÜMÜ INPUT KARTI */}
          <div className="mb-6">
            <div className="border-2 border-slate-200 rounded-2xl flex items-stretch h-18 sm:h-20 bg-white shadow-inner overflow-hidden focus-within:border-[#145dfa] focus-within:ring-4 focus-within:ring-blue-500/10 transition">
              {/* Sol TR Bandı */}
              <div className="bg-[#0a4fc4] w-12 sm:w-14 text-white flex flex-col items-center justify-between py-2.5 font-bold select-none shrink-0">
                <span className="text-[10px] text-white/80">★</span>
                <span className="text-xs sm:text-sm tracking-wider">TR</span>
              </div>

              {/* Plaka Metin Alanı */}
              <div className="flex-1 flex items-center justify-center px-4">
                <input
                  type="text"
                  value={plakaGirdisi}
                  onChange={(e) => setPlakaGirdisi(e.target.value.toUpperCase())}
                  placeholder="34 ABC 123"
                  className="w-full text-center font-mono text-2xl sm:text-4xl font-extrabold tracking-widest text-slate-900 placeholder:text-slate-300 placeholder:font-extrabold focus:outline-none uppercase bg-transparent"
                />
              </div>

              {/* Temizleme Butonu */}
              {plakaGirdisi && (
                <button
                  type="button"
                  onClick={handleTemizle}
                  className="px-3 text-slate-400 hover:text-slate-600 transition flex items-center justify-center cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* DOKUNMATİK SANAL KLAVYE */}
          <div className="space-y-2 mb-6 select-none">
            {/* Satır 1: Rakamlar (1 - 0) */}
            <div className="grid grid-cols-10 gap-1.5 sm:gap-2">
              {tuslarSatir1.map((tus) => (
                <button
                  key={tus}
                  type="button"
                  onClick={() => handleTusTikla(tus)}
                  className="h-11 sm:h-12 bg-white hover:bg-slate-50 active:bg-slate-100 active:scale-95 border border-slate-200/90 rounded-xl font-bold text-sm sm:text-base text-slate-800 shadow-xs transition flex items-center justify-center cursor-pointer"
                >
                  {tus}
                </button>
              ))}
            </div>

            {/* Satır 2: Q - P */}
            <div className="grid grid-cols-10 gap-1.5 sm:gap-2">
              {tuslarSatir2.map((tus) => (
                <button
                  key={tus}
                  type="button"
                  onClick={() => handleTusTikla(tus)}
                  className="h-11 sm:h-12 bg-white hover:bg-slate-50 active:bg-slate-100 active:scale-95 border border-slate-200/90 rounded-xl font-bold text-sm sm:text-base text-slate-800 shadow-xs transition flex items-center justify-center cursor-pointer"
                >
                  {tus}
                </button>
              ))}
            </div>

            {/* Satır 3: A - Z */}
            <div className="grid grid-cols-10 gap-1.5 sm:gap-2">
              {tuslarSatir3.map((tus) => (
                <button
                  key={tus}
                  type="button"
                  onClick={() => handleTusTikla(tus)}
                  className="h-11 sm:h-12 bg-white hover:bg-slate-50 active:bg-slate-100 active:scale-95 border border-slate-200/90 rounded-xl font-bold text-sm sm:text-base text-slate-800 shadow-xs transition flex items-center justify-center cursor-pointer"
                >
                  {tus}
                </button>
              ))}
            </div>

            {/* Satır 4: X - M ve SİL Butonu */}
            <div className="grid grid-cols-10 gap-1.5 sm:gap-2">
              {tuslarSatir4.map((tus) => (
                <button
                  key={tus}
                  type="button"
                  onClick={() => handleTusTikla(tus)}
                  className="h-11 sm:h-12 bg-white hover:bg-slate-50 active:bg-slate-100 active:scale-95 border border-slate-200/90 rounded-xl font-bold text-sm sm:text-base text-slate-800 shadow-xs transition flex items-center justify-center cursor-pointer"
                >
                  {tus}
                </button>
              ))}

              {/* SİL (Backspace) Tuşu - 4 Sütun Genişlikte */}
              <button
                type="button"
                onClick={handleSil}
                className="col-span-4 h-11 sm:h-12 bg-slate-100/90 hover:bg-slate-200/80 active:bg-slate-200 active:scale-95 border border-slate-200/90 rounded-xl font-bold text-xs sm:text-sm text-slate-700 shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Delete className="w-4 h-4 text-slate-600" />
                <span>SİL</span>
              </button>
            </div>
          </div>

          {/* SORGULA & ONAYLA BUTONU */}
          <button
            type="button"
            disabled={sorgulaniyor}
            onClick={() => handleSorgulaVeOnayla()}
            className="w-full py-4 px-6 rounded-2xl bg-[#145dfa] hover:bg-[#0f4ed4] active:scale-[0.99] text-white font-bold text-sm sm:text-base shadow-lg shadow-blue-500/25 transition flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {sorgulaniyor ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Search className="w-5 h-5 stroke-[2.5]" />
                <span>SORGULA & ONAYLA</span>
              </>
            )}
          </button>
        </div>
      </main>

      {/* ================= ALT FOOTER BARI ================= */}
      <footer className="px-6 sm:px-10 py-3.5 border-t border-slate-200/80 bg-white/70 backdrop-blur-xs flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <button
            type="button"
            title="Listeyi Yenile"
            onClick={araclariGetir}
            className="w-8 h-8 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center transition cursor-pointer shadow-2xs"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${yukleniyor ? 'animate-spin' : ''}`} />
          </button>
          <span className="font-mono text-[11px] tracking-wider text-slate-400">
            © 2024 LOJİSTİK TERMİNAL V2.0
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 font-mono text-[11px] tracking-wider text-slate-500 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>ÇEVRİMİÇİ</span>
            <span className="text-slate-400 ml-1">KSK-{kioskSehir.slice(0, 3)}-01</span>
          </div>

          <button
            type="button"
            onClick={onCikis}
            title="Kiosk Oturumunu Kapat"
            className="w-8 h-8 rounded-xl border border-slate-200 bg-white hover:bg-red-50 hover:text-red-600 text-slate-500 flex items-center justify-center transition cursor-pointer shadow-2xs"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </footer>

      {/* ================= GERİ BİLDİRİM / ANINDA DOĞRULAMA MODALI (MODÜL 3) ================= */}
      {geriBildirim && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 text-center relative animate-fade-in">
            <button
              onClick={() => setGeriBildirim(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Durum İkonu */}
            {geriBildirim.tip === 'VAKTINDE' && (
              <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-600">
                <CheckCircle2 className="w-10 h-10 stroke-[2.3]" />
              </div>
            )}

            {geriBildirim.tip === 'GECIKMELI' && (
              <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-amber-600">
                <AlertTriangle className="w-10 h-10 stroke-[2.3]" />
              </div>
            )}

            {geriBildirim.tip === 'HATA' && (
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-red-600">
                <XCircle className="w-10 h-10 stroke-[2.3]" />
              </div>
            )}

            {/* Başlık ve Mesaj */}
            <h3 className={`text-xl font-bold tracking-tight mb-2 ${
              geriBildirim.tip === 'VAKTINDE' ? 'text-emerald-700' :
              geriBildirim.tip === 'GECIKMELI' ? 'text-amber-700' : 'text-red-700'
            }`}>
              {geriBildirim.baslik}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6">
              {geriBildirim.mesaj}
            </p>

            {/* Randevu Bilgi Özeti */}
            {geriBildirim.randevu && (
              <div className="bg-slate-50 rounded-2xl p-4 text-xs space-y-2 text-left border border-slate-100 mb-6 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">Plaka:</span>
                  <span className="font-bold text-slate-900">{geriBildirim.randevu.plaka}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">Rota:</span>
                  <span className="font-semibold text-slate-800">{geriBildirim.randevu.kalkis_sehri} → {geriBildirim.randevu.varis_sehri}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">İşlem Aşaması:</span>
                  <span className="font-bold text-blue-600">
                    {geriBildirim.asama === 'KALKIS' ? 'Kalkış Terminali Onayı' : 'Hedef Terminal Varış Onayı'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">Yeni Statü:</span>
                  <span className={`font-bold ${geriBildirim.randevu.durum === 'YOLDA' ? 'text-blue-600' : 'text-emerald-600'}`}>
                    {geriBildirim.randevu.durum}
                  </span>
                </div>
              </div>
            )}

            {/* Onay Butonu */}
            <button
              onClick={() => setGeriBildirim(null)}
              className={`w-full py-3 rounded-xl text-white font-bold text-xs sm:text-sm transition shadow-md cursor-pointer ${
                geriBildirim.tip === 'VAKTINDE' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20' :
                geriBildirim.tip === 'GECIKMELI' ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20' :
                'bg-red-600 hover:bg-red-700 shadow-red-500/20'
              }`}
            >
              Tamam
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
