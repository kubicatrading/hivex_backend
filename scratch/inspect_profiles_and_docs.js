const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envText = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = envText.match(/SUPABASE_PRODUCTION_URL=([^\r\n]+)/)?.[1];
const serviceKey = envText.match(/SUPABASE_PRODUCTION_SERVICE_ROLE_KEY=([^\r\n]+)/)?.[1];

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  const { data: profiles, error: pError } = await supabase.from('profiles').select('*');
  if (pError) {
    console.error("Error fetching profiles:", pError);
    return;
  }
  console.log("\nPROFILES:");
  profiles.forEach(p => {
    console.log(`- Email: ${p.email}, ID: ${p.id}, Full Name: ${p.full_name}`);
  });

  const { data: docs, error: dError } = await supabase.from('documents').select('id, user_id, title, type, file_url');
  if (dError) {
    console.error("Error fetching documents:", dError);
    return;
  }
  console.log("\nDOCUMENTS:");
  docs.forEach(doc => {
    console.log(`- ID: ${doc.id}, User ID: ${doc.user_id}, Type: ${doc.type}, File URL: ${doc.file_url}, Title: "${doc.title}"`);
  });
}

run();
