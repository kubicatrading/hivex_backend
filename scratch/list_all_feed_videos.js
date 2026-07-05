const https = require('https');

const url = "https://www.youtube.com/feeds/videos.xml?channel_id=UCGy7SkBjcIAgTiwkXEtPnYg";

https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;
    const entries = [];
    while ((match = entryRegex.exec(data)) !== null) {
      entries.push(match[1]);
    }
    console.log(`Total entries in feed: ${entries.length}`);
    for (const entry of entries) {
      const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1];
      const published = entry.match(/<published>([\s\S]*?)<\/published>/)?.[1];
      const videoId = entry.match(/<yt:videoId>([\s\S]*?)<\/yt:videoId>/)?.[1];
      console.log(`- Title: ${title}`);
      console.log(`  Published: ${published}`);
      console.log(`  VideoId: ${videoId}`);
    }
  });
});
