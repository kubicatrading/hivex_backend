const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envText = fs.readFileSync('.env.local', 'utf8');

const getEnvVar = (text, key) => {
  const regex = new RegExp(`${key}\\s*=\\s*["']?([^\\s"']+)["']?`);
  const match = regex.exec(text);
  return match ? match[1] : null;
};

const url = getEnvVar(envText, 'SUPABASE_PRODUCTION_URL') || getEnvVar(envText, 'NEXT_PUBLIC_SUPABASE_URL');
const key = getEnvVar(envText, 'SUPABASE_PRODUCTION_SERVICE_ROLE_KEY') || getEnvVar(envText, 'NEXT_PUBLIC_SUPABASE_ANON_KEY');

if (!url || !key) {
  console.error("Could not find any database URL or Key in .env.local");
  process.exit(1);
}

console.log(`Using database URL: ${url}`);
const supabase = createClient(url, key);

async function run() {
  console.log("Starting DB purge for contaminated 'Judging Freedom' videos...");

  // Let's fetch the videos that match first so we can print their titles
  const { data: videos, error: fetchErr } = await supabase
    .from('documents')
    .select('*')
    .eq('type', 'video');

  if (fetchErr) {
    console.error("Error fetching video documents:", fetchErr);
    return;
  }

  const contaminated = videos.filter(v => {
    const ch = v.metadata?.channel_title || "";
    const title = v.title || "";
    const description = v.description || "";

    // Labeled as Freedom but has Andrei content, or simply any video currently labeled as Judging Freedom to ensure a 100% clean state
    return ch === 'Judging Freedom' || ch === 'Judging Freedom (Mock Feed)';
  });

  console.log(`Found ${contaminated.length} videos labeled as 'Judging Freedom' in the database.`);

  if (contaminated.length === 0) {
    console.log("No contaminated documents found in Supabase production database.");
    return;
  }

  for (const doc of contaminated) {
    console.log(`Deleting contaminated document: ID: ${doc.id} | Title: "${doc.title}"`);
    const { error: deleteErr } = await supabase
      .from('documents')
      .delete()
      .eq('id', doc.id);

    if (deleteErr) {
      console.error(`Error deleting document ${doc.id}:`, deleteErr);
    } else {
      console.log(`Successfully deleted document ${doc.id}`);
    }
  }

  console.log("DB Purge complete. All contaminated documents have been removed.");
}

run();
