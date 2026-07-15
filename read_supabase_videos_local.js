const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read env variables
const envText = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = envText.match(/SUPABASE_PRODUCTION_URL=([^\r\n]+)/)?.[1]?.trim();
const supabaseServiceKey = envText.match(/SUPABASE_PRODUCTION_SERVICE_ROLE_KEY=([^\r\n]+)/)?.[1]?.trim();

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Could not read Supabase production credentials from .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function run() {
  console.log("Fetching documents from Supabase...");
  const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  console.log("Cutoff date (24h):", cutoff24h);

  const { data, error } = await supabase
    .from('documents')
    .select('id, title, type, created_at, file_url, metadata')
    .gte('created_at', cutoff24h)
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Error fetching documents:", error);
    return;
  }

  const counts = {};
  data.forEach(d => {
    counts[d.type] = (counts[d.type] || 0) + 1;
  });
  console.log("\nDocument counts by type in the last 24 hours:", counts);

  const videos = data.filter(d => d.type === 'video');
  console.log(`\nFound ${videos.length} 'video' documents:`);
  for (const doc of videos) {
    console.log(`\nDoc ID: ${doc.id}`);
    console.log(`Title: ${doc.title}`);
    console.log(`Created At: ${doc.created_at}`);
    console.log(`File URL: ${doc.file_url}`);
  }
}

run();
