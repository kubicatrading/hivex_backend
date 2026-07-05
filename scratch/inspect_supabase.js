async function inspectSupabase() {
  const url = 'https://lhtlrztsmkllcqiziftn.supabase.co/storage/v1/object/public/snapshots/48134892-d0cd-4fc5-9def-7f5f25d2d451/103.jpg';
  console.log('Fetching Supabase directly:', url);
  try {
    const res = await fetch(url);
    console.log('Status:', res.status, res.statusText);
    console.log('Headers:');
    res.headers.forEach((val, name) => {
      console.log(`  ${name}: ${val}`);
    });

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('json') || contentType.includes('text') || res.status !== 200) {
      const text = await res.text();
      console.log('Response body:', text);
    } else {
      console.log('Response is binary (size:', (await res.arrayBuffer()).byteLength, 'bytes)');
    }
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

inspectSupabase();
