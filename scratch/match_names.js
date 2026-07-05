const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envText = fs.readFileSync('.env.local', 'utf8');
const url = envText.match(/SUPABASE_PRODUCTION_URL=([^\r\n]+)/)?.[1];
const key = envText.match(/SUPABASE_PRODUCTION_SERVICE_ROLE_KEY=([^\r\n]+)/)?.[1];
const supabase = createClient(url, key);

const folderNames = [
  '2ytsxqzhuqa', '32hl5ya4tjr', '8xb9mryio9l', '96v1e5nyt4r', '9h4t478735',
  'ad754lgx5a7', 'atj8clyhtrn', 'bpt1qi4lm6q', 'd9rbfe0h07', 'dif8kci13q',
  'gv3czb0jd1o', 'hflrjw8c2br', 'o2fug1h1j7a', 'oc6up7l14w', 'oe24jthvlom',
  'ph3rdwk0kaq', 'u9lq9anbok', 'v26iwipgrz', 'vhw52d4d5lr', 'vkvxkqm8fi',
  'zrr3gk6mahf', 'zw9lop3xaye'
];

async function run() {
  const { data: docs, error } = await supabase.from('documents').select('*');
  if (error) {
    console.error(error);
    return;
  }
  
  console.log(`Matching ${folderNames.length} names with ${docs.length} documents...`);
  
  folderNames.forEach(folder => {
    let matched = false;
    docs.forEach(doc => {
      const docStr = JSON.stringify(doc).toLowerCase();
      if (docStr.includes(folder.toLowerCase())) {
        console.log(`MATCHED folder "${folder}" in doc: id=${doc.id}, title="${doc.title}", file_url="${doc.file_url}"`);
        matched = true;
      }
    });
    if (!matched) {
      console.log(`No match for folder "${folder}"`);
    }
  });
}

run();
