import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.SUPADATA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ success: false, error: "SUPADATA_API_KEY is not defined in process.env" });
  }
  
  try {
    const videoId = "siazPdsZHuI"; // China Is About To Pop The AI Bubble
    const url = `https://api.supadata.ai/v1/youtube/transcript?videoId=${videoId}&mode=auto`;
    const res = await fetch(url, {
      headers: {
        "x-api-key": apiKey
      }
    });
    const status = res.status;
    let data = null;
    try {
      data = await res.json();
    } catch (e) {}
    
    return NextResponse.json({
      success: res.ok,
      status,
      apiKeyLength: apiKey.length,
      apiKeyPrefix: apiKey.slice(0, 5) + "...",
      data
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}
