const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envText = fs.readFileSync('.env.local', 'utf8');
const url = envText.match(/SUPABASE_PRODUCTION_URL=([^\r\n]+)/)?.[1];
const key = envText.match(/SUPABASE_PRODUCTION_SERVICE_ROLE_KEY=([^\r\n]+)/)?.[1];
const supabase = createClient(url, key);

async function run() {
  const { data: docs, error } = await supabase.from('documents').select('id, file_url, title').eq('type', 'video');
  if (error) {
    console.error(error);
    return;
  }
  
  const localFolders = fs.readdirSync(path.join(process.cwd(), 'public', 'snapshots')).filter(f => {
    return fs.statSync(path.join(process.cwd(), 'public', 'snapshots', f)).isDirectory();
  });
  
  console.log(`Local folders: ${localFolders.length}`);
  
  docs.forEach(doc => {
    const match = doc.file_url.match(/(?:embed\/|v=)([a-zA-Z0-9_-]{11})/);
    if (match) {
      const ytId = match[1];
      const lowerYtId = ytId.toLowerCase();
      const hasMatch = localFolders.includes(lowerYtId);
      console.log(`Doc ID: ${doc.id} | YT ID: ${ytId} | Lower: ${lowerYtId} | Matches folder: ${hasMatch}`);
    } else {
      console.log(`No YT ID for doc: ${doc.id} | ${doc.file_url}`);
    }
  });
}

run();
