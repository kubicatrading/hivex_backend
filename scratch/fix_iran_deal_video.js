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
  const videoId = '1dea36ae-607a-4d7f-839e-4370999f61ff';
  
  // 1. Fetch current video document
  const { data: video, error: fetchError } = await supabase
    .from('documents')
    .select('*')
    .eq('id', videoId)
    .single();

  if (fetchError) {
    console.error("Error fetching video:", fetchError);
    return;
  }

  console.log("Current video document:");
  console.log(JSON.stringify(video, null, 2));

  // Update metadata
  const updatedMetadata = {
    ...video.metadata,
    channel_title: 'Judging Freedom',
    channel: 'Judging Freedom'
  };

  // Update in DB
  const { data: updatedVideo, error: updateError } = await supabase
    .from('documents')
    .update({ metadata: updatedMetadata })
    .eq('id', videoId)
    .select();

  if (updateError) {
    console.error("Error updating video metadata:", updateError);
    return;
  }

  console.log("\nUpdated video document metadata successfully!");
  console.log(JSON.stringify(updatedVideo, null, 2));

  // 2. Search for any knowledge documents related to this video
  const { data: relatedDocs, error: relatedError } = await supabase
    .from('documents')
    .select('*')
    .neq('type', 'video')
    .or(`title.ilike.%Iran%,file_url.ilike.%r4xoOQ32KNM%`);

  if (relatedError) {
    console.error("Error fetching related docs:", relatedError);
    return;
  }

  console.log(`\nFound ${relatedDocs.length} potentially related knowledge documents:`);
  for (const doc of relatedDocs) {
    console.log(`ID: ${doc.id}, Type: ${doc.type}, Title: ${doc.title}`);
    console.log("Metadata keys:", Object.keys(doc.metadata || {}));
    if (doc.metadata && (doc.metadata.channel_title === 'Andrei Jikh' || doc.metadata.channel === 'Andrei Jikh')) {
      console.log(`Updating related doc metadata for: ${doc.id}`);
      const docUpdatedMeta = {
        ...doc.metadata,
        channel_title: 'Judging Freedom',
        channel: 'Judging Freedom'
      };
      const { data: updatedDoc, error: updateDocErr } = await supabase
        .from('documents')
        .update({ metadata: docUpdatedMeta })
        .eq('id', doc.id)
        .select();
      if (updateDocErr) {
        console.error(`Error updating related doc ${doc.id}:`, updateDocErr);
      } else {
        console.log(`Successfully updated doc ${doc.id} channel_title to "Judging Freedom"`);
      }
    }
  }
}

run();
