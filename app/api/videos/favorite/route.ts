import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_PRODUCTION_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_PRODUCTION_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase URL or service role key in environment variables");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

async function verifySession(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { error: "Missing or invalid Authorization header", status: 401, adminClient: null, currentUser: null };
  }

  const token = authHeader.substring(7);
  try {
    const adminClient = getSupabaseAdmin();
    
    // Try to verify token using standard client first (recommended by Supabase)
    const supabaseUrl = process.env.SUPABASE_PRODUCTION_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    let user = null;
    let authError = null;
    
    if (supabaseUrl && anonKey) {
      try {
        const standardClient = createClient(supabaseUrl, anonKey);
        const { data: { user: u }, error: err } = await standardClient.auth.getUser(token);
        user = u;
        authError = err;
      } catch (e) {
        console.warn("Standard token validation skipped/failed:", e);
      }
    }
    
    // Fallback to adminClient if standard validation failed
    if (!user || authError) {
      const { data: { user: adminUser }, error: adminError } = await adminClient.auth.getUser(token);
      if (!adminUser || adminError) {
        return { error: "Unauthorized session", status: 401, adminClient: null, currentUser: null };
      }
      user = adminUser;
    }

    return { error: null, status: 200, adminClient, currentUser: user };
  } catch (err: any) {
    console.error("Error verifying session token:", err);
    return { error: err.message || "Internal server error during verification", status: 500, adminClient: null, currentUser: null };
  }
}

export async function POST(request: Request) {
  const { error, status, adminClient } = await verifySession(request);
  if (error || !adminClient) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const body = await request.json();
    const { videoId, isFavorite } = body;

    if (!videoId) {
      return NextResponse.json({ error: "videoId is required" }, { status: 400 });
    }

    // 1. Fetch current document metadata to preserve all other fields
    const { data: list, error: fetchErr } = await adminClient
      .from("documents")
      .select("metadata")
      .eq("id", videoId);

    if (fetchErr) {
      throw fetchErr;
    }

    if (!list || list.length === 0) {
      return NextResponse.json({ error: "Video document not found" }, { status: 404 });
    }

    const currentMetadata = list[0].metadata || {};
    const updatedMetadata = {
      ...currentMetadata,
      is_favorite: isFavorite
    };

    // 2. Update metadata in Supabase bypassing RLS
    const { error: updateErr } = await adminClient
      .from("documents")
      .update({ metadata: updatedMetadata })
      .eq("id", videoId);

    if (updateErr) {
      throw updateErr;
    }

    return NextResponse.json({ success: true, is_favorite: isFavorite });
  } catch (err: any) {
    console.error("POST /api/videos/favorite error:", err);
    return NextResponse.json({ error: err.message || "Failed to update favorite status" }, { status: 500 });
  }
}
