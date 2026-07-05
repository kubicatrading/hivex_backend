const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envText = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = envText.match(/SUPABASE_PRODUCTION_URL=([^\r\n]+)/)?.[1];
const serviceKey = envText.match(/SUPABASE_PRODUCTION_SERVICE_ROLE_KEY=([^\r\n]+)/)?.[1];

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  const { data: docs, error } = await supabase.from('documents').select('*');
  if (error) {
    console.error(error);
    return;
  }
  
  docs.forEach(d => {
    console.log(`\nID: ${d.id}`);
    console.log(`User: ${d.user_id}`);
    console.log(`Title: ${d.title}`);
    console.log(`Type: ${d.type}`);
    console.log(`Created At: ${d.created_at}`);
    console.log(`File URL: ${d.file_url}`);
    if (d.metadata) {
      console.log(`Metadata keys:`, Object.keys(d.metadata));
      console.log(`Transcription length: ${d.metadata.transcription?.length || 0}`);
    }
  });
}

run();
