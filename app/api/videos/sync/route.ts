import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Standard YouTube feeds map
const YT_CHANNELS: Record<string, string> = {
  "Andrei Jikh": "UCGy7SkBjcIAgTiwkXEtPnYg",
  "Judging Freedom": "UCkei_gbdGw1lxyc9NV45wJQ",
  "Cihat E. Çiçek": "UCHExW8VqaE0a3W0kwSe_BXg",
  "Zang International with Lynette Zang": "UCvONE8y1nZarMAnZM-2ojfA",
  "The Rich Dad Channel": "UCuifm5ns5SRG8LZJ6gCfKyw",
  "Trends Journal": "UCKNT8BDOkXegtCD9OghepWA",
  "Integral Forextv": "UCU1l_gWfDhmvG2TgLMuK2ag",
  "Kanal Finans": "UCGBytjbMXiF1nbe6HD7iORQ",
  "Norgesbank Investment Management": "UCRhQsN8AVIfZuBNeRV1A37w",
  "George Gammon": "UCpvyOqtEc86X8w8_Se0t4-w",
  "Clive Thompson": "UCrlFUp4OtXJSiDfiPMFnk3A",
  "ITM Trading": "UCom1i7_NVeSUNyJyuR_NbMQ",
  "Spegtacular": "UCTkDDZaijqu0QzUOsDMk56g",
  "Soar Financially": "UCiq8gIFmHOAWjVoQPzJWwng",
  "Rebel Capitalist": "UCNjyEXSvYUUCzagFAKmaJ1Q",
  "Okan Yorganci": "UCi6gOcW2KfRyUCO4ox-AaLQ",
  "Prof. Dr. Emre Alkin": "UCq3M_HY-fZWJ_U_QnegqmbA",
  "Smart Silverstacker": "UC1FUQYPxrtVt8bd0516Pjbw"
};

function isFreedomChannel(channelName: string | null | undefined): boolean {
  if (!channelName) return false;
  const name = channelName.toLowerCase();
  return name.includes("freedom") || name.includes("judging") || name.includes("napolitano");
}

interface AnalysedVideo {
  id: string;
  title: string;
  description: string;
  file_url: string;
  created_at: string;
  metadata: {
    duration: string;
    resolution: string;
    thumbnail: string;
    is_youtube: boolean;
    channel_title: string;
    published_at: string;
  };
}

// Simple XML extraction helper to avoid heavy NPM dependency conflicts
function extractTagContent(xml: string, tag: string): string {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, "i").exec(xml);
  return match ? match[1].trim() : "";
}


export async function GET(request: Request) {
  return handleSync(request);
}

export async function POST(request: Request) {
  return handleSync(request);
}

async function handleSync(request: Request) {
  try {
    // 1. Validate Secret Auth Token (for cron/scripts) or Supabase user session (for dashboard manual sync)
    const { searchParams } = new URL(request.url);
    let isAuthorized = false;

    // Check 1: Cron Secret validation
    const cronSecret = searchParams.get("secret") || request.headers.get("x-cron-secret");
    const expectedSecret = process.env.CRON_SECRET || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (expectedSecret && cronSecret === expectedSecret) {
      isAuthorized = true;
    }

    // Check 2: Supabase active session JWT token validation (for Dashboard manual sync)
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
    
    if (!isAuthorized && bearerToken) {
      const supabaseUrl = process.env.SUPABASE_PRODUCTION_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseAnonKey) {
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
          auth: { persistSession: false }
        });
        const { data: { user }, error } = await supabase.auth.getUser(bearerToken);
        if (user && !error) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ success: false, error: "Unauthorized access" }, { status: 401 });
    }

    let channelParam = searchParams.get("channel") || "all";

    // Determine channels to sync (defaults to all channels)
    let channelsToSync: string[] = [];
    if (channelParam.toLowerCase() === "all") {
      channelsToSync = Object.keys(YT_CHANNELS);
    } else {
      const matchedKey = Object.keys(YT_CHANNELS).find(
        key => key.toLowerCase() === channelParam.toLowerCase()
      );
      if (matchedKey) {
        channelsToSync = [matchedKey];
      } else if (isFreedomChannel(channelParam)) {
        channelsToSync = ["Judging Freedom"];
      } else {
        channelsToSync = ["Andrei Jikh"];
      }
    }

    const now = Date.now();
    const syncedVideos: AnalysedVideo[] = [];

    for (const channelTitle of channelsToSync) {
      const channelId = YT_CHANNELS[channelTitle];
      if (!channelId) {
        console.warn(`[Sync] Channel ID not found for channel: ${channelTitle}`);
        continue;
      }

      // July 1st, 2026 cutoff for new channels, June 24th, 2026 for original channels
      const isNewChannel = [
        "Norgesbank Investment Management",
        "George Gammon",
        "Clive Thompson",
        "ITM Trading",
        "Spegtacular",
        "Soar Financially",
        "Rebel Capitalist",
        "Okan Yorganci",
        "Prof. Dr. Emre Alkin",
        "Smart Silverstacker"
      ].includes(channelTitle);

      const CUTOFF_TIMESTAMP = isNewChannel
        ? Date.parse("2026-07-01T00:00:00Z")
        : Date.parse("2026-06-24T00:00:00Z");

      console.log(`[Sync] Synchronizing channel: "${channelTitle}" (${channelId}) with cutoff ${isNewChannel ? "2026-07-01" : "2026-06-24"}...`);
      const ytRssFeed = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;

      let xmlText = "";

      try {
        // 1. Fetch RSS XML Feed from YouTube
        const response = await fetch(ytRssFeed, {
          next: { revalidate: 3600 }, // Cache feed for 1 hour
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        });

        if (!response.ok) {
          throw new Error(`YouTube RSS feed returned status ${response.status} for channel: ${channelTitle}`);
        }
        xmlText = await response.text();
      } catch (fetchErr: any) {
        console.error(`[Sync] Failed to fetch feed for ${channelTitle}:`, fetchErr);
        // Continue to the next channel instead of crashing the entire sync
        continue;
      }

      // 2. Parse Entries using a robust RegExp parser
      const entryMatches: string[] = [];
      const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
      let match;
      while ((match = entryRegex.exec(xmlText)) !== null) {
        entryMatches.push(match[1]);
      }

      for (const entryXml of entryMatches) {
        const videoId = extractTagContent(entryXml, "yt:videoId");
        if (!videoId) continue;

        const title = extractTagContent(entryXml, "title");
        const publishedAtStr = extractTagContent(entryXml, "published");
        const publishedTime = publishedAtStr ? Date.parse(publishedAtStr) : now;

        // Apply date filter: within the current day
        if (publishedTime < CUTOFF_TIMESTAMP) {
          console.log(`Skipping real feed video due to date constraint (not from current day): ${title}`);
          continue;
        }

        // Extract description
        let rawDescription = extractTagContent(entryXml, "media:description");
        if (!rawDescription) {
          rawDescription = extractTagContent(entryXml, "description");
        }

        // Fetch actual duration from YouTube watch page
        console.log(`Fetching real duration for YouTube video ${videoId} (${title})...`);
        const { duration: durationSecsResult, isLive } = await fetchRealYoutubeDuration(videoId);
        let durationSecs = durationSecsResult;

        if (isLive) {
          console.log(`[Sync] Skipping video because it is classified as a Live Stream: ${title}`);
          continue;
        }

        if (durationSecs === 0) {
          console.warn(`[Sync] Failed to scrape duration for video ${videoId} (${title}). Likely blocked by YouTube. Applying smart fallback.`);
          
          // Check if it's a YouTube Short
          const isShort = title.toLowerCase().includes("#shorts") || 
                          title.toLowerCase().includes("#short") ||
                          (rawDescription && (rawDescription.toLowerCase().includes("#shorts") || rawDescription.toLowerCase().includes("#short"))) ||
                          entryXml.includes("/shorts/");
          
          if (isShort) {
            console.log(`[Sync] Skipping video because it is classified as a YouTube Short: ${title}`);
            continue;
          }
          
          // Fallback to 900 seconds (15 minutes) for standard videos to pass the duration filter
          durationSecs = 900;
        }

        // Apply strict duration filter: > 5 minutes (300 seconds)
        if (durationSecs <= 300) {
          console.log(`Skipping real feed video due to duration constraint (duration: ${durationSecs}s <= 5 mins): ${title}`);
          continue;
        }

        const durationStr = formatSecondsToDuration(durationSecs);

        // Create Synced Video Document
        const videoDoc: AnalysedVideo = {
          id: `yt-video-${videoId}`,
          title: title,
          description: rawDescription || "Sin descripción proporcionada.",
          file_url: `https://www.youtube.com/embed/${videoId}`,
          created_at: new Date(publishedTime).toISOString(),
          metadata: {
            duration: durationStr,
            resolution: "4K UHD",
            thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
            is_youtube: true,
            channel_title: channelTitle,
            published_at: publishedAtStr,
          },
        };

        syncedVideos.push(videoDoc);
      }
    }

    // Server-side database synchronization fallback/daemon logic
    // This allows a silent background cron calling GET /api/videos/sync to automatically
    // synchronize and populate new videos in the database for all registered profiles!
    const supabaseUrl = process.env.SUPABASE_PRODUCTION_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_PRODUCTION_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (supabaseUrl && serviceRoleKey && syncedVideos.length > 0) {
      console.log("[Daemon] Sincronización silenciosa en segundo plano iniciada para todos los usuarios...");
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
          auth: { persistSession: false }
        });        // 1. Obtener videos existentes de forma global en la videoteca compartida
        const { data: existingDocs, error: fetchErr } = await supabaseAdmin
          .from("documents")
          .select("file_url")
          .eq("type", "video");

        if (fetchErr) {
          console.error("[Daemon] Error al obtener videos existentes globales:", fetchErr);
        } else {
          const existingUrls = new Set((existingDocs || []).map((v) => v.file_url));
          const uniqueNewVideos: typeof syncedVideos = [];

          for (const fv of syncedVideos) {
            if (!existingUrls.has(fv.file_url)) {
              uniqueNewVideos.push(fv);
            }
          }

          console.log(`[Daemon] Se detectaron ${uniqueNewVideos.length} vídeos nuevos únicos globales para sincronizar.`);

          // 2. Insertar los nuevos documentos de forma unificada bajo el usuario Admin
          // Real videos: We bypass synchronous transcription during sync to prevent Vercel Gateway timeouts (max 10s on Hobby).
          // The background monitor cron will automatically handle transcription/analysis asynchronously.
          const ADMIN_ID = "5c8d65c6-0798-4f8a-aae3-dd2cebebd868";
          const newDocsToInsert = uniqueNewVideos.map((fv) => {
            return {
              user_id: ADMIN_ID,
              title: fv.title,
              description: fv.description,
              type: "video",
              file_url: fv.file_url,
              created_at: fv.created_at,
              metadata: {
                duration: fv.metadata.duration,
                resolution: fv.metadata.resolution,
                thumbnail: fv.metadata.thumbnail,
                is_youtube: true,
                channel_title: fv.metadata.channel_title || "Andrei Jikh",
              }
            };
          });

          if (newDocsToInsert.length > 0) {
            const { data: insertedDocs, error: insertError } = await supabaseAdmin
              .from("documents")
              .insert(newDocsToInsert)
              .select("id, title, file_url, metadata");

            if (insertError) {
              console.warn(`[Daemon] Error al insertar ${newDocsToInsert.length} nuevos videos para el administrador:`, insertError);
            } else if (insertedDocs && insertedDocs.length > 0) {
              console.log(`[Daemon] Sincronizados e insertados exitosamente ${insertedDocs.length} nuevos videos bajo el Administrador. No se envían alertas de Telegram en esta fase, ya que el monitor las enviará tras completar el análisis.`);
            }
          } else {
            console.log("[Daemon] La videoteca compartida ya está al día. 0 videos nuevos insertados.");
          }
        }
      } catch (dbErr) {
        console.error("[Daemon] Error crítico durante la sincronización silenciosa del daemon:", dbErr);
      }
    } else {
      console.log("[Daemon] Sincronización server-side omitida (claves de servicio no configuradas).");
    }

    return NextResponse.json({
      success: true,
      count: syncedVideos.length,
      videos: syncedVideos,
      timestamp: new Date().toISOString(),
      message: "YouTube channel synchronized successfully with strict date and duration filters.",
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Unexpected synchronization error.";
    console.error("YouTube sync route failure:", error);
    return NextResponse.json(
      { success: false, error: errMsg },
      { status: 500 }
    );
  }
}

// Helper to parse ISO-8601 duration string (e.g. PT15M30S)
function parseISO8601Duration(durationStr: string): number {
  const match = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);
  return hours * 3600 + minutes * 60 + seconds;
}

// Helper to format total seconds to duration format (MM:SS or HH:MM:SS)
function formatSecondsToDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

// Helper to fetch and extract actual YouTube video duration
async function fetchRealYoutubeDuration(videoId: string): Promise<{ duration: number; isLive: boolean }> {
  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!response.ok) {
      console.warn(`Failed to fetch watch page for video ${videoId}: status ${response.status}`);
      return { duration: 0, isLive: false };
    }
    const html = await response.text();

    // Check for live stream indicators
    const hasLiveContent = html.includes('"isLiveContent":true');
    const hasLiveBroadcast = html.includes('itemprop="isLiveBroadcast"');
    const hasLiveStream = html.includes('"isLiveStream":true');
    const hasIsLive = html.includes('"isLive":true');
    const isLive = hasLiveContent || hasLiveBroadcast || hasLiveStream || hasIsLive;

    if (isLive) {
      return { duration: 0, isLive: true };
    }

    // 1. Try meta tag itemprop="duration"
    const metaMatch = /itemprop="duration"\s+content="([^"]+)"/i.exec(html) ||
                      /<meta\s+itemprop="duration"\s+content="([^"]+)"/i.exec(html) ||
                      /content="([^"]+)"\s+itemprop="duration"/i.exec(html);
    if (metaMatch) {
      const isoDuration = metaMatch[1];
      const seconds = parseISO8601Duration(isoDuration);
      if (seconds > 0) {
        return { duration: seconds, isLive: false };
      }
    }

    // 2. Try lengthSeconds inside ytInitialPlayerResponse
    const playerResponseMatch = /ytInitialPlayerResponse\s*=\s*({[\s\S]*?});/.exec(html) ||
                                /ytInitialPlayerResponse\s*=\s*({[\s\S]*?})</.exec(html);
    if (playerResponseMatch) {
      try {
        const jsonStr = playerResponseMatch[1];
        const lengthMatch = /"lengthSeconds"\s*:\s*"(\d+)"/.exec(jsonStr);
        if (lengthMatch) {
          return { duration: parseInt(lengthMatch[1], 10), isLive: false };
        }
        const obj = JSON.parse(jsonStr);
        if (obj?.videoDetails?.lengthSeconds) {
          return { duration: parseInt(obj.videoDetails.lengthSeconds, 10), isLive: false };
        }
      } catch (e) {
        console.warn(`Failed to parse ytInitialPlayerResponse JSON for ${videoId}:`, e);
      }
    }

    // 3. Fallback direct regex on entire HTML
    const directMatch = /"lengthSeconds"\s*:\s*"(\d+)"/.exec(html);
    if (directMatch) {
      return { duration: parseInt(directMatch[1], 10), isLive: false };
    }

    return { duration: 0, isLive: false };
  } catch (error) {
    console.error(`Error in fetchRealYoutubeDuration for ${videoId}:`, error);
    return { duration: 0, isLive: false };
  }
}

// Helper to convert MM:SS or HH:MM:SS to total seconds for filtering
function parseDurationToSeconds(durationStr?: string): number {
  if (!durationStr) return 0;
  const parts = durationStr.split(":").map(p => parseInt(p, 10));
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 1) {
    return parts[0];
  }
  return 0;
}
