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
    .from('documents')
    .select('*')
    .eq('type', 'video');

  if (error) {
    console.error("Error:", error);
    return;
  }

  data.forEach(d => {
    console.log(`\nID: ${d.id}`);
    console.log(`Title: ${d.title}`);
    console.log(`Channel Title in metadata: "${d.metadata?.channel_title}"`);
    console.log(`User ID: ${d.user_id}`);
  });
}

run();
