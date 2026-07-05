import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

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

    if (response.status === 404) {
      console.log(`[Snapshots Route] Snapshot ${fileKey} not found in storage. Triggering dynamic on-demand generation for video ${resolvedVideoId}...`);
      
      // Parse seconds to integer
      const secondsInt = parseInt(fileKey.replace(".jpg", ""), 10);
      if (isNaN(secondsInt)) {
        return new NextResponse("Invalid seconds parameter", { status: 400 });
      }

      // Reconstruct the YouTube URL
      let youtubeUrl = rawFileUrl;
      if (!youtubeUrl) {
        // If we didn't query a fileUrl or it's not a UUID, construct from the resolved ID
        youtubeUrl = `https://www.youtube.com/watch?v=${resolvedVideoId}`;
      }

      // Check if yt-dlp and ffmpeg are available on the host machine
      let ytdlpPath: string;
      let ffmpegPath: string;
      try {
        ytdlpPath = await findExecutable("yt-dlp");
        ffmpegPath = await findExecutable("ffmpeg");
      } catch (err: any) {
        console.error("[Snapshots Route] Missing executables:", err.message);
        return new NextResponse(`Image not found in storage. Dynamic generation failed: yt-dlp or ffmpeg not configured on server.`, { status: 404 });
      }

      // Resolve stream URL using yt-dlp
      let streamUrl = "";
      try {
        const { stdout } = await execAsync(`"${ytdlpPath}" -f "best[ext=mp4]/best" -g "${youtubeUrl}"`);
        streamUrl = stdout.trim();
      } catch (err: any) {
        console.warn(`[Snapshots Route] yt-dlp first attempt failed: ${err.message}. Trying fallback...`);
        try {
          const { stdout } = await execAsync(`"${ytdlpPath}" -g "${youtubeUrl}"`);
          streamUrl = stdout.trim();
        } catch (fallbackErr: any) {
          console.error(`[Snapshots Route] yt-dlp fallback failed: ${fallbackErr.message}`);
          return new NextResponse(`Image not found in storage. Dynamic generation failed: yt-dlp could not resolve stream URL`, { status: 404 });
        }
      }

      // Define temp directory and file output path
      const tempDir = path.join(process.cwd(), "public", "snapshots", "temp");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      const tempOut = path.join(tempDir, `${resolvedVideoId}_${secondsInt}_${Date.now()}.jpg`);

      // Extract the frame using ffmpeg
      try {
        await execAsync(`"${ffmpegPath}" -y -ss ${secondsInt} -i "${streamUrl}" -vframes 1 -q:v 2 "${tempOut}"`);
      } catch (err: any) {
        console.error(`[Snapshots Route] ffmpeg frame extraction failed: ${err.message}`);
        if (fs.existsSync(tempOut)) {
          try { fs.unlinkSync(tempOut); } catch (_) {}
        }
        return new NextResponse(`Image not found in storage. Dynamic generation failed: ffmpeg could not extract frame`, { status: 404 });
      }

      if (!fs.existsSync(tempOut)) {
        return new NextResponse(`Image not found in storage. Dynamic generation failed: output file not found`, { status: 404 });
      }

      const fileBuffer = fs.readFileSync(tempOut);

      // Clean up temp file immediately
      try {
        fs.unlinkSync(tempOut);
      } catch (unlinkErr) {
        console.error(`[Snapshots Route] Temp file cleanup error:`, unlinkErr);
      }

      // Upload to Supabase Storage as a background/cached task so next time we bypass this
      if (supabaseUrl && supabaseKey) {
        try {
          const supabase = createClient(supabaseUrl, supabaseKey, {
            auth: { persistSession: false },
          });
          const uploadPath = `${resolvedVideoId}/${fileKey}`;
          const { error: uploadError } = await supabase.storage
            .from("snapshots")
            .upload(uploadPath, fileBuffer, {
              contentType: "image/jpeg",
              upsert: true,
            });

          if (uploadError) {
            console.error(`[Snapshots Route] Supabase upload failed for ${uploadPath}:`, uploadError.message);
          } else {
            console.log(`[Snapshots Route] Successfully generated and uploaded fallback snapshot: ${uploadPath}`);
          }
        } catch (uploadErr) {
          console.error(`[Snapshots Route] Failed to cache generated snapshot to Supabase:`, uploadErr);
        }
      }

      // Return the buffer directly to the user
      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    return new NextResponse(`Failed to fetch image from storage: ${response.statusText}`, { status: response.status });
  } catch (error) {
    console.error("Error proxying snapshot:", error);
    // Fallback to direct redirect to prevent failure if proxy fails for unexpected reason
    return NextResponse.redirect(publicStorageUrl, 302);
  }
}
