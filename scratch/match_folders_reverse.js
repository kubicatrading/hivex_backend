const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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
  
  const localFolders = fs.readdirSync(path.join(process.cwd(), 'public', 'snapshots')).filter(f => {
    return fs.statSync(path.join(process.cwd(), 'public', 'snapshots', f)).isDirectory();
  });
  
  console.log(`Local folders: ${localFolders.length}`);
  
  localFolders.forEach(folder => {
    // Find if any document's file_url contains this folder name (case-insensitive)
    const match = docs.find(doc => {
      return doc.file_url.toLowerCase().includes(folder);
    });
    if (match) {
      console.log(`Folder: ${folder} | Matches Doc ID: ${match.id} | Title: "${match.title}"`);
    } else {
      console.log(`Folder: ${folder} | NO MATCH in database!`);
    }
  });
}

run();
