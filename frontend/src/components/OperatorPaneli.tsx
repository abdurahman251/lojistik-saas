import { useState, useEffect } from 'react';
import { 
  Anchor, 
  Box, 
  BarChart2, 
  AlertTriangle, 
  Settings, 
  LogOut, 
  Zap, 
  Truck, 
  Activity, 
  Clock, 
  ChevronRight, 
  X, 
  ArrowRight,
  PackageCheck
} from 'lucide-react';

interface KullaniciBilgisi {
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

interface OperatorPaneliProps {
  kullanici: KullaniciBilgisi;
  onCikis: () => void;
}

export default function OperatorPaneli({ kullanici, onCikis }: OperatorPaneliProps) {
  const operatorSehir = kullanici.sehir === 'YOK' ? 'ISTANBUL' : kullanici.sehir;

  // Şehir İsimleri ve Kısaltmaları
  const sehirDetay: Record<string, { ad: string; kod: string }> = {
    ISTANBUL: { ad: 'İSTANBUL TERMİNALİ', kod: 'IST' },
    ANKARA: { ad: 'ANKARA TERMİNALİ', kod: 'ANK' },
    IZMIR: { ad: 'İZMİR TERMİNALİ', kod: 'IZM' },
  };
  const terminalBilgisi = sehirDetay[operatorSehir] || { ad: `${operatorSehir} TERMİNALİ`, kod: 'TRM' };

  // Durumlar
  const [saatMetni, setSaatMetni] = useState('');
  const [rampalar, setRampalar] = useState<RampaVerisi[]>([]);
  const [sahadakiTirlar, setSahadakiTirlar] = useState<RandevuVerisi[]>([]);
  const [yoldakiTirlar, setYoldakiTirlar] = useState<RandevuVerisi[]>([]);
  const [istatistikler, setIstatistikler] = useState({
    sahadaSayisi: 0,
    doluRampaSayisi: 0,
    musaitRampaSayisi: 8,
    yoldaSayisi: 0,
    dolulukYuzdesi: 0,
  });
  const [, setYukleniyor] = useState(false);
  const [islemYapiliyor, setIslemYapiliyor] = useState(false);

  // Atama Modalı State
  const [secilenRampa, setSecilenRampa] = useState<RampaVerisi | null>(null);
  const [secilenTir, setSecilenTir] = useState<RandevuVerisi | null>(null);
  const [secilenOperasyon, setSecilenOperasyon] = useState<'YUK_BOSALTMA' | 'YUKLEME'>('YUK_BOSALTMA');
  const [atamaModalAcik, setAtamaModalAcik] = useState(false);

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
      const res = await fetch(`/api/operator/durum?sehir=${operatorSehir}`);
      const data = await res.json();
      if (data.basarili) {
        setRampalar(data.rampalar || []);
        setSahadakiTirlar(data.sahadakiTirlar || []);
        setYoldakiTirlar(data.yoldakiTirlar || []);
        setIstatistikler(data.istatistikler || {
          sahadaSayisi: 0,
          doluRampaSayisi: 0,
          musaitRampaSayisi: 8,
          yoldaSayisi: 0,
          dolulukYuzdesi: 0,
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
    // 10 saniyede bir otomatik yenile
    const periyodik = setInterval(durumGetir, 10000);
    return () => clearInterval(periyodik);
  }, [operatorSehir]);

  // Rampaya Tır Ata
  const handleRampaAta = async () => {
    if (!secilenRampa || !secilenTir) return;

    setIslemYapiliyor(true);
    try {
      const res = await fetch('/api/operator/rampa-ata', {
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
        alert(data.mesaj || 'Atama başarısız.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIslemYapiliyor(false);
    }
  };

  // Rampadaki Operasyonu Tamamla / Yola Çıkar
  const handleOperasyonTamamla = async (rampaId: string) => {
    if (!confirm('Bu rampadaki operasyonu tamamlayıp boşaltmak istiyor musunuz?')) return;

    setIslemYapiliyor(true);
    try {
      const res = await fetch('/api/operator/operasyon-tamamla', {
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

  return (
    <div className="min-h-screen w-full flex bg-[#f8fafc] text-slate-800 font-sans">
      {/* ================= SOL KENAR ÇUBUĞU (SIDEBAR) ================= */}
      <aside 
        className="w-64 shrink-0 bg-[#0c182a] text-white flex flex-col justify-between p-5 select-none relative"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px)
          `,
          backgroundSize: '24px 24px',
        }}
      >
        <div>
          {/* Logo & Marka */}
          <div className="flex items-center gap-3 mb-6">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-[#145dfa] flex items-center justify-center text-white shadow-md shadow-blue-500/30">
                <Anchor className="w-5 h-5 stroke-[2.3]" />
              </div>
              <span className="w-2.5 h-2.5 bg-emerald-400 border-2 border-[#0c182a] rounded-full absolute -bottom-0.5 -right-0.5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-tight leading-tight">Lojistik OS</h2>
              <p className="text-[11px] text-slate-400 font-medium">Operations Suite</p>
            </div>
          </div>

          {/* Aktif Bölge Kartı */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 mb-6">
            <span className="block text-[10px] font-bold text-blue-300 uppercase tracking-widest mb-0.5">
              AKTİF BÖLGE
            </span>
            <span className="font-extrabold text-sm tracking-wide text-white block truncate">
              {terminalBilgisi.ad}
            </span>
          </div>

          {/* Menü Öğeleri */}
          <nav className="space-y-1.5">
            <button
              type="button"
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-[#145dfa] text-white font-bold text-xs shadow-lg shadow-blue-500/25 transition cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Box className="w-4 h-4" />
                <span>Saha Yönetimi</span>
              </div>
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 font-semibold text-xs transition cursor-pointer"
            >
              <Box className="w-4 h-4 opacity-70" />
              <span>Rampa Planı</span>
            </button>

            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 font-semibold text-xs transition cursor-pointer"
            >
              <BarChart2 className="w-4 h-4 opacity-70" />
              <span>Analitik</span>
            </button>

            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 font-semibold text-xs transition cursor-pointer"
            >
              <AlertTriangle className="w-4 h-4 opacity-70" />
              <span>İhlal Kayıtları</span>
            </button>

            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 font-semibold text-xs transition cursor-pointer"
            >
              <Settings className="w-4 h-4 opacity-70" />
              <span>Ayarlar</span>
            </button>
          </nav>
        </div>

        {/* Alt Saat ve Oturumu Kapat */}
        <div className="space-y-3 pt-6 border-t border-white/10">
          <div className="bg-black/30 rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs font-mono">
            <div>
              <span className="block text-[9px] text-slate-400 uppercase tracking-widest font-sans font-bold">
                SİSTEM
              </span>
              <span className="font-bold text-slate-200">{saatMetni || '18:16:49'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-sans font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>CANLI</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onCikis}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-300 hover:text-red-200 text-xs font-bold transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>OTURUMU KAPAT</span>
          </button>
        </div>
      </aside>

      {/* ================= ANA İÇERİK ALANI ================= */}
      <main className="flex-1 p-6 sm:p-10 overflow-y-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* ÜST BAŞLIK & KPI KARTLARI */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/60 text-blue-700 text-[11px] font-bold tracking-wider mb-2">
                <span>✦ CANLI SAHA</span>
                <span className="text-blue-300">·</span>
                <span className="text-slate-500 font-medium">OTOMATİK YENİLEME · 10SN</span>
              </div>
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                Rampa Yönetimi
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Sahadaki araçları yönetin, rampa atayın ve liman trafiğini denetleyin.
              </p>
            </div>

            {/* 3 KPI KARTLARI (SAHADA, DOLU RAMPA, YOLDA) */}
            <div className="flex items-center gap-3 w-full lg:w-auto">
              {/* SAHADA */}
              <div className="flex-1 lg:w-32 bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs relative overflow-hidden">
                <div className="w-12 h-12 rounded-full bg-blue-100/60 absolute -right-2 -bottom-2 pointer-events-none" />
                <div className="flex items-center gap-1.5 text-slate-400 font-bold text-[10px] uppercase tracking-wider mb-1">
                  <Truck className="w-3.5 h-3.5 text-blue-600" />
                  <span>SAHADA</span>
                </div>
                <span className="text-2xl font-extrabold text-slate-900 font-mono">
                  {istatistikler.sahadaSayisi}
                </span>
              </div>

              {/* DOLU RAMPA */}
              <div className="flex-1 lg:w-36 bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs relative overflow-hidden">
                <div className="w-12 h-12 rounded-full bg-emerald-100/60 absolute -right-2 -bottom-2 pointer-events-none" />
                <div className="flex items-center gap-1.5 text-slate-400 font-bold text-[10px] uppercase tracking-wider mb-1">
                  <Box className="w-3.5 h-3.5 text-emerald-600" />
                  <span>DOLU RAMPA</span>
                </div>
                <span className="text-2xl font-extrabold text-slate-900 font-mono">
                  {istatistikler.doluRampaSayisi}/8
                </span>
              </div>

              {/* YOLDA */}
              <div className="flex-1 lg:w-32 bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs relative overflow-hidden">
                <div className="w-12 h-12 rounded-full bg-amber-100/60 absolute -right-2 -bottom-2 pointer-events-none" />
                <div className="flex items-center gap-1.5 text-slate-400 font-bold text-[10px] uppercase tracking-wider mb-1">
                  <Activity className="w-3.5 h-3.5 text-amber-600" />
                  <span>YOLDA</span>
                </div>
                <span className="text-2xl font-extrabold text-slate-900 font-mono">
                  {istatistikler.yoldaSayisi}
                </span>
              </div>
            </div>
          </div>

          {/* TERMİNAL DOLULUK İLERLEME ÇUBUĞU */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/30">
              <Zap className="w-5 h-5 fill-white" />
            </div>

            <div className="flex-1">
              <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                <span className="text-slate-400 uppercase tracking-wider">
                  TERMİNAL DOLULUK
                </span>
                <span className="text-slate-900 font-mono text-sm">
                  %{istatistikler.dolulukYuzdesi}
                </span>
              </div>

              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#145dfa] rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(istatistikler.dolulukYuzdesi, 2)}%` }}
                />
              </div>
            </div>

            <div className="text-right text-xs font-semibold text-slate-400 shrink-0">
              <span className="text-slate-700 font-bold">{istatistikler.doluRampaSayisi} dolu</span> · {istatistikler.musaitRampaSayisi} müsait
            </div>
          </div>

          {/* ================= TERMINAL İSTASYONLARI (8 RAMPA KARTLARI) ================= */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Box className="w-4 h-4 text-blue-600" />
                <h3 className="font-extrabold text-sm tracking-wider uppercase text-slate-900">
                  TERMINAL İSTASYONLARI
                </h3>
              </div>
              <span className="text-xs font-semibold text-slate-400">8 İstasyon</span>
            </div>

            {/* 8 Rampa Grid (4x2) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {rampalar.map((rampa) => {
                const doluMu = rampa.durum === 'DOLU';

                return (
                  <div
                    key={rampa.id}
                    className={`rounded-2xl p-5 border transition flex flex-col justify-between min-h-[190px] relative ${
                      doluMu 
                        ? 'bg-white border-blue-200 shadow-md shadow-blue-500/5' 
                        : 'bg-white border-slate-200/80 shadow-xs hover:border-slate-300'
                    }`}
                  >
                    {/* Üst Satır: Durum Noktası ve İstasyon Kodu */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 font-bold">
                        <span className={`w-2 h-2 rounded-full ${doluMu ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                        <span className={doluMu ? 'text-amber-700' : 'text-slate-400'}>
                          {doluMu ? (rampa.operasyon_tipi === 'YUK_BOSALTMA' ? 'BOŞALTMA YAPILIYOR' : 'YÜKLEME YAPILIYOR') : 'MÜSAİT'}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-slate-300 text-xs">
                        {terminalBilgisi.kod} #{rampa.numara}
                      </span>
                    </div>

                    {/* Orta Gövde */}
                    {doluMu ? (
                      <div className="my-auto py-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          ATANAN TIR
                        </span>
                        <h4 className="font-mono font-extrabold text-xl text-slate-900 tracking-tight">
                          {rampa.plaka}
                        </h4>
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-1 truncate">
                          <span>{rampa.sofor_ad_soyad || 'Sürücü'}</span>
                          <span className="text-slate-300">·</span>
                          <span className="font-semibold text-blue-600">
                            {rampa.operasyon_tipi === 'YUK_BOSALTMA' ? 'Yük Boşaltma' : 'Yükleme'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="my-auto text-center py-4">
                        <div className="w-12 h-12 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center mx-auto mb-2 text-slate-300">
                          <Box className="w-6 h-6 stroke-[1.5]" />
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          ATAMA BEKLİYOR
                        </span>
                      </div>
                    )}

                    {/* Alt Aksiyon Butonu */}
                    <div>
                      {doluMu ? (
                        <button
                          type="button"
                          disabled={islemYapiliyor}
                          onClick={() => handleOperasyonTamamla(rampa.id)}
                          className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-black active:scale-[0.98] text-white font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <PackageCheck className="w-3.5 h-3.5" />
                          <span>
                            {rampa.operasyon_tipi === 'YUK_BOSALTMA' ? 'Boşaltmayı Bitir' : 'Yola Çıkar'}
                          </span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSecilenRampa(rampa);
                            setAtamaModalAcik(true);
                          }}
                          className="w-full py-2 px-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 active:scale-[0.98] text-slate-600 font-bold text-xs transition cursor-pointer"
                        >
                          Tır Ata +
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ================= ALT İKİ PANEL (SAHADA BEKLEYENLER & YOLDAKİLER) ================= */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
            {/* 1. SOL PANEL: SAHADA BEKLEYEN TIRLAR */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#145dfa] flex items-center justify-center text-white shadow-sm shadow-blue-500/20">
                      <Box className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900 leading-tight uppercase tracking-wide">
                        SAHADA BEKLEYEN TIRLAR
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">Rampa atama bekliyor</p>
                    </div>
                  </div>

                  <span className="px-3 py-1 rounded-full bg-blue-50 border border-blue-200/70 text-blue-700 font-bold text-xs">
                    {sahadakiTirlar.length} ARAÇ
                  </span>
                </div>

                {/* Liste veya Boş Durum */}
                {sahadakiTirlar.length === 0 ? (
                  <div className="py-12 text-center text-slate-300 flex flex-col items-center justify-center">
                    <Truck className="w-12 h-12 stroke-[1.2] mb-2 opacity-50" />
                    <span className="text-xs font-bold text-slate-400 tracking-wider uppercase">
                      BEKLEYEN ARAÇ YOK
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Kiosk kapısından onay alan tırlar burada listelenir.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {sahadakiTirlar.map((tir) => {
                      const isIncoming = tir.varis_sehri === operatorSehir;

                      return (
                        <div
                          key={tir.id}
                          className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/70 flex items-center justify-between hover:bg-slate-100/70 transition"
                        >
                          <div>
                            <span className="font-mono font-extrabold text-lg text-slate-900 tracking-tight block">
                              {tir.plaka}
                            </span>
                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                              <span className="font-medium text-slate-700">{tir.sofor_ad_soyad}</span>
                              <span>·</span>
                              <span className="font-semibold text-blue-600">
                                {tir.kalkis_sehri} → {tir.varis_sehri}
                              </span>
                            </div>
                            <span className={`inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isIncoming ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}>
                              {isIncoming ? 'Yük Boşaltılacak (Hedefe Vardı)' : 'Yüklenecek (Kalkış Yapacak)'}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setSecilenTir(tir);
                              setSecilenOperasyon(isIncoming ? 'YUK_BOSALTMA' : 'YUKLEME');
                              setAtamaModalAcik(true);
                            }}
                            className="py-2 px-3.5 rounded-xl bg-[#145dfa] hover:bg-[#0f4ed4] active:scale-95 text-white font-bold text-xs transition cursor-pointer shadow-sm shadow-blue-500/20 shrink-0"
                          >
                            Rampaya Ata
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 2. SAĞ PANEL: YOLDAKİ ARAÇLAR */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-white shadow-sm shadow-amber-500/20">
                      <Truck className="w-5 h-5 stroke-[2.2]" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900 leading-tight uppercase tracking-wide">
                        YOLDAKİ ARAÇLAR
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">Tahmini varış · gelen kargo</p>
                    </div>
                  </div>

                  <span className="px-3 py-1 rounded-full bg-amber-50 border border-amber-200/70 text-amber-700 font-bold text-xs">
                    {yoldakiTirlar.length} ARAÇ
                  </span>
                </div>

                {/* Yoldaki Araçlar Listesi */}
                {yoldakiTirlar.length === 0 ? (
                  <div className="py-12 text-center text-slate-300 flex flex-col items-center justify-center">
                    <Activity className="w-12 h-12 stroke-[1.2] mb-2 opacity-50" />
                    <span className="text-xs font-bold text-slate-400 tracking-wider uppercase">
                      YOLDA ARAÇ BULUNMUYOR
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Diğer limanlardan yola çıkan araçlar burada belirecektir.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {yoldakiTirlar.map((arac) => (
                      <div
                        key={arac.id}
                        className="bg-slate-50/70 rounded-2xl p-4 border border-slate-200/70 flex items-center justify-between hover:bg-slate-100/70 transition"
                      >
                        <div>
                          <span className="font-mono font-extrabold text-xl text-slate-900 tracking-tight block">
                            {arac.plaka}
                          </span>
                          <div className="flex items-center gap-2 text-xs mt-1">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                              ROTA
                            </span>
                            <span className="font-semibold text-slate-700">
                              {arac.kalkis_sehri} → <span className="text-[#145dfa] font-bold">BURADAYIZ</span>
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                            TAHMİNİ VARIŞ
                          </span>
                          <div className="inline-flex items-center gap-1.5 font-mono font-extrabold text-sm text-slate-800">
                            <Clock className="w-3.5 h-3.5 text-amber-500" />
                            <span>{arac.randevu_saati || '12:50'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Alt Footer Notu */}
          <div className="pt-4 text-center">
            <span className="font-mono text-[11px] text-slate-400 tracking-wider">
              LOJİSTİK OS · OPERATIONS SUITE V2.0
            </span>
          </div>
        </div>
      </main>

      {/* ================= RAMPA ATAMA MODALI ================= */}
      {atamaModalAcik && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-100 relative animate-fade-in">
            <button
              onClick={() => {
                setAtamaModalAcik(false);
                setSecilenRampa(null);
                setSecilenTir(null);
              }}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-blue-50 text-[#145dfa] rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-xs">
                <Box className="w-6 h-6 stroke-[2.3]" />
              </div>
              <h3 className="text-xl font-extrabold text-slate-900">Rampa Ataması Yap</h3>
              <p className="text-xs text-slate-400 mt-0.5">Sahada bekleyen aracı uygun istasyona yönlendirin</p>
            </div>

            <div className="space-y-4">
              {/* 1. Rampa Seçimi */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Hedef Rampa İstasyonu
                </label>
                <select
                  value={secilenRampa?.id || ''}
                  onChange={(e) => {
                    const r = rampalar.find((x) => x.id === e.target.value);
                    setSecilenRampa(r || null);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                >
                  <option value="">Rampa Seçiniz</option>
                  {rampalar
                    .filter((r) => r.durum === 'BOS')
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {terminalBilgisi.kod} #{r.numara} ({r.ad}) - MÜSAİT
                      </option>
                    ))}
                </select>
              </div>

              {/* 2. Sahadaki Tır Seçimi */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Sahada Bekleyen Tır
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
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                >
                  <option value="">Tır Seçiniz</option>
                  {sahadakiTirlar.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.plaka} - {t.sofor_ad_soyad} ({t.kalkis_sehri} → {t.varis_sehri})
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Operasyon Tipi Seçimi */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Operasyon Türü
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSecilenOperasyon('YUK_BOSALTMA')}
                    className={`p-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                      secilenOperasyon === 'YUK_BOSALTMA'
                        ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>📦 Yük Boşaltma</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSecilenOperasyon('YUKLEME')}
                    className={`p-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                      secilenOperasyon === 'YUKLEME'
                        ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>🚚 Yükleme (Sevk)</span>
                  </button>
                </div>
              </div>

              {/* Onayla Butonu */}
              <button
                type="button"
                disabled={!secilenRampa || !secilenTir || islemYapiliyor}
                onClick={handleRampaAta}
                className="w-full mt-3 py-3.5 px-4 rounded-xl bg-[#145dfa] hover:bg-[#0f4ed4] active:scale-[0.99] text-white font-bold text-sm shadow-lg shadow-blue-500/25 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {islemYapiliyor ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Rampaya Yerleştir</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
