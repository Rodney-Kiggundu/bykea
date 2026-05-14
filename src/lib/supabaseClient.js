import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://iaorixerxnqedwgkqxtz.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlhb3JpeGVyeG5xZWR3Z2txeHR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NDA2NzMsImV4cCI6MjA5MzMxNjY3M30.V1Ttor7zpdKP96KVdJokec9L92u3LMdyvY6UzWRL_0g';

const rawUrl = process.env.REACT_APP_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '');
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  // Helps catch missing env vars during local development.
  // App still builds, but DB calls will fail until env vars are configured.
  // eslint-disable-next-line no-console
  console.warn('Supabase env vars are missing. Check REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY.');
}

export const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;

