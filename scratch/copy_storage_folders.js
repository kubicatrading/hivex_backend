const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)\s*$/);
  if (match) {
    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value;
  }
});

const url = env.SUPABASE_PRODUCTION_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_PRODUCTION_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

async function run() {
  const mappingsPath = path.join(__dirname, 'mappings.json');
  if (!fs.existsSync(mappingsPath)) {
    console.error("mappings.json not found! Please run fingerprint_matching.js first.");
    return;
  }

  const mappings = JSON.parse(fs.readFileSync(mappingsPath, 'utf8'));
  console.log(`Loaded ${mappings.length} folder mappings to process.`);

  for (const m of mappings) {
    console.log(`\nProcessing folder mapping: "${m.folder}" -> "${m.youtubeId}" (${m.title})`);

    // 1. List files in old folder
    const { data: files, error: listError } = await supabase.storage
      .from('snapshots')
      .list(m.folder, { limit: 150 });

    if (listError) {
      console.error(`  Error listing files in "${m.folder}":`, listError.message);
      continue;
    }

    if (!files || files.length === 0) {
      console.log(`  No files found in folder "${m.folder}".`);
      continue;
    }

    console.log(`  Found ${files.length} files to copy.`);

    for (const file of files) {
      if (file.name === '.emptyFolderPlaceholder') continue;

      const oldPath = `${m.folder}/${file.name}`;
      const newPath = `${m.youtubeId}/${file.name}`;

      // Try copy
      try {
        const { error: copyError } = await supabase.storage
          .from('snapshots')
          .copy(oldPath, newPath);

        if (!copyError) {
          console.log(`  [COPY SUCCESS] "${oldPath}" -> "${newPath}"`);
        } else {
          // If copy fails (e.g. if the function is not supported, or bucket policies restrict it), try download-and-upload fallback
          console.log(`  [COPY FAILED] ${copyError.message}. Trying download-and-upload fallback...`);
          
          const { data: blob, error: downloadError } = await supabase.storage
            .from('snapshots')
            .download(oldPath);

          if (downloadError) {
            console.error(`    Download failed for "${oldPath}":`, downloadError.message);
            continue;
          }

          // Convert blob to Buffer
          const buffer = Buffer.from(await blob.arrayBuffer());

          const { error: uploadError } = await supabase.storage
            .from('snapshots')
            .upload(newPath, buffer, {
              contentType: 'image/jpeg',
              upsert: true
            });

          if (uploadError) {
            console.error(`    Upload failed for "${newPath}":`, uploadError.message);
          } else {
            console.log(`    [FALLBACK SUCCESS] Uploaded to "${newPath}"`);
          }
        }
      } catch (err) {
        console.error(`  Unexpected error processing file "${file.name}":`, err.message);
      }
    }
  }

  console.log("\n==================================================");
  console.log("STORAGE FOLDER COPY COMPLETED!");
  console.log("==================================================");
}

run();
