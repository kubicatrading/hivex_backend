const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envText = fs.readFileSync('.env.local', 'utf8');
const url = envText.match(/SUPABASE_PRODUCTION_URL=([^\r\n]+)/)?.[1];
const key = envText.match(/SUPABASE_PRODUCTION_SERVICE_ROLE_KEY=([^\r\n]+)/)?.[1];
const supabase = createClient(url, key);

async function run() {
  console.log("Listing buckets...");
  const { data: buckets, error: bError } = await supabase.storage.listBuckets();
  if (bError) {
    console.error("Error listing buckets:", bError);
    return;
  }
  console.log("Buckets:", buckets.map(b => b.name));

  console.log("\nListing root files in 'snapshots' bucket...");
  const { data: files, error: fError } = await supabase.storage.from('snapshots').list('', { limit: 100 });
  if (fError) {
    console.error("Error listing files:", fError);
    return;
  }
  
  console.log(`Found ${files.length} root items in 'snapshots':`);
  files.forEach(f => {
    console.log(`- ${f.name} (${f.metadata ? 'folder/metadata' : 'file'})`);
  });
}

run();
