const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)\s*$/);
  if (match) {
    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
});

const url = env.SUPABASE_PRODUCTION_URL || env.NEXT_PUBLIC_SUPABASE_URL || "https://lhtlrztsmkllcqiziftn.supabase.co";
const key = env.SUPABASE_PRODUCTION_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(url, key);

async function listFiles(folder) {
  console.log(`\nListing files in snapshots bucket under: "${folder}"`);
  try {
    const { data, error } = await supabase.storage
      .from('snapshots')
      .list(folder);
      
    if (error) {
      console.error(`Error listing "${folder}":`, error.message);
      return;
    }
    
    if (data && data.length > 0) {
      console.log(`Found ${data.length} files:`);
      data.forEach(file => {
        console.log(` - ${file.name} (size: ${file.metadata ? file.metadata.size : 'N/A'}, created: ${file.created_at})`);
      });
    } else {
      console.log('No files found.');
    }
  } catch (err) {
    console.error(`Exception listing "${folder}":`, err);
  }
}

async function run() {
  await listFiles('lMFTJGMmbU8');
  await listFiles('48134892-d0cd-4fc5-9def-7f5f25d2d451');
}

run();
