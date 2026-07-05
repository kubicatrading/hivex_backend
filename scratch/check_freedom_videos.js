const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envText = fs.readFileSync('.env.local', 'utf8');

const getEnvVar = (text, key) => {
  const regex = new RegExp(`${key}\\s*=\\s*["']?([^\\s"']+)["']?`);
  const match = regex.exec(text);
  return match ? match[1] : null;
};

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
    console.error("Error fetching video documents:", error);
    return;
  }

  console.log(`Total video documents: ${data.length}`);
  
  const judgingVideos = data.filter(d => d.metadata && (d.metadata.channel_title === 'Judging Freedom' || d.metadata.channel === 'Judging Freedom'));
  console.log(`Videos labeled with Judging Freedom: ${judgingVideos.length}`);
  
  judgingVideos.forEach(v => {
    console.log(`\nID: ${v.id}`);
    console.log(`Title: ${v.title}`);
    console.log(`Channel Title (in metadata): ${v.metadata?.channel_title}`);
    console.log(`Channel (in metadata): ${v.metadata?.channel}`);
    console.log(`Video URL / File URL: ${v.file_url}`);
    console.log(`User ID: ${v.user_id}`);
    console.log(`Created At: ${v.created_at}`);
  });
}

run();
