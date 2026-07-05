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

const supabase = createClient(url, key);

async function run() {
  const { data: docs, error } = await supabase
    .from('documents')
    .select('id, title, type, metadata')
    .neq('type', 'video')
    .ilike('title', '%Iran%');

  if (error) {
    console.error("Error fetching docs:", error);
    return;
  }

  console.log(`Found ${docs.length} knowledge documents for Iran Deal.`);
  docs.forEach(doc => {
    console.log(`\nID: ${doc.id}`);
    console.log(`Title: ${doc.title}`);
    console.log(`Type: ${doc.type}`);
    console.log(`Canal Origen in metadata: "${doc.metadata?.canal_origen}"`);
  });
}

run();
