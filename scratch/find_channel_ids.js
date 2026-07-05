const https = require('https');

const handles = [
  'cihatecicek',
  'zangintl',
  'therichdadchannel',
  'trendsjournal',
  'integralforextv',
  'kanalfinans'
];

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    }, (res) => {
      console.log(`URL: ${url} -> Status: ${res.statusCode}`);
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        console.log(`Redirecting to: ${res.headers.location}`);
        resolve(fetchPage(res.headers.location));
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function findIds() {
  for (const handle of handles) {
    try {
      const url = `https://www.youtube.com/@${handle}`;
      const html = await fetchPage(url);
      
      const canonicalMatch = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[a-zA-Z0-9_-]+)"/);
      const ogMatch = html.match(/<meta property="og:url" content="https:\/\/www\.youtube\.com\/channel\/(UC[a-zA-Z0-9_-]+)"/);
      const externalMatch = html.match(/"externalId"\s*:\s*"(UC[a-zA-Z0-9_-]+)"/);
      const channelIdMatch = html.match(/"channelId"\s*:\s*"(UC[a-zA-Z0-9_-]+)"/);
      const rssMatch = html.match(/youtube\.com\/feeds\/videos\.xml\?channel_id=(UC[a-zA-Z0-9_-]+)/);

      const id = (canonicalMatch && canonicalMatch[1]) ||
                 (ogMatch && ogMatch[1]) ||
                 (externalMatch && externalMatch[1]) ||
                 (channelIdMatch && channelIdMatch[1]) ||
                 (rssMatch && rssMatch[1]);

      if (id) {
        console.log(`Handle: @${handle} -> ID: ${id}`);
      } else {
        console.log(`Handle: @${handle} -> Not Found. HTML length: ${html.length}`);
        const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/);
        console.log(`Title: ${titleMatch ? titleMatch[1] : 'No title'}`);
        
        const anyUCMatch = html.match(/UC[a-zA-Z0-9_-]{22}/g);
        if (anyUCMatch) {
          console.log(`Possible UC IDs found:`, Array.from(new Set(anyUCMatch)).slice(0, 5));
        }
      }
    } catch (err) {
      console.error(`Error fetching @${handle}:`, err.message);
    }
  }
}

findIds();
