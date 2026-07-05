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

function extractSeconds(markdown) {
  if (!markdown) return [];
  const secondsList = [];
  // Regex to find timestamps like [01:43] or [12:53 - 19:01] or [1:23:45]
  const regex = /\[(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*-\s*(\d{1,2}):(\d{2})(?::(\d{2}))?)?\]/g;
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    let startSecs = 0;
    if (match[3] !== undefined) {
      // HH:MM:SS
      const hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const seconds = parseInt(match[3], 10);
      startSecs = hours * 3600 + minutes * 60 + seconds;
    } else {
      // MM:SS
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      startSecs = minutes * 60 + seconds;
    }
    secondsList.push(startSecs);
  }
  return secondsList;
}

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

async function run() {
  console.log("Fetching all documents from Supabase...");
  const { data: docs, error } = await supabase
    .from('documents')
    .select('id, title, file_url, type, metadata');

  if (error) {
    console.error("Error fetching documents:", error);
    return;
  }

  const chartDocs = docs.filter(d => d.type === 'knowledge_charts');
  console.log(`Found ${chartDocs.length} knowledge_charts documents.`);

  // Prepare database chart entries with their parsed start seconds
  const parsedDocs = chartDocs.map(doc => {
    const ytId = extractYoutubeId(doc.file_url);
    const md = doc.metadata?.graficos_markdown || '';
    const seconds = extractSeconds(md);
    return {
      docId: doc.id,
      title: doc.title,
      youtubeId: ytId,
      fileUrl: doc.file_url,
      expectedSeconds: seconds
    };
  }).filter(d => d.expectedSeconds.length > 0);

  console.log(`Parsed timestamps for ${parsedDocs.length} documents with charts.`);

  // Read local public/snapshots folders
  const snapshotsBaseDir = path.join(process.cwd(), 'public', 'snapshots');
  const folders = fs.readdirSync(snapshotsBaseDir).filter(f => {
    return f !== 'temp' && fs.statSync(path.join(snapshotsBaseDir, f)).isDirectory();
  });

  console.log(`Found ${folders.length} local snapshot folders to match.`);

  const mappings = [];

  for (const folder of folders) {
    const folderPath = path.join(snapshotsBaseDir, folder);
    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.jpg'));
    const folderSeconds = files.map(f => parseInt(f.replace('.jpg', ''), 10)).filter(n => !isNaN(n));

    console.log(`\nFolder "${folder}" contains ${folderSeconds.length} snapshots:`, folderSeconds);

    // Find the best matching document
    let bestDoc = null;
    let maxMatches = 0;
    let bestScores = [];

    for (const pDoc of parsedDocs) {
      let matches = 0;
      // Check how many of the folder seconds are within +/- 5 seconds of the document's expected seconds
      folderSeconds.forEach(fSec => {
        const hasCloseMatch = pDoc.expectedSeconds.some(eSec => Math.abs(eSec - fSec) <= 5);
        if (hasCloseMatch) {
          matches++;
        }
      });

      if (matches > maxMatches) {
        maxMatches = matches;
        bestDoc = pDoc;
      }
    }

    if (bestDoc && maxMatches > 0) {
      console.log(`  -> MATCH! "${folder}" maps to YouTube ID "${bestDoc.youtubeId}"`);
      console.log(`     Title: "${bestDoc.title}"`);
      console.log(`     Matches: ${maxMatches}/${folderSeconds.length} files. Expected seconds:`, bestDoc.expectedSeconds);
      mappings.push({
        folder,
        youtubeId: bestDoc.youtubeId,
        docId: bestDoc.docId,
        title: bestDoc.title
      });
    } else {
      console.log(`  -> NO MATCH found for folder "${folder}"`);
    }
  }

  console.log("\n==================================================");
  console.log(`Matched ${mappings.length} folders out of ${folders.length}.`);
  console.log("==================================================");

  // Write mapping to scratch/mappings.json for persistence/verification
  fs.writeFileSync(
    path.join(__dirname, 'mappings.json'),
    JSON.stringify(mappings, null, 2),
    'utf8'
  );
  console.log("Saved mappings to scratch/mappings.json");
}

run();
