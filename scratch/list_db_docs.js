const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envText = fs.readFileSync('.env.local', 'utf8');
const url = envText.match(/SUPABASE_PRODUCTION_URL=([^\r\n]+)/)?.[1];
const key = envText.match(/SUPABASE_PRODUCTION_SERVICE_ROLE_KEY=([^\r\n]+)/)?.[1];
const supabase = createClient(url, key);

async function run() {
  const { data: docs, error } = await supabase
    .from('documents')
    .select('id, title, type, file_url')
    .limit(100);
    
  if (error) {
    console.error(error);
    return;
  }
  
  console.log(`Found ${docs.length} documents in DB:`);
  docs.forEach(doc => {
    console.log(`- ID: ${doc.id} | Title: "${doc.title}" | Type: ${doc.type} | URL: ${doc.file_url}`);
  });
}

run();
