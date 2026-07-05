const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envText = fs.readFileSync('.env.local', 'utf8');
const url = envText.match(/SUPABASE_PRODUCTION_URL=([^\r\n]+)/)?.[1];
const key = envText.match(/SUPABASE_PRODUCTION_SERVICE_ROLE_KEY=([^\r\n]+)/)?.[1];
const supabase = createClient(url, key);

async function run() {
  const docId = '48134892-d0cd-4fc5-9def-7f5f25d2d451';
  const { data: doc, error } = await supabase
    .from('documents')
    .select('id, title, type, file_url')
    .eq('id', docId)
    .single();
    
  if (error) {
    console.error("DB Query error:", error);
    return;
  }
  
  console.log("ID:", doc.id);
  console.log("Title:", doc.title);
  console.log("Type:", doc.type);
  console.log("File URL:", doc.file_url);
}

run();
