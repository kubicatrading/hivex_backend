import { createClient } from "@supabase/supabase-js";
import { mockSupabase } from "./mockSupabase";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Check if credentials are standard placeholders or valid
const hasRealCredentials = 
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== "your-supabase-url" && 
  supabaseAnonKey !== "your-supabase-anon-key";

export const supabase = hasRealCredentials 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (mockSupabase as unknown as ReturnType<typeof createClient>);

export const isUsingMock = !hasRealCredentials;
