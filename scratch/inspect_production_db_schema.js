const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read env variables
const envText = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = envText.match(/SUPABASE_PRODUCTION_URL=([^\r\n]+)/)?.[1];
const serviceKey = envText.match(/SUPABASE_PRODUCTION_SERVICE_ROLE_KEY=([^\r\n]+)/)?.[1];

if (!supabaseUrl || !serviceKey) {
  console.error("Could not read production Supabase credentials from .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  console.log("Connecting to Supabase Production to inspect database schema...");

  // Let's run a raw SQL query if possible, or query system catalogs via select if enabled, 
  // or let's inspect the tables/policies.
  // Wait, we can't run arbitrary raw SQL via supabase-js unless we use a RPC function, 
  // but we can query information_schema or pg_policies if they are exposed, or check if we get errors.
  
  // Let's inspect pg_catalog or information_schema tables
  console.log("\n--- Checking tables ---");
  const { data: tables, error: tError } = await supabase
    .from('documents')
    .select('*')
    .limit(1);

  if (tError) {
    console.error("Error accessing 'documents' table:", tError);
  } else {
    console.log("Successfully accessed 'documents' table. It exists!");
  }

  // Let's check profiles
  const { data: profiles, error: pError } = await supabase
    .from('profiles')
    .select('*')
    .limit(1);

  if (pError) {
    console.error("Error accessing 'profiles' table:", pError);
  } else {
    console.log("Successfully accessed 'profiles' table. It exists!");
  }

  // Let's test inserting a video for one of the profiles
  if (profiles && profiles.length > 0) {
    const testProfile = profiles[0];
    console.log(`\nTesting manual insertion of a video document for profile: ${testProfile.email} (${testProfile.id})`);
    
    const { data: inserted, error: iError } = await supabase
      .from('documents')
      .insert({
        user_id: testProfile.id,
        title: "Test Video Schema",
        description: "Test description",
        type: "video",
        file_url: "https://www.youtube.com/embed/test_schema_id",
        metadata: {
          duration: "10:00",
          resolution: "1080p",
          thumbnail: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe",
          is_youtube: true
        }
      })
      .select();

    if (iError) {
      console.error("Failed to insert video document:", iError);
    } else {
      console.log("Successfully inserted video document:", inserted);
      
      // Now let's delete it so we keep the DB clean for now
      const { error: dError } = await supabase
        .from('documents')
        .delete()
        .eq('id', inserted[0].id);
      
      if (dError) {
        console.error("Failed to clean up (delete) test video:", dError);
      } else {
        console.log("Successfully cleaned up test video document.");
      }
    }
  } else {
    console.log("No profiles found to run the insertion test.");
  }
}

run();
