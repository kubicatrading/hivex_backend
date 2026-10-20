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

    // Query weekly magazines using lightweight JSON field projection (no sentence_timestamps or large blobs)
    // We avoid ordering by created_at in PostgreSQL because it causes an expensive backwards index scan over 25k records
    const { data, error } = await supabase
      .from("documents")
      .select("id, title, description, type, file_url, user_id, created_at, metadata->slug, metadata->cover_url, metadata->published_at, metadata->page_count, metadata->author, metadata->audio_status, metadata->audio_progress_percent, metadata->audio_url, metadata->is_favorite, metadata->summary")
      .eq("type", "knowledge_transcription")
      .like("title", "Revista Semanal%");

    if (error) {
      console.error("[API News Issues] Database query error:", error);
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: 500 });
    }

    const rawItems = (data || []).map((item: any) => {
      return {
        id: item.id,
        title: item.title,
        description: item.description,
        type: item.type,
        file_url: item.file_url,
        user_id: item.user_id,
        created_at: item.created_at,
        metadata: {
          is_magazine_issue: true,
          slug: item.slug,
          cover_url: item.cover_url,
          published_at: item.published_at,
          page_count: item.page_count,
          author: item.author,
          audio_status: item.audio_status,
          audio_progress_percent: item.audio_progress_percent,
          audio_url: item.audio_url,
          is_favorite: item.is_favorite,
          summary: item.summary
        }
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

    // Sort descending by publication date / created_at in memory
    uniqueItems.sort((a, b) => {
      const timeA = new Date(a.metadata?.published_at || a.created_at).getTime() || 0;
      const timeB = new Date(b.metadata?.published_at || b.created_at).getTime() || 0;
      return timeB - timeA;
    });

    return NextResponse.json({
      success: true,
      issues: uniqueItems,
      count: uniqueItems.length
    }, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300"
      }
    });
  } catch (err: any) {
    console.error("[API News Issues] Fatal error:", err);
    return NextResponse.json({ success: false, error: err?.message || "Internal server error" }, { status: 500 });
  }
}
