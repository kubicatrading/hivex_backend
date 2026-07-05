const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envText = fs.readFileSync('.env.local', 'utf8');
const url = envText.match(/SUPABASE_PRODUCTION_URL=([^\r\n]+)/)?.[1];
const key = envText.match(/SUPABASE_PRODUCTION_SERVICE_ROLE_KEY=([^\r\n]+)/)?.[1];
const supabase = createClient(url, key);

async function run() {
  const targetId = '15c513a0-81bf-4880-b3e9-9524c7c0624f';
  
  const { data, error } = await supabase
    .from('documents')
    .select('id, title, type, file_url')
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
  } else {
    console.log("No document found");
  }
}

run();
