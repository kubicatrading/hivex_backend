const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)\s*$/);
  if (match) {
    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
});

const url = env.SUPABASE_PRODUCTION_URL || env.NEXT_PUBLIC_SUPABASE_URL || "https://lhtlrztsmkllcqiziftn.supabase.co";
const key = env.SUPABASE_PRODUCTION_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(url, key);

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
    if (match && match[1]) return match[1];
  }
  return null;
}

async function match() {
  console.log('Retrieving bucket items from snapshots...');
  const { data: files, error: storageErr } = await supabase.storage.from('snapshots').list('', { limit: 100 });
  if (storageErr) {
    console.error('Storage error:', storageErr);
    return;
  }

  console.log('Retrieving documents from database...');
  const { data: docs, error: dbErr } = await supabase.from('documents').select('id, title, file_url').eq('type', 'video');
  if (dbErr) {
    console.error('Database error:', dbErr);
    return;
  }
  
  console.log(`\nDB Video documents:`);
  docs.forEach(doc => {
    const ytId = extractYoutubeId(doc.file_url);
    console.log(`- YT ID: "${ytId}" | Lower: "${ytId ? ytId.toLowerCase() : ''}" | Title: "${doc.title}"`);
  });

  console.log(`\nStorage folders:`);
  files.forEach(f => {
    console.log(`- Folder: "${f.name}"`);
  });

  console.log(`\nMatching:`);
  for (const file of files) {
    const folder = file.name;
    const matchedDoc = docs.find(doc => {
      const ytId = extractYoutubeId(doc.file_url);
      return ytId && ytId.toLowerCase() === folder.toLowerCase();
    });
    if (matchedDoc) {
      console.log(`MATCH: Folder "${folder}" matches DB YT ID "${extractYoutubeId(matchedDoc.file_url)}"`);
    }
  }
}
match();
