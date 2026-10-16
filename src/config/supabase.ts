import { createClient } from '@supabase/supabase-js';
import { ENV } from './env.js';

// Supabase client with Service Role Key for privileged backend operations
export const supabase = createClient(
  ENV.SUPABASE_URL || 'https://placeholder.supabase.co',
  ENV.SUPABASE_SERVICE_ROLE_KEY || 'placeholder_service_role_key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

