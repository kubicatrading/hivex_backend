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

  // Fetch all documents ordered by created_at descending to prioritize newest videos
  const { data: allDocs, error } = await supabaseClient
    .from("documents")
    .select("id, title, type, file_url, created_at, metadata, description")
    .in("type", ["video", "knowledge_summary", "knowledge_charts", "knowledge_analysis"])
    .order("created_at", { ascending: false });

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

  console.log(`[Backfill Snapshots] Pre-filtering videos by existing snapshots in Supabase Storage...`);
  const videosWithMissingSnapshots: { video: any, missingCharts: any[], parsedCharts: any[] }[] = [];

  await Promise.all(videos.map(async (video) => {
    const videoUrl = video.file_url;
    if (!videoUrl) return;

    // Gather and combine all textual analysis contents
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
    if (parsedCharts.length === 0) return;

    const resolvedVideoId = extractYoutubeIdHelper(videoUrl, video.id) || video.id;
    try {
      const { data: storageFiles, error: storageError } = await supabaseClient.storage
        .from("snapshots")
        .list(resolvedVideoId);

      if (storageError) {
        console.error(`[Backfill Snapshots] Error listing storage files for video ${resolvedVideoId}:`, storageError.message);
      }

      const existingNames = new Set((storageFiles || []).map((f) => f.name));
      const missingCharts = parsedCharts.filter(c => !existingNames.has(`${c.seconds}.jpg`));

      if (missingCharts.length > 0) {
        videosWithMissingSnapshots.push({
          video,
          missingCharts,
          parsedCharts
        });
      }
    } catch (e) {
      console.error(`[Backfill Snapshots] Failed to check storage for ${resolvedVideoId}:`, e);
    }
  }));

  console.log(`[Backfill Snapshots] Pre-filtering complete. Found ${videosWithMissingSnapshots.length} videos needing snapshot extraction out of ${videos.length} total.`);

  for (const { video, missingCharts, parsedCharts } of videosWithMissingSnapshots) {
    const videoUrl = video.file_url;
    console.log(`\n--------------------------------------------------------`);
    console.log(`[Backfill Snapshots] Processing video: "${video.title}"`);
    console.log(`[Backfill Snapshots] URL: ${videoUrl}`);
    console.log(`[Backfill Snapshots] Needs ${missingCharts.length} missing snapshots of ${parsedCharts.length} total:`, missingCharts.map(c => c.timestamp));

    const resolvedVideoId = extractYoutubeIdHelper(videoUrl, video.id) || video.id;
    const localDir = path.join(process.cwd(), "public", "snapshots", resolvedVideoId);
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }

    const isYoutube = videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be");

    const getStreamUrl = async (): Promise<string> => {
      if (!isYoutube) return videoUrl;
      try {
        console.log(`[Backfill Snapshots] Resolving stream URL via yt-dlp...`);
        const resolved = await runCmd(`yt-dlp -f "best[ext=mp4]/best" -g "${videoUrl}"`);
        if (resolved) return resolved;
      } catch (err) {
        console.warn(`[Backfill Snapshots] Standard yt-dlp resolution failed, trying fallback...`);
        try {
          const fallback = await runCmd(`yt-dlp -g "${videoUrl}"`);
          if (fallback) return fallback;
        } catch (fallbackErr) {
          console.error(`[Backfill Snapshots] Failed to resolve video stream URL.`, fallbackErr);
        }
      }
      return videoUrl;
    };

    let streamUrl = await getStreamUrl();

    for (const chart of missingCharts) {
      const outputPath = path.join(localDir, `${chart.seconds}.jpg`);
      const offsetSeconds = chart.seconds + 5;

      console.log(`[Backfill Snapshots] Extracting snapshot at ${chart.timestamp} (${chart.seconds}s + 5s offset = ${offsetSeconds}s)...`);
      let success = false;
      try {
        const ffmpegCmd = `ffmpeg -y -ss ${offsetSeconds} -i "${streamUrl}" -vframes 1 -q:v 2 -strict -2 "${outputPath}"`;
        await runCmd(ffmpegCmd);
        console.log(`[Backfill Snapshots] Saved locally: ${chart.seconds}.jpg`);
        success = true;
      } catch (err) {
        console.warn(`[Backfill Snapshots] Ffmpeg failed. Re-resolving stream URL and retrying...`);
        try {
          streamUrl = await getStreamUrl();
          const ffmpegCmd = `ffmpeg -y -ss ${offsetSeconds} -i "${streamUrl}" -vframes 1 -q:v 2 -strict -2 "${outputPath}"`;
          await runCmd(ffmpegCmd);
          console.log(`[Backfill Snapshots] Saved locally on retry: ${chart.seconds}.jpg`);
          success = true;
        } catch (retryErr) {
          console.error(`[Backfill Snapshots] Error processing snapshot for ${chart.seconds}s on retry:`, retryErr);
        }
      }

      if (success && fs.existsSync(outputPath)) {
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
    }
  }

  console.log("\n========================================================");
  console.log("[Backfill Snapshots] Backfill job completed successfully!");
  console.log("========================================================");
}

run();
