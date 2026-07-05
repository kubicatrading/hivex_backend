const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read env variables
const envText = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = envText.match(/SUPABASE_PRODUCTION_URL=([^\r\n]+)/)?.[1];
const supabaseKey = envText.match(/SUPABASE_PRODUCTION_SERVICE_ROLE_KEY=([^\r\n]+)/)?.[1];

if (!supabaseUrl || !supabaseKey) {
  console.error("Could not read production Supabase credentials from .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function run() {
  console.log("Fetching all documents from Supabase to find active YouTube IDs and document UUIDs...");
  const { data: docs, error: dbError } = await supabase
    .from('documents')
    .select('*');

  if (dbError) {
    console.error("Error fetching documents:", dbError);
    return;
  }

  // Set of valid IDs (both document UUIDs and case-sensitive 11-char YouTube IDs)
  const validIds = new Set();
  
  function extractYoutubeId(fileUrl) {
    if (!fileUrl) return null;
    const regexes = [
      /youtube\.com\/embed\/([a-zA-Z0-9_\-]{11})/,
      /youtube\.com\/watch\?v=([a-zA-Z0-9_\-]{11})/,
      /youtu\.be\/([a-zA-Z0-9_\-]{11})/,
      /youtube\.com\/shorts\/([a-zA-Z0-9_\-]{11})/
    ];

    for (const regex of regexes) {
      const match = fileUrl.match(regex);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }

  for (const doc of docs) {
    validIds.add(doc.id);
    const ytId = extractYoutubeId(doc.file_url);
    if (ytId) {
      validIds.add(ytId);
    }
  }

  console.log(`Active, valid IDs in database: ${validIds.size}`);
  console.log("IDs include:", Array.from(validIds).slice(0, 10));

  console.log("\nListing root contents of 'snapshots' bucket...");
  const { data: rootItems, error: storageError } = await supabase.storage
    .from('snapshots')
    .list('', { limit: 100 });

  if (storageError) {
    console.error("Error listing storage root:", storageError);
    return;
  }

  console.log(`Found ${rootItems.length} items in the root of 'snapshots' bucket:`);
  
  const foldersToDelete = [];
  for (const item of rootItems) {
    // If it's a folder, it won't have metadata.id or size in some configurations, or we check if it is a directory.
    // In Supabase, list() returns { name, id, updated_at, created_at, last_accessed_at, metadata }
    // Usually, directories have no metadata or size = 0.
    const isFolder = !item.metadata || Object.keys(item.metadata).length === 0;
    console.log(`- ${item.name} (${isFolder ? 'Folder' : 'File'}, Size: ${item.metadata?.size || 0} bytes)`);
    
    // We only care about root folders
    if (isFolder || !item.metadata?.size) {
      const folderName = item.name;
      if (!validIds.has(folderName) && folderName !== 'temp') {
        foldersToDelete.push(folderName);
      }
    }
  }

  console.log(`\nFolders identified as legacy/unused (not in documents active IDs):`, foldersToDelete);

  if (foldersToDelete.length === 0) {
    console.log("No legacy snapshot folders found to delete.");
    return;
  }

  // To delete folders in Supabase Storage, we need to list files inside each folder and delete the files first.
  for (const folder of foldersToDelete) {
    console.log(`\nProcessing deletion for folder: "${folder}"...`);
    const { data: files, error: listError } = await supabase.storage
      .from('snapshots')
      .list(folder, { limit: 100 });

    if (listError) {
      console.error(`Error listing files in "${folder}":`, listError);
      continue;
    }

    if (!files || files.length === 0) {
      console.log(`Folder "${folder}" is empty. Deleting folder directly (or empty list).`);
      continue;
    }

    const filePaths = files.map(file => `${folder}/${file.name}`);
    console.log(`Deleting ${filePaths.length} files from folder "${folder}":`, filePaths);
    
    const { data: deleted, error: deleteError } = await supabase.storage
      .from('snapshots')
      .remove(filePaths);

    if (deleteError) {
      console.error(`Error deleting files in "${folder}":`, deleteError);
    } else {
      console.log(`Successfully deleted legacy snapshots in "${folder}":`, deleted);
    }
  }
}

run();
