import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_PRODUCTION_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_PRODUCTION_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return createClient(url, key, {
    auth: { persistSession: false }
  });
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    // Query weekly magazines using indexed fields
    const { data, error } = await supabase
      .from("documents")
      .select("id, title, description, type, file_url, user_id, created_at, metadata")
      .eq("type", "knowledge_transcription")
      .ilike("title", "Revista Semanal%")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[API News Issues] Database query error:", error);
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: 500 });
    }

    const rawItems = (data || []).map((item) => {
      // Clean large arrays from catalog list to keep payload ultra-lightweight
      const meta = { ...(item.metadata || {}) };
      if (meta.sentence_timestamps) {
        delete meta.sentence_timestamps;
      }
      return {
        ...item,
        metadata: meta
      };
    });

    // Deduplicate by issue slug, prioritizing the record that has audio_url
    const sorted = [...rawItems].sort((a, b) => {
      const aHasAudio = a.metadata?.audio_url ? 1 : 0;
      const bHasAudio = b.metadata?.audio_url ? 1 : 0;
      return bHasAudio - aHasAudio;
    });

    const seenSlugs = new Set<string>();
    const uniqueItems: typeof rawItems = [];
    for (const item of sorted) {
      const slug = item.metadata?.slug || item.id;
      if (!seenSlugs.has(slug)) {
        seenSlugs.add(slug);
        uniqueItems.push(item);
      }
    }

    return NextResponse.json({
      success: true,
      issues: uniqueItems,
      count: uniqueItems.length
    });
  } catch (err: any) {
    console.error("[API News Issues] Fatal error:", err);
    return NextResponse.json({ success: false, error: err?.message || "Internal server error" }, { status: 500 });
  }
}
