const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envText = fs.readFileSync('.env.local', 'utf8');
const url = envText.match(/SUPABASE_PRODUCTION_URL=([^\r\n]+)/)?.[1];
const key = envText.match(/SUPABASE_PRODUCTION_SERVICE_ROLE_KEY=([^\r\n]+)/)?.[1];
const supabase = createClient(url, key);

async function run() {
  const { data: docs, error } = await supabase.from('documents').select('*');
  if (error) {
    console.error(error);
    return;
  }
  
  console.log(`Searching in ${docs.length} documents...`);
  
  const localFolders = fs.readdirSync(require('path').join(process.cwd(), 'public', 'snapshots')).filter(f => {
    return fs.statSync(require('path').join(process.cwd(), 'public', 'snapshots', f)).isDirectory();
  });
  
  console.log(`Searching for ${localFolders.length} folders...`);
  let found = 0;
  
  localFolders.forEach(folder => {
    docs.forEach(doc => {
      const docStr = JSON.stringify(doc).toLowerCase();
      if (docStr.includes(folder)) {
        console.log(`FOUND folder "${folder}" in doc ID: ${doc.id} | Title: "${doc.title}" | Type: ${doc.type}`);
        console.log(`Matching details:`, doc.file_url, doc.metadata);
        found++;
      }
    });
  });
  
  if (found === 0) {
    console.log("No folder names found in any document in BBDD.");
  }
}

run();
