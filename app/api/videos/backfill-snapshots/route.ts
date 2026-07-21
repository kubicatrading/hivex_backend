import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { exec } from "child_process";

export const maxDuration = 300; // Extend Vercel execution duration to 300s (Pro plan limit) to prevent timeouts during stream extraction


interface ChartTimestamp {
  timestamp: string;
  seconds: number;
}

/**
 * Helper to run a command line.
 */
function runCmd(cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout.trim());
      }
    });
  });
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

/**
 * Extracts clean youtube ID if possible.
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

export async function GET(request: NextRequest) {
  return handleBackfill(request);
}

export async function POST(request: NextRequest) {
  return handleBackfill(request);
}

async function handleBackfill(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // 1. Authenticate the cron request
    const authHeader = request.headers.get("authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

    const cronSecret = searchParams.get("secret") || 
                       request.headers.get("x-cron-secret") || 
                       bearerToken;

    const expectedSecret = process.env.CRON_SECRET || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (expectedSecret && cronSecret !== expectedSecret) {
      return NextResponse.json({ success: false, error: "Unauthorized access" }, { status: 401 });
    }

    const supabaseUrl = process.env.SUPABASE_PRODUCTION_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_PRODUCTION_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ success: false, error: "Missing database environment configurations" }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    console.log("[Backfill API] Fetching documents from Supabase...");

    // Fetch all relevant documents to scan for charts
    const { data: allDocs, error } = await supabaseAdmin
      .from("documents")
      .select("id, title, type, file_url, created_at, metadata, description")
      .in("type", ["video", "knowledge_summary", "knowledge_charts", "knowledge_analysis"]);

    if (error || !allDocs) {
      return NextResponse.json({ success: false, error: `Failed to fetch documents: ${error?.message || "No data"}` }, { status: 500 });
    }

    const videos = allDocs.filter(d => d.type === "video");
    const analyses = allDocs.filter(d => d.type === "knowledge_analysis");
    const summaries = allDocs.filter(d => d.type === "knowledge_summary");
    const chartsDocs = allDocs.filter(d => d.type === "knowledge_charts");

    const processedVideosLog: string[] = [];
    let backfilledCount = 0;
    
    // We limit processing to maximum 2 videos with missing snapshots per execution to prevent serverless timeout limits
    const MAX_VIDEOS_PER_RUN = 2;

    for (const video of videos) {
      const videoUrl = video.file_url;
      if (!videoUrl) continue;

      // Combine text fields to scan for chart markers
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
      if (parsedCharts.length === 0) continue;

      const resolvedVideoId = extractYoutubeIdHelper(videoUrl, video.id) || video.id;

      // Query already uploaded files in storage for this video
      const { data: uploadedFiles } = await supabaseAdmin.storage
        .from("snapshots")
        .list(resolvedVideoId);

      const uploadedNames = new Set((uploadedFiles || []).map(f => f.name));
      const missingCharts = parsedCharts.filter(c => !uploadedNames.has(`${c.seconds}.jpg`));

      if (missingCharts.length === 0) {
        continue; // Perfectly healthy, all snapshots already exist!
      }

      // If we reached our limit for this cron run, note it and skip processing (will be healed in the next cron run)
      if (backfilledCount >= MAX_VIDEOS_PER_RUN) {
        processedVideosLog.push(`Video "${video.title}" has ${missingCharts.length} missing snapshots (deferred to next execution).`);
        continue;
      }

      console.log(`[Backfill API] Video "${video.title}" has ${missingCharts.length} missing snapshots. Processing...`);
      processedVideosLog.push(`Backfilled ${missingCharts.length} snapshots for "${video.title}".`);
      backfilledCount++;

      // Create a writable tmp dir for serverless execution environment
      const tmpDir = path.join(os.tmpdir(), "snapshots", resolvedVideoId);
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }

      const isYoutube = videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be");

      const getStreamUrl = async (): Promise<string> => {
        if (!isYoutube) return videoUrl;
        try {
          const resolved = await runCmd(`yt-dlp -f "best[ext=mp4]/best" -g "${videoUrl}"`);
          if (resolved) return resolved;
        } catch {
          try {
            const fallback = await runCmd(`yt-dlp -g "${videoUrl}"`);
            if (fallback) return fallback;
          } catch (err: any) {
            console.error(`[Backfill API] Failed to resolve video stream URL:`, err?.message || err);
          }
        }
        return videoUrl;
      };

      let streamUrl = await getStreamUrl();

      for (const chart of missingCharts) {
        const localPath = path.join(tmpDir, `${chart.seconds}.jpg`);
        const offsetSeconds = chart.seconds + 5;

        let success = false;
        try {
          const ffmpegCmd = `ffmpeg -y -ss ${offsetSeconds} -i "${streamUrl}" -vframes 1 -q:v 2 -strict -2 "${localPath}"`;
          await runCmd(ffmpegCmd);
          success = true;
        } catch {
          try {
            // Retry once with refreshed stream URL
            streamUrl = await getStreamUrl();
            const ffmpegCmd = `ffmpeg -y -ss ${offsetSeconds} -i "${streamUrl}" -vframes 1 -q:v 2 -strict -2 "${localPath}"`;
            await runCmd(ffmpegCmd);
            success = true;
          } catch (err: any) {
            console.error(`[Backfill API] Error extracting snapshot for ${chart.seconds}s:`, err?.message || err);
          }
        }

        if (success && fs.existsSync(localPath)) {
          const fileBuffer = fs.readFileSync(localPath);
          const uploadPath = `${resolvedVideoId}/${chart.seconds}.jpg`;

          const { error: uploadError } = await supabaseAdmin.storage
            .from("snapshots")
            .upload(uploadPath, fileBuffer, {
              contentType: "image/jpeg",
              upsert: true
            });

          if (uploadError) {
            console.error(`[Backfill API] Failed to upload "${uploadPath}":`, uploadError.message);
          }

          // Clean up local temp file immediately to conserve storage in /tmp
          try {
            fs.unlinkSync(localPath);
          } catch {}
        }
      }

      // Clean up local video temp folder
      try {
        fs.rmdirSync(tmpDir);
      } catch {}
    }

    return NextResponse.json({
      success: true,
      processedVideos: processedVideosLog,
      backfilledVideosCount: backfilledCount
    });
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    console.error("[Backfill API Error]", errorMsg);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
