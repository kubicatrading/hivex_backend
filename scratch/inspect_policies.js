const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envText = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = envText.match(/SUPABASE_PRODUCTION_URL=([^\r\n]+)/)?.[1];
const serviceKey = envText.match(/SUPABASE_PRODUCTION_SERVICE_ROLE_KEY=([^\r\n]+)/)?.[1];

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  const { data, error } = await supabase.rpc('inspect_policies');
  if (error) {
    console.log("RPC method failed (expected if not exists). Let's query pg_policies direct via custom select if allowed, or via system query.");
    
    // Let's see if we can query pg_policies using service_role via postgrest if it's exposed:
    const { data: policies, error: polErr } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('schemaname', 'public')
      .eq('tablename', 'documents');
    
    if (polErr) {
      console.error("Error fetching pg_policies directly (pg_policies is likely not exposed via postgrest API):", polErr);
    } else {
      console.log("Policies via API:", policies);
    }
  } else {
    console.log("RPC Data:", data);
  }
}

run();
