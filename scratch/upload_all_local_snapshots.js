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

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function uploadAll() {
  try {
    const snapshotsBaseDir = path.join(process.cwd(), 'public', 'snapshots');
    if (!fs.existsSync(snapshotsBaseDir)) {
      console.log('No local snapshots directory found.');
      return;
    }

    // Find all local video ID folders
    const folders = fs.readdirSync(snapshotsBaseDir).filter(f => {
      return fs.statSync(path.join(snapshotsBaseDir, f)).isDirectory();
    });

    console.log(`Found ${folders.length} folders to upload.`);

    let totalUploaded = 0;
    let totalSkipped = 0;

    for (const folder of folders) {
      const folderPath = path.join(snapshotsBaseDir, folder);
      const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.jpg'));
      
      console.log(`Processing folder "${folder}" with ${files.length} JPGs...`);

      for (const file of files) {
        const filePath = path.join(folderPath, file);
        const uploadPath = `${folder}/${file}`;

        try {
          const fileBuffer = fs.readFileSync(filePath);
          
          // Let's upload
          const { data, error } = await supabase.storage
            .from('snapshots')
            .upload(uploadPath, fileBuffer, {
              contentType: 'image/jpeg',
              upsert: true
            });

          if (error) {
            console.error(`  Failed to upload "${uploadPath}":`, error.message);
          } else {
            console.log(`  Uploaded: ${uploadPath}`);
            totalUploaded++;
          }
        } catch (fileErr) {
          console.error(`  Error reading/uploading "${uploadPath}":`, fileErr);
        }
      }
    }

    console.log('========================================================');
    console.log('UPLOAD ALL COMPLETED');
    console.log(`Total Uploaded: ${totalUploaded}`);
    console.log('========================================================');

  } catch (err) {
    console.error('Upload all failed:', err);
  }
}

uploadAll();
