const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envText = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = envText.match(/SUPABASE_PRODUCTION_URL=([^\r\n]+)/)?.[1];
const serviceKey = envText.match(/SUPABASE_PRODUCTION_SERVICE_ROLE_KEY=([^\r\n]+)/)?.[1];

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  // Update Ceren Yildirim
  const cerenEmail = "cerendeinert@hotmail.de";
  const cerenTelegramId = 8963408509;
  const cerenTelegramUsername = "cyildirim";

  console.log(`Attempting to update Ceren's profile for ${cerenEmail}...`);
  
  const { data: cerenData, error: cerenError } = await supabase
    .from('profiles')
    .update({
      telegram_user_id: cerenTelegramId,
      telegram_username: cerenTelegramUsername,
      updated_at: new Date().toISOString()
    })
    .eq('email', cerenEmail)
    .select();

  if (cerenError) {
    console.error("Error updating Ceren's profile:", cerenError.message);
  } else {
    console.log("SUCCESS! Ceren's profile updated successfully:");
    console.log(JSON.stringify(cerenData, null, 2));
  }

  // Update Juan Manuel Saavedra
  const juanmaEmail = "semeviene@hotmail.es";
  const juanmaTelegramId = 1450113787;
  const juanmaTelegramUsername = "jsaavedra";

  console.log(`\nAttempting to update Juanma's profile for ${juanmaEmail}...`);
  
  const { data: juanmaData, error: juanmaError } = await supabase
    .from('profiles')
    .update({
      telegram_user_id: juanmaTelegramId,
      telegram_username: juanmaTelegramUsername,
      updated_at: new Date().toISOString()
    })
    .eq('email', juanmaEmail)
    .select();

  if (juanmaError) {
    console.error("Error updating Juanma's profile:", juanmaError.message);
  } else {
    console.log("SUCCESS! Juanma's profile updated successfully:");
    console.log(JSON.stringify(juanmaData, null, 2));
  }
}

run();

