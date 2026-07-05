const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envText = fs.readFileSync('.env.local', 'utf8');
const url = envText.match(/SUPABASE_PRODUCTION_URL=([^\r\n]+)/)?.[1];
const key = envText.match(/SUPABASE_PRODUCTION_SERVICE_ROLE_KEY=([^\r\n]+)/)?.[1];
const supabase = createClient(url, key);

async function run() {
  const { data: docs, error } = await supabase.from('documents').select('id, file_url, title, type');
  if (error) {
    console.error(error);
    return;
  }
  
  docs.forEach((doc, idx) => {
    console.log(`${idx}: ID=${doc.id} | Type=${doc.type} | URL=${doc.file_url} | Title="${doc.title}"`);
  });
}

run();
