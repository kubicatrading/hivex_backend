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

async function run() {
  console.log('Searching documents for youtubeId lMFTJGMmbU8...');
  
  const { data, error } = await supabase
    .from('documents')
    .select('id, title, type, file_url, description, metadata, created_at')
    .like('file_url', '%lMFTJGMmbU8%');
    
  if (error) {
    console.error("Error:", error);
    return;
  }
  
  console.log(`Found ${data ? data.length : 0} documents:`);
  if (data && data.length > 0) {
    data.forEach((doc, idx) => {
      console.log(`\n--- Document ${idx+1} ---`);
      console.log("ID:", doc.id);
      console.log("Title:", doc.title);
      console.log("Type:", doc.type);
      console.log("URL:", doc.file_url);
      console.log("Created At:", doc.created_at);
      console.log("Metadata:", JSON.stringify(doc.metadata, null, 2));
    });
  }
}

run();
