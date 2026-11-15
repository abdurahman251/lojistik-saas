import { useState, useEffect } from 'react';
import Logo from './Logo';
import { 
  Truck, 
  User, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  LogOut, 
  RotateCcw, 
  MapPin, 
  AlertTriangle,
  Lock,
  Trash2,
  Calendar
} from 'lucide-react';
import { KullaniciBilgisi } from '../App';
import { authFetch } from '../api';

interface YoneticiPaneliProps {
  kullanici: KullaniciBilgisi;
  onCikis: () => void;
}

interface SurucuKaydi {
  id: string;
  kullanici_adi: string;
  plaka: string;
  sehir: string;
  rol: string;
  onay_durumu: 'BEKLEMEDE' | 'ONAYLANDI' | 'REDDEDILDI';
  olusturulma_tarihi: string;
}

export default function YoneticiPaneli({ kullanici, onCikis }: YoneticiPaneliProps) {
  const [bekleyenler, setBekleyenler] = useState<SurucuKaydi[]>([]);
  const [onaylananlar, setOnaylananlar] = useState<SurucuKaydi[]>([]);
  const [reddedilenler, setReddedilenler] = useState<SurucuKaydi[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [islemYapiliyorId, setIslemYapiliyorId] = useState<string | null>(null);
  const [bildirim, setBildirim] = useState<{ tur: 'basari' | 'hata'; mesaj: string } | null>(null);
  const [aktifSekme, setAktifSekme] = useState<'bekleyen' | 'onayli' | 'red'>('bekleyen');

  // Sürücü Listesini Getir
  const suruculeriGetir = async () => {
    try {
      setYukleniyor(true);
      const res = await authFetch('/api/admin/suruculer');
      const data = await res.json();
      if (data.basarili) {
        setBekleyenler(data.bekleyenler || []);
        setOnaylananlar(data.onaylananlar || []);
        setReddedilenler(data.reddedilenler || []);
      }
    } catch (err: any) {
      console.error('Sürücü listesi getirme hatası:', err);
    } finally {
      setYukleniyor(false);
    }
  };

  useEffect(() => {
    suruculeriGetir();
    const interval = setInterval(suruculeriGetir, 10000); // 10 saniyede bir otomatik tazele
    return () => clearInterval(interval);
  }, []);

  // Sürücüyü Onayla
  const handleOnayla = async (id: string, plaka: string) => {
    setIslemYapiliyorId(id);
    setBildirim(null);
    try {
      const res = await authFetch(`/api/admin/surucu-onayla/${id}`, { method: 'POST' });
      const data = await res.json();
      if (data.basarili) {
        setBildirim({ tur: 'basari', mesaj: data.mesaj || `${plaka} başarıyla onaylandı.` });
        await suruculeriGetir();
      } else {
        setBildirim({ tur: 'hata', mesaj: data.mesaj || 'Onay işlemi başarısız oldu.' });
      }
    } catch {
      setBildirim({ tur: 'hata', mesaj: 'Sunucu bağlantı hatası oluştu.' });
    } finally {
      setIslemYapiliyorId(null);
    }
  };

  // Sürücüyü Reddet
  const handleReddet = async (id: string, plaka: string) => {
    setIslemYapiliyorId(id);
    setBildirim(null);
    try {
      const res = await authFetch(`/api/admin/surucu-reddet/${id}`, { method: 'POST' });
      const data = await res.json();
      if (data.basarili) {
        setBildirim({ tur: 'basari', mesaj: data.mesaj || `${plaka} başvurusu reddedildi.` });
        await suruculeriGetir();
      } else {
        setBildirim({ tur: 'hata', mesaj: data.mesaj || 'Red işlemi başarısız oldu.' });
      }
    } catch {
      setBildirim({ tur: 'hata', mesaj: 'Sunucu bağlantı hatası oluştu.' });
    } finally {
      setIslemYapiliyorId(null);
    }
  };

  // Sürücüyü Sil
  const handleSil = async (id: string, plaka: string) => {
    if (!confirm(`${plaka} plakalı tır kaydını sistemden tamamen silmek istediğinize emin misiniz?`)) {
      return;
    }

    setIslemYapiliyorId(id);
    setBildirim(null);
    try {
      const res = await authFetch(`/api/admin/surucu-sil/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.basarili) {
        setBildirim({ tur: 'basari', mesaj: `${plaka} kaydı sistemden silindi.` });
        await suruculeriGetir();
      }
    } catch {
      setBildirim({ tur: 'hata', mesaj: 'Silme işlemi sırasında hata oluştu.' });
    } finally {
      setIslemYapiliyorId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 pb-12 select-none">
      
      {/* ================= ÜST BAŞLIK (HEADER) ================= */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          
          {/* Logo & Başlık */}
          <div className="flex items-center gap-3">
            <Logo variant="icon" size="sm" className="w-10 h-10 rounded-xl overflow-hidden shrink-0 shadow-xs" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 tracking-tight">Lojistik OS</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700 border border-purple-200">
                  Yönetici Konsolu
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">Güvenlik & Filo Onay Masası</p>
            </div>
          </div>

          {/* Sağ Alan: Kullanıcı ve Çıkış */}
          <div className="flex items-center gap-3">
            <button
              onClick={suruculeriGetir}
              disabled={yukleniyor}
              title="Yenile"
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              <RotateCcw className={`w-4 h-4 ${yukleniyor ? 'animate-spin' : ''}`} />
            </button>

            <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-slate-200 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-slate-600 font-medium">Yönetici:</span>
              <span className="font-semibold text-slate-900">{kullanici.kullaniciAdi}</span>
            </div>

            <button
              onClick={onCikis}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-medium transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Çıkış Yap</span>
            </button>
          </div>
        </div>
      </header>

      {/* ================= İÇERİK ALANI ================= */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        
        {/* Bildirim Alanı */}
        {bildirim && (
          <div className={`mb-6 p-4 rounded-2xl border text-sm font-medium flex items-center justify-between ${
            bildirim.tur === 'basari' 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-center gap-2">
              {bildirim.tur === 'basari' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
              )}
              <span>{bildirim.mesaj}</span>
            </div>
            <button 
              onClick={() => setBildirim(null)}
              className="text-xs opacity-70 hover:opacity-100 underline cursor-pointer"
            >
              Kapat
            </button>
          </div>
        )}

        {/* METRİK VE GÜVENLİK KARTLARI */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          
          {/* Kart 1: Bekleyen Başvurular */}
          <div 
            onClick={() => setAktifSekme('bekleyen')}
            className={`p-5 rounded-2xl border transition-all cursor-pointer ${
              aktifSekme === 'bekleyen' 
                ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-400/20' 
                : 'bg-white border-slate-200/80 hover:border-slate-300 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Onay Bekleyen</span>
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-slate-900 tracking-tight">
              {bekleyenler.length}
            </div>
            <p className="text-xs text-amber-700 font-medium mt-1">
              {bekleyenler.length > 0 ? 'İnceleme bekleyen yeni tır var' : 'Bekleyen başvuru yok'}
            </p>
          </div>

          {/* Kart 2: Aktif Onaylı Filo */}
          <div 
            onClick={() => setAktifSekme('onayli')}
            className={`p-5 rounded-2xl border transition-all cursor-pointer ${
              aktifSekme === 'onayli' 
                ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-400/20' 
                : 'bg-white border-slate-200/80 hover:border-slate-300 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Kayıtlı & Onaylı Tırlar</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                <Truck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-slate-900 tracking-tight">
              {onaylananlar.length}
            </div>
            <p className="text-xs text-emerald-700 font-medium mt-1">Sisteme giriş izni olan aktif filo</p>
          </div>

          {/* Kart 3: Güvenlik Modülleri */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Güvenlik Katmanları</span>
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                <Lock className="w-4 h-4" />
              </div>
            </div>
            <div className="space-y-1.5 mt-2 text-xs">
              <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Yönetici Onay Modülü: Aktif</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Brute-Force Koruması (5 Deneme / 15dk)</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>RBAC & JWT Doğrulama: Devrede</span>
              </div>
            </div>
          </div>
        </div>

        {/* ================= TAB BUTONLARI ================= */}
        <div className="flex items-center gap-2 mb-4 border-b border-slate-200 pb-3">
          <button
            onClick={() => setAktifSekme('bekleyen')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              aktifSekme === 'bekleyen'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Onay Bekleyen Başvurular</span>
            {bekleyenler.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-400 text-slate-900 font-black">
                {bekleyenler.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setAktifSekme('onayli')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              aktifSekme === 'onayli'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Onaylanmış Filo ({onaylananlar.length})</span>
          </button>

          <button
            onClick={() => setAktifSekme('red')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              aktifSekme === 'red'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Reddedilenler ({reddedilenler.length})</span>
          </button>
        </div>

        {/* ================= SEKME 1: ONAY BEKLEYENLER ================= */}
        {aktifSekme === 'bekleyen' && (
          <div>
            {bekleyenler.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Bekleyen Başvuru Bulunmuyor</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  Yeni bir sürücü veya tır kayıt olduğunda doğrulamak ve sisteme kabul etmek için burada listelenecektir.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {bekleyenler.map((surucu) => (
                  <div 
                    key={surucu.id} 
                    className="bg-white rounded-2xl border-2 border-amber-200 p-5 shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      {/* Üst Satır: Plaka & Şehir */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 text-white font-mono font-bold text-sm tracking-wider shadow-xs">
                          <Truck className="w-4 h-4 text-amber-400" />
                          <span>{surucu.plaka || 'PLAKASIZ'}</span>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          Onay Bekliyor
                        </span>
                      </div>

                      {/* Bilgiler */}
                      <div className="space-y-2 text-xs text-slate-600 mb-4 bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 flex items-center gap-1">
                            <User className="w-3.5 h-3.5" /> Kullanıcı:
                          </span>
                          <span className="font-semibold text-slate-800">{surucu.kullanici_adi}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" /> Bağlı Terminal:
                          </span>
                          <span className="font-semibold text-slate-800">{surucu.sehir}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" /> Başvuru Tarihi:
                          </span>
                          <span className="text-slate-700">
                            {new Date(surucu.olusturulma_tarihi).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Aksiyon Butonları */}
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => handleOnayla(surucu.id, surucu.plaka)}
                        disabled={islemYapiliyorId === surucu.id}
                        className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Onayla</span>
                      </button>

                      <button
                        onClick={() => handleReddet(surucu.id, surucu.plaka)}
                        disabled={islemYapiliyorId === surucu.id}
                        className="py-2 px-3 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reddet</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= SEKME 2: ONAYLANMIŞ FİLO ================= */}
        {aktifSekme === 'onayli' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Araç Plakası</th>
                    <th className="py-3 px-4">Kullanıcı Adı</th>
                    <th className="py-3 px-4">Bağlı Olduğu Şehir</th>
                    <th className="py-3 px-4">Kayıt Tarihi</th>
                    <th className="py-3 px-4">Durum</th>
                    <th className="py-3 px-4 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {onaylananlar.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {s.plaka || '-'}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-700">
                        {s.kullanici_adi}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {s.sehir}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {new Date(s.olusturulma_tarihi).toLocaleDateString('tr-TR')}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                          <CheckCircle2 className="w-3 h-3" /> Onaylı
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleSil(s.id, s.plaka)}
                          disabled={islemYapiliyorId === s.id}
                          title="Sistemden Sil"
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================= SEKME 3: REDDEDİLENLER ================= */}
        {aktifSekme === 'red' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            {reddedilenler.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                Reddedilmiş herhangi bir başvuru kaydı bulunmuyor.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Araç Plakası</th>
                      <th className="py-3 px-4">Kullanıcı Adı</th>
                      <th className="py-3 px-4">Şehir</th>
                      <th className="py-3 px-4">Durum</th>
                      <th className="py-3 px-4 text-right">Tekrar Onayla</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reddedilenler.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">{s.plaka}</td>
                        <td className="py-3 px-4 text-slate-700">{s.kullanici_adi}</td>
                        <td className="py-3 px-4 text-slate-600">{s.sehir}</td>
                        <td className="py-3 px-4">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                            Reddedildi
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleOnayla(s.id, s.plaka)}
                            disabled={islemYapiliyorId === s.id}
                            className="px-3 py-1 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition cursor-pointer"
                          >
                            Onayla
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}

