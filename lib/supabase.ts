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

/**
 * Fetches all file_url strings for a given document type, properly handling Supabase/PostgREST 1000-row limit via pagination.
 */
export async function fetchAllDocumentFileUrls(
  supabaseClient: any,
  type: string
): Promise<Set<string>> {
  const urls = new Set<string>();
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabaseClient
      .from("documents")
      .select("file_url")
      .eq("type", type)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error(`[fetchAllDocumentFileUrls] Error querying ${type} at page ${page}:`, error);
      break;
    }
    if (!data || data.length === 0) break;

    for (const doc of data) {
      if (doc.file_url) urls.add(doc.file_url);
    }

    if (data.length < pageSize) break;
    page++;
  }
  return urls;
}

