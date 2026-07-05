const { YoutubeTranscript } = require('youtube-transcript');

async function test() {
  try {
    const videoId = 'dQw4w9WgXcQ'; // Rickroll
    console.log(`Fetching transcript for video ${videoId}...`);
    const lines = await YoutubeTranscript.fetchTranscript(videoId);
    console.log(`Success! Fetched ${lines.length} lines.`);
    if (lines.length > 0) {
      console.log(`Sample lines:`);
      console.log(JSON.stringify(lines.slice(0, 5), null, 2));
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

test();
