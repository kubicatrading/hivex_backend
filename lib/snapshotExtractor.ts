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
 * Gemini AI-powered classifier to verify if a video frame is a valid data visualization chart.
 */
export async function isImageAChart(filePath: string): Promise<boolean> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[AI Snapshot Guard] GEMINI_API_KEY is not configured. Keeping snapshot by default.");
    return true;
  }

  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`[AI Snapshot Guard] File not found for analysis: ${filePath}`);
      return false;
    }
    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString("base64");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;
    
    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Data
              }
            },
            {
              text: "Analyze this video frame screenshot. Determine if this image displays a data representation, such as a bar chart, line chart, pie chart, stock market candles, financial graph, market trends, spreadsheet / Excel table, numeric dashboard, scatter plot, or any mathematical/statistical representation of numbers. Respond with 'YES' if it is a graph/chart/table of data. Respond with 'NO' if it shows a person/narrator, scenery, generic slide of text without numbers/charts, movie scene, or any other non-data visual. Your response must be exactly 'YES' or 'NO'."
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 10
      }
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.warn(`[AI Snapshot Guard] Gemini API request failed with status ${response.status}. Keeping snapshot by default.`);
      return true;
    }

    const json = await response.json();
    const answer = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toUpperCase();
    console.log(`[AI Snapshot Guard] Gemini model output for image "${path.basename(filePath)}": "${answer}"`);

    if (answer && answer.includes("YES")) {
      return true;
    } else if (answer && answer.includes("NO")) {
      return false;
    }

    // Default to true if response is unexpected
    return true;
  } catch (error) {
    console.error("[AI Snapshot Guard] Error during image classification:", error);
    return true;
  }
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

        // Verify with AI Snapshot Guard
        let isChart = true;
        if (extracted && fs.existsSync(outputPath)) {
          isChart = await isImageAChart(outputPath);
          if (!isChart) {
            console.log(`[Snapshot Extractor] AI Guard: Discarding non-chart frame at ${chart.timestamp} (${chart.seconds}s). Deleting local file.`);
            try {
              fs.unlinkSync(outputPath);
            } catch (err) {
              console.error("[Snapshot Extractor] Error deleting non-chart snapshot:", err);
            }
          }
        }

        // Upload to Supabase Storage if extracted, classified as a chart, and admin client is available
        if (extracted && isChart && supabaseAdmin && fs.existsSync(outputPath)) {
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

        // Extract and upload native mobile-optimized MP4 video clip if it is a valid chart
        // DESACTIVADO POR COSTE Y SEGURIDAD: Ya no copiamos ni guardamos clips de video mp4 en el storage.
        /*
        if (extracted && isChart && supabaseAdmin) {
          const clipOutputPath = path.join(snapshotsDir, `${chart.seconds}.mp4`);
          let clipExtracted = false;

          if (fs.existsSync(clipOutputPath)) {
            console.log(`[Snapshot Extractor] Video clip at ${chart.seconds}s already exists, skipping extraction.`);
            clipExtracted = true;
          } else {
            console.log(`[Snapshot Extractor] Extracting 60s native mobile-optimized video clip at ${chart.timestamp} (${chart.seconds}s) to: ${clipOutputPath}`);
            try {
              // Extract a 60s H.264 MP4 clip with AAC audio (fully compatible with Telegram native player)
              const ffmpegClipCmd = `ffmpeg -y -ss ${chart.seconds} -i "${streamUrl}" -t 60 -c:v libx264 -c:a aac -strict -2 -b:v 800k -b:a 128k -profile:v baseline -level 3.0 "${clipOutputPath}"`;
              await runCmd(ffmpegClipCmd);
              console.log(`[Snapshot Extractor] Successfully saved video clip: ${chart.seconds}.mp4`);
              clipExtracted = true;
            } catch (ffmpegErr) {
              console.error(`[Snapshot Extractor] Failed to extract video clip at ${chart.seconds}s via ffmpeg:`, ffmpegErr);
            }
          }

          if (clipExtracted && fs.existsSync(clipOutputPath)) {
            try {
              const clipBuffer = fs.readFileSync(clipOutputPath);
              const uploadClipPath = `clips/${resolvedVideoId}/${chart.seconds}.mp4`;
              console.log(`[Snapshot Extractor] Uploading video clip to Supabase Storage bucket documents/${uploadClipPath}...`);
              const { error: uploadError } = await supabaseAdmin.storage
                .from("documents")
                .upload(uploadClipPath, clipBuffer, {
                  contentType: "video/mp4",
                  upsert: true
                });
              if (uploadError) {
                console.error(`[Snapshot Extractor] Failed to upload video clip "${uploadClipPath}" to Supabase:`, uploadError.message);
              } else {
                console.log(`[Snapshot Extractor] Video clip successfully uploaded to Supabase Storage: ${uploadClipPath}`);
              }
            } catch (uploadErr) {
              console.error(`[Snapshot Extractor] Error during Supabase video clip upload for ${chart.seconds}s:`, uploadErr);
            }
          }
        }
        */
      }

      console.log(`[Snapshot Extractor] Background snapshot extraction job completed for video ID: ${resolvedVideoId}`);
    } catch (err) {
      console.error(`[Snapshot Extractor] Unhandled background error:`, err);
    }
  })();
}
