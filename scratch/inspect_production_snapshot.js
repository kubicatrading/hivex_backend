async function inspectUrl() {
  const url = 'https://hivex-backend.vercel.app/snapshots/lMFTJGMmbU8/103.jpg';
  console.log('Fetching:', url);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    console.log('Status:', res.status, res.statusText);
    console.log('Headers:');
    res.headers.forEach((val, name) => {
      console.log(`  ${name}: ${val}`);
    });

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text') || contentType.includes('json')) {
      const text = await res.text();
      console.log('Response body snippet:', text.slice(0, 500));
    } else {
      console.log('Response is binary (size:', (await res.arrayBuffer()).byteLength, 'bytes)');
    }
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

inspectUrl();
