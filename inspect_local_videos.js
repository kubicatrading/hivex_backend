const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envText = fs.readFileSync('.env.local', 'utf8');

const getEnvVar = (text, key) => {
  const regex = new RegExp(`${key}\\s*=\\s*["']?([^\\s"']+)["']?`);
  const match = regex.exec(text);
  return match ? match[1] : null;
};

// Try to find any URL/Key combination
const url = getEnvVar(envText, 'SUPABASE_PRODUCTION_URL') || getEnvVar(envText, 'NEXT_PUBLIC_SUPABASE_URL');
const key = getEnvVar(envText, 'SUPABASE_PRODUCTION_SERVICE_ROLE_KEY') || getEnvVar(envText, 'NEXT_PUBLIC_SUPABASE_ANON_KEY');

if (!url || !key) {
  console.error("Could not find any database URL or Key in .env.local");
  process.exit(1);
}

console.log(`Using URL: ${url}`);
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('type', 'video');

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log(`Retrieved ${data.length} video documents.`);
  data.forEach(d => {
    console.log(`\nID: ${d.id}`);
    console.log(`Title: ${d.title}`);
    console.log(`File URL: ${d.file_url}`);
    if (d.metadata) {
      console.log(`Metadata keys:`, Object.keys(d.metadata));
      console.log(`Duration in metadata: ${d.metadata.duration}`);
      console.log(`Transcription length: ${d.metadata.transcription?.length || 0}`);
      if (d.metadata.transcription) {
        console.log(`--- FIRST 300 CHARS ---`);
        console.log(d.metadata.transcription.substring(0, 300));
        console.log(`--- LAST 300 CHARS ---`);
        console.log(d.metadata.transcription.substring(d.metadata.transcription.length - 300));
      }
    }
  });
}

run();
