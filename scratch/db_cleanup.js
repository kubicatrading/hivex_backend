const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lhtlrztsmkllcqiziftn.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxodGxyenRzbWtsbGNxaXppZnRuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mjg5MDkxOSwiZXhwIjoyMDk4NDY2OTE5fQ.xrqTVx0jvLYfqVUfEqmoCPYfAR9KGgjuvY-L-vHopbo';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

const J_SAAVEDRA_ID = 'e48b2def-691a-4140-8fa9-42e79e23b1e4';

async function run() {
  console.log("--- DB CLEANUP START ---");

  // 1. Fetch all documents for jsaavedra of matching types
  const typesToDelete = ['video', 'audio', 'knowledge_transcription', 'knowledge_summary', 'knowledge_charts', 'knowledge_analysis', 'chart'];
  
  const { data: docs, error: fError } = await supabase
    .from('documents')
    .select('*')
    .eq('user_id', J_SAAVEDRA_ID)
    .in('type', typesToDelete);

  if (fError) {
    console.error("Error fetching documents to delete:", fError);
    return;
  }

  console.log(`Found ${docs.length} documents to delete for jsaavedra:`);
  for (const doc of docs) {
    console.log(`- ID: ${doc.id} | Type: ${doc.type} | Title: "${doc.title}" | File URL: ${doc.file_url}`);
  }

  if (docs.length === 0) {
    console.log("No documents found to delete.");
    return;
  }

  // 2. Perform the deletion
  console.log("\nDeleting documents from database...");
  const { data: deleted, error: dError } = await supabase
    .from('documents')
    .delete()
    .eq('user_id', J_SAAVEDRA_ID)
    .in('type', typesToDelete)
    .select('id');

  if (dError) {
    console.error("Error deleting documents:", dError);
    return;
  }

  console.log(`Successfully deleted ${deleted.length} documents from Supabase.`);
  console.log("--- DB CLEANUP END ---");
}

run();
