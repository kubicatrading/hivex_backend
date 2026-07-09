const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envText = fs.readFileSync('.env.local', 'utf8');
const url = envText.match(/SUPABASE_PRODUCTION_URL=([^\r\n]+)/)?.[1];
const key = envText.match(/SUPABASE_PRODUCTION_SERVICE_ROLE_KEY=([^\r\n]+)/)?.[1];
const supabase = createClient(url, key);

async function run() {
  const targetId = '42b52e60-3045-4110-b8b3-23196e708643';
  
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', targetId);
    
  if (error) {
    console.error("Error:", error);
    return;
  }
  
  if (data && data.length > 0) {
    const doc = data[0];
    console.log("RESULT_ID:", doc.id);
    console.log("RESULT_TITLE:", doc.title);
    console.log("RESULT_URL:", doc.file_url);
    console.log("ALL_DATA:", JSON.stringify(doc, null, 2));
  } else {
    console.log("No document found");
  }
}

run();
