async function run() {
  try {
    const url = "https://www.youtube.com/@JudgingFreedom";
    console.log(`Fetching ${url} to extract Channel ID...`);
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      }
    });
    if (!response.ok) {
      console.log(`Failed to fetch page. Status: ${response.status}`);
      return;
    }
    const html = await response.text();
    console.log("HTML length:", html.length);
    
    // Find channelId using regexes
    const regexes = [
      /itemprop="channelId"\s+content="([^"]+)"/i,
      /<meta\s+itemprop="channelId"\s+content="([^"]+)"/i,
      /channelId":"(UC[^"]+)"/i,
      /browseId":"(UC[^"]+)"/i,
      /youtube\.com\/channel\/(UC[^"\/]+)/i
    ];
    
    let found = false;
    for (const regex of regexes) {
      const match = regex.exec(html);
      if (match) {
        console.log(`🎯 Found Channel ID with regex ${regex}: ${match[1]}`);
        found = true;
      }
    }
    
    if (!found) {
      // Let's write a small slice of HTML to inspect if we couldn't find it
      console.log("Could not find channel ID. Let's check some head meta tags:");
      const headMatch = /<head>([\s\S]*?)<\/head>/.exec(html);
      if (headMatch) {
        console.log(headMatch[1].substring(0, 1000));
      }
    }
  } catch (err) {
    console.error("Error extracting channel ID:", err);
  }
}

run();
