import { useState, useEffect } from 'react';
import { authFetch } from '../api';
import Logo from './Logo';
import { 
  Truck, 
  Clock, 
  LogOut, 
  RotateCcw, 
  PackageCheck, 
  Plus, 
  X, 
  MapPin, 
  ArrowRight,
  Activity,
  Check,
  Zap,
  Box,
  Compass,
  Phone,
  AlertOctagon,
  Search,
  ShieldAlert,
  ChevronRight,
  FileText,
  ClipboardCheck,
  Scale,
  ShieldCheck
} from 'lucide-react';

export interface KullaniciBilgisi {
  id: string;
  kullaniciAdi: string;
  rol: 'YONETICI' | 'OPERATOR' | 'KIOSK' | 'SURUCU';
  sehir: 'ISTANBUL' | 'ANKARA' | 'IZMIR' | 'YOK';
  plaka?: string | null;
}

interface RampaVerisi {
  id: string;
  ad: string;
  numara: number;
  sehir: string;
  durum: 'BOS' | 'DOLU' | 'BAKIMDA';
  su_anki_randevu_id?: string | null;
  operasyon_tipi?: 'YUK_BOSALTMA' | 'YUKLEME' | null;
  islem_baslangic?: string | null;
  plaka?: string | null;
  sofor_ad_soyad?: string | null;
  sofor_telefon?: string | null;
  kalkis_sehri?: string | null;
  varis_sehri?: string | null;
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
  durum: string;
  cikis_zamani?: string | null;
  kiosk_giris_saati?: string | null;
  is_gecikme?: boolean;
}

interface IhlalVerisi {
  id: string;
  randevu_id?: string | null;
  plaka: string;
  ihlal_tipi: string;
  aciklama: string;
  tarih: string;
}

interface OperatorPaneliProps {
  kullanici: KullaniciBilgisi;
  onCikis: () => void;
}

export default function OperatorPaneli({ kullanici, onCikis }: OperatorPaneliProps) {
  const operatorSehir = (kullanici.sehir === 'YOK' || !kullanici.sehir) ? 'ISTANBUL' : kullanici.sehir;

  const sehirDetay: Record<string, { ad: string; kod: string; bolge: string; hava: string }> = {
    ISTANBUL: { ad: 'İstanbul Ambarlı Terminali', kod: 'IST', bolge: 'Marmara Lojistik Üssü', hava: '🌤️ 19°C • Rüzgar: 12 km/s' },
    ANKARA: { ad: 'Ankara Lojistik Üssü', kod: 'ANK', bolge: 'İç Anadolu Dağıtım Merkezi', hava: '☀️ 17°C • Görüş: Açık' },
    IZMIR: { ad: 'İzmir Alsancak Liman Sahası', kod: 'IZM', bolge: 'Ege Konteyner Sahası', hava: '🌤️ 22°C • Rüzgar: 8 km/s' },
  };
  const terminalBilgisi = sehirDetay[operatorSehir] || { 
    ad: `${operatorSehir} Terminali`, 
    kod: 'TRM', 
    bolge: 'Bölge Lojistik Sahası',
    hava: '🌤️ 20°C • Açık' 
  };

  // Durumlar
  const [saatMetni, setSaatMetni] = useState('');
  const [rampalar, setRampalar] = useState<RampaVerisi[]>([]);
  const [sahadakiTirlar, setSahadakiTirlar] = useState<RandevuVerisi[]>([]);
  const [yoldakiTirlar, setYoldakiTirlar] = useState<RandevuVerisi[]>([]);
  const [ihlaller, setIhlaller] = useState<IhlalVerisi[]>([]);
  
  const [istatistikler, setIstatistikler] = useState({
    sahadaSayisi: 0,
    doluRampaSayisi: 0,
    musaitRampaSayisi: 8,
    yoldaSayisi: 0,
    dolulukYuzdesi: 0,
    ihlalSayisi: 0,
  });

  const [yukleniyor, setYukleniyor] = useState(false);
  const [islemYapiliyor, setIslemYapiliyor] = useState(false);
  const [aramaMetni, setAramaMetni] = useState('');

  // Atama Modalı State
  const [secilenRampa, setSecilenRampa] = useState<RampaVerisi | null>(null);
  const [secilenTir, setSecilenTir] = useState<RandevuVerisi | null>(null);
  const [secilenOperasyon, setSecilenOperasyon] = useState<'YUK_BOSALTMA' | 'YUKLEME'>('YUK_BOSALTMA');
  const [atamaModalAcik, setAtamaModalAcik] = useState(false);

  // Dijital Sevk İrsaliyesi Modalı State
  const [irsaliyeModalAcik, setIrsaliyeModalAcik] = useState(false);
  const [secilenIrsaliyeRampa, setSecilenIrsaliyeRampa] = useState<RampaVerisi | null>(null);
  const [irsaliyeForm, setIrsaliyeForm] = useState({
    yukCinsi: 'Endüstriyel Parça & Otomotiv',
    tonajKg: '21400',
    paletSayisi: '32',
    muhurNo: '',
  });

  // Sekmeler: 'sahada' | 'yolda' | 'ihlaller'
  const [aktifAltSekme, setAktifAltSekme] = useState<'sahada' | 'yolda' | 'ihlaller'>('sahada');

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
    const interval = setInterval(saatGuncelle, 1000);
    return () => clearInterval(interval);
  }, []);

  // Saha Durumunu Çek
  const durumGetir = async () => {
    try {
      setYukleniyor(true);
      const res = await authFetch(`/api/operator/durum?sehir=${operatorSehir}`);
      const data = await res.json();
      if (data.basarili) {
        setRampalar(data.rampalar || []);
        setSahadakiTirlar(data.sahadakiTirlar || []);
        setYoldakiTirlar(data.yoldakiTirlar || []);
        setIhlaller(data.ihlaller || []);
        setIstatistikler(data.istatistikler || {
          sahadaSayisi: 0,
          doluRampaSayisi: 0,
          musaitRampaSayisi: 8,
          yoldaSayisi: 0,
          dolulukYuzdesi: 0,
          ihlalSayisi: 0,
        });
      }
    } catch (err) {
      console.error('Operatör durumu getirme hatası:', err);
    } finally {
      setYukleniyor(false);
    }
  };

  useEffect(() => {
    durumGetir();
    const periyodik = setInterval(durumGetir, 8000);
    return () => clearInterval(periyodik);
  }, [operatorSehir]);

  // Rampaya Tır Ata
  const handleRampaAta = async () => {
    if (!secilenRampa || !secilenTir) return;

    setIslemYapiliyor(true);
    try {
      const res = await authFetch('/api/operator/rampa-ata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rampaId: secilenRampa.id,
          randevuId: secilenTir.id,
          operasyonTipi: secilenOperasyon,
        }),
      });

      const data = await res.json();
      if (data.basarili) {
        setAtamaModalAcik(false);
        setSecilenRampa(null);
        setSecilenTir(null);
        durumGetir();
      } else {
        alert(data.mesaj || 'Atama gerçekleştirilemedi.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIslemYapiliyor(false);
    }
  };

  // Rampadaki Operasyonu Tamamla (Boşaltma işlemi için)
  const handleOperasyonTamamla = async (rampaId: string) => {
    if (!confirm('Bu rampadaki boşaltma operasyonunu tamamlayıp rampayı boşaltmak istiyor musunuz?')) return;

    setIslemYapiliyor(true);
    try {
      const res = await authFetch('/api/operator/operasyon-tamamla', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rampaId }),
      });

      const data = await res.json();
      if (data.basarili) {
        durumGetir();
      } else {
        alert(data.mesaj || 'İşlem tamamlanamadı.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIslemYapiliyor(false);
    }
  };

  // Yükleme Sonrası Resmi Sevk İrsaliyesi Düzenleme ve Sürücüye İletme
  const handleIrsaliyeOlustur = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secilenIrsaliyeRampa) return;

    setIslemYapiliyor(true);
    try {
      const res = await authFetch('/api/operator/operasyon-tamamla', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rampaId: secilenIrsaliyeRampa.id,
          yukCinsi: irsaliyeForm.yukCinsi,
          tonajKg: Number(irsaliyeForm.tonajKg),
          paletSayisi: Number(irsaliyeForm.paletSayisi),
          muhurNo: irsaliyeForm.muhurNo,
        }),
      });

      const data = await res.json();
      if (data.basarili) {
        setIrsaliyeModalAcik(false);
        setSecilenIrsaliyeRampa(null);
        durumGetir();
      } else {
        alert(data.mesaj || 'İrsaliye oluşturulamadı.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIslemYapiliyor(false);
    }
  };

  // Arama Filtrelemesi
  const filtrelenmisRampalar = rampalar.filter((r) => {
    if (!aramaMetni) return true;
    const arama = aramaMetni.toLowerCase();
    return (
      r.ad.toLowerCase().includes(arama) ||
      (r.plaka && r.plaka.toLowerCase().includes(arama)) ||
      (r.sofor_ad_soyad && r.sofor_ad_soyad.toLowerCase().includes(arama))
    );
  });

  const filtrelenmisSahadakiler = sahadakiTirlar.filter((t) => {
    if (!aramaMetni) return true;
    const arama = aramaMetni.toLowerCase();
    return (
      t.plaka.toLowerCase().includes(arama) ||
      t.sofor_ad_soyad.toLowerCase().includes(arama)
    );
  });

  const filtrelenmisIhlaller = ihlaller.filter((i) => {
    if (!aramaMetni) return true;
    const arama = aramaMetni.toLowerCase();
    return (
      i.plaka.toLowerCase().includes(arama) ||
      i.ihlal_tipi.toLowerCase().includes(arama) ||
      i.aciklama.toLowerCase().includes(arama)
    );
  });

  return (
    <div className="min-h-screen bg-[#f1f4f9] text-slate-900 antialiased flex flex-col font-sans">
      
      {/* ================= ÜST LOJİSTİK HEADER (ZENGİN & MODERN) ================= */}
      <header className="bg-white border-b border-slate-200/90 sticky top-0 z-30 px-4 sm:px-8 py-3 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Sol: Logo + Terminal İsmi ve Bölge */}
          <div className="flex items-center gap-3.5">
            <Logo variant="icon" size="sm" className="w-10 h-10 rounded-xl overflow-hidden shrink-0 shadow-xs" />

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight leading-none">
                  {terminalBilgisi.ad}
                </h1>
                <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                  <span>{terminalBilgisi.kod}-DISPATCH</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-2 font-medium">
                <span className="text-slate-400">{terminalBilgisi.bolge}</span>
                <span className="text-slate-300">•</span>
                <span className="text-slate-500 font-mono text-[10px] hidden sm:inline">{terminalBilgisi.hava}</span>
              </p>
            </div>
          </div>

          {/* Orta: Canlı Arama Kutusu (Plaka / Sürücü Arama) */}
          <div className="hidden lg:flex items-center flex-1 max-w-xs mx-4">
            <div className="relative w-full">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                value={aramaMetni}
                onChange={(e) => setAramaMetni(e.target.value)}
                placeholder="Plaka veya sürücü ara..."
                className="w-full pl-9 pr-8 py-1.5 rounded-lg border border-slate-200 bg-slate-50/80 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition"
              />
              {aramaMetni && (
                <button
                  type="button"
                  onClick={() => setAramaMetni('')}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Sağ: İhlal Uyarısı, Saat ve Çıkış */}
          <div className="flex items-center gap-2.5 sm:gap-4">
            
            {/* İhlal Uyarı Butonu (Eğer ihlal varsa kırmızı uyarı verir) */}
            <button
              type="button"
              onClick={() => setAktifAltSekme('ihlaller')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                ihlaller.length > 0
                  ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100 shadow-2xs animate-pulse'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <AlertOctagon className={`w-3.5 h-3.5 ${ihlaller.length > 0 ? 'text-red-600' : 'text-slate-400'}`} />
              <span>{ihlaller.length} İhlal</span>
            </button>

            {/* Canlı Saha Saati */}
            <div className="text-right hidden sm:block bg-slate-50 border border-slate-200/80 px-3 py-1 rounded-lg">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block leading-none">
                Saha Saati
              </span>
              <span className="text-xs sm:text-sm font-bold font-mono text-slate-900 tracking-tight">
                {saatMetni || '12:00:00'}
              </span>
            </div>

            {/* Yenile Butonu */}
            <button
              onClick={durumGetir}
              title="Saha Verilerini Güncelle"
              className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition cursor-pointer shadow-2xs"
            >
              <RotateCcw className={`w-4 h-4 ${yukleniyor ? 'animate-spin text-blue-600' : ''}`} />
            </button>

            {/* Çıkış Butonu */}
            <button
              onClick={onCikis}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-red-50 hover:border-red-200 hover:text-red-600 text-slate-600 text-xs font-semibold transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Çıkış</span>
            </button>
          </div>

        </div>
      </header>

      {/* ================= ANA İÇERİK ================= */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        
        {/* ================= 1. TERMİNAL KAPASİTE GÖSTERGESİ (DOLULUK BARI) ================= */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/25">
              <Zap className="w-5 h-5 fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 leading-tight">
                  Terminal Saha Doluluk & Akış Oranı
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  istatistikler.dolulukYuzdesi >= 75
                    ? 'bg-amber-100 text-amber-800'
                    : istatistikler.dolulukYuzdesi >= 40
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {istatistikler.dolulukYuzdesi >= 75 ? 'Yoğun Akış' : istatistikler.dolulukYuzdesi >= 40 ? 'Normal Trafik' : 'Optimal Akış'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                8 Rampa İstasyonunda anlık kapasite, tır yanaşma ve güvenlik denetimi
              </p>
            </div>
          </div>

          <div className="flex-1 max-w-md sm:ml-6">
            <div className="flex items-center justify-between text-xs font-bold mb-1.5">
              <span className="text-slate-400 font-medium">Doluluk:</span>
              <span className="font-mono text-slate-900 text-sm font-bold">
                %{istatistikler.dolulukYuzdesi}
              </span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/60">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 via-blue-500 to-indigo-600 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(istatistikler.dolulukYuzdesi, 4)}%` }}
              />
            </div>
          </div>

          <div className="text-right text-xs font-semibold text-slate-500 shrink-0 border-t sm:border-t-0 sm:border-l border-slate-100 pt-2 sm:pt-0 sm:pl-4">
            <div className="text-slate-900 font-bold">{istatistikler.musaitRampaSayisi} Rampa Boşta</div>
            <div className="text-[11px] text-slate-400">{istatistikler.doluRampaSayisi} İstasyon İşlemde</div>
          </div>
        </div>

        {/* ================= 2. RENKLİ KPI KARTLARI (İHLAL DAHİL 5 KART) ================= */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 animate-fade-in">
          
          {/* 1. Müsait İstasyonlar (Zümrüt Yeşili) */}
          <div className="bg-gradient-to-b from-emerald-50/60 to-white rounded-2xl p-4 border border-emerald-200 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                Müsait Rampa
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100 animate-pulse" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-extrabold font-mono text-slate-900">
                {istatistikler.musaitRampaSayisi}
              </span>
              <span className="text-xs text-slate-400 font-medium">/ 8 Boş</span>
            </div>
            <p className="text-[10px] text-emerald-700 font-semibold mt-1">Hemen yanaşmaya hazır</p>
          </div>

          {/* 2. Aktif Dolu Rampa (Kraliyet Mavisi) */}
          <div className="bg-gradient-to-b from-blue-50/60 to-white rounded-2xl p-4 border border-blue-200 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800">
                Aktif Operasyon
              </span>
              <Box className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-extrabold font-mono text-slate-900">
                {istatistikler.doluRampaSayisi}
              </span>
              <span className="text-xs text-slate-400 font-medium">İstasyon</span>
            </div>
            <p className="text-[10px] text-blue-700 font-semibold mt-1">Yükleme & Boşaltma</p>
          </div>

          {/* 3. Sahada Bekleyen Tırlar (Kehribar) */}
          <div className="bg-gradient-to-b from-amber-50/60 to-white rounded-2xl p-4 border border-amber-200 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                Sahada Bekleyen
              </span>
              <Truck className="w-4 h-4 text-amber-600" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-extrabold font-mono text-slate-900">
                {istatistikler.sahadaSayisi}
              </span>
              <span className="text-xs text-slate-400 font-medium">Araç Kuyrukta</span>
            </div>
            <p className="text-[10px] text-amber-700 font-semibold mt-1">Kiosk kapı onaylı</p>
          </div>

          {/* 4. Yoldaki Seferler (Menekşe) */}
          <div className="bg-gradient-to-b from-purple-50/60 to-white rounded-2xl p-4 border border-purple-200 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800">
                Yoldaki Araçlar
              </span>
              <Activity className="w-4 h-4 text-purple-600" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-extrabold font-mono text-slate-900">
                {istatistikler.yoldaSayisi}
              </span>
              <span className="text-xs text-slate-400 font-medium">Sefer</span>
            </div>
            <p className="text-[10px] text-purple-700 font-semibold mt-1">Bu terminale geliyor</p>
          </div>

          {/* 5. İHLAL VE GÜVENLİK KAYITLARI (KIRMIZI / YENİ ÖZELLİK) */}
          <div 
            onClick={() => setAktifAltSekme('ihlaller')}
            className={`rounded-2xl p-4 border shadow-xs relative overflow-hidden cursor-pointer transition-all hover:scale-[1.02] ${
              ihlaller.length > 0
                ? 'bg-gradient-to-b from-red-50/70 to-white border-red-300 ring-1 ring-red-400/30'
                : 'bg-gradient-to-b from-slate-50 to-white border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${ihlaller.length > 0 ? 'text-red-800' : 'text-slate-500'}`}>
                İhlal Kayıtları
              </span>
              <ShieldAlert className={`w-4 h-4 ${ihlaller.length > 0 ? 'text-red-600 animate-bounce' : 'text-slate-400'}`} />
            </div>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-extrabold font-mono ${ihlaller.length > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                {ihlaller.length}
              </span>
              <span className="text-xs text-slate-400 font-medium">Kayıt</span>
            </div>
            <p className={`text-[10px] font-semibold mt-1 flex items-center justify-between ${ihlaller.length > 0 ? 'text-red-700' : 'text-slate-500'}`}>
              <span>Gecikme & Rota İhlali</span>
              <ChevronRight className="w-3 h-3" />
            </p>
          </div>

        </div>

        {/* ================= 3. RAMPA İSTASYONLARI (8 PERON - DOCKING BAYS) ================= */}
        <div className="space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                Liman Rampa İstasyonları ({terminalBilgisi.kod} 01 - 08)
              </h2>
            </div>

            {sahadakiTirlar.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const bosRampa = rampalar.find(r => r.durum === 'BOS');
                  if (bosRampa) setSecilenRampa(bosRampa);
                  setSecilenTir(sahadakiTirlar[0]);
                  setAtamaModalAcik(true);
                }}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Kuyruktan Tır Ata</span>
              </button>
            )}
          </div>

          {/* 8 Rampa Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {filtrelenmisRampalar.map((rampa) => {
              const doluMu = rampa.durum === 'DOLU';
              const numaraIkiHane = rampa.numara.toString().padStart(2, '0');

              return (
                <div
                  key={rampa.id}
                  className={`rounded-2xl p-4 border transition-all flex flex-col justify-between min-h-[195px] relative overflow-hidden ${
                    doluMu
                      ? 'bg-white border-blue-300/90 shadow-md shadow-blue-500/10 ring-1 ring-blue-500/20'
                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                  }`}
                >
                  {/* Arka Plan Büyük Su Damgası Peron Numarası */}
                  <span className="absolute -right-2 -bottom-3 text-7xl font-extrabold font-mono text-slate-100 select-none pointer-events-none z-0">
                    {numaraIkiHane}
                  </span>

                  {/* Üst Kısım: İstasyon Başlığı ve Durum Rozeti */}
                  <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-6 h-6 rounded-md bg-slate-900 text-white font-mono text-xs font-extrabold flex items-center justify-center">
                        {numaraIkiHane}
                      </span>
                      <span className="text-xs font-bold text-slate-800">
                        {rampa.ad}
                      </span>
                    </div>

                    <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono flex items-center gap-1 ${
                      doluMu
                        ? 'bg-amber-100 text-amber-900 border border-amber-300/70'
                        : 'bg-emerald-100 text-emerald-900 border border-emerald-300/70'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${doluMu ? 'bg-amber-600 animate-pulse' : 'bg-emerald-600'}`} />
                      <span>{doluMu ? (rampa.operasyon_tipi === 'YUK_BOSALTMA' ? 'BOŞALTMA' : 'YÜKLEME') : 'MÜSAİT'}</span>
                    </div>
                  </div>

                  {/* Orta Gövde: Atanan Araç veya Boş Park Deseni */}
                  <div className="relative z-10 my-3">
                    {doluMu ? (
                      <div className="space-y-1.5">
                        {/* TR Plaka */}
                        <div className="flex items-center rounded-lg overflow-hidden border border-slate-300 bg-white w-fit shadow-xs">
                          <span className="bg-[#003399] text-white text-[9px] font-extrabold px-1.5 py-1">
                            TR
                          </span>
                          <span className="px-2.5 py-1 text-xs font-mono font-extrabold text-slate-900 tracking-wider">
                            {rampa.plaka}
                          </span>
                        </div>

                        {/* Sürücü ve Operasyon */}
                        <div className="text-[11px] text-slate-600 font-medium">
                          <div className="truncate text-slate-800 font-bold">{rampa.sofor_ad_soyad || 'Sürücü'}</div>
                          {rampa.sofor_telefon && (
                            <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                              <Phone className="w-2.5 h-2.5" />
                              <span>{rampa.sofor_telefon}</span>
                            </div>
                          )}
                        </div>

                        {/* Rota */}
                        <div className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/60 w-fit flex items-center gap-1">
                          <MapPin className="w-2.5 h-2.5 text-blue-500" />
                          <span>{rampa.kalkis_sehri} → {rampa.varis_sehri}</span>
                        </div>
                      </div>
                    ) : (
                      /* Boş Rampa: Sarı Park Çizgileri ve Yanaşma Alanı */
                      <div className="dock-stripes-yellow rounded-xl p-3 border border-dashed border-amber-200 text-center">
                        <Truck className="w-5 h-5 text-amber-500/70 mx-auto mb-1" />
                        <span className="text-[10px] font-bold text-amber-900/80 uppercase tracking-wider block">
                          Park Yeri Boş
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          Tır atanması bekleniyor
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Alt Aksiyon Butonu */}
                  <div className="relative z-10 pt-1">
                    {doluMu ? (
                      <button
                        type="button"
                        disabled={islemYapiliyor}
                        onClick={() => {
                          if (rampa.operasyon_tipi === 'YUKLEME') {
                            setSecilenIrsaliyeRampa(rampa);
                            setIrsaliyeForm({
                              yukCinsi: 'Endüstriyel Parça & Otomotiv',
                              tonajKg: '21400',
                              paletSayisi: '32',
                              muhurNo: `MHR-${Math.floor(10000 + Math.random() * 90000)}`,
                            });
                            setIrsaliyeModalAcik(true);
                          } else {
                            handleOperasyonTamamla(rampa.id);
                          }
                        }}
                        className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        {rampa.operasyon_tipi === 'YUK_BOSALTMA' ? (
                          <>
                            <PackageCheck className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Boşaltmayı Tamamla</span>
                          </>
                        ) : (
                          <>
                            <FileText className="w-3.5 h-3.5 text-blue-400" />
                            <span>Sevk İrsaliyesi Düzenle</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setSecilenRampa(rampa);
                          if (sahadakiTirlar.length > 0) {
                            setSecilenTir(sahadakiTirlar[0]);
                          }
                          setAtamaModalAcik(true);
                        }}
                        className="w-full py-2 px-3 rounded-xl border border-slate-300 bg-slate-50 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700 text-slate-700 font-bold text-xs transition cursor-pointer"
                      >
                        + Tır Yanaştır
                      </button>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        </div>

        {/* ================= 4. ALT KONTROL & DENETİM MERKEZİ (SAHA, YOLDA & İHLALLER) ================= */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 space-y-4">
          
          {/* 3 Sekmeli Seçici */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
              
              {/* 1. Sahada Bekleyenler */}
              <button
                type="button"
                onClick={() => setAktifAltSekme('sahada')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  aktifAltSekme === 'sahada'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Sahada Bekleyenler</span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                  aktifAltSekme === 'sahada' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'
                }`}>
                  {sahadakiTirlar.length}
                </span>
              </button>

              {/* 2. Yoldaki Araçlar */}
              <button
                type="button"
                onClick={() => setAktifAltSekme('yolda')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  aktifAltSekme === 'yolda'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Yoldaki Seferler</span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                  aktifAltSekme === 'yolda' ? 'bg-purple-100 text-purple-800' : 'bg-slate-200 text-slate-600'
                }`}>
                  {yoldakiTirlar.length}
                </span>
              </button>

              {/* 3. İHLAL KAYITLARI (VERİTABANI DENETİM MERKEZİ) */}
              <button
                type="button"
                onClick={() => setAktifAltSekme('ihlaller')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  aktifAltSekme === 'ihlaller'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-red-700 hover:bg-red-50'
                }`}
              >
                <AlertOctagon className="w-3.5 h-3.5" />
                <span>İhlal Kayıtları</span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                  aktifAltSekme === 'ihlaller' ? 'bg-white/20 text-white' : 'bg-red-100 text-red-800'
                }`}>
                  {ihlaller.length}
                </span>
              </button>
            </div>

            <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Veritabanı Canlı Senkronizasyon</span>
            </div>
          </div>

          {/* ================= 1. SEKME: SAHADA BEKLEYENLER ================= */}
          {aktifAltSekme === 'sahada' && (
            <div>
              {filtrelenmisSahadakiler.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-xs">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-300 flex items-center justify-center mx-auto mb-2 border border-slate-100">
                    <Truck className="w-6 h-6" />
                  </div>
                  <p className="font-bold text-slate-700">Sahada rampa ataması bekleyen araç bulunmuyor.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Kiosk kapısından giriş yapan tırlar burada listelenir.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filtrelenmisSahadakiler.map((tir) => {
                    const isIncoming = tir.varis_sehri === operatorSehir;
                    return (
                      <div
                        key={tir.id}
                        className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition flex items-center justify-between gap-3 bg-slate-50/50 hover:bg-white"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center rounded overflow-hidden border border-slate-300 bg-white shadow-2xs">
                              <span className="bg-[#003399] text-white text-[9px] font-extrabold px-1.5 py-0.5">
                                TR
                              </span>
                              <span className="px-2 py-0.5 text-xs font-mono font-bold text-slate-900">
                                {tir.plaka}
                              </span>
                            </div>

                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              isIncoming ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {isIncoming ? 'Yük Boşaltacak' : 'Yüklenecek'}
                            </span>
                          </div>

                          <div className="text-xs font-bold text-slate-800">
                            {tir.sofor_ad_soyad}
                          </div>

                          <div className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span>{tir.kalkis_sehri} → {tir.varis_sehri}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSecilenTir(tir);
                            setSecilenOperasyon(isIncoming ? 'YUK_BOSALTMA' : 'YUKLEME');
                            const bosRampa = rampalar.find(r => r.durum === 'BOS');
                            if (bosRampa) setSecilenRampa(bosRampa);
                            setAtamaModalAcik(true);
                          }}
                          className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-blue-600 text-white font-bold text-xs transition cursor-pointer shadow-xs shrink-0"
                        >
                          Rampaya Ata
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ================= 2. SEKME: YOLDAKİLER ================= */}
          {aktifAltSekme === 'yolda' && (
            <div>
              {yoldakiTirlar.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-xs">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-300 flex items-center justify-center mx-auto mb-2 border border-slate-100">
                    <Activity className="w-6 h-6" />
                  </div>
                  <p className="font-bold text-slate-700">Şu anda bu terminale doğru yolda araç bulunmuyor.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Diğer limanlardan çıkış onayı alan tırlar burada belirecektir.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {yoldakiTirlar.map((arac) => (
                    <div
                      key={arac.id}
                      className="p-4 rounded-xl border border-slate-200 flex items-center justify-between gap-3 bg-slate-50/50"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center rounded overflow-hidden border border-slate-300 bg-white shadow-2xs w-fit">
                          <span className="bg-[#003399] text-white text-[9px] font-extrabold px-1.5 py-0.5">
                            TR
                          </span>
                          <span className="px-2 py-0.5 text-xs font-mono font-bold text-slate-900">
                            {arac.plaka}
                          </span>
                        </div>

                        <div className="text-xs font-bold text-slate-800">
                          {arac.sofor_ad_soyad}
                        </div>

                        <div className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{arac.kalkis_sehri} → {arac.varis_sehri}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                          Tahmini Varış
                        </span>
                        <div className="text-xs font-mono font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-md border border-amber-200/80 inline-flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>{arac.randevu_saati}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ================= 3. SEKME: İHLAL KAYITLARI TABLOSU (VERİTABANI CANLI) ================= */}
          {aktifAltSekme === 'ihlaller' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-red-700 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Liman ve Otoyol İhlal Tutanakları</span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Kiosk kapısında toleransı aşan (30 dk+) veya hatalı rota deneyen araçlar otomatik loglanır.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
                    {ihlaller.length} Tutanak Kayıtlı
                  </span>
                </div>
              </div>

              {filtrelenmisIhlaller.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-100">
                  <Check className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="font-bold text-slate-700">Kayıtlı herhangi bir ihlal bulunmuyor.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Tüm araçlar zamanında ve rotasına uygun hareket ediyor.</p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="py-3 px-4">Araç Plakası</th>
                          <th className="py-3 px-4">İhlal Türü</th>
                          <th className="py-3 px-4">Tutanak / Açıklama</th>
                          <th className="py-3 px-4">Zaman</th>
                          <th className="py-3 px-4 text-right">Durum</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filtrelenmisIhlaller.map((ihlal) => {
                          const tarihStr = ihlal.tarih ? new Date(ihlal.tarih).toLocaleString('tr-TR') : 'Şimdi';
                          return (
                            <tr key={ihlal.id} className="hover:bg-slate-50/80 transition font-medium">
                              {/* Plaka */}
                              <td className="py-3 px-4">
                                <div className="flex items-center rounded overflow-hidden border border-slate-300 bg-white w-fit shadow-2xs">
                                  <span className="bg-[#003399] text-white text-[8px] font-extrabold px-1 py-0.5">
                                    TR
                                  </span>
                                  <span className="px-2 py-0.5 text-xs font-mono font-bold text-slate-900">
                                    {ihlal.plaka}
                                  </span>
                                </div>
                              </td>

                              {/* İhlal Türü */}
                              <td className="py-3 px-4">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200/80">
                                  <AlertOctagon className="w-3 h-3 text-red-600 shrink-0" />
                                  <span>{ihlal.ihlal_tipi}</span>
                                </span>
                              </td>

                              {/* Açıklama */}
                              <td className="py-3 px-4 text-slate-700 font-normal max-w-xs">
                                {ihlal.aciklama}
                              </td>

                              {/* Tarih */}
                              <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                                {tarihStr}
                              </td>

                              {/* Durum Rozeti */}
                              <td className="py-3 px-4 text-right">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-slate-100 text-slate-700 border border-slate-200">
                                  KAYITLI
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

      </main>

      {/* ================= RAMPA ATAMA MODALI ================= */}
      {atamaModalAcik && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-200 relative animate-fade-in space-y-5">
            
            <button
              onClick={() => {
                setAtamaModalAcik(false);
                setSecilenRampa(null);
                setSecilenTir(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold mb-1 border border-blue-200">
                <span>Rampa Atama Protokolü</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                Rampaya Tır Yerleştir
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Sahadaki tırı boş istasyona yönlendirip operasyonu başlatın.
              </p>
            </div>

            <div className="space-y-4">
              {/* Rampa Seçimi */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Müsait Rampa İstasyonu
                </label>
                <select
                  value={secilenRampa?.id || ''}
                  onChange={(e) => {
                    const r = rampalar.find((x) => x.id === e.target.value);
                    setSecilenRampa(r || null);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 cursor-pointer"
                >
                  <option value="">Rampa İstasyonu Seçin</option>
                  {rampalar
                    .filter((r) => r.durum === 'BOS')
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        Rampa #{r.numara} ({r.ad}) — Boş
                      </option>
                    ))}
                </select>
              </div>

              {/* Tır Seçimi */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Sahadaki Araç
                </label>
                <select
                  value={secilenTir?.id || ''}
                  onChange={(e) => {
                    const t = sahadakiTirlar.find((x) => x.id === e.target.value);
                    setSecilenTir(t || null);
                    if (t) {
                      setSecilenOperasyon(t.varis_sehri === operatorSehir ? 'YUK_BOSALTMA' : 'YUKLEME');
                    }
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 cursor-pointer"
                >
                  <option value="">Tır Seçin</option>
                  {sahadakiTirlar.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.plaka} — {t.sofor_ad_soyad} ({t.kalkis_sehri} → {t.varis_sehri})
                    </option>
                  ))}
                </select>
              </div>

              {/* Operasyon Türü */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Operasyon Türü
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSecilenOperasyon('YUK_BOSALTMA')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      secilenOperasyon === 'YUK_BOSALTMA'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {secilenOperasyon === 'YUK_BOSALTMA' && <Check className="w-3.5 h-3.5 text-blue-400" />}
                    <span>📦 Yük Boşaltma</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSecilenOperasyon('YUKLEME')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      secilenOperasyon === 'YUKLEME'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {secilenOperasyon === 'YUKLEME' && <Check className="w-3.5 h-3.5 text-blue-400" />}
                    <span>🚚 Yükleme (Sevk)</span>
                  </button>
                </div>
              </div>

              {/* Onayla Butonu */}
              <button
                type="button"
                disabled={!secilenRampa || !secilenTir || islemYapiliyor}
                onClick={handleRampaAta}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {islemYapiliyor ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Rampaya Yerleştir ve Başlat</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* DİJİTAL SEVK İRSALİYESİ DÜZENLEME MODALI */}
      {irsaliyeModalAcik && secilenIrsaliyeRampa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            
            {/* Modal Başlık */}
            <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    Resmi Dijital Sevk İrsaliyesi Düzenle
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    {secilenIrsaliyeRampa.ad} · Yükleme Tamamlandı
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIrsaliyeModalAcik(false);
                  setSecilenIrsaliyeRampa(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Gövdesi */}
            <form onSubmit={handleIrsaliyeOlustur} className="p-5 space-y-4">
              
              {/* Tır & Rota Özeti */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Taşıyıcı Araç</span>
                  <span className="font-mono font-extrabold text-slate-900 text-sm">
                    {secilenIrsaliyeRampa.plaka || '34 LOR 2024'}
                  </span>
                  <span className="text-slate-500 block text-[11px]">
                    {secilenIrsaliyeRampa.sofor_ad_soyad || 'Sürücü'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Sevk Rotası</span>
                  <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-xs">
                    {secilenIrsaliyeRampa.kalkis_sehri || operatorSehir} → {secilenIrsaliyeRampa.varis_sehri || 'Hedef'}
                  </span>
                </div>
              </div>

              {/* Yük Cinsi */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Yük Cinsi / Emtia Türü
                </label>
                <input
                  type="text"
                  required
                  value={irsaliyeForm.yukCinsi}
                  onChange={(e) => setIrsaliyeForm({ ...irsaliyeForm, yukCinsi: e.target.value })}
                  placeholder="Örn: Endüstriyel Yedek Parça & Otomotiv"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                />
                
                {/* Hızlı Seçim Butonları */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[
                    'Endüstriyel & Otomotiv',
                    'Paletli Soğuk Gıda',
                    'Beyaz Eşya & Elektronik',
                    'Tekstil & Konfeksiyon',
                    'İhracat Konteyner Yükü'
                  ].map((tip) => (
                    <button
                      key={tip}
                      type="button"
                      onClick={() => setIrsaliyeForm({ ...irsaliyeForm, yukCinsi: tip })}
                      className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-[10px] font-semibold text-slate-700 transition cursor-pointer"
                    >
                      + {tip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Net Tonaj ve Palet Sayısı (Yan Yana) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Scale className="w-3.5 h-3.5 text-slate-400" />
                    <span>Net Yük (KG)</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={100}
                    max={40000}
                    value={irsaliyeForm.tonajKg}
                    onChange={(e) => setIrsaliyeForm({ ...irsaliyeForm, tonajKg: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    {(Number(irsaliyeForm.tonajKg) / 1000).toFixed(2)} Ton
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Box className="w-3.5 h-3.5 text-slate-400" />
                    <span>Palet / Koli Adedi</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={5000}
                    value={irsaliyeForm.paletSayisi}
                    onChange={(e) => setIrsaliyeForm({ ...irsaliyeForm, paletSayisi: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Standart Euro Palet</span>
                </div>
              </div>

              {/* Dorse Mühür No */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                  <span>Dorse Güvenlik Mühür Numarası</span>
                </label>
                <input
                  type="text"
                  required
                  value={irsaliyeForm.muhurNo}
                  onChange={(e) => setIrsaliyeForm({ ...irsaliyeForm, muhurNo: e.target.value })}
                  placeholder="Örn: MHR-88421"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                />
              </div>

              {/* Bilgilendirme Notu */}
              <div className="bg-blue-50/70 border border-blue-200/60 rounded-xl p-3 text-[11px] text-blue-900 leading-relaxed flex items-start gap-2">
                <FileText className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  Bu işlemle birlikte resmi <strong>LOS Dijital Sevk İrsaliyesi</strong> üretilecek ve sürücünün telefonuna iletilecektir. Sürücü e-imza attığında araç sistemde <strong>YOLDA</strong> statüsüne geçecektir.
                </span>
              </div>

              {/* Butonlar */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIrsaliyeModalAcik(false);
                    setSecilenIrsaliyeRampa(null);
                  }}
                  className="w-1/3 py-3 px-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
                >
                  Vazgeç
                </button>

                <button
                  type="submit"
                  disabled={islemYapiliyor}
                  className="w-2/3 py-3 px-4 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {islemYapiliyor ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <ClipboardCheck className="w-4 h-4 text-emerald-400" />
                      <span>İrsaliyeyi Kes & Sürücüye İlet</span>
                    </>
                  )}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
