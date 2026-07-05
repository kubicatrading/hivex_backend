const { YoutubeTranscript } = require('youtube-transcript');

async function test() {
  try {
    const videoId = 'Z_xvkbGWauU';
    console.log(`Fetching transcript for video ${videoId}...`);
    const lines = await YoutubeTranscript.fetchTranscript(videoId);
    console.log(`Success! Fetched ${lines.length} lines.`);
  } catch (err) {
    console.error("Caught error:", err);
    console.log("Error name:", err.name);
    console.log("Error message:", err.message);
    console.log("Is Error instance:", err instanceof Error);
  }
}

test();
