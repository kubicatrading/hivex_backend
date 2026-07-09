const { createClient } = require('@supabase/supabase-js');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)\s*$/);
  if (match) {
    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
});

const url = env.SUPABASE_PRODUCTION_URL || env.NEXT_PUBLIC_SUPABASE_URL || "https://lhtlrztsmkllcqiziftn.supabase.co";
const key = env.SUPABASE_PRODUCTION_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(url, key);

function runCmd(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

async function run() {
  const videoId = "Z_xvkbGWauU";
  const start = 747;
  const duration = 40; // 747 to 787
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const localOut = path.join(__dirname, `${videoId}_${start}.mp4`);

  console.log(`[Clip Extractor] Resolving stream URL for YouTube video: ${youtubeUrl}`);
  
  let streamUrl = "";
  try {
    streamUrl = await runCmd(`yt-dlp -f "best[ext=mp4]/best" -g "${youtubeUrl}"`);
  } catch (err) {
    console.warn(`[Clip Extractor] Standard format failed, trying fallback...`);
    streamUrl = await runCmd(`yt-dlp -g "${youtubeUrl}"`);
  }

  console.log(`[Clip Extractor] Stream resolved successfully. Extracting 40-second clip via ffmpeg...`);
  
  // Mobile optimized H.264 MP4 with AAC audio, 800k video bitrate, 128k audio bitrate
  const ffmpegCmd = `ffmpeg -y -ss ${start} -i "${streamUrl}" -t ${duration} -c:v libx264 -c:a aac -strict -2 -b:v 800k -b:a 128k -profile:v baseline -level 3.0 "${localOut}"`;
  
  await runCmd(ffmpegCmd);
  console.log(`[Clip Extractor] Clip saved locally to: ${localOut}`);

  const stats = fs.statSync(localOut);
  console.log(`[Clip Extractor] File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

  console.log(`[Clip Extractor] Uploading to Supabase Storage bucket documents/clips/${videoId}/${start}.mp4...`);
  const fileBuffer = fs.readFileSync(localOut);
  
  const { data, error } = await supabase.storage
    .from('documents')
    .upload(`clips/${videoId}/${start}.mp4`, fileBuffer, {
      contentType: 'video/mp4',
      upsert: true
    });

  if (error) {
    console.error(`[Clip Extractor] Upload failed:`, error.message);
  } else {
    console.log(`[Clip Extractor] SUCCESS! Clip uploaded to Supabase Storage.`, data);
  }

  // Cleanup local file
  try {
    fs.unlinkSync(localOut);
    console.log(`[Clip Extractor] Local file cleaned up.`);
  } catch (_) {}
}

run();
