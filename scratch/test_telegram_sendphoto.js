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

const botToken = env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const chatId = env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID;

console.log('Bot Token found:', botToken ? 'YES (starts with ' + botToken.slice(0, 6) + ')' : 'NO');
console.log('Chat ID found:', chatId ? 'YES (' + chatId + ')' : 'NO');

if (!botToken || !chatId) {
  console.error('Error: Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
  process.exit(1);
}

const photoUrl = 'https://hivex-backend.vercel.app/snapshots/lMFTJGMmbU8/103.jpg';

async function runTests() {
  console.log('\n--- Test 1: Sending photo WITHOUT caption ---');
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        photo: photoUrl,
      }),
    });
    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Response payload:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Test 1 failed with connection error:', err);
  }

  console.log('\n--- Test 2: Sending photo WITH simple HTML caption ---');
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        photo: photoUrl,
        caption: '<b>Test Caption</b>\nThis is a test image from HIVEX.',
        parse_mode: 'HTML',
      }),
    });
    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Response payload:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Test 2 failed with connection error:', err);
  }
}

runTests();
