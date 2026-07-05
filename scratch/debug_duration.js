const https = require('https');

const videoId = 'j3yDwy1l5Mo';
const url = `https://www.youtube.com/watch?v=${videoId}`;

https.get(url, {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9"
  }
}, (res) => {
  let html = '';
  res.on('data', chunk => html += chunk);
  res.on('end', () => {
    const metaMatch = html.match(/itemprop="duration"\s+content="([^"]+)"/i);
    console.log("itemprop duration:", metaMatch ? metaMatch[1] : "NOT found");

    const playerMatch = html.match(/ytInitialPlayerResponse\s*=\s*({[\s\S]*?});/) ||
                        html.match(/ytInitialPlayerResponse\s*=\s*({[\s\S]*?})</);
    if (playerMatch) {
      const matchSec = playerMatch[1].match(/"lengthSeconds"\s*:\s*"(\d+)"/);
      console.log("lengthSeconds in playerResponse:", matchSec ? matchSec[1] : "NOT found");
    } else {
      console.log("playerResponse NOT found");
    }

    const directMatch = html.match(/"lengthSeconds"\s*:\s*"(\d+)"/);
    console.log("direct lengthSeconds match:", directMatch ? directMatch[1] : "NOT found");
  });
});
