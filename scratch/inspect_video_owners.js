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
  const { data, error } = await supabase
    .rpc('get_policies'); // We might not have a get_policies RPC, but we can try running query or just inspect documents content

  console.log("Error querying RPC:", error);
  
  // Let's query all documents of type 'video' with the service role key to see which user_ids they belong to
  const { data: docs, error: docError } = await supabase
    .from('documents')
    .select('*')
    .eq('type', 'video');
    
  if (docError) {
    console.error("Error fetching documents:", docError);
    return;
  }
  
  console.log(`All video documents in database (Total: ${docs.length}):`);
  docs.forEach(doc => {
    console.log(`- ID: ${doc.id} | Title: "${doc.title}" | User ID: ${doc.user_id} | Channel: "${doc.metadata?.channel_title}"`);
  });
}

run();
