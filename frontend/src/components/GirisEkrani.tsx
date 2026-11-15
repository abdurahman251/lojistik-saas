import { useState } from 'react';
import { 
  Truck, 
  Lock, 
  User, 
  AlertCircle,
  Eye,
  EyeOff,
  ArrowRight,
  ChevronDown,
  Globe,
  Sparkles,
  Check
} from 'lucide-react';
import Logo from './Logo';
import { KullaniciBilgisi } from '../App';

interface GirisEkraniProps {
  onGirisBasarili: (kullanici: KullaniciBilgisi, token: string) => void;
}

type LojistikSehir = 'ISTANBUL' | 'ANKARA' | 'IZMIR';
type Dil = 'TR' | 'EN';

// Çok Dilli Sözlük (TR & EN)
const I18N = {
  TR: {
    rozet: 'Lojistik OS • Kurumsal Sevk Ağı',
    baslik: 'Lojistik OS',
    girisAltBaslik: 'Kurumsal terminal hesabınıza giriş yapın',
    kayitAltBaslik: 'Filoya yeni tır ve sürücü profili kaydedin',
    girisTab: 'Giriş Yap',
    kayitTab: 'Yeni Tır Kaydı',
    kullaniciAdiEtiket: 'Kullanıcı Adı veya Araç Plakası',
    kullaniciAdiPlaceholder: 'admin, operator_ist, 34IST01...',
    sifreEtiket: 'Güvenlik Şifresi',
    sifreGoster: 'Göster',
    sifreGizle: 'Gizle',
    girisButon: 'Terminale Giriş Yap',
    girisYapiliyor: 'Doğrulanıyor...',
    surucuKayitSorusu: 'Sürücü müsünüz?',
    surucuKayitLink: 'Yeni tır tanımlayın',
    girisSorusu: 'Zaten kayıtlı mısınız?',
    girisLink: 'Giriş yapın',
    plakaEtiket: 'Araç Plakası',
    plakaPlaceholder: '34 VR 890',
    soforAdiEtiket: 'Sürücü Adı Soyadı',
    soforAdiOpsiyonel: '(opsiyonel)',
    soforAdiPlaceholder: 'Boş bırakılırsa plaka kullanılır',
    terminalEtiket: 'Bağlı Olacağı Terminal / Üs',
    kayitSifreEtiket: 'Şifre Belirleyin',
    kayitSifrePlaceholder: 'En az 6 karakter',
    kayitSifreTekrarEtiket: 'Şifre Tekrar',
    kayitSifreTekrarPlaceholder: 'Tekrar girin',
    kayitButon: 'Tırı Filoya Ekle ve Giriş Yap',
    demoButon: 'Demo hesaplarla hızlı giriş yapın',
    tumSifreler: 'Tüm demo şifreleri: 123456',
    altDetay1: '3 Terminal',
    altDetay2: '24 Aktif Rampa',
    altDetay3: 'Kesintisiz Canlı Takip',
    hataDoldur: 'Lütfen kullanıcı adı / plaka ve şifrenizi girin.',
    hataPlaka: 'Lütfen geçerli bir araç plakası girin.',
    hataSifreKisa: 'Şifre en az 6 karakter uzunluğunda olmalıdır.',
    hataSifreUyusmaz: 'Girdiğiniz şifreler birbiriyle uyuşmuyor.',
    hataGenel: 'Giriş başarısız. Lütfen bilgilerinizi kontrol edin.',
    yonetim: 'Yönetim',
    operatorler: 'Saha Operatörleri',
    kiosklar: 'Liman Kioskları',
    suruculer: 'Tır Sürücüleri',
    sehirler: {
      ISTANBUL: 'İstanbul',
      ANKARA: 'Ankara',
      IZMIR: 'İzmir',
    }
  },
  EN: {
    rozet: 'Logistics OS • Enterprise Dispatch Network',
    baslik: 'Logistics OS',
    girisAltBaslik: 'Sign in to your enterprise terminal account',
    kayitAltBaslik: 'Register a new truck & driver into the fleet',
    girisTab: 'Sign In',
    kayitTab: 'Register Truck',
    kullaniciAdiEtiket: 'Username or Vehicle License Plate',
    kullaniciAdiPlaceholder: 'admin, operator_ist, 34IST01...',
    sifreEtiket: 'Security Password',
    sifreGoster: 'Show',
    sifreGizle: 'Hide',
    girisButon: 'Sign In to Terminal',
    girisYapiliyor: 'Authenticating...',
    surucuKayitSorusu: 'Are you a driver?',
    surucuKayitLink: 'Register new vehicle',
    girisSorusu: 'Already registered?',
    girisLink: 'Sign in',
    plakaEtiket: 'License Plate',
    plakaPlaceholder: '34 VR 890',
    soforAdiEtiket: 'Driver Full Name',
    soforAdiOpsiyonel: '(optional)',
    soforAdiPlaceholder: 'Defaults to plate if left empty',
    terminalEtiket: 'Home Station / Hub',
    kayitSifreEtiket: 'Create Password',
    kayitSifrePlaceholder: 'Min 6 characters',
    kayitSifreTekrarEtiket: 'Confirm Password',
    kayitSifreTekrarPlaceholder: 'Re-enter password',
    kayitButon: 'Register to Fleet & Sign In',
    demoButon: 'Quick sign-in with demo accounts',
    tumSifreler: 'All demo passwords: 123456',
    altDetay1: '3 Terminals',
    altDetay2: '24 Active Docks',
    altDetay3: 'Real-Time Dispatch',
    hataDoldur: 'Please enter your username / plate and password.',
    hataPlaka: 'Please enter a valid license plate.',
    hataSifreKisa: 'Password must be at least 6 characters.',
    hataSifreUyusmaz: 'Entered passwords do not match.',
    hataGenel: 'Authentication failed. Please check your credentials.',
    yonetim: 'Management',
    operatorler: 'Yard Operators',
    kiosklar: 'Gate Kiosks',
    suruculer: 'Truck Drivers',
    sehirler: {
      ISTANBUL: 'Istanbul',
      ANKARA: 'Ankara',
      IZMIR: 'Izmir',
    }
  }
};

// Demo Hesap Grupları
const DEMO_GRUPLARI = [
  {
    anahtar: 'yonetim' as const,
    hesaplar: [
      { etiket: 'Admin (Yönetici)', deger: 'admin', rol: 'YONETICI' },
    ],
  },
  {
    anahtar: 'operatorler' as const,
    hesaplar: [
      { etiket: 'İstanbul Operatör', deger: 'operator_ist', rol: 'OPERATOR' },
      { etiket: 'Ankara Operatör', deger: 'operator_ank', rol: 'OPERATOR' },
      { etiket: 'İzmir Operatör', deger: 'operator_izm', rol: 'OPERATOR' },
    ],
  },
  {
    anahtar: 'kiosklar' as const,
    hesaplar: [
      { etiket: 'İstanbul Kiosk', deger: 'kiosk_ist', rol: 'KIOSK' },
      { etiket: 'Ankara Kiosk', deger: 'kiosk_ank', rol: 'KIOSK' },
      { etiket: 'İzmir Kiosk', deger: 'kiosk_izm', rol: 'KIOSK' },
    ],
  },
  {
    anahtar: 'suruculer' as const,
    hesaplar: [
      { etiket: '34IST01 (Tır Sürücüsü)', deger: '34IST01', rol: 'SURUCU' },
      { etiket: '34IST02 (Tır Sürücüsü)', deger: '34IST02', rol: 'SURUCU' },
    ],
  },
];

export default function GirisEkrani({ onGirisBasarili }: GirisEkraniProps) {
  const [dil, setDil] = useState<Dil>('TR');
  const [mod, setMod] = useState<'giris' | 'kayit'>('giris');

  // Giriş form
  const [girisDegeri, setGirisDegeri] = useState('34IST01');
  const [sifre, setSifre] = useState('123456');
  const [sifreGoster, setSifreGoster] = useState(false);

  // Kayıt form
  const [kayitPlaka, setKayitPlaka] = useState('');
  const [kayitKullaniciAdi, setKayitKullaniciAdi] = useState('');
  const [kayitSehir, setKayitSehir] = useState<LojistikSehir>('ISTANBUL');
  const [kayitSifre, setKayitSifre] = useState('');
  const [kayitSifreTekrar, setKayitSifreTekrar] = useState('');
  const [kayitSifreGoster, setKayitSifreGoster] = useState(false);

  // Durum
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hataMesaji, setHataMesaji] = useState<string | null>(null);
  const [basariMesaji, setBasariMesaji] = useState<string | null>(null);
  const [demoAcik, setDemoAcik] = useState(false);

  const t = I18N[dil];

  // Demo Seç
  const handleDemoSec = (deger: string) => {
    setGirisDegeri(deger);
    setSifre('123456');
    setMod('giris');
    setHataMesaji(null);
  };

  // Giriş Yap
  const handleGirisYap = async (e: React.FormEvent) => {
    e.preventDefault();
    setHataMesaji(null);

    if (!girisDegeri.trim() || !sifre.trim()) {
      setHataMesaji(t.hataDoldur);
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

      let data: any = null;
      try {
        data = await response.json();
      } catch {
        // Yanıt JSON değilse veya bağlantı koptuysa
      }

      if (!response.ok || !data || !data.basarili) {
        throw new Error((data && data.mesaj) || t.hataGenel);
      }

      // Yönetici Onayına tabi ise bilgilendir ve giriş sekmesine aktar
      if (data.onayBekliyor) {
        setBasariMesaji(data.mesaj);
        setMod('giris');
        setGirisDegeri(kayitPlaka.trim().toUpperCase());
        setSifre(kayitSifre.trim());
        setKayitPlaka('');
        setKayitKullaniciAdi('');
        setKayitSifre('');
        setKayitSifreTekrar('');
        return;
      }

      localStorage.setItem('lojistik_token', data.token);
      localStorage.setItem('lojistik_kullanici', JSON.stringify(data.kullanici));
      onGirisBasarili(data.kullanici, data.token);
    } catch (err: any) {
      setHataMesaji(err.message || t.hataGenel);
    } finally {
      setYukleniyor(false);
    }
  };

  // Kayıt Ol
  const handleKayit = async (e: React.FormEvent) => {
    e.preventDefault();
    setHataMesaji(null);

    if (!kayitPlaka.trim()) {
      setHataMesaji(t.hataPlaka);
      return;
    }
    if (kayitSifre.length < 6) {
      setHataMesaji(t.hataSifreKisa);
      return;
    }
    if (kayitSifre !== kayitSifreTekrar) {
      setHataMesaji(t.hataSifreUyusmaz);
      return;
    }

    setYukleniyor(true);
    try {
      const response = await fetch('/api/auth/kayit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plaka: kayitPlaka.trim().toUpperCase(),
          kullaniciAdi: kayitKullaniciAdi.trim() || undefined,
          sehir: kayitSehir,
          sifre: kayitSifre.trim(),
        }),
      });

      let data: any = null;
      try {
        data = await response.json();
      } catch {
        // Yanıt JSON değilse veya bağlantı koptuysa
      }

      if (!response.ok || !data || !data.basarili) {
        throw new Error((data && data.mesaj) || t.hataGenel);
      }

      // Yönetici Onayına tabi ise bilgilendir ve giriş sekmesine aktar
      if (data.onayBekliyor) {
        setBasariMesaji(data.mesaj);
        setMod('giris');
        setGirisDegeri(kayitPlaka.trim().toUpperCase());
        setSifre(kayitSifre.trim());
        setKayitPlaka('');
        setKayitKullaniciAdi('');
        setKayitSifre('');
        setKayitSifreTekrar('');
        return;
      }

      localStorage.setItem('lojistik_token', data.token);
      localStorage.setItem('lojistik_kullanici', JSON.stringify(data.kullanici));
      onGirisBasarili(data.kullanici, data.token);
    } catch (err: any) {
      setHataMesaji(err.message || t.hataGenel);
    } finally {
      setYukleniyor(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#f0f4f9] px-4 py-8 relative overflow-hidden select-none">
      
      {/* ================= ARKA PLAN CANLI ORTAM GLOWLARI ================= */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-sky-400/5 rounded-full blur-3xl pointer-events-none" />

      {/* ================= SAĞ ÜST DİL SEÇİCİ (TR / EN) ================= */}
      <div className="absolute top-5 right-5 sm:top-7 sm:right-8 z-20">
        <div className="bg-white/80 backdrop-blur-md p-1 rounded-full border border-slate-200/90 shadow-sm flex items-center gap-1">
          <Globe className="w-3.5 h-3.5 text-slate-400 ml-2 mr-0.5" />
          <button
            type="button"
            onClick={() => setDil('TR')}
            className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
              dil === 'TR'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            TR
          </button>
          <button
            type="button"
            onClick={() => setDil('EN')}
            className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
              dil === 'EN'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            EN
          </button>
        </div>
      </div>

      {/* ================= ANA MERKEZ KONTEYNER ================= */}
      <div className="w-full max-w-[440px] relative z-10 animate-fade-in space-y-5">
        
        {/* LOGO & BAŞLIK ALANI */}
        <div className="text-center space-y-3">
          
          {/* Lojistik Canlı Statü Rozeti */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/90 border border-slate-200/90 shadow-2xs backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-semibold text-slate-700">
              {t.rozet}
            </span>
          </div>

          {/* Orijinal Kurumsal Logo (Özenle Dengelenmiş Boyut) */}
          <div className="flex justify-center px-1 py-1">
            <Logo 
              variant="full" 
              className="w-full max-w-[290px] sm:max-w-[320px] h-auto drop-shadow-sm transition-transform duration-300 hover:scale-[1.02]" 
            />
          </div>

          <p className="text-xs sm:text-sm text-slate-500 max-w-xs mx-auto">
            {mod === 'giris' ? t.girisAltBaslik : t.kayitAltBaslik}
          </p>
        </div>

        {/* ANA KART */}
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/50 overflow-hidden transition-all">
          
          {/* TAB GEÇİŞ (Apple Segmented Style) */}
          <div className="p-1.5 bg-slate-100/90 border-b border-slate-200/70 flex rounded-t-3xl">
            <button
              type="button"
              onClick={() => { setMod('giris'); setHataMesaji(null); }}
              className={`flex-1 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                mod === 'giris'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Truck className="w-3.5 h-3.5 text-blue-600" />
              <span>{t.girisTab}</span>
            </button>
            <button
              type="button"
              onClick={() => { setMod('kayit'); setHataMesaji(null); }}
              className={`flex-1 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                mod === 'kayit'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>{t.kayitTab}</span>
            </button>
          </div>

          {/* FORM İÇERİĞİ */}
          <div className="p-6 sm:p-7 space-y-4">
            
            {/* Başarı ve Yönetici Onayı Bilgilendirmesi */}
            {basariMesaji && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-start gap-2.5 animate-fade-in">
                <Check className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                <span>{basariMesaji}</span>
              </div>
            )}

            {/* Hata Uyarısı */}
            {hataMesaji && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200/80 text-red-600 text-xs font-medium flex items-start gap-2.5 animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                <span>{hataMesaji}</span>
              </div>
            )}

            {/* ===== GİRİŞ FORMU ===== */}
            {mod === 'giris' ? (
              <form onSubmit={handleGirisYap} className="space-y-4">
                
                {/* Kullanıcı Adı veya Plaka */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {t.kullaniciAdiEtiket}
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      value={girisDegeri}
                      onChange={(e) => setGirisDegeri(e.target.value)}
                      placeholder={t.kullaniciAdiPlaceholder}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition"
                    />
                  </div>
                </div>

                {/* Şifre */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      {t.sifreEtiket}
                    </label>
                    <span className="text-[11px] font-mono text-slate-400">
                      Demo: 123456
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type={sifreGoster ? 'text' : 'password'}
                      value={sifre}
                      onChange={(e) => setSifre(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setSifreGoster(!sifreGoster)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition cursor-pointer"
                    >
                      {sifreGoster ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Giriş Butonu */}
                <button
                  type="submit"
                  disabled={yukleniyor}
                  className="w-full py-3.5 px-4 rounded-xl bg-slate-900 hover:bg-blue-600 active:scale-[0.99] text-white font-bold text-sm shadow-md shadow-slate-900/10 hover:shadow-blue-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {yukleniyor ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>{t.girisButon}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Kayıt Moduna Geçiş */}
                <div className="text-center pt-1">
                  <span className="text-xs text-slate-500">
                    {t.surucuKayitSorusu}{' '}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setMod('kayit'); setHataMesaji(null); }}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 transition cursor-pointer underline underline-offset-2"
                  >
                    {t.surucuKayitLink}
                  </button>
                </div>

              </form>
            ) : (

              /* ===== YENİ TIR KAYIT FORMU ===== */
              <form onSubmit={handleKayit} className="space-y-4">
                
                {/* Plaka (TR Plaka Kutusu) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {t.plakaEtiket} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative flex items-center rounded-xl overflow-hidden border border-slate-200 bg-white focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/20 transition">
                    <div className="bg-[#003399] px-2.5 py-2.5 text-white font-extrabold text-xs select-none tracking-tight flex items-center justify-center shrink-0">
                      TR
                    </div>
                    <input
                      type="text"
                      required
                      value={kayitPlaka}
                      onChange={(e) => setKayitPlaka(e.target.value.toUpperCase())}
                      placeholder={t.plakaPlaceholder}
                      className="w-full px-3 py-2 text-slate-900 font-mono font-bold text-sm uppercase tracking-wider focus:outline-none placeholder:text-slate-400 placeholder:font-normal placeholder:tracking-normal"
                    />
                  </div>
                </div>

                {/* Sürücü Adı */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {t.soforAdiEtiket} <span className="text-slate-400 font-normal">{t.soforAdiOpsiyonel}</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      value={kayitKullaniciAdi}
                      onChange={(e) => setKayitKullaniciAdi(e.target.value)}
                      placeholder={t.soforAdiPlaceholder}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition"
                    />
                  </div>
                </div>

                {/* Bağlı Terminal */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {t.terminalEtiket}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['ISTANBUL', 'ANKARA', 'IZMIR'] as LojistikSehir[]).map((sehir) => {
                      const aktif = kayitSehir === sehir;
                      return (
                        <button
                          key={sehir}
                          type="button"
                          onClick={() => setKayitSehir(sehir)}
                          className={`py-2 px-2.5 rounded-xl text-xs font-semibold transition cursor-pointer border flex items-center justify-center gap-1 ${
                            aktif
                              ? 'bg-blue-600 text-white border-blue-600 shadow-2xs font-bold'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {aktif && <Check className="w-3.5 h-3.5" />}
                          <span>{t.sehirler[sehir]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Şifre ve Tekrarı */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      {t.kayitSifreEtiket} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type={kayitSifreGoster ? 'text' : 'password'}
                      required
                      value={kayitSifre}
                      onChange={(e) => setKayitSifre(e.target.value)}
                      placeholder={t.kayitSifrePlaceholder}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition font-mono"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-bold text-slate-700">
                        {t.kayitSifreTekrarEtiket}
                      </label>
                      <button
                        type="button"
                        onClick={() => setKayitSifreGoster(!kayitSifreGoster)}
                        className="text-[10px] text-slate-400 hover:text-slate-700 cursor-pointer transition font-medium"
                      >
                        {kayitSifreGoster ? t.sifreGizle : t.sifreGoster}
                      </button>
                    </div>
                    <input
                      type={kayitSifreGoster ? 'text' : 'password'}
                      required
                      value={kayitSifreTekrar}
                      onChange={(e) => setKayitSifreTekrar(e.target.value)}
                      placeholder={t.kayitSifreTekrarPlaceholder}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition font-mono"
                    />
                  </div>
                </div>

                {/* Kayıt Butonu */}
                <button
                  type="submit"
                  disabled={yukleniyor}
                  className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold text-sm shadow-md shadow-blue-600/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {yukleniyor ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Truck className="w-4 h-4" />
                      <span>{t.kayitButon}</span>
                    </>
                  )}
                </button>

                {/* Giriş Moduna Geçiş */}
                <div className="text-center pt-1">
                  <span className="text-xs text-slate-500">
                    {t.girisSorusu}{' '}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setMod('giris'); setHataMesaji(null); }}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 transition cursor-pointer underline underline-offset-2"
                  >
                    {t.girisLink}
                  </button>
                </div>

              </form>
            )}

          </div>

        </div>

        {/* ================= DEMO HESAPLAR AKORDİYONU ================= */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setDemoAcik(!demoAcik)}
            className="w-full py-2.5 px-4 rounded-2xl bg-white/80 hover:bg-white border border-slate-200/90 shadow-2xs text-xs font-semibold text-slate-700 transition cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{t.demoButon}</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${demoAcik ? 'rotate-180' : ''}`} />
          </button>

          {demoAcik && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3.5 shadow-sm animate-fade-in">
              {DEMO_GRUPLARI.map((grup) => (
                <div key={grup.anahtar}>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                    {t[grup.anahtar]}
                  </span>
                  <div className={`grid gap-1.5 ${
                    grup.hesaplar.length === 1 ? 'grid-cols-1' :
                    grup.hesaplar.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
                  }`}>
                    {grup.hesaplar.map((h) => {
                      const secili = girisDegeri === h.deger;
                      return (
                        <button
                          key={h.deger}
                          type="button"
                          onClick={() => handleDemoSec(h.deger)}
                          className={`p-2 rounded-xl border text-left transition cursor-pointer ${
                            secili
                              ? 'bg-slate-900 text-white border-slate-900 shadow-2xs font-bold'
                              : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200/80 text-slate-800'
                          }`}
                        >
                          <div className="text-[11px] font-bold truncate leading-tight">
                            {h.etiket}
                          </div>
                          <div className={`text-[10px] font-mono mt-0.5 truncate ${
                            secili ? 'text-slate-300' : 'text-slate-400'
                          }`}>
                            {h.deger}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="pt-2 border-t border-slate-100 text-center">
                <span className="text-[11px] font-mono text-slate-400 font-medium">
                  {t.tumSifreler}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ================= ALT BİLGİ & ROZETLER ================= */}
        <div className="flex items-center justify-center gap-4 text-[11px] font-medium text-slate-400 pt-2">
          <span>{t.altDetay1}</span>
          <span>•</span>
          <span>{t.altDetay2}</span>
          <span>•</span>
          <span>{t.altDetay3}</span>
        </div>

      </div>

    </div>
  );
}
