import React, { useState, useEffect, useRef } from 'react';
import { 
  Truck, 
  MapPin, 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  Upload, 
  ArrowRight, 
  LogOut, 
  CheckCircle2, 
  AlertTriangle,
  FileText,
  Sparkles,
  QrCode,
  X
} from 'lucide-react';

interface KullaniciBilgisi {
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
  durum: string;
  is_gecikme?: boolean;
  olusturulma_tarihi?: string;
}

interface SurucuPortaliProps {
  kullanici: KullaniciBilgisi;
  onCikis: () => void;
}

export default function SurucuPortali({ kullanici, onCikis }: SurucuPortaliProps) {
  const [aktifRandevu, setAktifRandevu] = useState<RandevuVerisi | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [formGonderiliyor, setFormGonderiliyor] = useState(false);
  const [hataMesaji, setHataMesaji] = useState<string | null>(null);
  const [detayModalAcik, setDetayModalAcik] = useState(false);

  // Form Değerleri
  const kalkisSehri = kullanici.sehir === 'YOK' ? 'ISTANBUL' : kullanici.sehir;
  const [varisSehri, setVarisSehri] = useState('');
  const [randevuTarihi, setRandevuTarihi] = useState('');
  const [randevuSaati, setRandevuSaati] = useState('');
  const [soforAdSoyad, setSoforAdSoyad] = useState(kullanici.kullaniciAdi || '');
  const [soforTelefon, setSoforTelefon] = useState('');
  const [secilenDosya, setSecilenDosya] = useState<File | null>(null);
  const dosyaGirdiRef = useRef<HTMLInputElement>(null);

  // Varış şehri seçenekleri (Kalkış şehri haricindekiler)
  const tumSehirler = ['ISTANBUL', 'ANKARA', 'IZMIR'];
  const olasiVarisSehirleri = tumSehirler.filter((s) => s !== kalkisSehri);

  // Aktif randevuyu Supabase'den çek
  const aktifRandevuGetir = async () => {
    try {
      setYukleniyor(true);
      const res = await fetch(`/api/randevu/aktif?tirId=${kullanici.id}&plaka=${kullanici.plaka || ''}`);
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

  useEffect(() => {
    aktifRandevuGetir();
  }, [kullanici]);

  // Yeni Randevu Oluştur (Form Gönderimi)
  const handleRandevuOlustur = async (e: React.FormEvent) => {
    e.preventDefault();
    setHataMesaji(null);

    if (!varisSehri) {
      setHataMesaji('Lütfen bir varış şehri seçin.');
      return;
    }
    if (!randevuTarihi || !randevuSaati) {
      setHataMesaji('Lütfen randevu tarihi ve tahmini varış saatini girin.');
      return;
    }
    if (!soforAdSoyad.trim() || !soforTelefon.trim()) {
      setHataMesaji('Lütfen sürücü ad soyad ve iletişim numarasını girin.');
      return;
    }

    setFormGonderiliyor(true);
    try {
      const formData = new FormData();
      formData.append('tirId', kullanici.id);
      formData.append('plaka', kullanici.plaka || '34 IST 01');
      formData.append('kalkisSehri', kalkisSehri);
      formData.append('varisSehri', varisSehri);
      formData.append('randevuTarihi', randevuTarihi);
      formData.append('randevuSaati', randevuSaati);
      formData.append('soforAdSoyad', soforAdSoyad.trim());
      formData.append('soforTelefon', soforTelefon.trim());

      if (secilenDosya) {
        formData.append('evrak', secilenDosya);
      }

      const res = await fetch('/api/randevu/olustur', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.basarili) {
        throw new Error(data.mesaj || 'Randevu oluşturulamadı.');
      }

      // Başarılı: Doğrudan 2. SS'teki Aktif Randevu Kartı ekranına geç
      setAktifRandevu(data.randevu);
    } catch (err: any) {
      setHataMesaji(err.message || 'Randevu kaydedilemedi.');
    } finally {
      setFormGonderiliyor(false);
    }
  };

  // Test amaçlı randevu sıfırlama (Tekrar randevu oluşturabilmek için)
  const handleRandevuIptal = async () => {
    if (!aktifRandevu) return;
    if (!confirm('Randevuyu iptal edip yeni randevu alma ekranına dönmek istiyor musunuz?')) return;

    try {
      await fetch(`/api/randevu/iptal/${aktifRandevu.id}`, { method: 'POST' });
      setAktifRandevu(null);
      setDetayModalAcik(false);
    } catch (err) {
      console.error(err);
    }
  };

  if (yukleniyor) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      {/* ================= ÜST NAVBAR (HER İKİ EKRANDA ORTAK) ================= */}
      <header className="bg-white border-b border-slate-200/80 px-6 sm:px-12 py-3.5 flex items-center justify-between sticky top-0 z-30">
        {/* Sol Logo ve Sürücü Bilgisi */}
        <div className="flex items-center gap-3.5">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-[#0e1726] flex items-center justify-center text-white shadow-sm">
              <Truck className="w-5 h-5 stroke-[2.2]" />
            </div>
            {/* Yeşil Online Noktası */}
            <span className="w-3 h-3 bg-emerald-500 border-2 border-white rounded-full absolute -bottom-0.5 -right-0.5" />
          </div>

          <div>
            <h1 className="text-sm font-bold text-slate-900 leading-none">
              Sürücü Portalı
            </h1>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              Plaka <span className="font-semibold text-slate-600">{kullanici.plaka || '34 IST 01'}</span> · Konum <span className="font-semibold text-slate-600 uppercase">{kalkisSehri}</span>
            </p>
          </div>
        </div>

        {/* Sağ Çıkış Butonu */}
        <button
          onClick={onCikis}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-medium text-xs transition active:scale-[0.98]"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Çıkış</span>
        </button>
      </header>

      {/* ================= ANA İÇERİK ================= */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8 md:p-12">
        {!aktifRandevu ? (
          /* ================= 1. EKRAN: YENİ RANDEVU OLUŞTUR ================= */
          <div className="w-full max-w-[760px] bg-white rounded-3xl p-6 sm:p-10 shadow-sm border border-slate-200/70">
            {/* Üst İkon & Başlık */}
            <div className="text-center mb-8">
              <div className="w-12 h-12 rounded-2xl bg-[#145dfa] flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-blue-500/25">
                <Truck className="w-6 h-6 stroke-[2.2]" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Yeni Randevu Oluştur
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1.5">
                Lütfen rota ve sürücü bilgilerini eksiksiz girin.
              </p>
            </div>

            {/* Hata Uyarısı */}
            {hataMesaji && (
              <div className="mb-6 p-3.5 rounded-xl bg-red-50 border border-red-100 flex items-center gap-2.5 text-red-600 text-xs animate-shake">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{hataMesaji}</span>
              </div>
            )}

            {/* Randevu Formu */}
            <form onSubmit={handleRandevuOlustur} className="space-y-5">
              {/* Satır 1: Kalkış & Varış Şehri */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Kalkış Şehri (Kilitli & Otomatik Dolu) */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    KALKIŞ ŞEHRİ
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <MapPin className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      disabled
                      value={kalkisSehri}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-sm font-semibold text-slate-700 cursor-not-allowed uppercase"
                    />
                  </div>
                </div>

                {/* Varış Şehri (Diğer 2 Şehir Listelenir) */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    VARIŞ ŞEHRİ
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <MapPin className="w-4 h-4" />
                    </span>
                    <select
                      required
                      value={varisSehri}
                      onChange={(e) => setVarisSehri(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#145dfa]/20 focus:border-[#145dfa] transition cursor-pointer"
                    >
                      <option value="">Şehir Seçiniz</option>
                      {olasiVarisSehirleri.map((sehir) => (
                        <option key={sehir} value={sehir}>
                          {sehir}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Satır 2: Randevu Tarihi & Tahmini Varış Saati */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Randevu Tarihi */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    RANDEVU TARİHİ
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Calendar className="w-4 h-4" />
                    </span>
                    <input
                      type="date"
                      required
                      min={new Date().toISOString().split('T')[0]}
                      value={randevuTarihi}
                      onChange={(e) => setRandevuTarihi(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#145dfa]/20 focus:border-[#145dfa] transition"
                    />
                  </div>
                </div>

                {/* Tahmini Varış Saati */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    TAHMİNİ VARIŞ SAATİ
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Clock className="w-4 h-4" />
                    </span>
                    <input
                      type="time"
                      required
                      value={randevuSaati}
                      onChange={(e) => setRandevuSaati(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#145dfa]/20 focus:border-[#145dfa] transition"
                    />
                  </div>
                </div>
              </div>

              {/* Satır 3: Sürücü Ad Soyad & İletişim Numarası */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Sürücü Ad Soyad */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    SÜRÜCÜ AD SOYAD
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      required
                      value={soforAdSoyad}
                      onChange={(e) => setSoforAdSoyad(e.target.value)}
                      placeholder="Ahmet Yılmaz"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#145dfa]/20 focus:border-[#145dfa] transition"
                    />
                  </div>
                </div>

                {/* İletişim Numarası */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    İLETİŞİM NUMARASI
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Phone className="w-4 h-4" />
                    </span>
                    <input
                      type="tel"
                      required
                      value={soforTelefon}
                      onChange={(e) => setSoforTelefon(e.target.value)}
                      placeholder="05xx xxx xx xx"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#145dfa]/20 focus:border-[#145dfa] transition"
                    />
                  </div>
                </div>
              </div>

              {/* Satır 4: Evrak Yükleme (Yol Belgesi) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  EVRAK YÜKLEME (YOL BELGESİ)
                </label>
                <input
                  type="file"
                  ref={dosyaGirdiRef}
                  accept=".pdf,.png,.jpg,.jpeg"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSecilenDosya(e.target.files[0]);
                    }
                  }}
                />
                <div
                  onClick={() => dosyaGirdiRef.current?.click()}
                  className="border-2 border-dashed border-slate-200/90 rounded-2xl p-6 sm:p-8 text-center hover:bg-slate-50/60 hover:border-blue-400/60 transition cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-blue-50 text-slate-500 group-hover:text-[#145dfa] flex items-center justify-center mx-auto mb-2 transition">
                    <Upload className="w-5 h-5" />
                  </div>
                  {secilenDosya ? (
                    <div className="flex items-center justify-center gap-2 text-xs font-semibold text-emerald-600">
                      <FileText className="w-4 h-4" />
                      <span>{secilenDosya.name}</span>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs sm:text-sm font-semibold text-slate-800">
                        Dosyayı buraya sürükleyin veya tıklayın
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        PDF, PNG veya JPG · Maks 5MB
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Randevuyu Tamamla Butonu */}
              <button
                type="submit"
                disabled={formGonderiliyor}
                className="w-full mt-4 py-3.5 px-6 rounded-xl bg-[#0b192c] hover:bg-[#061120] active:scale-[0.99] text-white font-semibold text-sm transition flex items-center justify-center gap-2 shadow-md shadow-slate-900/10 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {formGonderiliyor ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Randevuyu Tamamla</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          /* ================= 2. EKRAN: AKTİF RANDEVU KARTI ================= */
          <div className="w-full max-w-[700px] flex flex-col gap-4 animate-fade-in">
            {/* Ana Randevu Kartı */}
            <div className="bg-white rounded-3xl overflow-hidden shadow-lg shadow-slate-200/50 border border-slate-200/70">
              {/* ÜST MAVİ / GRID BAŞLIK ALANI */}
              <div 
                className="p-6 sm:p-8 text-white relative overflow-hidden"
                style={{
                  backgroundColor: '#0c2356',
                  backgroundImage: `
                    linear-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255, 255, 255, 0.07) 1px, transparent 1px)
                  `,
                  backgroundSize: '24px 24px',
                }}
              >
                {/* Rozetler Satırı */}
                <div className="flex items-center justify-between mb-4">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[11px] font-semibold text-white tracking-wider">
                    <Sparkles className="w-3 h-3 text-blue-300" />
                    <span>AKTİF RANDEVU</span>
                  </div>

                  <div className="px-3.5 py-1 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-bold text-white tracking-wider uppercase">
                    {aktifRandevu.durum}
                  </div>
                </div>

                {/* Rota Başlığı */}
                <h2 className="text-2xl sm:text-4xl font-extrabold tracking-wide text-white uppercase flex items-center gap-3">
                  <span>{aktifRandevu.kalkis_sehri}</span>
                  <span className="text-blue-300 font-light">→</span>
                  <span>{aktifRandevu.varis_sehri}</span>
                </h2>
              </div>

              {/* ORTA BİLGİ ALANI (4 SÜTUN) */}
              <div className="p-6 sm:p-8 bg-white grid grid-cols-2 md:grid-cols-4 gap-6">
                {/* 1. Tarih */}
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      TARİH
                    </span>
                    <span className="text-sm font-bold text-slate-800">
                      {aktifRandevu.randevu_tarihi}
                    </span>
                  </div>
                </div>

                {/* 2. Tahmini Varış */}
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      TAHMİNİ VARIŞ
                    </span>
                    <span className="text-sm font-bold text-slate-800">
                      {aktifRandevu.randevu_saati}
                    </span>
                  </div>
                </div>

                {/* 3. Sürücü */}
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      SÜRÜCÜ
                    </span>
                    <span className="text-sm font-bold text-slate-800 truncate block max-w-[100px]">
                      {aktifRandevu.sofor_ad_soyad}
                    </span>
                  </div>
                </div>

                {/* 4. İletişim */}
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      İLETİŞİM
                    </span>
                    <span className="text-sm font-bold text-slate-800">
                      {aktifRandevu.sofor_telefon}
                    </span>
                  </div>
                </div>
              </div>

              {/* ALT DURUM BARI (Randevu Onaylı & Detayları Gör) */}
              <div className="bg-slate-50/80 border-t border-slate-100 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100/80 text-emerald-600 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
                      Randevu Onaylı
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Liman girişinde QR kodunuzu okutun
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setDetayModalAcik(true)}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 shadow-sm transition active:scale-[0.98]"
                >
                  Detayları Gör
                </button>
              </div>
            </div>

            {/* ÖNEMLİ HATIRLATMA BANNERI */}
            <div className="bg-[#fef9ec] border border-[#fde8bb] rounded-2xl p-4 flex items-start sm:items-center gap-3.5">
              <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                <AlertTriangle className="w-4 h-4 stroke-[2.2]" />
              </div>
              <div className="flex-1">
                <h5 className="text-xs font-bold text-amber-900 leading-none">
                  Önemli Hatırlatma
                </h5>
                <p className="text-xs text-amber-800/90 mt-1 leading-snug">
                  Randevu saatinizden 30 dakika önce sahada olmanız gerekmektedir. Gecikme durumunda randevunuz iptal edilebilir.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ================= DETAYLAR MODALI ================= */}
      {detayModalAcik && aktifRandevu && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 relative animate-fade-in">
            <button
              onClick={() => setDetayModalAcik(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-3 text-[#145dfa]">
                <QrCode className="w-9 h-9" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Randevu Doğrulama Kodu</h3>
              <p className="text-xs text-slate-500 mt-0.5">Kiosk kapısında bu barkod / plakayı bildirin</p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 text-xs space-y-2.5 border border-slate-100 mb-6">
              <div className="flex justify-between">
                <span className="text-slate-400">Plaka:</span>
                <span className="font-mono font-bold text-slate-800">{aktifRandevu.plaka}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Rota:</span>
                <span className="font-semibold text-slate-800">{aktifRandevu.kalkis_sehri} → {aktifRandevu.varis_sehri}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Tarih / Saat:</span>
                <span className="font-semibold text-slate-800">{aktifRandevu.randevu_tarihi} - {aktifRandevu.randevu_saati}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Durum:</span>
                <span className="font-semibold text-blue-600">{aktifRandevu.durum}</span>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => setDetayModalAcik(false)}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-semibold transition"
              >
                Kapat
              </button>
              <button
                onClick={handleRandevuIptal}
                className="w-full py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold transition"
              >
                Randevuyu İptal Et (Yeni Randevu Al)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

