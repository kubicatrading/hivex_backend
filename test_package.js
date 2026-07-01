const { YoutubeTranscript } = require('youtube-transcript');

async function testPackage(videoId) {
  try {
    console.log('Testing youtube-transcript package for:', videoId);
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    console.log('Successfully fetched transcript! Count:', transcript.length);
    console.log('Sample transcript (first 5 lines):', transcript.slice(0, 5));
    
    const text = transcript.map(line => line.text).join(' ');
    console.log('Transcript text length:', text.length);
    console.log('Transcript preview:', text.substring(0, 300));
  } catch (err) {
    console.error('Error with youtube-transcript:', err);
  }
}

testPackage('dQw4w9WgXcQ');
