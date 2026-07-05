const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

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

const supabaseUrl = getEnvVar(envText, 'SUPABASE_PRODUCTION_URL') || getEnvVar(envText, 'NEXT_PUBLIC_SUPABASE_URL');
const supabaseServiceKey = getEnvVar(envText, 'SUPABASE_PRODUCTION_SERVICE_ROLE_KEY') || getEnvVar(envText, 'NEXT_PUBLIC_SUPABASE_ANON_KEY');

console.log('Supabase URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseServiceKey);

supabase
  .from('documents')
  .select('*')
  .eq('type', 'video')
  .then(({ data, error }) => {
    if (error) {
      console.error('Fetch error:', error);
    } else {
      console.log(`Fetched ${data.length} videos`);
      for (const doc of data) {
        console.log('========================================');
        console.log(`ID: ${doc.id}`);
        console.log(`Title: ${doc.title}`);
        console.log(`Metadata keys:`, Object.keys(doc.metadata || {}));
        if (doc.metadata && doc.metadata.transcription) {
          console.log(`Has transcription! Length: ${doc.metadata.transcription.length}`);
        }
        if (doc.metadata && doc.metadata.translations) {
          console.log('Translations languages:', Object.keys(doc.metadata.translations));
          // Let's check Spanish translation if available
          const es = doc.metadata.translations.es;
          if (es) {
            console.log(`Has Spanish translation! Length: ${es.length}`);
            console.log(es.substring(0, 1000));
          }
        }
      }
    }
  });
