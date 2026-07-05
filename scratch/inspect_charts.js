const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envText = fs.readFileSync('.env.local', 'utf8');
const url = envText.match(/SUPABASE_PRODUCTION_URL=([^\r\n]+)/)?.[1];
const key = envText.match(/SUPABASE_PRODUCTION_SERVICE_ROLE_KEY=([^\r\n]+)/)?.[1];
const supabase = createClient(url, key);

async function run() {
  const targetUrl = 'https://www.youtube.com/embed/Z_xvkbGWauU';
  console.log(`Querying documents for: ${targetUrl}`);
  
  const { data: docs, error } = await supabase
    .from('documents')
    .select('id, type, title, file_url, metadata')
    .eq('file_url', targetUrl);
    
  if (error) {
    console.error("Error:", error);
    return;
  }
  
  console.log(`Found ${docs.length} documents:`);
  docs.forEach(d => {
    console.log(`- Type: ${d.type}, ID: ${d.id}`);
    console.log(`  Metadata keys:`, Object.keys(d.metadata || {}));
    if (d.type === 'knowledge_charts') {
      console.log(`  Charts Metadata:`, JSON.stringify(d.metadata, null, 2));
    }
  });
}

run();
