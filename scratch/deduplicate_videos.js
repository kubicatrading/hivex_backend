const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envText = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = envText.match(/SUPABASE_PRODUCTION_URL=([^\r\n]+)/)?.[1];
const serviceKey = envText.match(/SUPABASE_PRODUCTION_SERVICE_ROLE_KEY=([^\r\n]+)/)?.[1];

if (!supabaseUrl || !serviceKey) {
  console.error("Could not parse SUPABASE_PRODUCTION_URL or SUPABASE_PRODUCTION_SERVICE_ROLE_KEY from .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false }
});

const ADMIN_ID = '5c8d65c6-0798-4f8a-aae3-dd2cebebd868';

async function run() {
  console.log("--- START DEDUPLICATION OF ADMIN VIDEOS ---");

  // Fetch all video documents
  const { data: videos, error: fError } = await supabase
    .from('documents')
    .select('id, user_id, title, file_url')
    .eq('type', 'video');

  if (fError) {
    console.error("Error fetching video documents:", fError);
    return;
  }

  // Find duplicates
  const urlMap = {};
  videos.forEach(v => {
    if (!urlMap[v.file_url]) {
      urlMap[v.file_url] = [];
    }
    urlMap[v.file_url].push(v);
  });

  const idsToDelete = [];

  for (const [url, list] of Object.entries(urlMap)) {
    if (list.length > 1) {
      console.log(`Duplicate found for URL: ${url}`);
      // Find the one that belongs to Ceren (48ce16e8-45f0-4da1-a047-ab7eac8563dc)
      const cerenDoc = list.find(v => v.user_id === '48ce16e8-45f0-4da1-a047-ab7eac8563dc');
      if (cerenDoc) {
        console.log(`- Keeping Ceren's document: ID: ${cerenDoc.id}, Title: "${cerenDoc.title}"`);
        // Find other documents to delete
        list.forEach(v => {
          if (v.id !== cerenDoc.id) {
            console.log(`- Will delete duplicate: ID: ${v.id}, User ID: ${v.user_id}, Title: "${v.title}"`);
            idsToDelete.push(v.id);
          }
        });
      } else {
        // If Ceren's is not found, keep the first one and delete the rest
        console.log(`- Ceren's document not found. Keeping first document: ID: ${list[0].id}`);
        for (let i = 1; i < list.length; i++) {
          console.log(`- Will delete duplicate: ID: ${list[i].id}, User ID: ${list[i].user_id}`);
          idsToDelete.push(list[i].id);
        }
      }
    }
  }

  if (idsToDelete.length === 0) {
    console.log("No duplicates found to delete.");
    console.log("--- END DEDUPLICATION OF ADMIN VIDEOS ---");
    return;
  }

  console.log(`\nDeleting ${idsToDelete.length} duplicate video documents...`);
  const { data: deleted, error: dError } = await supabase
    .from('documents')
    .delete()
    .in('id', idsToDelete)
    .select('id');

  if (dError) {
    console.error("Error deleting duplicates:", dError);
    return;
  }

  console.log(`Successfully deleted ${deleted.length} duplicate video documents.`);
  console.log("--- END DEDUPLICATION OF ADMIN VIDEOS ---");
}

run();
