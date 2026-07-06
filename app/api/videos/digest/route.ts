import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTelegramMessage, markdownToTelegramHtml, splitMarkdown, getTelegramLanguage } from "@/lib/telegram";

export async function GET(request: NextRequest) {
  return handleDigest(request);
}

export async function POST(request: NextRequest) {
  return handleDigest(request);
}

async function handleDigest(request: NextRequest) {
  try {
    // 1. Parse query parameters
    let hours = 24;
    let dryRun = false;
    let customChatId = "";
    let lang = "en";

    try {
      const { searchParams } = new URL(request.url);
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
        ? `🚨 <b>HIVEX News - 24H</b>\n\nNo se han detectado nuevos análisis de vídeo en las últimas ${hours} horas.\nLa cabina de estudio se mantiene al día.`
        : `🚨 <b>HIVEX News - 24H</b>\n\nNo new video analyses have been detected in the last ${hours} hours.\nThe study cabin remains up to date.`;
      
      if (!dryRun) {
        await sendTelegramMessage(emptyStateMessage, customChatId || undefined);
      }

      return NextResponse.json({
        success: true,
        count: 0,
        message: `No videos analyzed in the last ${hours} hours. Empty state notification dispatched.`,
        markdown: isSpanish
          ? `🚨 HIVEX News - 24H\n\nNo se han detectado nuevos análisis de vídeo en las últimas ${hours} horas.\nLa cabina de estudio se mantiene al día.`
          : `🚨 HIVEX News - 24H\n\nNo new video analyses have been detected in the last ${hours} hours.\nThe study cabin remains up to date.`,
      });
    }

    console.log(`[Digest Route] Found ${videos.length} videos. Fetching associated analyses and summaries...`);

    // 4. Batch query associated documents (knowledge_analysis and knowledge_summary)
    const fileUrls = videos.map((v) => v.file_url).filter(Boolean);
    let analyses: any[] = [];
    let summaries: any[] = [];

    if (fileUrls.length > 0) {
      const [analysesRes, summariesRes] = await Promise.all([
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
    }

    // 5. Structure contexts for each video
    const videoContexts = videos.map((video, idx) => {
      const analysisDoc = analyses.find((a) => a.file_url === video.file_url);
      const summaryDoc = summaries.find((s) => s.file_url === video.file_url);

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

      return {
        id: video.id,
        title: video.title,
        channel: video.metadata?.channel_title || "Canal Desconocido",
        publishedAt: video.metadata?.published_at || video.created_at,
        content: slicedContent,
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
      const telegramHtml = markdownToTelegramHtml(reportMarkdown);

      if (telegramHtml.length > 3500) {
        console.log(`[Digest Route] Long digest detected (${telegramHtml.length} chars). Splitting into chunks.`);
        const chunks = splitMarkdown(reportMarkdown, 3000);
        for (let i = 0; i < chunks.length; i++) {
          const chunkHtml = markdownToTelegramHtml(chunks[i]);
          await sendTelegramMessage(chunkHtml, customChatId || undefined);
        }
      } else {
        await sendTelegramMessage(telegramHtml, customChatId || undefined);
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
    ? `You are an elite financial news editor and investment analyst. Your task is to synthesize a daily premium investment news digest in Spanish based on analyzed video materials, replicating a specific high-fidelity format. Always output standard Markdown without HTML tags.`
    : `You are an elite financial news editor and investment analyst. Your task is to synthesize a daily premium investment news digest in English based on analyzed video materials, replicating a specific high-fidelity format. Always output standard Markdown without HTML tags.`;

  const promptText = isSpanish
    ? `Eres un editor de noticias financieras de élite. Tu tarea es generar un informe unificado en español titulado "🚨 HIVEX News - 24H" que sintetice las ideas clave de los vídeos analizados recientemente en HIVEX.

Sigue ESTRICTAMENTE las siguientes reglas de formato y estilo:
1. El título principal debe ser exactamente:
🚨 HIVEX News - 24H

2. Cada vídeo analizado debe presentarse como un elemento numerado con la siguiente estructura exacta (reemplazando los corchetes con los datos sintetizados):

[Número]. [Concept Headline / Título Conceptual de Inversión de Alto Impacto] ([Fecha de Publicación del Vídeo en formato corto legible, ej. 5 de julio de 2026])
* Fuente: [[Título Real del Vídeo]](https://hivex-backend.vercel.app/dashboard/videos?id=[id_real_del_video]&from=telegram)
* Análisis Clave: [Síntesis premium, rigurosa, fluida y sumamente profesional de las implicaciones financieras, macroeconómicas y geopolíticas del vídeo en base al material provisto. Debe tener aproximadamente 3-5 oraciones densas en información y un estilo sofisticado.]

3. No agregues introducciones, preámbulos, conclusiones ni resúmenes generales antes o después de la lista numerada. El informe debe comenzar directamente con "🚨 HIVEX News - 24H" y seguir inmediatamente con el primer elemento numerado.
4. Genera únicamente Markdown estándar. No utilices etiquetas HTML en absoluto, ya que el sistema convertirá tu respuesta a HTML compatible con Telegram usando un formateador preestablecido. El enlace de la fuente en Markdown estándar ([Título del Vídeo](URL)) será transformado automáticamente a etiqueta HTML de forma limpia.
5. El enlace de la cabina de estudio para cada vídeo debe tener exactamente este formato:
https://hivex-backend.vercel.app/dashboard/videos?id=[id_real_del_video]&from=telegram
Asegúrate de inyectar el ID real de cada vídeo (provisto en cada objeto de datos) y añadir el parámetro '&from=telegram'.
6. Redacta el informe completo en español.

Aquí tienes los datos de los vídeos recién analizados para sintetizar:
${JSON.stringify(videoContexts, null, 2)}
`
    : `You are an elite financial news editor. Your task is to generate a unified English report titled "🚨 HIVEX News - 24H" that synthesizes the key insights from the videos recently analyzed on HIVEX.

STRICTLY follow the formatting and style rules below:
1. The main title must be exactly:
🚨 HIVEX News - 24H

2. Each analyzed video must be presented as a numbered item with the following exact structure (replacing the brackets with the synthesized data):

[Number]. [High-Impact Conceptual Investment Headline] ([Short, readable publication date, e.g., July 5, 2026])
* Source: [[Real Video Title]](https://hivex-backend.vercel.app/dashboard/videos?id=[real_video_id]&from=telegram)
* Key Analysis: [Premium, rigorous, fluid, and highly professional synthesis of the financial, macroeconomic, and geopolitical implications of the video based on the provided material. It must have approximately 3-5 information-dense sentences and a highly sophisticated style.]

3. Do not add introductions, preambles, conclusions, or general summaries before or after the numbered list. The report must begin directly with "🚨 HIVEX News - 24H" and be followed immediately by the first numbered item.
4. Generate ONLY standard Markdown. Do not use HTML tags at all, as the system will convert your response to Telegram-compliant HTML using a pre-established formatter. The standard Markdown source link ([Video Title](URL)) will be automatically converted to a clean HTML tag.
5. The study cabin link for each video must have exactly this format:
https://hivex-backend.vercel.app/dashboard/videos?id=[real_video_id]&from=telegram
Be sure to inject the real ID of each video (provided in each data object) and append the parameter '&from=telegram'.
6. Write the entire report in English.

Here is the data of the recently analyzed videos to synthesize:
${JSON.stringify(videoContexts, null, 2)}
`;

  const attempts = [
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
          maxOutputTokens: 2500,
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
        const apiResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

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
  let output = "🚨 HIVEX News - 24H\n\n";
  const isSpanish = lang === "es";
  const sourceLabel = isSpanish ? "Fuente" : "Source";
  const analysisLabel = isSpanish ? "Análisis Clave" : "Key Analysis";

  videoContexts.forEach((video, idx) => {
    const headline = cleanHeadline(video.title);
    const dateText = formatShortDate(video.publishedAt, lang);
    const studyCabinUrl = `https://hivex-backend.vercel.app/dashboard/videos?id=${video.id}&from=telegram`;
    const keyAnalysisText = extractKeyAnalysis(video.content);

    output += `${idx + 1}. ${headline} (${dateText})\n`;
    output += `* ${sourceLabel}: [${video.title}](${studyCabinUrl})\n`;
    output += `* ${analysisLabel}: ${keyAnalysisText}\n\n`;
  });

  return output.trim();
}

