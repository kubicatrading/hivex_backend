const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read env variables
const envText = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = envText.match(/SUPABASE_PRODUCTION_URL=([^\r\n]+)/)?.[1];
const serviceKey = envText.match(/SUPABASE_PRODUCTION_SERVICE_ROLE_KEY=([^\r\n]+)/)?.[1];

if (!supabaseUrl || !serviceKey) {
  console.error("Could not read production Supabase credentials from .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  console.log("Connecting to Supabase Production...");
  
  // 1. Fetch profiles
  const { data: profiles, error: pError } = await supabase.from('profiles').select('*');
  if (pError) {
    console.error("Error fetching profiles:", pError);
  } else {
    console.log(`Found ${profiles.length} profiles:`, profiles);
  }

  // 2. Fetch documents
  const { data: docs, error: dError } = await supabase.from('documents').select('*');
  if (dError) {
    console.error("Error fetching documents:", dError);
  } else {
    console.log(`Found ${docs.length} total documents:`);
    for (const doc of docs) {
      console.log(`- [${doc.type}] ID: ${doc.id}`);
      console.log(`  Title: ${doc.title}`);
      console.log(`  User: ${doc.user_id}`);
      console.log(`  Created At: ${doc.created_at}`);
      console.log(`  Metadata: ${JSON.stringify(doc.metadata)}`);
    }
  }
}

run();
