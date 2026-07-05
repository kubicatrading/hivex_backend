import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ videoId: string; seconds: string }> }
) {
  const { videoId, seconds } = await params;

  if (!videoId || !seconds) {
    return new NextResponse("Missing parameters", { status: 400 });
  }

  // Clean up seconds parameter:
  // If it's a number like "83", make it "83.jpg"
  // If it's "83.jpg", keep it as "83.jpg"
  let fileKey = seconds;
  if (!fileKey.endsWith(".jpg") && !fileKey.includes(".")) {
    fileKey = `${fileKey}.jpg`;
  }

  // Retrieve Supabase URL from environment variables
  const supabaseUrl =
    process.env.SUPABASE_PRODUCTION_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://lhtlrztsmkllcqiziftn.supabase.co";

  // Construct public Supabase Storage URL
  // The path inside the public "snapshots" bucket is [videoId]/[seconds.jpg]
  const redirectUrl = `${supabaseUrl}/storage/v1/object/public/snapshots/${videoId}/${fileKey}`;

  // Execute a 302 Temporary Redirect to point client/Telegram bot directly to Supabase Storage
  return NextResponse.redirect(redirectUrl, 302);
}
