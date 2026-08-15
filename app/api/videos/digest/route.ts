import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTelegramMessage, markdownToTelegramHtml, splitMarkdown, getTelegramLanguage, getYoutubeId } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Extend Vercel execution duration to 300s (Pro plan limit) to prevent timeouts during daily synthesis

export async function GET(request: NextRequest) {
  return handleDigest(request);
}

export async function POST(request: NextRequest) {
  return handleDigest(request);
}

async function handleDigest(request: NextRequest) {
  try {
    // Validate Secret Auth Token to prevent unauthorized invocation
    const { searchParams } = new URL(request.url);
    const authHeader = request.headers.get("authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

    const cronSecret = searchParams.get("secret") || 
                       request.headers.get("x-cron-secret") || 
                       bearerToken;

    const expectedSecret = process.env.CRON_SECRET || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (expectedSecret && cronSecret !== expectedSecret) {
      return NextResponse.json({ success: false, error: "Unauthorized access" }, { status: 401 });
    }

    // 1. Parse query parameters
    let hours = 24;
    let dryRun = false;
    let customChatId = "";
    let lang = "en";

    try {
      const hoursParam = searchParams.get("hours");
      if (hoursParam) {
        const parsedHours = parseInt(hoursParam, 10);
        if (!isNaN(parsedHours) && parsedHours > 0) {
          hours = parsedHours;
        }
      }
      dryRun = searchParams.get("dryRun") === "true";
      customChatId = searchParams.get("chatId") || "";
      
      const langParam = searchParams.get("lang");
      if (langParam === "es" || langParam === "en") {
        lang = langParam;
      } else {
        lang = await getTelegramLanguage();
      }
    } catch (urlErr) {
      console.warn("[Digest Route] Failed to parse query params from request, using defaults:", urlErr);
    }

    console.log(`[Digest Route] Starting digest generation for the last ${hours} hours in language '${lang}'. (dryRun: ${dryRun})`);

    // 2. Initialize Supabase Admin Client
    const supabaseUrl =
      process.env.SUPABASE_PRODUCTION_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey =
      process.env.SUPABASE_PRODUCTION_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase configuration keys (SUPABASE_PRODUCTION_URL/NEXT_PUBLIC_SUPABASE_URL or SERVICE_ROLE_KEY).");
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // 3. Query videos from the last X hours
    const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    console.log(`[Digest Route] Querying video documents created on or after: ${cutoffDate}`);

    const { data: videos, error: videosError } = await supabaseAdmin
      .from("documents")
      .select("*")
      .eq("type", "video")
      .gte("created_at", cutoffDate)
      .order("created_at", { ascending: false });

    if (videosError) {
      console.error("[Digest Route] Error querying videos:", videosError);
      throw new Error(`Database query failed: ${videosError.message}`);
    }

    if (!videos || videos.length === 0) {
      console.log(`[Digest Route] No videos found in the last ${hours} hours.`);
      
      const isSpanish = lang === "es";
      const emptyStateMessage = isSpanish
        ? `🚨 <b>HIVEX Alerts - 24H</b>\n\nNo se han detectado nuevos análisis de vídeo en las últimas ${hours} horas.\nLa cabina de estudio se mantiene al día.`
        : `🚨 <b>HIVEX Alerts - 24H</b>\n\nNo new video analyses have been detected in the last ${hours} hours.\nThe study cabin remains up to date.`;
      
      if (!dryRun) {
        await sendTelegramMessage(emptyStateMessage, customChatId || undefined);
      }

      return NextResponse.json({
        success: true,
        count: 0,
        message: `No videos analyzed in the last ${hours} hours. Empty state notification dispatched.`,
        markdown: isSpanish
          ? `🚨 HIVEX Alerts - 24H\n\nNo se han detectado nuevos análisis de vídeo en las últimas ${hours} horas.\nLa cabina de estudio se mantiene al día.`
          : `🚨 HIVEX Alerts - 24H\n\nNo new video analyses have been detected in the last ${hours} hours.\nThe study cabin remains up to date.`,
      });
    }

    console.log(`[Digest Route] Found ${videos.length} videos. Fetching associated analyses, summaries, and charts...`);

    // 4. Batch query associated documents (knowledge_analysis, knowledge_summary, knowledge_charts)
    const fileUrls = videos.map((v) => v.file_url).filter(Boolean);
    let analyses: any[] = [];
    let summaries: any[] = [];
    let charts: any[] = [];

    if (fileUrls.length > 0) {
      const [analysesRes, summariesRes, chartsRes] = await Promise.all([
        supabaseAdmin
          .from("documents")
          .select("*")
          .eq("type", "knowledge_analysis")
          .in("file_url", fileUrls),
        supabaseAdmin
          .from("documents")
          .select("*")
          .eq("type", "knowledge_summary")
          .in("file_url", fileUrls),
        supabaseAdmin
          .from("documents")
          .select("*")
          .eq("type", "knowledge_charts")
          .in("file_url", fileUrls),
      ]);

      if (analysesRes.error) {
        console.warn("[Digest Route] Warning: Failed to query associated analyses:", analysesRes.error);
      } else {
        analyses = analysesRes.data || [];
      }

      if (summariesRes.error) {
        console.warn("[Digest Route] Warning: Failed to query associated summaries:", summariesRes.error);
      } else {
        summaries = summariesRes.data || [];
      }

      if (chartsRes.error) {
        console.warn("[Digest Route] Warning: Failed to query associated charts:", chartsRes.error);
      } else {
        charts = chartsRes.data || [];
      }
    }

    // 5. Structure contexts for each video
    const videoContexts = videos.map((video, idx) => {
      const analysisDoc = analyses.find((a) => a.file_url === video.file_url);
      const summaryDoc = summaries.find((s) => s.file_url === video.file_url);
      const chartsDoc = charts.find((c) => c.file_url === video.file_url);

      let contentToUse = analysisDoc?.metadata?.informe_completo || analysisDoc?.metadata?.report || "";
      let contentType = "Análisis de Inversión Completo";

      if (!contentToUse.trim()) {
        contentToUse = summaryDoc?.metadata?.resumen_markdown || summaryDoc?.metadata?.summary || "";
        contentType = "Resumen de Contenido";
      }

      if (!contentToUse.trim()) {
        contentToUse = video.metadata?.transcription || video.description || "";
        contentType = "Transcripción o Descripción";
      }

      // Truncate to avoid payload limits
      const maxLen = 4000;
      const slicedContent =
        contentToUse.length > maxLen
          ? contentToUse.slice(0, maxLen) + "\n...[Contenido Truncado por Límite de Tamaño]..."
          : contentToUse;

      // Access charts list
      const chartsData = chartsDoc?.metadata?.graficos_markdown || chartsDoc?.metadata?.charts || "";

      return {
        id: video.id,
        title: video.title,
        fileUrl: video.file_url,
        channel: video.metadata?.channel_title || "Canal Desconocido",
        publishedAt: video.metadata?.published_at || video.created_at,
        content: slicedContent,
        charts: chartsData,
        contentType,
      };
    });

    // 6. Generate synthesized report via Gemini (with robust deterministic fallback)
    let reportMarkdown = "";
    try {
      console.log("[Digest Route] Synthesizing premium report using Gemini...");
      reportMarkdown = await generateSynthesizedDigest(videoContexts, lang);
      console.log("[Digest Route] Synthesis completed successfully via Gemini.");
    } catch (geminiErr: any) {
      console.warn(
        `[Digest Route] Gemini API synthesis failed (falling back to deterministic synthesis):`,
        geminiErr?.message || geminiErr
      );
      reportMarkdown = generateDeterministicDigest(videoContexts, lang);
      console.log("[Digest Route] Deterministic fallback synthesis completed successfully.");
    }

    // 7. Deliver to Telegram (unless dryRun)
    if (!dryRun) {
      console.log("[Digest Route] Converting report to Telegram HTML and sending...");
      
      const isSpanish = lang === "es";
      const delimiter = isSpanish ? "🚨 ALERTA " : "🚨 ALERT ";
      
      // Split the generated markdown into separate alert segments using positive lookahead
      const parts = reportMarkdown.split(new RegExp(`(?=${delimiter}\\d+)`, "g"));
      
      if (parts.length > 1) {
        // parts[0] contains the header (e.g., "🚨 HIVEX Alerts - 24H\n\n")
        const header = parts[0].trim() ? parts[0].trim() + "\n\n" : "";
        const firstAlertMarkdown = header + parts[1].trim();
        const firstAlertHtml = markdownToTelegramHtml(firstAlertMarkdown);
        
        console.log(`[Digest Route] Dispatching Alert 1 to Telegram...`);
        await sendTelegramMessage(firstAlertHtml, customChatId || undefined);
        
        // Dispatch subsequent alerts chronologically with a slight delay to preserve Telegram ordering
        for (let i = 2; i < parts.length; i++) {
          const alertMarkdown = parts[i].trim();
          if (alertMarkdown) {
            const alertHtml = markdownToTelegramHtml(alertMarkdown);
            await new Promise((resolve) => setTimeout(resolve, 800));
            console.log(`[Digest Route] Dispatching Alert ${i} to Telegram...`);
            await sendTelegramMessage(alertHtml, customChatId || undefined);
          }
        }
      } else {
        // Fallback to sending as a single message (or chunks if too long) if splitting fails
        const telegramHtml = markdownToTelegramHtml(reportMarkdown);
        if (telegramHtml.length > 3500) {
          const chunks = splitMarkdown(reportMarkdown, 3000);
          for (let i = 0; i < chunks.length; i++) {
            const chunkHtml = markdownToTelegramHtml(chunks[i]);
            await sendTelegramMessage(chunkHtml, customChatId || undefined);
          }
        } else {
          await sendTelegramMessage(telegramHtml, customChatId || undefined);
        }
      }
      console.log("[Digest Route] Digest delivered successfully to Telegram.");
    } else {
      console.log("[Digest Route] Dry-run enabled. Skipping Telegram delivery.");
    }

    return NextResponse.json({
      success: true,
      count: videos.length,
      message: dryRun
        ? "Digest generated successfully (Dry Run - No Telegram dispatch)."
        : "Digest generated and delivered to Telegram successfully.",
      markdown: reportMarkdown,
      videos: videos.map((v) => ({ id: v.id, title: v.title, created_at: v.created_at })),
    });
  } catch (error: any) {
    console.error("[Digest Route] Critical failure:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Unexpected failure in digest route." },
      { status: 500 }
    );
  }
}

async function generateSynthesizedDigest(videoContexts: any[], lang: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable. Unable to proceed with AI synthesis.");
  }
  const isSpanish = lang === "es";

   const systemInstruction = isSpanish
    ? `You are an elite financial news editor and investment analyst. Your task is to synthesize a daily premium investment news digest in Spanish based on analyzed video materials, replicating a clean, high-impact, narrative-driven format. Always output standard Markdown without HTML tags.`
    : `You are an elite financial news editor and investment analyst. Your task is to synthesize a daily premium investment news digest in English based on analyzed video materials, replicating a clean, high-impact, narrative-driven format. Always output standard Markdown without HTML tags.`;

  const promptText = isSpanish
    ? `Eres un editor de noticias financieras de élite. Tu tarea es generar un informe unificado en español titulado "🚨 HIVEX Alerts - 24H" que sintetice las ideas clave de los vídeos analizados recientemente en HIVEX de forma extremadamente premium, limpia y asertiva.

Sigue ESTRICTAMENTE las siguientes reglas de formato y diseño:
1. El título principal del boletín debe ser exactamente:
🚨 HIVEX Alerts - 24H
---

2. Cada vídeo analizado debe presentarse con la estructura de ALERTA premium descrita a continuación. Asegúrate de dejar una línea en blanco completa (doble salto de línea) entre cada apartado para una legibilidad óptima en móviles:

🚨 ALERTA [Número]: [Título de Impacto]

[Párrafo narrativo integrado de 3 a 5 líneas. Debe ser un flujo editorial fluido, asertivo y de muy alto nivel, resumiendo de forma contundente la tesis central, la urgencia de la situación y la idea macroeconómica del ponente, sin usar subtítulos rígidos.]

▫️ [Punto clave 1: un dato numérico preciso, porcentaje, precio, o un nivel de soporte o resistencia relevante.]
▫️ [Punto clave 2: una implicación táctica directa para el inversor, flujo de liquidez o riesgo sistémico.]

🎬 **REPRODUCTOR INTEGRADO (CABINA DE ESTUDIO)**
🔗 [Abrir Escena del Gráfico en la Cabina de HIVEX](https://hivex-backend.vercel.app/share/{videoId}?start={startSeconds}&end={endSeconds})
🔗 [Vídeo Completo: {videoTitle}](https://hivex-backend.vercel.app/share/{videoId})

REGLAS CRÍTICAS DE MAQUETACIÓN Y SINTAXIS (CUMPLIMIENTO OBLIGATORIO):
- En la primera alerta, el título "🚨 HIVEX Alerts - 24H" debe ir seguido inmediatamente por la línea de separación "---", y un espacio en blanco antes de "🚨 ALERTA 1:".
- Deja una línea en blanco completa (doble salto de línea) entre cada una de las secciones de la alerta para mantener el diseño premium y aireado.
- PROHIBICIÓN ABSOLUTA DE ENLACES A YOUTUBE: Está terminantemente prohibido incluir enlaces a "youtube.com" o "youtu.be" en el cuerpo de texto del mensaje. El único hipervínculo que debe aparecer para el vídeo es el enlace público "/share/" de HIVEX.
- PROHIBICIÓN DE OTROS SÍMBOLOS O VIÑETAS EN ENLACES: Las líneas de "🎬 **REPRODUCTOR INTEGRADO (CABINA DE ESTUDIO)**" y "🔗" NO deben comenzar con viñetas de asteriscos, guiones ni puntos de lista. Deben ser líneas de texto independientes y limpias.
- PROHIBICIÓN DE COMILLAS INVERTIDAS: No utilices comillas invertidas (\`) ni bloques de código para envolver los títulos o las URLs.
- REGLA PARA VÍDEOS SIN GRÁFICOS: Si en el campo "charts" de un vídeo no se detectó ningún gráfico (o el campo está vacío o indica que no hay gráficos), NO agregues la cabecera "🎬 **REPRODUCTOR INTEGRADO (CABINA DE ESTUDIO)**" ni la línea "🔗 [Abrir Escena del Gráfico...]" para ese vídeo. En ese caso, incluye únicamente la línea "🔗 [Vídeo Completo: {videoTitle}](...)".
- REGLA PARA CALCULAR {startSeconds} Y {endSeconds} (solo aplicable si el vídeo tiene gráficos):
  1. Busca cualquier marca de tiempo de gráfico en el campo "charts" (ej. "04:15") y conviértela a segundos enteros (4 * 60 + 15 = 255).
  2. Suma siempre 60 segundos para obtener {endSeconds} (ej. si start es 255, end es 315).
- Para "🔗 [Abrir Escena del Gráfico en la Cabina de HIVEX](...)": Genera un link markdown directo apuntando a la ruta de compartir de HIVEX inyectando el {videoId} real (su UUID en HIVEX) y los parámetros de tiempo de inicio ({startSeconds}) y fin ({endSeconds}) calculados en la URL de "/share/".
- Para "🔗 [Vídeo Completo: {videoTitle}](...)": Añade obligatoriamente este segundo enlace apuntando al vídeo completo sin parámetros de tiempo utilizando el título real del vídeo (propiedad "title" del objeto de datos) como el texto del enlace {videoTitle} y "/share/{videoId}" como URL.

3. PROHIBICIÓN DE NOTAS, COMENTARIOS DE IA O TABLAS: No escribas borradores, explicaciones ni notas. Comienza directamente con "🚨 HIVEX Alerts - 24H" and continúa inmediatamente con la línea de separación "---".
4. Genera únicamente Markdown estándar. No utilices etiquetas HTML en absoluto.
5. Redacta todo el informe en español.

Aquí tienes los datos de los vídeos recién analizados para sintetizar:
${JSON.stringify(videoContexts, null, 2)}
`
    : `You are an elite financial news editor. Your task is to generate a unified English report titled "🚨 HIVEX Alerts - 24H" that synthesizes the key insights from the videos recently analyzed on HIVEX in an extremely premium, clean, and assertive manner.

STRICTLY follow the formatting and style rules below:
1. The main title must be exactly:
🚨 HIVEX Alerts - 24H
---

2. Each analyzed video must be presented with the premium ALERT structure described below. Make sure to leave a full blank line (double newline) between each section for easy readability on mobile:

🚨 ALERT [Number]: [Impact Title]

[Narrative integrated paragraph of 3 to 5 lines. It must be a fluid, high-level, and assertive editorial flow, summarizing the central thesis, the urgency of the situation, and the speaker's macroeconomic insight without rigid subheaders.]

▫️ [Key point 1: a precise numerical data point, percentage, price, or relevant support/resistance level.]
▫️ [Key point 2: a direct tactical implication for the investor, liquidity flow, or systemic risk.]

🎬 **INTEGRATED PLAYER (STUDY CABIN)**
🔗 [Open Chart Scene in HIVEX Study Cabin](https://hivex-backend.vercel.app/share/{videoId}?start={startSeconds}&end={endSeconds})
🔗 [Full Video: {videoTitle}](https://hivex-backend.vercel.app/share/{videoId})

CRITICAL LAYOUT AND SYNTAX RULES (MANDATORY COMPLIANCE):
- In the first alert, the main title "🚨 HIVEX Alerts - 24H" must be followed immediately by the line "---", and a blank space before "🚨 ALERT 1:".
- Leave a full blank line (double newline) between every section of the alert to keep the design premium and airy.
- ABSOLUTE PROHIBITION OF YOUTUBE LINKS: Do NOT include any links pointing to "youtube.com" or "youtu.be" inside the message text body. The only allowed URL is the public HIVEX "/share/" URL.
- NO BULLETS ON LINKS OR HEADERS: The lines starting with "🎬 **INTEGRATED PLAYER (STUDY CABIN)**" and "🔗" MUST NOT start with bullets, asterisks, or hyphens. They must be clean, top-level text lines.
- NO BACKTICKS: Do NOT use backticks (\`) anywhere around the titles, markdown links, or URLs.
- RULE FOR VIDEOS WITHOUT CHARTS: If the "charts" field for a video is empty, states that no charts were detected, or has no valid timestamps, do NOT include the "🎬 **INTEGRATED PLAYER (STUDY CABIN)**" heading or the "🔗 [Open Chart Scene...]" link for that video. Show only the "🔗 [Full Video: {videoTitle}](...)" link.
- RULE TO CALCULATE {startSeconds} AND {endSeconds} (only applicable if the video has charts):
  1. Find any chart timestamp in the "charts" field (e.g. "04:15") and convert it to seconds (4 * 60 + 15 = 255).
  2. Always add 60 seconds to get {endSeconds} (e.g. if start is 255, end is 315).
- For "🔗 [Open Chart Scene in HIVEX Study Cabin](...)": Generate a direct markdown link pointing to the HIVEX share route by injecting the real {videoId} (its UUID in HIVEX) and the start ({startSeconds}) and end ({endSeconds}) parameters in the "/share/" URL.
- For "🔗 [Full Video: {videoTitle}](...)": Generate a direct markdown link pointing to the full video without time parameters by using the real title of the video (property "title" of the data object) as the link text {videoTitle} and "/share/{videoId}" as URL.

3. NO NOTES, AI COMMENTARY OR TABLES: Do not output any draft table, ID list, or final notes. Start immediately with "🚨 HIVEX Alerts - 24H" and follow immediately with the line "---".
4. Generate ONLY standard Markdown. Do not use HTML tags at all.
5. Write the entire report in English.

Here is the data of the recently analyzed videos to synthesize:
${JSON.stringify(videoContexts, null, 2)}
`;

  const attempts = [
    {
      name: "Google AI Studio Gemini 3.6 Flash (v1beta)",
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
    },
    {
      name: "Google AI Studio Gemini 3.5 Flash (v1beta)",
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
    },
    {
      name: "Google AI Studio Gemini 2.5 Flash (v1beta)",
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    },
    {
      name: "Google AI Studio Gemini 2.5 Pro (v1beta)",
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
    },
  ];

  let reportContent = "";
  const errorDetails: string[] = [];

  for (const attempt of attempts) {
    try {
      console.log(`[Digest Route] Attempting report generation using ${attempt.name}...`);

      const payload = {
        contents: [
          {
            role: "user",
            parts: [{ text: promptText }],
          },
        ],
        system_instruction: {
          parts: [{ text: systemInstruction }],
        },
        generationConfig: {
          temperature: 0.15,
          maxOutputTokens: 8192,
          thinkingConfig: {
            thinkingBudget: 0
          }
        },
      };

      const response = await fetch(attempt.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const geminiData = await response.json();
        const parts = geminiData.candidates?.[0]?.content?.parts || [];
        const apiResponse = parts
          .filter((p: any) => !p.thought)
          .map((p: any) => p.text)
          .filter(Boolean)
          .join("") || "";

        if (apiResponse && apiResponse.trim().length > 0) {
          let cleaned = apiResponse.trim();
          if (cleaned.startsWith("```")) {
            const match = cleaned.match(/^```(?:markdown)?\s*([\s\S]*?)\s*```$/i);
            if (match) {
              cleaned = match[1].trim();
            }
          }
          reportContent = cleaned;
          console.log(`[Digest Route] Success using ${attempt.name}.`);
          break;
        } else {
          errorDetails.push(`${attempt.name}: Empty response body.`);
        }
      } else {
        const errText = await response.text();
        errorDetails.push(`${attempt.name} (HTTP ${response.status}): ${errText}`);
      }
    } catch (err: any) {
      errorDetails.push(`${attempt.name} (System/Network Error): ${err?.message || String(err)}`);
    }
  }

  if (reportContent) {
    return reportContent;
  } else {
    throw new Error(
      `Failed to generate the synthesized report with any of the attempted Gemini models. Details:\n` +
        errorDetails.map((d) => `- ${d}`).join("\n")
    );
  }
}

function formatShortDate(dateStr: string, lang: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return lang === "es" ? "Reciente" : "Recent";
    const isSpanish = lang === "es";
    if (isSpanish) {
      const months = [
        "enero",
        "febrero",
        "marzo",
        "abril",
        "mayo",
        "junio",
        "julio",
        "agosto",
        "septiembre",
        "octubre",
        "noviembre",
        "diciembre",
      ];
      return `${date.getDate()} de ${months[date.getMonth()]} de ${date.getFullYear()}`;
    } else {
      const months = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    }
  } catch {
    return lang === "es" ? "Reciente" : "Recent";
  }
}

function cleanHeadline(title: string): string {
  return title
    .replace(/^\[Análisis\]\s*-\s*/i, "")
    .replace(/^INTEL Roundtable\s*:\s*/i, "")
    .replace(/^COL\.\s+[A-Za-z\s]+\s*:\s*/i, "")
    .replace(/^Pepe Escobar\s*:\s*/i, "")
    .trim();
}

function extractKeyAnalysis(content: string): string {
  if (!content) return "Detailed analysis not available.";

  const lines = content.split("\n");
  const bulletPoints: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if ((trimmed.startsWith("-") || trimmed.startsWith("*")) && trimmed.length > 20) {
      let cleaned = trimmed.replace(/^[-*]\s*/, "").trim();
      cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, "$1");
      bulletPoints.push(cleaned);
      if (bulletPoints.length >= 3) break;
    }
  }

  if (bulletPoints.length > 0) {
    return bulletPoints.join(" ");
  }

  const cleanTextLines = lines
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  if (cleanTextLines.length > 0) {
    return cleanTextLines.join(" ").slice(0, 450).trim() + "...";
  }

  return "Detailed analysis not available.";
}

function generateDeterministicDigest(videoContexts: any[], lang: string): string {
  const isSpanish = lang === "es";
  let output = "🚨 HIVEX Alerts - 24H\n---\n\n";
  const label = isSpanish ? "ALERTA" : "ALERT";

  videoContexts.forEach((video, idx) => {
    const keyAnalysisText = extractKeyAnalysis(video.content);
    const shareUrl = `https://hivex-backend.vercel.app/share/${video.id}?start=0&end=60`;

    output += `🚨 ${label} ${idx + 1}: ${cleanHeadline(video.title)}\n\n`;

    if (isSpanish) {
      output += `Análisis de mercado de alto impacto detectado en el canal de ${video.channel}. Se detalla un estudio exhaustivo sobre las tendencias recientes de los activos financieros y flujos de capital globales.\n\n`;
      output += `▫️ Detalle clave: ${keyAnalysisText.slice(0, 160)}...\n`;
      output += `▫️ Implicación táctica: Se aconseja revisar detenidamente la liquidez del mercado y el panel en la cabina.\n\n`;

      output += `🎬 **REPRODUCTOR INTEGRADO (CABINA DE ESTUDIO)**\n`;
      output += `🔗 [Abrir Escena del Gráfico en la Cabina de HIVEX](${shareUrl})\n`;
      output += `🔗 [Vídeo Completo: ${video.title}](https://hivex-backend.vercel.app/share/${video.id})\n\n`;
    } else {
      output += `High-impact market analysis detected on the ${video.channel} channel. A comprehensive study on recent financial asset trends and global capital flows is detailed inside.\n\n`;
      output += `▫️ Key detail: ${keyAnalysisText.slice(0, 160)}...\n`;
      output += `▫️ Tactical implication: Careful review of market liquidity and the dashboard in the cabin is highly advised.\n\n`;

      output += `🎬 **INTEGRATED PLAYER (STUDY CABIN)**\n`;
      output += `🔗 [Open Chart Scene in HIVEX Study Cabin](${shareUrl})\n`;
      output += `🔗 [Full Video: ${video.title}](https://hivex-backend.vercel.app/share/${video.id})\n\n`;
    }
  });

  return output.trim();
}

