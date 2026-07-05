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
  const { data: docs, error } = await supabase
    .from('documents')
    .select('*')
    .in('type', ['knowledge_transcription', 'knowledge_summary', 'knowledge_charts', 'knowledge_analysis']);

  if (error) {
    console.error("Error fetching docs:", error);
    return;
  }

  console.log(`Fetched ${docs.length} knowledge documents.`);
  for (const doc of docs) {
    console.log(`\nID: ${doc.id}`);
    console.log(`Title: ${doc.title}`);
    console.log(`Type: ${doc.type}`);
    console.log(`Metadata:`, JSON.stringify(doc.metadata, null, 2));

    if (doc.metadata && doc.metadata.canal_origen && doc.metadata.canal_origen.toLowerCase().includes('andrei')) {
      // Wait, is this video related to the Iran Deal (Judging Freedom)?
      if (doc.title.includes('Iran') || doc.title.includes('Deal') || doc.title.includes('Broke') || doc.title.includes('Global Economy')) {
        console.log(`Fixing canal_origen for doc: ${doc.id}`);
        const updatedMetadata = {
          ...doc.metadata,
          canal_origen: 'Judging Freedom'
        };
        const { data: updated, error: updateErr } = await supabase
          .from('documents')
          .update({ metadata: updatedMetadata })
          .eq('id', doc.id)
          .select();
        if (updateErr) {
          console.error("Error updating:", updateErr);
        } else {
          console.log(`Updated successfully to "Judging Freedom"!`);
        }
      }
    }
  }
}

run();
