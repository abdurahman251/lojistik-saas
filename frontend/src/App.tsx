import React, { useState } from 'react';
import { 
  Truck, 
  User, 
  Lock, 
  Terminal, 
  MessageSquare, 
  LayoutGrid, 
  CheckCircle2, 
  AlertCircle,
  LogOut,
  Shield,
  MapPin,
  UserPlus,
  ArrowRight
} from 'lucide-react';
import SurucuPortali from './components/SurucuPortali';
import KioskEkrani from './components/KioskEkrani';
import OperatorPaneli from './components/OperatorPaneli';

export interface KullaniciBilgisi {
  id: string;
  kullaniciAdi: string;
  rol: 'YONETICI' | 'OPERATOR' | 'KIOSK' | 'SURUCU';
  sehir: 'ISTANBUL' | 'ANKARA' | 'IZMIR' | 'YOK';
  plaka?: string | null;
}

export default function App() {
  const [mod, setMod] = useState<'giris' | 'kayit'>('giris');

  // Giriş State
  const [girisDegeri, setGirisDegeri] = useState('');
  const [sifre, setSifre] = useState('');

  // Tır Kayıt State
  const [kayitPlaka, setKayitPlaka] = useState('');
  const [kayitKullaniciAdi, setKayitKullaniciAdi] = useState('');
  const [kayitSehir, setKayitSehir] = useState<'ISTANBUL' | 'ANKARA' | 'IZMIR'>('ISTANBUL');
  const [kayitSifre, setKayitSifre] = useState('');
  const [kayitSifreTekrar, setKayitSifreTekrar] = useState('');

  // Genel Durumlar
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hataMesaji, setHataMesaji] = useState<string | null>(null);

  const [aktifKullanici, setAktifKullanici] = useState<KullaniciBilgisi | null>(() => {
    const kayitli = localStorage.getItem('lojistik_kullanici');
    return kayitli ? JSON.parse(kayitli) : null;
  });

  // Hızlı test butonları tıklandığında yalnızca inputları doldurur (Kritik kural)
  const testGirisiniDoldur = (deger: string, sifreDegeri: string = '123456') => {
    setMod('giris');
    setGirisDegeri(deger);
    setSifre(sifreDegeri);
    setHataMesaji(null);
  };

  const handleGirisYap = async (e: React.FormEvent) => {
    e.preventDefault();
    setHataMesaji(null);

    if (!girisDegeri.trim() || !sifre.trim()) {
      setHataMesaji('Lütfen kullanıcı adı / plaka ve şifrenizi girin.');
      return;
    }

    setYukleniyor(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          girisDegeri: girisDegeri.trim(),
          sifre: sifre.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.basarili) {
        throw new Error(data.mesaj || 'Giriş yapılamadı.');
      }

      // Başarılı giriş
      localStorage.setItem('lojistik_token', data.token);
      localStorage.setItem('lojistik_kullanici', JSON.stringify(data.kullanici));
      setAktifKullanici(data.kullanici);
    } catch (err: any) {
      setHataMesaji(err.message || 'Giriş başarısız. Lütfen bilgilerinizi kontrol edin.');
    } finally {
      setYukleniyor(false);
    }
  };

  const handleTirKaydi = async (e: React.FormEvent) => {
    e.preventDefault();
    setHataMesaji(null);

    if (!kayitPlaka.trim()) {
      setHataMesaji('Lütfen geçerli bir araç plakası girin.');
      return;
    }

    if (kayitSifre.length < 6) {
      setHataMesaji('Şifre en az 6 karakter uzunluğunda olmalıdır.');
      return;
    }

    if (kayitSifre !== kayitSifreTekrar) {
      setHataMesaji('Girdiğiniz şifreler birbiriyle uyuşmuyor.');
      return;
    }

    setYukleniyor(true);
    try {
      const response = await fetch('/api/auth/kayit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plaka: kayitPlaka.trim(),
          kullaniciAdi: kayitKullaniciAdi.trim() || undefined,
          sehir: kayitSehir,
          sifre: kayitSifre.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.basarili) {
        throw new Error(data.mesaj || 'Kayıt oluşturulamadı.');
      }

      // Başarılı kayıt: doğrudan sisteme giriş yap
      localStorage.setItem('lojistik_token', data.token);
      localStorage.setItem('lojistik_kullanici', JSON.stringify(data.kullanici));
      setAktifKullanici(data.kullanici);
    } catch (err: any) {
      setHataMesaji(err.message || 'Kayıt esnasında bir hata oluştu.');
    } finally {
      setYukleniyor(false);
    }
  };

  const handleCikisYap = () => {
    localStorage.removeItem('lojistik_token');
    localStorage.removeItem('lojistik_kullanici');
    setAktifKullanici(null);
    setGirisDegeri('');
    setSifre('');
    setHataMesaji(null);
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

    // 3. Operatör Girişi ise: Rampa ve Saha Yönetimi Paneli (Yeni Ekran)
    if (aktifKullanici.rol === 'OPERATOR') {
      return <OperatorPaneli kullanici={aktifKullanici} onCikis={handleCikisYap} />;
    }

    // 4. Yönetici rolü için geçici görünüm
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-xl border border-slate-100 text-center animate-fade-in">
          <div className="w-16 h-16 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-1">Yönetici Girişi Başarılı</h2>
          <p className="text-sm text-slate-500 mb-6">Supabase üzerinden kimlik doğrulandı.</p>

          <div className="bg-slate-50 rounded-2xl p-4 text-left mb-6 space-y-3 border border-slate-100">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 flex items-center gap-1.5">
                <User className="w-4 h-4 text-slate-400" /> Kullanıcı:
              </span>
              <span className="font-semibold text-slate-800">{aktifKullanici.kullaniciAdi}</span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-slate-400" /> Rol:
              </span>
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold border bg-purple-100 text-purple-700 border-purple-200">
                {aktifKullanici.rol}
              </span>
            </div>
          </div>

          <button
            onClick={handleCikisYap}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-sm transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Çıkış Yap / Giriş Ekranına Dön
          </button>
        </div>
      </div>
    );
  }

  // ================= GİRİŞ & KAYIT EKRANI =================
  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-white">
      {/* SOL PANEL (Mavi Lojistik Alanı) */}
      <div className="w-full md:w-[48%] bg-[#004aad] flex flex-col justify-between p-8 sm:p-12 lg:p-16 text-white min-h-[460px] md:min-h-screen">
        {/* İllüstrasyon Kartı */}
        <div className="flex-1 flex items-center justify-center my-auto">
          <div className="w-full max-w-[370px] aspect-square rounded-[32px] overflow-hidden shadow-2xl bg-white/10 flex items-center justify-center border border-white/15 backdrop-blur-sm">
            <img 
              src="/lojistik-hero.png" 
              alt="Kurumsal Lojistik Yönetim Portalı"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Başlık ve Açıklama */}
        <div className="mt-8 max-w-md">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
            Kurumsal Lojistik<br />
            Yönetim Portalı
          </h1>
          <p className="mt-3 text-sm sm:text-base text-blue-100/90 font-normal leading-relaxed">
            Verimli randevu yönetimi, gerçek zamanlı tır takibi ve operasyonel mükemmellik için tek merkez.
          </p>
        </div>
      </div>

      {/* SAĞ PANEL (Giriş / Tır Kayıt Formu ve Hızlı Erişim) */}
      <div className="w-full md:w-[52%] flex items-center justify-center p-6 sm:p-10 lg:p-14 bg-white overflow-y-auto">
        <div className="w-full max-w-[420px]">
          {/* Üst Logo/İkon ve Mod Seçici */}
          <div className="flex items-center justify-between mb-6">
            <div className="w-12 h-12 rounded-2xl bg-[#145dfa] flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Truck className="w-6 h-6 stroke-[2.2]" />
            </div>

            {/* Giriş / Kayıt Geçiş Tabı */}
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => { setMod('giris'); setHataMesaji(null); }}
                className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
                  mod === 'giris' 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Giriş Yap
              </button>
              <button
                type="button"
                onClick={() => { setMod('kayit'); setHataMesaji(null); }}
                className={`px-3.5 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer ${
                  mod === 'kayit' 
                    ? 'bg-white text-[#145dfa] shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                Tır Kaydı
              </button>
            </div>
          </div>

          {/* Başlıklar */}
          {mod === 'giris' ? (
            <>
              <h2 className="text-2xl sm:text-[28px] font-bold text-slate-900 tracking-tight">
                Hoş Geldiniz
              </h2>
              <p className="text-sm text-slate-500 mt-1 mb-6">
                Lütfen kimlik bilgilerinizle giriş yapın
              </p>
            </>
          ) : (
            <>
              <h2 className="text-2xl sm:text-[28px] font-bold text-slate-900 tracking-tight">
                Yeni Tır Sürücü Kaydı
              </h2>
              <p className="text-sm text-slate-500 mt-1 mb-6">
                Sisteme dahil olmak için plaka ve bilgilerinizi tanımlayın
              </p>
            </>
          )}

          {/* Hata Uyarısı */}
          {hataMesaji && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-100 flex items-start gap-2.5 text-red-600 text-xs animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{hataMesaji}</span>
            </div>
          )}

          {/* ================= GİRİŞ FORMU ================= */}
          {mod === 'giris' ? (
            <form onSubmit={handleGirisYap} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Kullanıcı Adı veya Plaka
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={girisDegeri}
                    onChange={(e) => setGirisDegeri(e.target.value)}
                    placeholder="Örn: admin veya 34IST01"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#145dfa]/20 focus:border-[#145dfa] transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Şifre
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    value={sifre}
                    onChange={(e) => setSifre(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#145dfa]/20 focus:border-[#145dfa] transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={yukleniyor}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-[#145dfa] hover:bg-[#0f4ed4] active:scale-[0.99] text-white font-semibold text-sm shadow-lg shadow-blue-500/25 transition flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
              >
                {yukleniyor ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Giriş Yap'
                )}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => { setMod('kayit'); setHataMesaji(null); }}
                  className="text-xs text-slate-600 hover:text-[#145dfa] font-medium transition inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Sürücü müsünüz? Yeni tır kaydı oluşturun</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          ) : (
            /* ================= TIR KAYIT FORMU ================= */
            <form onSubmit={handleTirKaydi} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Araç Plakası <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Truck className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    value={kayitPlaka}
                    onChange={(e) => setKayitPlaka(e.target.value.toUpperCase())}
                    placeholder="Örn: 34 IST 99"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm font-mono text-slate-800 placeholder:text-slate-400 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-[#145dfa]/20 focus:border-[#145dfa] transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Sürücü Kullanıcı Adı <span className="text-slate-400 font-normal">(Opsiyonel)</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={kayitKullaniciAdi}
                    onChange={(e) => setKayitKullaniciAdi(e.target.value)}
                    placeholder="Boş bırakılırsa plaka kullanılır"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#145dfa]/20 focus:border-[#145dfa] transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Tırın Bulunduğu Şehir (Mevcut Konum)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <MapPin className="w-4 h-4" />
                  </span>
                  <select
                    value={kayitSehir}
                    onChange={(e) => setKayitSehir(e.target.value as any)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#145dfa]/20 focus:border-[#145dfa] transition cursor-pointer"
                  >
                    <option value="ISTANBUL">İstanbul Lojistik Merkezi</option>
                    <option value="ANKARA">Ankara Lojistik Merkezi</option>
                    <option value="IZMIR">İzmir Lojistik Merkezi</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                    Şifre <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-3.5 h-3.5" />
                    </span>
                    <input
                      type="password"
                      required
                      value={kayitSifre}
                      onChange={(e) => setKayitSifre(e.target.value)}
                      placeholder="Min 6 krk"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#145dfa]/20 focus:border-[#145dfa] transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                    Şifre Tekrar <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-3.5 h-3.5" />
                    </span>
                    <input
                      type="password"
                      required
                      value={kayitSifreTekrar}
                      onChange={(e) => setKayitSifreTekrar(e.target.value)}
                      placeholder="Tekrar"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#145dfa]/20 focus:border-[#145dfa] transition"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={yukleniyor}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-[#145dfa] hover:bg-[#0f4ed4] active:scale-[0.99] text-white font-semibold text-sm shadow-lg shadow-blue-500/25 transition flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
              >
                {yukleniyor ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Tırı Kaydet ve Giriş Yap'
                )}
              </button>

              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => { setMod('giris'); setHataMesaji(null); }}
                  className="text-xs text-slate-500 hover:text-slate-800 transition cursor-pointer"
                >
                  Zaten bir hesabınız var mı? <span className="font-semibold text-[#145dfa]">Giriş Yap</span>
                </button>
              </div>
            </form>
          )}

          {/* HIZLI ERİŞİM (TEST) BÖLÜMÜ */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-slate-400 font-semibold text-[11px] uppercase tracking-wider mb-3">
              <Terminal className="w-3.5 h-3.5" />
              <span>HIZLI ERİŞİM (TEST)</span>
            </div>

            <div className="mb-3">
              <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                <span>@</span>
                <span>YÖNETİM</span>
              </div>
              <button
                type="button"
                onClick={() => testGirisiniDoldur('admin', '123456')}
                className="w-full text-left px-3.5 py-2 rounded-xl border border-slate-200/90 bg-slate-50/70 hover:bg-slate-100 text-slate-700 text-xs font-medium transition active:scale-[0.99] cursor-pointer"
              >
                Sistem Yöneticisi
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  <MessageSquare className="w-3 h-3" />
                  <span>KIOSKLAR</span>
                </div>
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => testGirisiniDoldur('kiosk_ist', '123456')}
                    className="w-full text-left px-3 py-1.5 rounded-xl border border-blue-200/70 bg-[#eff5ff] hover:bg-blue-100/70 text-[#195de6] text-xs font-medium transition active:scale-[0.99] cursor-pointer"
                  >
                    İstanbul Kiosk
                  </button>
                  <button
                    type="button"
                    onClick={() => testGirisiniDoldur('kiosk_ank', '123456')}
                    className="w-full text-left px-3 py-1.5 rounded-xl border border-blue-200/70 bg-[#eff5ff] hover:bg-blue-100/70 text-[#195de6] text-xs font-medium transition active:scale-[0.99] cursor-pointer"
                  >
                    Ankara Kiosk
                  </button>
                  <button
                    type="button"
                    onClick={() => testGirisiniDoldur('kiosk_izm', '123456')}
                    className="w-full text-left px-3 py-1.5 rounded-xl border border-blue-200/70 bg-[#eff5ff] hover:bg-blue-100/70 text-[#195de6] text-xs font-medium transition active:scale-[0.99] cursor-pointer"
                  >
                    İzmir Kiosk
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  <LayoutGrid className="w-3 h-3" />
                  <span>OPERATÖRLER</span>
                </div>
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => testGirisiniDoldur('operator_ist', '123456')}
                    className="w-full text-left px-3 py-1.5 rounded-xl border border-emerald-200/70 bg-[#ecfdf5] hover:bg-emerald-100/70 text-[#059669] text-xs font-medium transition active:scale-[0.99] cursor-pointer"
                  >
                    İstanbul Op.
                  </button>
                  <button
                    type="button"
                    onClick={() => testGirisiniDoldur('operator_ank', '123456')}
                    className="w-full text-left px-3 py-1.5 rounded-xl border border-emerald-200/70 bg-[#ecfdf5] hover:bg-emerald-100/70 text-[#059669] text-xs font-medium transition active:scale-[0.99] cursor-pointer"
                  >
                    Ankara Op.
                  </button>
                  <button
                    type="button"
                    onClick={() => testGirisiniDoldur('operator_izm', '123456')}
                    className="w-full text-left px-3 py-1.5 rounded-xl border border-emerald-200/70 bg-[#ecfdf5] hover:bg-emerald-100/70 text-[#059669] text-xs font-medium transition active:scale-[0.99] cursor-pointer"
                  >
                    İzmir Op.
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={() => testGirisiniDoldur('34IST01', '123456')}
                className="text-[11px] text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                Tır Sürücüsü Testi: <span className="underline font-mono">34IST01</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
