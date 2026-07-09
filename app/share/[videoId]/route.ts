import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function extractYoutubeId(fileUrl: string): string | null {
  if (!fileUrl) return null;
  const regexes = [
    /youtube\.com\/embed\/([a-zA-Z0-9_\-]{11})/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_\-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_\-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_\-]{11})/
  ];

  for (const regex of regexes) {
    const match = fileUrl.match(regex);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params;
    const { searchParams } = new URL(request.url);

    const start = searchParams.get("start") || searchParams.get("t") || "0";
    const end = searchParams.get("end") || "";
    const isEmbed = searchParams.get("embed") === "true";

    if (!videoId) {
      return new NextResponse("Missing videoId parameter", { status: 400 });
    }

    // 1. Initialize Supabase Client
    const supabaseUrl =
      process.env.SUPABASE_PRODUCTION_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      "https://lhtlrztsmkllcqiziftn.supabase.co";

    const supabaseKey =
      process.env.SUPABASE_PRODUCTION_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "";

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    // 2. Fetch video details from the database
    let videoTitle = "Análisis de Vídeo en HIVEX";
    let fileUrl = "";
    let youtubeId = "";
    let finalVideoUuid = videoId;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(videoId);

    if (isUuid) {
      const { data, error } = await supabase
        .from("documents")
        .select("id, title, file_url")
        .eq("id", videoId)
        .eq("type", "video")
        .single();

      if (!error && data) {
        videoTitle = data.title;
        fileUrl = data.file_url || "";
        const ytId = extractYoutubeId(fileUrl);
        if (ytId) {
          youtubeId = ytId;
        }
      }
    } else {
      // If it's a YouTube ID, look up the document by file_url to find the UUID
      const { data, error } = await supabase
        .from("documents")
        .select("id, title, file_url")
        .eq("type", "video")
        .ilike("file_url", `%${videoId}%`)
        .limit(1);

      if (!error && data && data.length > 0) {
        videoTitle = data[0].title;
        fileUrl = data[0].file_url || "";
        finalVideoUuid = data[0].id;
        youtubeId = videoId;
      } else {
        youtubeId = videoId;
      }
    }

    // Fallback if we couldn't resolve a title or youtubeId
    if (!youtubeId && fileUrl) {
      const ytId = extractYoutubeId(fileUrl);
      if (ytId) youtubeId = ytId;
    }
    if (!youtubeId) {
      youtubeId = videoId; // fallback to videoId if it looks like a YouTube ID
    }

    // 3. Define absolute URLs for sharing and redirecting
    const host = request.headers.get("host") || "hivex-backend.vercel.app";
    const protocol = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";
    const absoluteOrigin = `${protocol}://${host}`;

    // 3.1 Serve full HTML5 video player page when loaded in Telegram's inline webview iframe (embed=true)
    if (isEmbed) {
      const videoClipUrl = `https://lhtlrztsmkllcqiziftn.supabase.co/storage/v1/object/public/documents/clips/${youtubeId || finalVideoUuid || videoId}/${start}.mp4`;
      
      const embedHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Reproductor HIVEX</title>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background-color: #000000;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    video {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
  </style>
</head>
<body>
  <video src="${videoClipUrl}" autoplay controls playsinline loop></video>
</body>
</html>`;

      return new NextResponse(embedHtml, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    const userAgent = request.headers.get("user-agent") || "";
    const isBot = /telegrambot|twitterbot|facebookexternalhit|slackbot|discordbot|googlebot|bingbot|baiduspider/i.test(userAgent);

    const redirectUrl = `${absoluteOrigin}/dashboard/videos?id=${finalVideoUuid}&start=${start}${end ? `&end=${end}` : ""}&from=telegram`;
    const shareUrl = `${absoluteOrigin}/share/${videoId}?start=${start}${end ? `&end=${end}` : ""}`;
    const coverImageUrl = `${absoluteOrigin}/snapshots/${finalVideoUuid}/${start}.jpg`;

    // 4. Point the embedded video players (og:video and twitter:player) to our custom responsive iframe player URL
    // Pointing to a text/html iframe URL guarantees Telegram UI will show a Play button on the cover image!
    const activeVideoUrl = `${absoluteOrigin}/share/${videoId}?start=${start}${end ? `&end=${end}` : ""}&embed=true`;
    const ogVideoType = "text/html";

    // 5. Only inject redirection headers for real human browsers to prevent crawlers from following the redirect
    // and losing the Open Graph metadata cards.
    const redirectTags = !isBot ? `
  <!-- Meta Refresh and Script for Instant Redirection to Native Video Player for Humans -->
  <meta http-equiv="refresh" content="0;url=${redirectUrl}" />
  <script>
    window.location.href = ${JSON.stringify(redirectUrl)};
  </script>
` : "";

    // 6. Generate and return the HTML template containing the Open Graph & Twitter Cards headers for crawlers,
    // and the Meta Refresh + JS Redirects for real users.
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${videoTitle}</title>
  
  <!-- Open Graph Meta Tags -->
  <meta property="og:title" content="${videoTitle}" />
  <meta property="og:description" content="Gráfico clave analizado en la Cabina de Estudio interactiva de HIVEX." />
  <meta property="og:type" content="video.other" />
  <meta property="og:url" content="${shareUrl}" />
  
  <!-- Telegram & Facebook Embedded Video Player -->
  <meta property="og:video" content="${activeVideoUrl}" />
  <meta property="og:video:secure_url" content="${activeVideoUrl}" />
  <meta property="og:video:type" content="${ogVideoType}" />
  <meta property="og:video:width" content="1280" />
  <meta property="og:video:height" content="720" />
  
  <!-- Video Player Thumbnail Cover Cover -->
  <meta property="og:image" content="${coverImageUrl}" />
  <meta property="og:image:secure_url" content="${coverImageUrl}" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:image:width" content="1280" />
  <meta property="og:image:height" content="720" />

  <!-- Twitter Player Card Metadata -->
  <meta name="twitter:card" content="player" />
  <meta name="twitter:title" content="${videoTitle}" />
  <meta name="twitter:description" content="Gráfico clave analizado en la Cabina de Estudio interactiva de HIVEX." />
  <meta name="twitter:player" content="${activeVideoUrl}" />
  <meta name="twitter:player:width" content="1280" />
  <meta name="twitter:player:height" content="720" />
  <meta name="twitter:image" content="${coverImageUrl}" />
  ${redirectTags}
</head>
<body style="background-color: #0b0f19; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
  <div style="text-align: center; padding: 24px; max-width: 480px; border-radius: 12px; background: rgba(17, 24, 39, 0.7); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);">
    <div style="font-size: 48px; margin-bottom: 16px;">🎬</div>
    <h1 style="color: #3b82f6; font-size: 24px; font-weight: 700; margin: 0 0 12px 0;">Reproductor de Escena</h1>
    <p style="color: #9ca3af; font-size: 15px; margin: 0 0 24px 0; line-height: 1.5;">Abriendo la escena acotada directamente en el reproductor integrado...</p>
    <a href="${redirectUrl}" style="display: inline-block; background-color: #3b82f6; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 15px; font-weight: 600; transition: background-color 0.2s;">
      Abrir Reproductor
    </a>
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=60, s-maxage=60",
      },
    });
  } catch (error: any) {
    console.error("[Share Route] Critical failure:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
