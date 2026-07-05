const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envText = fs.readFileSync('.env.local', 'utf8');
const url = envText.match(/SUPABASE_PRODUCTION_URL=([^\r\n]+)/)?.[1];
const key = envText.match(/SUPABASE_PRODUCTION_SERVICE_ROLE_KEY=([^\r\n]+)/)?.[1];
const supabase = createClient(url, key);

async function run() {
  const query = 'ph3rdwk0kaq';
  console.log(`Searching for "${query}" in all documents columns...`);
  
  const { data: docs, error } = await supabase.from('documents').select('*');
  if (error) {
    console.error(error);
    return;
  }
  
  docs.forEach(doc => {
    const docStr = JSON.stringify(doc).toLowerCase();
    if (docStr.includes(query.toLowerCase())) {
      console.log(`FOUND in doc id: ${doc.id}`);
      console.log(`Title: ${doc.title}`);
      console.log(`Type: ${doc.type}`);
      console.log(`File URL: ${doc.file_url}`);
    }
  });
}

run();
