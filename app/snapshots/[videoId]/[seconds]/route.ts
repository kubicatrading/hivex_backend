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
      console.log(`[Snapshots Route] Snapshot ${fileKey} not found in storage. Checking for closest available match...`);
      
      // Parse seconds to integer
      const secondsInt = parseInt(fileKey.replace(".jpg", ""), 10);
      if (isNaN(secondsInt)) {
        return new NextResponse("Invalid seconds parameter", { status: 400 });
      }

      // Try closest available match resolution in the backend (using admin bypass listing)
      try {
        const supabase = createClient(supabaseUrl, supabaseKey, {
          auth: { persistSession: false },
        });
        const { data: fileList, error: listErr } = await supabase.storage
          .from("snapshots")
          .list(resolvedVideoId, { limit: 100 });

        if (!listErr && fileList && fileList.length > 0) {
          const availableSeconds = fileList
            .map((f) => parseInt(f.name.replace(".jpg", ""), 10))
            .filter((s) => !isNaN(s));

          if (availableSeconds.length > 0) {
            let closest = availableSeconds[0];
            let minDiff = Math.abs(availableSeconds[0] - secondsInt);
            for (let i = 1; i < availableSeconds.length; i++) {
              const diff = Math.abs(availableSeconds[i] - secondsInt);
              if (diff < minDiff) {
                minDiff = diff;
                closest = availableSeconds[i];
              }
            }

            // Allow up to a generous 60-second window to resolve slightly shifted timestamps
            if (minDiff <= 60) {
              const resolvedFileKey = `${closest}.jpg`;
              console.log(`[Snapshots Route] Resolved shifted timestamp ${secondsInt} to closest match ${resolvedFileKey}`);
              const closestStorageUrl = `${supabaseUrl}/storage/v1/object/public/snapshots/${resolvedVideoId}/${resolvedFileKey}`;
              const closestResponse = await fetch(closestStorageUrl);
              if (closestResponse.ok) {
                const contentType = closestResponse.headers.get("Content-Type") || "image/jpeg";
                const buffer = await closestResponse.arrayBuffer();

                return new NextResponse(buffer, {
                  status: 200,
                  headers: {
                    "Content-Type": contentType,
                    "Cache-Control": "public, max-age=31536000, immutable",
                  },
                });
              }
            }
          }
        }
      } catch (matchErr) {
        console.error("[Snapshots Route] Closest match resolution crash:", matchErr);
      }

      console.log(`[Snapshots Route] Dynamic extraction fallback required for ${fileKey}...`);

      // Reconstruct the YouTube URL
      let youtubeUrl = rawFileUrl;
      if (!youtubeUrl) {
        youtubeUrl = `https://www.youtube.com/watch?v=${resolvedVideoId}`;
      }

      // Check if yt-dlp and ffmpeg are available on the host machine
      let ytdlpPath: string;
      let ffmpegPath: string;
      try {
        ytdlpPath = await findExecutable("yt-dlp");
        ffmpegPath = await findExecutable("ffmpeg");
        
        // Basic execution check
        await execAsync(`"${ytdlpPath}" --version`);
        await execAsync(`"${ffmpegPath}" -version`);
      } catch (err: any) {
        console.warn(`[Snapshots Route] Dynamic extraction tools not configured or failed execution on this host. Gracefully redirecting to YouTube cover to prevent Vercel block/timeout.`);
        return NextResponse.redirect(`https://img.youtube.com/vi/${resolvedVideoId}/hqdefault.jpg`, 302);
      }

      console.log(`[Snapshots Route] Extraction tools verified. Starting on-demand extraction for ${resolvedVideoId} at ${secondsInt}s...`);

      // Define temp directory and file output path
      const tempDir = path.join(process.cwd(), "public", "snapshots", "temp");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      const tempOut = path.join(tempDir, `${resolvedVideoId}_${secondsInt}_${Date.now()}.jpg`);

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
          return NextResponse.redirect(`https://img.youtube.com/vi/${resolvedVideoId}/hqdefault.jpg`, 302);
        }
      }

      // Extract the frame using ffmpeg
      try {
        await execAsync(`"${ffmpegPath}" -y -ss ${secondsInt} -i "${streamUrl}" -vframes 1 -q:v 2 "${tempOut}"`);
      } catch (err: any) {
        console.error(`[Snapshots Route] ffmpeg frame extraction failed: ${err.message}`);
        if (fs.existsSync(tempOut)) {
          try { fs.unlinkSync(tempOut); } catch (_) {}
        }
        return NextResponse.redirect(`https://img.youtube.com/vi/${resolvedVideoId}/hqdefault.jpg`, 302);
      }

      if (!fs.existsSync(tempOut)) {
        return NextResponse.redirect(`https://img.youtube.com/vi/${resolvedVideoId}/hqdefault.jpg`, 302);
      }

      // Verify if the extracted frame is a chart/graph/table using AI Snapshot Guard
      const isChart = await isImageAChart(tempOut);
      if (!isChart) {
        console.log(`[Snapshots Route] AI Guard: Discarding non-chart dynamic snapshot at ${secondsInt}s. Deleting local temp file.`);
        try {
          fs.unlinkSync(tempOut);
        } catch (_) {}
        // If it is not a chart, return the standard YouTube cover so we still have a beautiful preview
        return NextResponse.redirect(`https://img.youtube.com/vi/${resolvedVideoId}/hqdefault.jpg`, 302);
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
