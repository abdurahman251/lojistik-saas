import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const havuz = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:lojistiksaas@db.nkilyhxlygprpjcsltef.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false },
});

export const sorgu = (metin: string, parametreler?: any[]) => havuz.query(metin, parametreler);

export default havuz;

