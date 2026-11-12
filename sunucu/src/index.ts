import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import { authRouter } from './rotalar/auth';
import { randevuRouter } from './rotalar/randevu';
import { kioskRouter } from './rotalar/kiosk';
import { operatorRouter } from './rotalar/operator';
import { sorgu } from './veritabani';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Statik dosya erişimi (yüklenen evraklar)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

const PORT = process.env.PORT || 5000;

app.get('/api/saglik', async (req, res) => {
  try {
    await sorgu('SELECT 1');
    res.json({ durum: 'aktif', veritabani: 'bagli', zaman: new Date() });
  } catch (error: any) {
    res.status(500).json({ durum: 'hata', veritabani: error.message });
  }
});

app.use('/api/auth', authRouter);
app.use('/api/randevu', randevuRouter);
app.use('/api/kiosk', kioskRouter);
app.use('/api/operator', operatorRouter);

app.listen(PORT, () => {
  console.log(`Lojistik OS Sunucusu ${PORT} portunda çalışıyor.`);
});

export default app;
