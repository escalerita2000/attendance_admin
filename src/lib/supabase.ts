import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

if (supabaseUrl.includes('placeholder-url') || supabaseAnonKey === 'placeholder-anon-key') {
  console.warn('⚠️ Supabase URL or Anon Key is missing or using placeholder values! Check your environment variables (.env.local or Vercel settings).');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
