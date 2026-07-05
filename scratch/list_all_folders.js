const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envText = fs.readFileSync('.env.local', 'utf8');
const url = envText.match(/SUPABASE_PRODUCTION_URL=([^\r\n]+)/)?.[1];
const key = envText.match(/SUPABASE_PRODUCTION_SERVICE_ROLE_KEY=([^\r\n]+)/)?.[1];
const supabase = createClient(url, key);

async function run() {
  console.log("Listing root in 'snapshots' bucket...");
  const { data: files, error: fError } = await supabase.storage.from('snapshots').list('', { limit: 100 });
  if (fError) {
    console.error("Error:", fError);
    return;
  }
  
  for (const f of files) {
    console.log(`Item: "${f.name}", id: ${f.id}, metadata: ${f.metadata ? 'has metadata' : 'no metadata'}`);
    // If it's a folder, try to list its contents
    const { data: subFiles, error: subError } = await supabase.storage.from('snapshots').list(f.name, { limit: 10 });
    if (!subError && subFiles) {
      console.log(`  Subfiles in "${f.name}":`, subFiles.map(sf => sf.name));
    }
  }
}

run();
