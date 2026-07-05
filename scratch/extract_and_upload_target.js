const { createClient } = require('@supabase/supabase-js');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const envText = fs.readFileSync('.env.local', 'utf8');
const url = envText.match(/SUPABASE_PRODUCTION_URL=([^\r\n]+)/)?.[1];
const key = envText.match(/SUPABASE_PRODUCTION_SERVICE_ROLE_KEY=([^\r\n]+)/)?.[1];
const supabase = createClient(url, key);

function runCmd(cmd) {
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

async function run() {
  const videoId = '15c513a0-81bf-4880-b3e9-9524c7c0624f';
  const fileUrl = 'https://www.youtube.com/embed/Z_xvkbGWauU';
  const youtubeId = 'Z_xvkbGWauU';
  
  // Spanish timestamps to extract:
  const targets = [
    { label: 'Gold Price Volatility', seconds: 83 },
    { label: "China's Monthly Gold Purchases", seconds: 211 },
    { label: 'Central Bank Net Gold Purchases', seconds: 747 },
    { label: 'Hong Kong Physical Vault Capacity Expansion', seconds: 1179 },
    { label: 'US Official Gold Reserves Valuation Discrepancy', seconds: 1303 }
  ];

  console.log(`Starting snapshot extraction for video: ${videoId} (${youtubeId})`);
  
  // Resolve stream URL using yt-dlp
  console.log("Resolving YouTube stream URL...");
  const ytdlpPath = '/opt/homebrew/bin/yt-dlp';
  const ffmpegPath = '/opt/homebrew/bin/ffmpeg';
  
  let streamUrl = '';
  try {
    streamUrl = await runCmd(`${ytdlpPath} -f "best[ext=mp4]/best" -g "${fileUrl}"`);
    console.log("Stream URL resolved successfully!");
  } catch (err) {
    console.error("Failed to resolve stream URL with best mp4 format, trying fallback...", err.message);
    try {
      streamUrl = await runCmd(`${ytdlpPath} -g "${fileUrl}"`);
      console.log("Stream URL resolved via fallback!");
    } catch (fallbackErr) {
      console.error("Failed completely to resolve stream URL:", fallbackErr.message);
      return;
    }
  }

  const tempDir = path.join(process.cwd(), 'public', 'snapshots', 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  for (const target of targets) {
    const tempOut = path.join(tempDir, `${target.seconds}.jpg`);
    console.log(`Extracting frame at ${target.seconds}s (${target.label}) to ${tempOut}...`);
    
    try {
      // Input seeking is extremely fast
      const ffmpegCmd = `${ffmpegPath} -y -ss ${target.seconds} -i "${streamUrl}" -vframes 1 -q:v 2 "${tempOut}"`;
      await runCmd(ffmpegCmd);
      console.log(`Successfully extracted ${target.seconds}.jpg`);
      
      // Upload to Supabase
      const fileBuffer = fs.readFileSync(tempOut);
      const uploadPath = `${youtubeId}/${target.seconds}.jpg`;
      console.log(`Uploading to Supabase Storage: snapshots/${uploadPath}...`);
      
      const { data, error: uploadError } = await supabase.storage
        .from('snapshots')
        .upload(uploadPath, fileBuffer, {
          contentType: 'image/jpeg',
          upsert: true
        });
        
      if (uploadError) {
        console.error(`Failed to upload ${uploadPath}:`, uploadError.message);
      } else {
        console.log(`Successfully uploaded ${uploadPath}!`);
      }
      
      // Clean up temp file
      fs.unlinkSync(tempOut);
    } catch (err) {
      console.error(`Error processing target ${target.seconds}s:`, err.message);
    }
  }
  
  console.log("All done!");
}

run();
