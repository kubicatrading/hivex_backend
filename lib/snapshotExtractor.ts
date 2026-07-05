import { exec } from "child_process";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_PRODUCTION_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_PRODUCTION_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;


interface ChartTimestamp {
  timestamp: string;
  seconds: number;
}

/**
 * Resiliently parses chart timestamps from the Spanish analysis markdown.
 */
export function parseChartTimestamps(analysisMarkdown: string): ChartTimestamp[] {
  if (!analysisMarkdown) return [];

  const timestamps: ChartTimestamp[] = [];
  const lines = analysisMarkdown.split("\n");
  const headerRegex = /^####\s+\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?/i;
  const seenSeconds = new Set<number>();

  for (const line of lines) {
    const match = line.trim().match(headerRegex);
    if (match && match[1]) {
      const timestamp = match[1];
      const parts = timestamp.split(":").map(Number);
      let seconds = 0;
      if (parts.length === 3) {
        seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
      } else if (parts.length === 2) {
        seconds = parts[0] * 60 + parts[1];
      }

      if (!seenSeconds.has(seconds)) {
        seenSeconds.add(seconds);
        timestamps.push({ timestamp, seconds });
      }
    }
  }

  return timestamps;
}

/**
 * Executes a shell command and returns a Promise.
 */
function runCmd(cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

/**
 * Helper to extract YouTube video ID (11 chars) from a URL or raw ID.
 */
function extractYoutubeIdHelper(fileUrl: string, videoId?: string): string | null {
  if (fileUrl) {
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
  }

  if (videoId) {
    if (videoId.startsWith("yt-video-")) {
      return videoId.substring("yt-video-".length);
    }
    if (videoId.length === 11) {
      return videoId;
    }
  }

  return null;
}

/**
 * Asynchronously extracts frame snapshots for the detected chart timestamps in the background.
 */
export async function extractSnapshotsInBackground(
  videoId: string,
  fileUrl: string,
  analysisMarkdown: string
): Promise<void> {
  // Run entirely in background
  (async () => {
    try {
      console.log(`[Snapshot Extractor] Starting background job for video document ID: ${videoId}`);
      const charts = parseChartTimestamps(analysisMarkdown);
      if (charts.length === 0) {
        console.log(`[Snapshot Extractor] No chart timestamps detected in analysis markdown.`);
        return;
      }

      console.log(`[Snapshot Extractor] Found ${charts.length} chart timestamps to extract:`, charts.map(c => c.timestamp));

      // Resolve the clean, case-sensitive YouTube ID if possible
      let resolvedVideoId = videoId;
      const ytId = extractYoutubeIdHelper(fileUrl, videoId);
      if (ytId) {
        resolvedVideoId = ytId;
        console.log(`[Snapshot Extractor] Resolved video ID from ${videoId} to YouTube ID: ${resolvedVideoId}`);
      }

      const snapshotsDir = path.join(process.cwd(), "public", "snapshots", resolvedVideoId);
      if (!fs.existsSync(snapshotsDir)) {
        fs.mkdirSync(snapshotsDir, { recursive: true });
        console.log(`[Snapshot Extractor] Created folder: ${snapshotsDir}`);
      }

      const isYoutube = fileUrl.includes("youtube.com") || fileUrl.includes("youtu.be");
      let streamUrl = fileUrl;

      if (isYoutube) {
        try {
          console.log(`[Snapshot Extractor] Fetching stream URL via yt-dlp for: ${fileUrl}`);
          // Query best MP4 stream or best overall stream URL
          const resolvedUrl = await runCmd(`yt-dlp -f "best[ext=mp4]/best" -g "${fileUrl}"`);
          if (resolvedUrl) {
            streamUrl = resolvedUrl;
            console.log(`[Snapshot Extractor] Successfully resolved YouTube stream URL!`);
          } else {
            throw new Error("yt-dlp returned an empty stream URL");
          }
        } catch (ytErr) {
          console.error(`[Snapshot Extractor] Failed to resolve YouTube stream URL with standard format. Falling back to default format query.`, ytErr);
          try {
            const fallbackUrl = await runCmd(`yt-dlp -g "${fileUrl}"`);
            if (fallbackUrl) {
              streamUrl = fallbackUrl;
              console.log(`[Snapshot Extractor] Resolved YouTube stream URL using fallback format query!`);
            } else {
              throw new Error("yt-dlp fallback returned empty stream URL");
            }
          } catch (fallbackErr) {
            console.error(`[Snapshot Extractor] YouTube stream URL extraction failed completely:`, fallbackErr);
            return;
          }
        }
      }

      for (const chart of charts) {
        const outputPath = path.join(snapshotsDir, `${chart.seconds}.jpg`);
        let extracted = false;

        // Skip if snapshot already exists to be highly resource-efficient
        if (fs.existsSync(outputPath)) {
          console.log(`[Snapshot Extractor] Snapshot at ${chart.timestamp} (${chart.seconds}s) already exists, skipping extraction.`);
          extracted = true;
        } else {
          console.log(`[Snapshot Extractor] Extracting snapshot at ${chart.timestamp} (${chart.seconds}s) to: ${outputPath}`);

          try {
            // Input seeking (-ss before -i) is incredibly fast and avoids downloading the whole stream
            const ffmpegCmd = `ffmpeg -y -ss ${chart.seconds} -i "${streamUrl}" -vframes 1 -q:v 2 "${outputPath}"`;
            await runCmd(ffmpegCmd);
            console.log(`[Snapshot Extractor] Successfully saved snapshot: ${chart.seconds}.jpg`);
            extracted = true;
          } catch (ffmpegErr) {
            console.error(`[Snapshot Extractor] Failed to extract snapshot at ${chart.seconds}s via ffmpeg:`, ffmpegErr);
          }
        }

        // Upload to Supabase Storage if extracted or existing, and admin client is available
        if (extracted && supabaseAdmin && fs.existsSync(outputPath)) {
          try {
            const fileBuffer = fs.readFileSync(outputPath);
            const uploadPath = `${resolvedVideoId}/${chart.seconds}.jpg`;
            console.log(`[Snapshot Extractor] Uploading to Supabase Storage bucket snapshots/${uploadPath}...`);
            const { error: uploadError } = await supabaseAdmin.storage
              .from("snapshots")
              .upload(uploadPath, fileBuffer, {
                contentType: "image/jpeg",
                upsert: true
              });
            if (uploadError) {
              console.error(`[Snapshot Extractor] Failed to upload snapshot "${uploadPath}" to Supabase:`, uploadError.message);
            } else {
              console.log(`[Snapshot Extractor] Snapshot successfully uploaded to Supabase Storage: ${uploadPath}`);
            }
          } catch (uploadErr) {
            console.error(`[Snapshot Extractor] Error during Supabase upload for ${chart.seconds}s:`, uploadErr);
          }
        }
      }

      console.log(`[Snapshot Extractor] Background snapshot extraction job completed for video ID: ${resolvedVideoId}`);
    } catch (err) {
      console.error(`[Snapshot Extractor] Unhandled background error:`, err);
    }
  })();
}
