const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envText = fs.readFileSync('.env.local', 'utf8');
const url = envText.match(/SUPABASE_PRODUCTION_URL=([^\r\n]+)/)?.[1];
const key = envText.match(/SUPABASE_PRODUCTION_SERVICE_ROLE_KEY=([^\r\n]+)/)?.[1];
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
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

async function run() {
  const { data: docs, error } = await supabase.from('documents').select('id, file_url, title');
  if (error) {
    console.error(error);
    return;
  }
  
  const folders = [
    '2ytsxqzhuqa', '32hl5ya4tjr', '8xb9mryio9l', '96v1e5nyt4r', '9h4t478735',
    'ad754lgx5a7', 'atj8clyhtrn', 'bpt1qi4lm6q', 'd9rbfe0h07', 'dif8kci13q',
    'gv3czb0jd1o', 'hflrjw8c2br', 'o2fug1h1j7a', 'oc6up7l14w', 'oe24jthvlom',
    'ph3rdwk0kaq', 'u9lq9anbok', 'v26iwipgrz', 'vhw52d4d5lr', 'vkvxkqm8fi',
    'zrr3gk6mahf', 'zw9lop3xaye'
  ];

  console.log(`Analyzing ${docs.length} documents for ${folders.length} folder names...`);

  folders.forEach(f => {
    let matchFound = false;
    docs.forEach(doc => {
      const ytId = extractYoutubeId(doc.file_url);
      if (ytId && ytId.toLowerCase() === f) {
        console.log(`MATCH FOUND: folder "${f}" matches ytId "${ytId}" (Exact: ${ytId}) for doc "${doc.title}" (id: ${doc.id})`);
        matchFound = true;
      }
    });
    if (!matchFound) {
      console.log(`No matching doc found for folder "${f}"`);
    }
  });
}

run();
