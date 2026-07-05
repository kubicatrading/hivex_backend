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

async function uploadTest() {
  try {
    const snapshotsBaseDir = path.join(process.cwd(), 'public', 'snapshots');
    if (!fs.existsSync(snapshotsBaseDir)) {
      console.log('No local snapshots directory found.');
      return;
    }

    // Find any local video ID folders
    const folders = fs.readdirSync(snapshotsBaseDir).filter(f => {
      return fs.statSync(path.join(snapshotsBaseDir, f)).isDirectory();
    });

    if (folders.length === 0) {
      console.log('No video folder found inside public/snapshots/');
      return;
    }

    console.log('Found video folders:', folders);
    
    // Pick the first folder
    const videoFolder = folders[0];
    const videoFolderPath = path.join(snapshotsBaseDir, videoFolder);
    
    // Find any JPG files in this folder
    const files = fs.readdirSync(videoFolderPath).filter(f => f.endsWith('.jpg'));
    if (files.length === 0) {
      console.log(`No JPG files found in public/snapshots/${videoFolder}`);
      return;
    }

    console.log(`Found JPG files in ${videoFolder}:`, files);
    
    // Pick the first JPG file
    const jpgFile = files[0];
    const jpgFilePath = path.join(videoFolderPath, jpgFile);
    
    console.log(`Uploading ${jpgFile} from ${videoFolder} to Supabase...`);
    const fileBuffer = fs.readFileSync(jpgFilePath);
    
    const uploadPath = `${videoFolder}/${jpgFile}`;
    const { data, error } = await supabase.storage
      .from('snapshots')
      .upload(uploadPath, fileBuffer, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (error) {
      throw error;
    }

    console.log('Upload successful! Result:', data);
    
    // Generate public URL
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/snapshots/${uploadPath}`;
    console.log('========================================================');
    console.log('PUBLIC SNAPSHOT URL:');
    console.log(publicUrl);
    console.log('========================================================');

  } catch (err) {
    console.error('Upload failed:', err);
  }
}

uploadTest();
