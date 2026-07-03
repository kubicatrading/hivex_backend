import { exec } from "child_process";
import fs from "fs";
import path from "path";

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

      const snapshotsDir = path.join(process.cwd(), "public", "snapshots", videoId);
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

        // Skip if snapshot already exists to be highly resource-efficient
        if (fs.existsSync(outputPath)) {
          console.log(`[Snapshot Extractor] Snapshot at ${chart.timestamp} (${chart.seconds}s) already exists, skipping.`);
          continue;
        }

        console.log(`[Snapshot Extractor] Extracting snapshot at ${chart.timestamp} (${chart.seconds}s) to: ${outputPath}`);

        try {
          // Input seeking (-ss before -i) is incredibly fast and avoids downloading the whole stream
          const ffmpegCmd = `ffmpeg -y -ss ${chart.seconds} -i "${streamUrl}" -vframes 1 -q:v 2 "${outputPath}"`;
          await runCmd(ffmpegCmd);
          console.log(`[Snapshot Extractor] Successfully saved snapshot: ${chart.seconds}.jpg`);
        } catch (ffmpegErr) {
          console.error(`[Snapshot Extractor] Failed to extract snapshot at ${chart.seconds}s via ffmpeg:`, ffmpegErr);
        }
      }

      console.log(`[Snapshot Extractor] Background snapshot extraction job completed for video ID: ${videoId}`);
    } catch (err) {
      console.error(`[Snapshot Extractor] Unhandled background error:`, err);
    }
  })();
}
