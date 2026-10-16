import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
};

if (!ENV.SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    '⚠️ [Config] SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY non configurati nel file .env. Le chiamate al database potrebbero fallire finché non inserisci le credenziali Supabase.'
  );
}

