const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envText = fs.readFileSync('.env.local', 'utf8');
const url = envText.match(/SUPABASE_PRODUCTION_URL=([^\r\n]+)/)?.[1];
const key = envText.match(/SUPABASE_PRODUCTION_SERVICE_ROLE_KEY=([^\r\n]+)/)?.[1];
const supabase = createClient(url, key);

async function run() {
  const docId = 'e36ac6f0-793e-4dad-b23f-71a60b315e20';
  const { data: doc, error } = await supabase
    .from('documents')
    .select('metadata')
    .eq('id', docId)
    .single();
    
  if (error) {
    console.error(error);
    return;
  }
  
  console.log("Metadata of e36ac6f0-793e-4dad-b23f-71a60b315e20:");
  console.log(JSON.stringify(doc.metadata, null, 2));
}

run();
