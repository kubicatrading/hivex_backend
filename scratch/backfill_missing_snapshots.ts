import * as fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { createClient } from '@supabase/supabase-js';

// 1. Read and load all environment variables from .env.local
const envPath = path.join(__dirname, '../.env.local');
console.log(`[Backfill Snapshots] Loading environment variables from: ${envPath}`);
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, 'utf8');
  envText.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.\-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] || "";
      value = value.replace(/^["']|["']$/g, "").trim();
      process.env[match[1]] = value;
    }
  });
}

// Ensure critical variables are loaded
const supabaseUrl = process.env.SUPABASE_PRODUCTION_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_PRODUCTION_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("[Backfill Snapshots] Missing Supabase environment variables!");
  process.exit(1);
}

// Initialize Supabase Client
const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

interface ChartTimestamp {
  timestamp: string;
  seconds: number;
}

/**
 * Parses chart timestamps from analysis text.
 */
function parseChartTimestamps(analysisMarkdown: string): ChartTimestamp[] {
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

async function run() {
  console.log("[Backfill Snapshots] Querying database documents from Supabase...");

  // Fetch all documents
  const { data: allDocs, error } = await supabaseClient
    .from("documents")
    .select("id, title, type, file_url, created_at, metadata, description")
    .in("type", ["video", "knowledge_summary", "knowledge_charts", "knowledge_analysis"]);

  if (error || !allDocs) {
    console.error("[Backfill Snapshots] Failed to fetch documents:", error?.message);
    process.exit(1);
  }

  console.log(`[Backfill Snapshots] Loaded ${allDocs.length} total documents.`);

  const videos = allDocs.filter(d => d.type === "video");
  const analyses = allDocs.filter(d => d.type === "knowledge_analysis");
  const summaries = allDocs.filter(d => d.type === "knowledge_summary");
  const chartsDocs = allDocs.filter(d => d.type === "knowledge_charts");

  console.log(`[Backfill Snapshots] Found ${videos.length} video documents.`);

  for (const video of videos) {
    const videoUrl = video.file_url;
    if (!videoUrl) continue;

    console.log(`\n--------------------------------------------------------`);
    console.log(`[Backfill Snapshots] Processing video: "${video.title}"`);
    console.log(`[Backfill Snapshots] URL: ${videoUrl}`);

    // Gather and combine all textual analysis contents for this video to scan for charts
    const matchingAnalysis = analyses.find(a => a.file_url === videoUrl);
    const matchingSummary = summaries.find(s => s.file_url === videoUrl);
    const matchingChartsDoc = chartsDocs.find(c => c.file_url === videoUrl);

    let textBody = "";
    if (matchingAnalysis?.metadata?.informe_completo) textBody += "\n" + matchingAnalysis.metadata.informe_completo;
    if (matchingAnalysis?.metadata?.report) textBody += "\n" + matchingAnalysis.metadata.report;
    if (matchingSummary?.metadata?.resumen_markdown) textBody += "\n" + matchingSummary.metadata.resumen_markdown;
    if (matchingSummary?.metadata?.summary) textBody += "\n" + matchingSummary.metadata.summary;
    if (matchingChartsDoc?.metadata?.graficos_markdown) textBody += "\n" + matchingChartsDoc.metadata.graficos_markdown;
    if (matchingChartsDoc?.metadata?.charts) textBody += "\n" + matchingChartsDoc.metadata.charts;
    if (video.description) textBody += "\n" + video.description;

    const parsedCharts = parseChartTimestamps(textBody);
    if (parsedCharts.length === 0) {
      console.log(`[Backfill Snapshots] No charts detected for this video, skipping.`);
      continue;
    }

    console.log(`[Backfill Snapshots] Found ${parsedCharts.length} chart timestamps to extract with +5s offset:`, parsedCharts.map(c => c.timestamp));

    const resolvedVideoId = extractYoutubeIdHelper(videoUrl, video.id) || video.id;
    const localDir = path.join(process.cwd(), "public", "snapshots", resolvedVideoId);
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }

    let streamUrl = videoUrl;
    const isYoutube = videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be");

    if (isYoutube) {
      try {
        console.log(`[Backfill Snapshots] Resolving stream URL via yt-dlp...`);
        const resolved = await runCmd(`yt-dlp -f "best[ext=mp4]/best" -g "${videoUrl}"`);
        if (resolved) {
          streamUrl = resolved;
          console.log(`[Backfill Snapshots] Stream URL resolved successfully!`);
        }
      } catch (err) {
        console.warn(`[Backfill Snapshots] Standard yt-dlp resolution failed, trying fallback...`);
        try {
          const fallback = await runCmd(`yt-dlp -g "${videoUrl}"`);
          if (fallback) {
            streamUrl = fallback;
            console.log(`[Backfill Snapshots] Stream URL resolved via fallback!`);
          }
        } catch (fallbackErr) {
          console.error(`[Backfill Snapshots] Failed to resolve video stream URL. Skipping video.`, fallbackErr);
          continue;
        }
      }
    }

    for (const chart of parsedCharts) {
      const outputPath = path.join(localDir, `${chart.seconds}.jpg`);
      const offsetSeconds = chart.seconds + 5;

      console.log(`[Backfill Snapshots] Extracting snapshot at ${chart.timestamp} (${chart.seconds}s + 5s offset = ${offsetSeconds}s)...`);
      try {
        const ffmpegCmd = `ffmpeg -y -ss ${offsetSeconds} -i "${streamUrl}" -vframes 1 -q:v 2 "${outputPath}"`;
        await runCmd(ffmpegCmd);
        console.log(`[Backfill Snapshots] Saved locally: ${chart.seconds}.jpg`);

        if (fs.existsSync(outputPath)) {
          const fileBuffer = fs.readFileSync(outputPath);
          const uploadPath = `${resolvedVideoId}/${chart.seconds}.jpg`;
          console.log(`[Backfill Snapshots] Uploading to Supabase snapshots/${uploadPath}...`);

          const { error: uploadError } = await supabaseClient.storage
            .from("snapshots")
            .upload(uploadPath, fileBuffer, {
              contentType: "image/jpeg",
              upsert: true
            });

          if (uploadError) {
            console.error(`[Backfill Snapshots] Failed to upload snapshot "${uploadPath}":`, uploadError.message);
          } else {
            console.log(`[Backfill Snapshots] Successfully uploaded snapshot!`);
          }
        }
      } catch (err) {
        console.error(`[Backfill Snapshots] Error processing snapshot for ${chart.seconds}s:`, err);
      }
    }
  }

  console.log("\n========================================================");
  console.log("[Backfill Snapshots] Backfill job completed successfully!");
  console.log("========================================================");
}

run();
