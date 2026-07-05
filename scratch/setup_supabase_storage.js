const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = './.env.local';
if (!fs.existsSync(envPath)) {
  console.error('Error: .env.local not found in current directory');
  process.exit(1);
}
const envText = fs.readFileSync(envPath, 'utf8');

const getEnvVar = (text, key) => {
  const regex = new RegExp(`${key}\\s*=\\s*["']?([^\\s"']+)["']?`);
  const match = regex.exec(text);
  return match ? match[1] : null;
};

const supabaseUrl = getEnvVar(envText, 'SUPABASE_PRODUCTION_URL');
const supabaseServiceKey = getEnvVar(envText, 'SUPABASE_PRODUCTION_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing production Supabase credentials in .env.local');
  process.exit(1);
}

console.log('Connecting to production Supabase at:', supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setup() {
  try {
    console.log('Checking storage buckets...');
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) {
      throw listError;
    }

    console.log('Existing buckets:', buckets.map(b => b.name));

    const bucketName = 'snapshots';
    const exists = buckets.some(b => b.name === bucketName);

    if (!exists) {
      console.log(`Creating public bucket "${bucketName}"...`);
      const { data, error: createError } = await supabase.storage.createBucket(bucketName, {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png'],
        fileSizeLimit: 5242880 // 5MB
      });
      if (createError) {
        throw createError;
      }
      console.log(`Bucket "${bucketName}" created successfully:`, data);
    } else {
      console.log(`Bucket "${bucketName}" already exists!`);
    }

    console.log('Testing list files in "snapshots" bucket...');
    const { data: files, error: listFilesError } = await supabase.storage.from(bucketName).list();
    if (listFilesError) {
      throw listFilesError;
    }
    console.log('Files in bucket:', files);

  } catch (err) {
    console.error('Setup failed:', err);
  }
}

setup();
