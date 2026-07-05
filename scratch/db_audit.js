const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lhtlrztsmkllcqiziftn.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxodGxyenRzbWtsbGNxaXppZnRuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mjg5MDkxOSwiZXhwIjoyMDk4NDY2OTE5fQ.xrqTVx0jvLYfqVUfEqmoCPYfAR9KGgjuvY-L-vHopbo';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

async function run() {
  console.log("--- DB DETAILED AUDIT START ---");
  
  const { data: docs, error: dError } = await supabase.from('documents').select('*');
  if (dError) {
    console.error("Error fetching documents:", dError);
    return;
  }

  for (const doc of docs) {
    console.log(`\nID: ${doc.id}`);
    console.log(`User ID: ${doc.user_id}`);
    console.log(`Title: ${doc.title}`);
    console.log(`Type: ${doc.type}`);
    console.log(`File URL: ${doc.file_url}`);
    console.log(`Created At: ${doc.created_at}`);
    
    // Metadata / Description info
    if (doc.type === 'video') {
      const transLength = doc.metadata?.transcription?.length || 0;
      console.log(`Video metadata transcription length: ${transLength}`);
      console.log(`Video metadata keys: ${Object.keys(doc.metadata || {})}`);
    } else {
      console.log(`Description preview: ${doc.description ? doc.description.substring(0, 150) + "..." : "none"}`);
      console.log(`Metadata keys: ${Object.keys(doc.metadata || {})}`);
    }
  }

  console.log("\n--- DB DETAILED AUDIT END ---");
}

run();
