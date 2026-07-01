const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read env variables
const envText = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = envText.match(/NEXT_PUBLIC_SUPABASE_URL=([^\r\n]+)/)?.[1];
const supabaseAnonKey = envText.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=([^\r\n]+)/)?.[1];

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Could not read Supabase credentials from .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("Fetching documents from Supabase...");
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('type', 'video');

  if (error) {
    console.error("Error fetching documents:", error);
    return;
  }

  console.log(`Retrieved ${data.length} video documents:`);
  for (const doc of data) {
    console.log(`\nDoc ID: ${doc.id}`);
    console.log(`Title: ${doc.title}`);
    console.log(`Created At: ${doc.created_at}`);
    console.log(`Transcription length: ${doc.metadata?.transcription?.length || 0}`);
    if (doc.metadata?.transcription) {
      console.log(`--- First 500 chars of transcription/summary/report ---`);
      console.log(doc.metadata.transcription.substring(0, 500));
    }
  }
}

run();
