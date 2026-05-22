import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Returns null when Supabase env vars are not configured
const supabaseBrowser = (url && key) ? createClient(url, key) : null;

export default supabaseBrowser;
