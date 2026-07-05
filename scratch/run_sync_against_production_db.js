const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const https = require('https');

// Read env variables from .env.local
const envText = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = envText.match(/SUPABASE_PRODUCTION_URL=([^\r\n]+)/)?.[1];
const serviceRoleKey = envText.match(/SUPABASE_PRODUCTION_SERVICE_ROLE_KEY=([^\r\n]+)/)?.[1];

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Could not read production Supabase credentials from .env.local");
  process.exit(1);
}

const YT_RSS_FEED = "https://www.youtube.com/feeds/videos.xml?channel_id=UCGy7SkBjcIAgTiwkXEtPnYg";
const CUTOFF_TIMESTAMP = Date.parse("2026-06-24T00:00:00Z");

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, text: () => Promise.resolve(data) }));
    }).on('error', reject);
  });
}

function extractTagContent(xml, tag) {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, "i").exec(xml);
  return match ? match[1].trim() : "";
}

function parseISO8601Duration(durationStr) {
  const match = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);
  return hours * 3600 + minutes * 60 + seconds;
}

async function fetchRealYoutubeDuration(videoId) {
  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetchUrl(url);
    if (!response.ok) {
      console.warn(`Failed to fetch watch page for video ${videoId}: status ${response.status}`);
      return 0;
    }
    const html = await response.text();

    const metaMatch = /itemprop="duration"\s+content="([^"]+)"/i.exec(html) ||
                      /<meta\s+itemprop="duration"\s+content="([^"]+)"/i.exec(html) ||
                      /content="([^"]+)"\s+itemprop="duration"/i.exec(html);
    if (metaMatch) {
      const isoDuration = metaMatch[1];
      const seconds = parseISO8601Duration(isoDuration);
      if (seconds > 0) return seconds;
    }

    const playerResponseMatch = /ytInitialPlayerResponse\s*=\s*({[\s\S]*?});/.exec(html) ||
                                /ytInitialPlayerResponse\s*=\s*({[\s\S]*?})</.exec(html);
    if (playerResponseMatch) {
      try {
        const jsonStr = playerResponseMatch[1];
        const lengthMatch = /"lengthSeconds"\s*:\s*"(\d+)"/.exec(jsonStr);
        if (lengthMatch) {
          return parseInt(lengthMatch[1], 10);
        }
      } catch (e) {
        console.warn(`Failed to parse json for ${videoId}:`, e);
      }
    }

    const directMatch = /"lengthSeconds"\s*:\s*"(\d+)"/.exec(html);
    if (directMatch) {
      return parseInt(directMatch[1], 10);
    }

    return 0;
  } catch (error) {
    console.error(`Error in fetchRealYoutubeDuration for ${videoId}:`, error);
    return 0;
  }
}

function formatSecondsToDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

async function run() {
  console.log("Starting production synchronization logic simulation...");
  
  // Initialize Supabase Admin client
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  
  // 1. Fetch profiles
  const { data: profiles, error: pError } = await supabaseAdmin.from('profiles').select('id, email');
  if (pError) {
    console.error("Error fetching profiles:", pError);
    process.exit(1);
  }
  console.log(`Found ${profiles.length} profiles to sync.`);
  
  // 2. Fetch YouTube RSS Feed
  console.log("Fetching YouTube RSS feed...");
  const feedRes = await fetchUrl(YT_RSS_FEED);
  if (!feedRes.ok) {
    console.error(`Failed to fetch feed: status ${feedRes.status}`);
    process.exit(1);
  }
  const xmlText = await feedRes.text();
  
  const entryMatches = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;
  while ((match = entryRegex.exec(xmlText)) !== null) {
    entryMatches.push(match[1]);
  }
  
  console.log(`Parsed ${entryMatches.length} videos from the feed.`);
  
  const syncedVideos = [];
  const now = Date.now();
  
  for (const entryXml of entryMatches) {
    const videoId = extractTagContent(entryXml, "yt:videoId");
    if (!videoId) continue;

    const title = extractTagContent(entryXml, "title");
    const publishedAtStr = extractTagContent(entryXml, "published");
    const publishedTime = publishedAtStr ? Date.parse(publishedAtStr) : now;

    if (publishedTime < CUTOFF_TIMESTAMP) {
      console.log(`Skipping real feed video due to date constraint (pre-June 24, 2026): "${title}" (${publishedAtStr})`);
      continue;
    }

    console.log(`Processing video: "${title}" (${videoId})`);
    let durationSecs = await fetchRealYoutubeDuration(videoId);
    console.log(`- Scraped duration: ${durationSecs} seconds`);

    if (durationSecs === 0) {
      console.log(`- Failed to scrape duration for ${videoId}. Applying fallback duration of 900s (15m)`);
      durationSecs = 900;
    }

    if (durationSecs <= 300) {
      console.log(`- Skipping video due to duration constraint (<= 5 mins): "${title}"`);
      continue;
    }

    const durationStr = formatSecondsToDuration(durationSecs);
    syncedVideos.push({
      id: `yt-video-${videoId}`,
      title: title,
      description: extractTagContent(entryXml, "media:description") || "Sin descripción",
      file_url: `https://www.youtube.com/embed/${videoId}`,
      created_at: new Date(publishedTime).toISOString(),
      metadata: {
        duration: durationStr,
        resolution: "4K UHD",
        thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        is_youtube: true,
        channel_title: "Andrei Jikh",
        published_at: publishedAtStr,
      }
    });
  }
  
  console.log(`\nFiltered ${syncedVideos.length} eligible videos.`);
  if (syncedVideos.length === 0) {
    console.log("No videos passed the filters. Ending sync.");
    return;
  }
  
  // 3. For each profile, sync videos
  for (const profile of profiles) {
    console.log(`\nSyncing for profile: ${profile.email} (${profile.id})`);
    
    // Fetch existing video documents for this user
    const { data: existingDocs, error: dFetchError } = await supabaseAdmin
      .from('documents')
      .select('file_url')
      .eq('user_id', profile.id)
      .eq('type', 'video');
      
    if (dFetchError) {
      console.error(`Error fetching existing docs for ${profile.email}:`, dFetchError);
      continue;
    }
    
    const existingUrls = new Set((existingDocs || []).map(d => d.file_url));
    const newDocsToInsert = [];
    
    for (const fv of syncedVideos) {
      if (!existingUrls.has(fv.file_url)) {
        newDocsToInsert.push({
          user_id: profile.id,
          title: fv.title,
          description: fv.description,
          type: 'video',
          file_url: fv.file_url,
          created_at: fv.created_at,
          metadata: {
            duration: fv.metadata.duration,
            resolution: fv.metadata.resolution,
            thumbnail: fv.metadata.thumbnail,
            is_youtube: true,
            channel_title: "Andrei Jikh"
          }
        });
      }
    }
    
    if (newDocsToInsert.length > 0) {
      console.log(`Inserting ${newDocsToInsert.length} new videos for ${profile.email}...`);
      const { data: inserted, error: iError } = await supabaseAdmin
        .from('documents')
        .insert(newDocsToInsert)
        .select();
        
      if (iError) {
        console.error(`Failed to insert videos for ${profile.email}:`, iError);
      } else {
        console.log(`Successfully inserted ${inserted.length} videos for ${profile.email}.`);
      }
    } else {
      console.log(`User ${profile.email} is already up to date.`);
    }
  }
  
  console.log("\nSynchronization finished!");
}

run();
