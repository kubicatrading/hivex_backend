const { createClient } = require('@supabase/supabase-js');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const execAsync = promisify(exec);

// Duplicate matching env loader
const envText = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = envText.match(/SUPABASE_PRODUCTION_URL=([^\r\n]+)/)?.[1];
const supabaseKey = envText.match(/SUPABASE_PRODUCTION_SERVICE_ROLE_KEY=([^\r\n]+)/)?.[1];

async function findExecutable(name) {
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

function extractYoutubeId(fileUrl) {
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

async function testOnDemand() {
  const videoId = '15c513a0-81bf-4880-b3e9-9524c7c0624f';
  const fileKey = '100.jpg'; // testing dynamic 100 seconds frame extraction
  
  let resolvedVideoId = videoId;
  let rawFileUrl = '';

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(videoId);

  if (isUuid && supabaseUrl && supabaseKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data, error } = await supabase
        .from('documents')
        .select('file_url')
        .eq('id', videoId)
        .single();

      if (!error && data && data.file_url) {
        rawFileUrl = data.file_url;
        const ytId = extractYoutubeId(data.file_url);
        if (ytId) {
          resolvedVideoId = ytId;
        }
      }
    } catch (dbErr) {
      console.error('[Snapshots Route] DB query crash:', dbErr);
    }
  }

  console.log(`Resolved video: ${resolvedVideoId}, Original URL: ${rawFileUrl}`);

  // Fetch from storage to see if it exists (expecting 404 since 100.jpg shouldn't exist)
  const publicStorageUrl = `${supabaseUrl}/storage/v1/object/public/snapshots/${resolvedVideoId}/${fileKey}`;
  console.log(`Checking if image exists at: ${publicStorageUrl}`);
  
  try {
    const res = await fetch(publicStorageUrl);
    if (res.ok) {
      console.log('Snapshot already exists in storage. We will delete it to test extraction fallback.');
      const supabase = createClient(supabaseUrl, supabaseKey);
      await supabase.storage.from('snapshots').remove([`${resolvedVideoId}/${fileKey}`]);
      console.log('Existing snapshot deleted.');
    }
  } catch (err) {
    console.warn('Check request failed, proceeding to extract.', err.message);
  }

  // Now, simulate the fallback extraction!
  console.log('Simulating on-demand extraction fallback...');
  const secondsInt = parseInt(fileKey.replace('.jpg', ''), 10);
  let youtubeUrl = rawFileUrl || `https://www.youtube.com/watch?v=${resolvedVideoId}`;

  const ytdlpPath = await findExecutable('yt-dlp');
  const ffmpegPath = await findExecutable('ffmpeg');
  console.log(`Found executables: yt-dlp -> ${ytdlpPath}, ffmpeg -> ${ffmpegPath}`);

  let streamUrl = '';
  try {
    const { stdout } = await execAsync(`"${ytdlpPath}" -f "best[ext=mp4]/best" -g "${youtubeUrl}"`);
    streamUrl = stdout.trim();
  } catch (err) {
    console.warn(`yt-dlp first attempt failed: ${err.message}. Trying fallback...`);
    try {
      const { stdout } = await execAsync(`"${ytdlpPath}" -g "${youtubeUrl}"`);
      streamUrl = stdout.trim();
    } catch (fallbackErr) {
      console.error(`yt-dlp fallback failed: ${fallbackErr.message}`);
      process.exit(1);
    }
  }

  const tempDir = path.join(process.cwd(), 'public', 'snapshots', 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  const tempOut = path.join(tempDir, `${resolvedVideoId}_${secondsInt}_${Date.now()}.jpg`);

  try {
    console.log(`Running ffmpeg frame extraction to ${tempOut}...`);
    await execAsync(`"${ffmpegPath}" -y -ss ${secondsInt} -i "${streamUrl}" -vframes 1 -q:v 2 "${tempOut}"`);
    console.log('Frame extracted successfully!');
  } catch (err) {
    console.error(`ffmpeg extraction failed: ${err.message}`);
    process.exit(1);
  }

  if (!fs.existsSync(tempOut)) {
    console.error('Output file not found.');
    process.exit(1);
  }

  const fileBuffer = fs.readFileSync(tempOut);
  console.log(`Image file size: ${fileBuffer.length} bytes`);

  // Clean up temp file
  fs.unlinkSync(tempOut);
  console.log('Cleaned up local temp file.');

  // Upload to Supabase Storage
  console.log(`Uploading newly generated fallback snapshot to Supabase: snapshots/${resolvedVideoId}/${fileKey}...`);
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error: uploadError } = await supabase.storage
    .from('snapshots')
    .upload(`${resolvedVideoId}/${fileKey}`, fileBuffer, {
      contentType: 'image/jpeg',
      upsert: true
    });

  if (uploadError) {
    console.error('Upload failed:', uploadError.message);
  } else {
    console.log('Upload successful! Details:', data);
  }
}

testOnDemand();
