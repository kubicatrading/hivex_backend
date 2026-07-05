const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)\s*$/);
  if (match) {
    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value;
  }
});

const url = env.SUPABASE_PRODUCTION_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_PRODUCTION_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

async function run() {
  const { data: docs, error } = await supabase
    .from('documents')
    .select('id, title, file_url, type, metadata')
    .eq('type', 'knowledge_charts');

  if (error) {
    console.error(error);
    return;
  }

  console.log(`Found ${docs.length} knowledge_charts documents:`);
  docs.slice(0, 5).forEach((d, idx) => {
    console.log(`\n--- Document ${idx+1} ---`);
    console.log(`ID: ${d.id}`);
    console.log(`Title: ${d.title}`);
    console.log(`URL: ${d.file_url}`);
    console.log(`Metadata keys:`, Object.keys(d.metadata || {}));
    if (d.metadata && d.metadata.graficos_markdown) {
      console.log(`graficos_markdown sample:`);
      console.log(d.metadata.graficos_markdown.slice(0, 300));
    }
  });
}

run();
