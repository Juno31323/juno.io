/// <reference types="astro/client" />
declare namespace App {
  interface Locals { db: import('@supabase/supabase-js').SupabaseClient | null; user: import('@supabase/supabase-js').User | null; }
}
