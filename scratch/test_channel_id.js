async function testId(channelId) {
  try {
    const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    console.log(`Testing Channel ID: ${channelId}...`);
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      }
    });
    if (!response.ok) {
      console.log(`❌ Channel ID ${channelId} failed with status: ${response.status}`);
      return;
    }
    const text = await response.text();
    if (text.includes("<entry>")) {
      const titleMatch = /<title>([\s\S]*?)<\/title>/.exec(text);
      console.log(`✅ Channel ID ${channelId} is VALID! Channel Title: ${titleMatch ? titleMatch[1] : 'Unknown'}`);
      
      // Print first video title
      const videoMatch = /<entry>[\s\S]*?<title>([\s\S]*?)<\/title>/.exec(text);
      if (videoMatch) {
        console.log(`   First video: ${videoMatch[1]}`);
      }
    } else {
      console.log(`❌ Channel ID ${channelId} parsed successfully but has no <entry> tags.`);
    }
  } catch (err) {
    console.error(`❌ Error testing ${channelId}:`, err);
  }
}

async function run() {
  const ids = [
    'UC9B3uW5N4q-5wPzF1yS3V4Q',
    'UC961R7O8hW4L7sI_fF0N1Yw',
    'UC8n887zM-wQ8sWJ5vL1Z93A'
  ];
  for (const id of ids) {
    await testId(id);
    console.log("------------------------");
  }
}

run();
