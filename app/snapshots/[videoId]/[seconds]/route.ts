import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { isImageAChart } from "@/lib/snapshotExtractor";

const execAsync = promisify(exec);

// Find executables on PATH or other standard directories
async function findExecutable(name: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`which ${name}`);
    const resolvedPath = stdout.trim();
    if (resolvedPath && fs.existsSync(resolvedPath)) {
      return resolvedPath;
    }
  } catch (e) {
    // Ignore error
  }

  const homebrewPath = `/opt/homebrew/bin/${name}`;
  if (fs.existsSync(homebrewPath)) {
    return homebrewPath;
  }

  const usrLocalPath = `/usr/local/bin/${name}`;
  if (fs.existsSync(usrLocalPath)) {
    return usrLocalPath;
  }

  return name;
}

function extractYoutubeId(fileUrl: string): string | null {
  if (!fileUrl) return null;
  const regexes = [
    /youtube\.com\/embed\/([a-zA-Z0-9_\-]{11})/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_\-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_\-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_\-]{11})/
  ];

  for (const regex of regexes) {
    const match = fileUrl.match(regex);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ videoId: string; seconds: string }> }
) {
  const { videoId, seconds } = await params;

  if (!videoId || !seconds) {
    return new NextResponse("Missing parameters", { status: 400 });
  }

  // Clean up seconds parameter:
  // If it's a number like "83", make it "83.jpg"
  // If it's "83.jpg", keep it as "83.jpg"
  let fileKey = seconds;
  if (!fileKey.endsWith(".jpg") && !fileKey.includes(".")) {
    fileKey = `${fileKey}.jpg`;
  }

  // Retrieve Supabase URL from environment variables
  const supabaseUrl =
    process.env.SUPABASE_PRODUCTION_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://lhtlrztsmkllcqiziftn.supabase.co";

  const supabaseKey =
    process.env.SUPABASE_PRODUCTION_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";

  let resolvedVideoId = videoId;
  let rawFileUrl = "";

  // Check if videoId is a UUID
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(videoId);

  if (isUuid && supabaseUrl && supabaseKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false },
      });
      const { data, error } = await supabase
        .from("documents")
        .select("file_url")
        .eq("id", videoId)
        .single();

      if (!error && data && data.file_url) {
        rawFileUrl = data.file_url;
        const ytId = extractYoutubeId(data.file_url);
        if (ytId) {
          resolvedVideoId = ytId;
        }
      }
    } catch (dbErr) {
      console.error("[Snapshots Route] DB query crash:", dbErr);
    }
  }

  // Construct public Supabase Storage URL
  // The path inside the public "snapshots" bucket is [resolvedVideoId]/[seconds.jpg]
  const publicStorageUrl = `${supabaseUrl}/storage/v1/object/public/snapshots/${resolvedVideoId}/${fileKey}`;

  // Fetch the image from Supabase Storage and proxy it
  try {
    const response = await fetch(publicStorageUrl);
    if (response.ok) {
      const contentType = response.headers.get("Content-Type") || "image/jpeg";
      const buffer = await response.arrayBuffer();

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    let isNotFound = response.status === 404;
    if (response.status === 400) {
      try {
        const json = await response.clone().json();
        if (json && (json.statusCode === "404" || json.statusCode === 404 || json.error === "not_found" || json.message === "Object not found")) {
          isNotFound = true;
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
    }

    if (isNotFound) {
      console.log(`[Snapshots Route] Snapshot ${fileKey} not found in storage. Returning instant YouTube thumbnail redirect fallback.`);
      return NextResponse.redirect(`https://img.youtube.com/vi/${resolvedVideoId}/hqdefault.jpg`, 302);
    }

    let isNotFoundFinal = response.status === 404;
    if (response.status === 400) {
      try {
        const json = await response.clone().json();
        if (json && (json.statusCode === "404" || json.statusCode === 404 || json.error === "not_found" || json.message === "Object not found")) {
          isNotFoundFinal = true;
        }
      } catch (e) {}
    }
    const finalStatus = isNotFoundFinal ? 404 : response.status;
    const finalStatusText = isNotFoundFinal ? "Not Found" : response.statusText;
    return new NextResponse(`Failed to fetch image from storage: ${finalStatusText}`, { status: finalStatus });
  } catch (error) {
    console.error("Error proxying snapshot:", error);
    // Fallback to direct redirect to prevent failure if proxy fails for unexpected reason
    return NextResponse.redirect(publicStorageUrl, 302);
  }
}
