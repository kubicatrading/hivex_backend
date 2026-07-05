const https = require('https');

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

async function testSync() {
  console.log("Fetching YouTube RSS Feed...");
  const response = await fetchUrl(YT_RSS_FEED);
  if (!response.ok) {
    console.error(`Failed to fetch YouTube feed: ${response.status}`);
    return;
  }
  const xmlText = await response.text();
  
  const entryMatches = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;
  while ((match = entryRegex.exec(xmlText)) !== null) {
    entryMatches.push(match[1]);
  }

  console.log(`Found ${entryMatches.length} videos in the feed.`);

  for (const entryXml of entryMatches) {
    const videoId = extractTagContent(entryXml, "yt:videoId");
    const title = extractTagContent(entryXml, "title");
    const publishedAtStr = extractTagContent(entryXml, "published");
    const publishedTime = publishedAtStr ? Date.parse(publishedAtStr) : Date.now();

    console.log(`\nVideo: "${title}" (${videoId})`);
    console.log(`Published At: ${publishedAtStr}`);
    
    if (publishedTime < CUTOFF_TIMESTAMP) {
      console.log(`-> Skipped by DATE filter (CUTOFF: June 24, 2026)`);
      continue;
    }

    const durationSecs = await fetchRealYoutubeDuration(videoId);
    console.log(`-> Scraped duration: ${durationSecs} seconds`);

    if (durationSecs <= 300) {
      console.log(`-> Skipped by DURATION filter (<= 5 mins)`);
      continue;
    }

    console.log(`-> PASSED! Highly eligible for sync!`);
  }
}

testSync();
