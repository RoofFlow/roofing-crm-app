// supa.js - creates the Supabase client
// Requires config.js to define SUPABASE_URL and SUPABASE_ANON_KEY

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
