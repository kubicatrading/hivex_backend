import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTelegramMessage, markdownToTelegramHtml, splitMarkdown, getTelegramLanguage } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Extend Vercel execution duration to 300s (Pro plan limit) to prevent timeouts during synthesis

export async function GET(request: NextRequest) {
  return handleAlerts(request);
}

export async function POST(request: NextRequest) {
  return handleAlerts(request);
}

async function handleAlerts(request: NextRequest) {
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

    // Parse parameters
    let dryRun = false;
    let customChatId = "";
    let lang = "en";

    try {
      dryRun = searchParams.get("dryRun") === "true";
      customChatId = searchParams.get("chatId") || "";
      
      const langParam = searchParams.get("lang");
      if (langParam === "es" || langParam === "en") {
        lang = langParam;
      } else {
        lang = await getTelegramLanguage();
      }
    } catch (urlErr) {
      console.warn("[Alerts Route] Failed to parse query params:", urlErr);
    }

    console.log(`[Alerts Route] Starting alerts processing. Language: '${lang}'. (dryRun: ${dryRun})`);

    // Initialize Supabase Client
    const supabaseUrl = process.env.SUPABASE_PRODUCTION_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_PRODUCTION_SERVICE_ROLE_KEY || 
                           process.env.SUPABASE_SERVICE_ROLE_KEY || 
                           process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase configuration keys.");
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Query all video documents
    const { data: videos, error: videosError } = await supabaseAdmin
      .from("documents")
      .select("*")
      .eq("type", "video")
      .order("created_at", { ascending: false });

    if (videosError) {
      console.error("[Alerts Route] Error querying videos:", videosError);
      throw new Error(`Database query failed: ${videosError.message}`);
    }

    // Filter for videos that have transcription/analysis but are not yet alerted
    const unalertedVideos = (videos || []).filter((video: any) => {
      const hasTranscriptionInMetadata = !!video.metadata?.transcription;
      const alreadyAlerted = video.metadata?.alert_sent === true;
      return hasTranscriptionInMetadata && !alreadyAlerted;
    });

    if (unalertedVideos.length === 0) {
      console.log("[Alerts Route] No new unalerted videos found. Skipping Telegram message.");
      return NextResponse.json({
        success: true,
        count: 0,
        message: "No new unalerted videos found. Skipping Telegram message dispatch."
      });
    }

    console.log(`[Alerts Route] Found ${unalertedVideos.length} new unalerted videos. Fetching associated analyses, summaries, and charts...`);

    // Batch query associated documents
    const fileUrls = unalertedVideos.map((v) => v.file_url).filter(Boolean);
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

      analyses = analysesRes.data || [];
      summaries = summariesRes.data || [];
      charts = chartsRes.data || [];
    }

    // Structure video contexts
    const videoContexts = unalertedVideos.map((video) => {
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

      const maxLen = 4000;
      const slicedContent =
        contentToUse.length > maxLen
          ? contentToUse.slice(0, maxLen) + "\n...[Contenido Truncado]..."
          : contentToUse;

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

    // Synthesize alerts report via Gemini
    let reportMarkdown = "";
    try {
      console.log("[Alerts Route] Synthesizing premium alerts using Gemini...");
      reportMarkdown = await generateSynthesizedAlerts(videoContexts, lang);
      console.log("[Alerts Route] Synthesis completed successfully.");
    } catch (geminiErr: any) {
      console.warn("[Alerts Route] Gemini API synthesis failed, falling back to deterministic:", geminiErr?.message || geminiErr);
      reportMarkdown = generateDeterministicAlerts(videoContexts, lang);
    }

    // Deliver to Telegram (unless dryRun)
    if (!dryRun) {
      console.log("[Alerts Route] Converting alerts report to Telegram HTML and sending...");
      const delimiter = "🚨 ";
      
      // Split the generated markdown into separate segments using positive lookahead
      const parts = reportMarkdown.split(new RegExp(`(?=${delimiter})`, "g")).filter(p => p.trim());
      
      if (parts.length > 1) {
        // First part is the header: "🚨 HIVEX Alerts - 24H\n---\n\n"
        const header = parts[0].includes("HIVEX Alerts") ? parts[0].trim() + "\n\n" : "";
        const startIndex = parts[0].includes("HIVEX Alerts") ? 1 : 0;

        for (let i = startIndex; i < parts.length; i++) {
          const alertMarkdown = (i === startIndex && header) ? header + parts[i].trim() : parts[i].trim();
          if (alertMarkdown) {
            const alertHtml = markdownToTelegramHtml(alertMarkdown);
            if (i > startIndex) {
              await new Promise((resolve) => setTimeout(resolve, 800));
            }
            console.log(`[Alerts Route] Dispatching Alert ${i + 1 - startIndex} to Telegram...`);
            await sendTelegramMessage(alertHtml, customChatId || undefined);
          }
        }
      } else {
        // Fallback to sending as a single message
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

      // Mark these videos as alerted in Supabase
      console.log("[Alerts Route] Marking video metadata as alert_sent = true in Supabase...");
      for (const video of unalertedVideos) {
        const updatedMetadata = {
          ...(video.metadata || {}),
          alert_sent: true,
          alert_sent_at: new Date().toISOString()
        };
        const { error: updateError } = await supabaseAdmin
          .from("documents")
          .update({ metadata: updatedMetadata })
          .eq("id", video.id);

        if (updateError) {
          console.error(`[Alerts Route] Failed to update alert_sent for video ${video.id}:`, updateError.message);
        }
      }

      console.log("[Alerts Route] Alerts delivered successfully to Telegram and metadata updated.");
    } else {
      console.log("[Alerts Route] Dry-run enabled. Skipping Telegram delivery and database update.");
    }

    return NextResponse.json({
      success: true,
      count: unalertedVideos.length,
      message: dryRun
        ? "Alerts generated successfully (Dry Run - No Telegram dispatch)."
        : "Alerts generated, delivered to Telegram, and database updated successfully.",
      markdown: reportMarkdown,
      videos: unalertedVideos.map((v) => ({ id: v.id, title: v.title, created_at: v.created_at })),
    });
  } catch (error: any) {
    console.error("[Alerts Route] Critical failure:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Unexpected failure in alerts route." },
      { status: 500 }
    );
  }
}

async function generateSynthesizedAlerts(videoContexts: any[], lang: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY.");
  }

  const isSpanish = lang === "es";

  const systemInstruction = isSpanish
    ? `You are an elite financial news editor and investment analyst. Your task is to synthesize daily premium investment alerts in Spanish based on video materials, replicating a clean, high-impact, narrative-driven format. Always output standard Markdown without HTML tags.`
    : `You are an elite financial news editor and investment analyst. Your task is to synthesize daily premium investment alerts in English based on video materials, replicating a clean, high-impact, narrative-driven format. Always output standard Markdown without HTML tags.`;

  const promptText = isSpanish
    ? `Eres un editor de noticias financieras de élite y un estratega bursátil en HIVEX. Tu tarea es generar un informe unificado en español titulado exactamente "🚨 HIVEX Alerts - 24H" que recopile todas las alertas oportunas de la videoteca desde la perspectiva de un inversor astuto. No agregues preámbulos formales ni presentaciones adicionales.
  
Debes enfocar este reporte estrictamente en:
- Aspectos de importancia, urgencia o carácter atípico de los flujos de mercado y tendencias geopolíticas/macroeconómicas.
- Ofrecer una ventaja inversora clara y asertiva que beneficie a nuestros asociados del canal.

Sigue ESTRICTAMENTE las siguientes reglas de formato y diseño:
1. El boletín debe iniciarse exactamente con el siguiente encabezado, seguido de una línea de separación y un espacio en blanco (sin ningún tipo de introducción ni texto extra):
🚨 HIVEX Alerts - 24H
---

2. Cada vídeo debe presentarse con la estructura de ALERTA premium descrita a continuación. Deja un doble salto de línea entre cada sección de la alerta para mantener un formato limpio. Está TERMINANTEMENTE PROHIBIDO anteponer etiquetas secuenciales como "ALERTA [numero]" o "ALERTA:":

🚨 [Título de Impacto en Mayúsculas]

[Párrafo narrativo integrado de 3 a 5 líneas. Flujo de redacción fluido, sumamente premium, asertivo y de alto nivel, que sintetiza la tesis central del ponente, la urgencia de la situación macroeconómica y el evento de mercado detectado. No utilices subtítulos intermedios rígidos.]

▫️ **El Incidente**: [Dato cuantitativo preciso, porcentaje, precio, nivel técnico de soporte/resistencia, o anomalía detectada.]
▫️ **Ventaja Inversora**: [La implicación táctica directa, oportunidad de arbitraje o cobertura defensiva recomendada para obtener beneficio.]

🎬 **REPRODUCTOR INTEGRADO (CABINA DE ESTUDIO)**
🔗 [Abrir Escena del Gráfico en la Cabina de HIVEX](https://hivex-backend.vercel.app/share/{videoId}?start={startSeconds}&end={endSeconds})
🔗 [Vídeo Completo: {videoTitle}](https://hivex-backend.vercel.app/share/{videoId})

REGLAS CRÍTICAS DE MAQUETACIÓN Y SINTAXIS (CUMPLIMIENTO OBLIGATORIO):
- El informe comienza directamente con el encabezado indicado y pasa de inmediato a las alertas. No agregues saludos, presentaciones, firmas, ni notas explicativas.
- Deja una línea en blanco completa (doble salto de línea) entre cada una de las secciones de la alerta para mantener el diseño premium y aireado.
- PROHIBICIÓN ABSOLUTA DE ENLACES A YOUTUBE: Está terminantemente prohibido incluir enlaces a "youtube.com" o "youtu.be" en el cuerpo de texto del mensaje. El único hipervínculo que debe aparecer para el vídeo es el enlace público "/share/" de HIVEX.
- PROHIBICIÓN DE OTROS SÍMBOLOS O VIÑETAS EN ENLACES: Las líneas de "🎬 **REPRODUCTOR INTEGRADO (CABINA DE ESTUDIO)**" y "🔗" NO deben comenzar con viñetas de asteriscos, guiones ni puntos de lista. Devuelven líneas de texto independientes y limpias.
- PROHIBICIÓN DE COMILLAS INVERTIDAS: No utilices comillas invertidas (\`) ni bloques de código para envolver los títulos o las URLs.
- REGLA PARA VÍDEOS SIN GRÁFICOS: Si en el campo "charts" de un vídeo no se detectó ningún gráfico (o el campo está vacío o indica que no hay gráficos), NO agregues la cabecera "🎬 **REPRODUCTOR INTEGRADO (CABINA DE ESTUDIO)**" ni la línea "🔗 [Abrir Escena del Gráfico...]" para ese vídeo. En ese caso, incluye únicamente la línea "🔗 [Vídeo Completo: {videoTitle}](...)".
- REGLA PARA CALCULAR {startSeconds} Y {endSeconds} (solo aplicable si el vídeo tiene gráficos):
  1. Busca cualquier marca de tiempo de gráfico en el campo "charts" (ej. "04:15") y conviértela a segundos enteros (4 * 60 + 15 = 255).
  2. Suma siempre 60 segundos para obtener {endSeconds} (ej. si start es 255, end es 315).
- Para "🔗 [Abrir Escena del Gráfico en la Cabina de HIVEX](...)": Genera un link markdown directo apuntando a la ruta de compartir de HIVEX inyectando el {videoId} real (su UUID en HIVEX) y los parámetros de tiempo de inicio ({startSeconds}) y fin ({endSeconds}) calculados en la URL de "/share/".
- Para "🔗 [Vídeo Completo: {videoTitle}](...)": Añade obligatoriamente este segundo enlace apuntando al vídeo completo sin parámetros de tiempo utilizando el título real del vídeo (propiedad "title" del objeto de datos) como el texto del enlace {videoTitle} y "/share/{videoId}" como URL.

3. PROHIBICIÓN ABSOLUTA DE METANARRATIVA, PASOS DE AUTO-CORRECCIÓN Y REVISIONES DE IA: No escribas borradores, explicaciones, notas, listas de cumplimiento, ni textos de autocomprobación. El informe debe terminar de forma limpia y directa inmediatamente después del último enlace de la última alerta.
4. Genera únicamente Markdown estándar. No utilices etiquetas HTML en absoluto.
5. Redacta todo el informe en español de alta gama profesional.

Aquí tienes los datos de los vídeos sincronizados para sintetizar:
${JSON.stringify(videoContexts, null, 2)}
`
    : `You are an elite financial news editor and a market strategist at HIVEX. Your task is to generate a unified English report titled exactly "🚨 HIVEX Alerts - 24H" summarizing all timely alerts from the video library from the perspective of an astute investor. Do not add formal intros or greetings.
  
You must focus this report strictly on:
- Matters of significance, urgency, or unusual market flows and geopolitical/macroeconomic trends.
- Offering a clear, assertive investment edge that benefits our channel associates.

STRICTLY follow the formatting and style rules below:
1. The newsletter must start exactly with the following header, followed by a separator line and a blank space (no other intro text or greeting):
🚨 HIVEX Alerts - 24H
---

2. Each video must be presented with the premium ALERT structure described below. Leave a double newline between each section of the alert to maintain a clean layout. DO NOT prepend sequential labels like "ALERT [number]" or "ALERT:":

🚨 [Impact Title in Uppercase]

[Narrative integrated paragraph of 3 to 5 lines. Fluid, highly premium, assertive, and high-level writing style synthesizing the speaker's core thesis, the urgency of the macroeconomic situation, and the detected market event. Do not use rigid subheaders.]

▫️ **The Incident**: [Precise quantitative data, percentage, price, technical support/resistance level, or anomaly detected.]
▫️ **Investor Advantage**: [The direct tactical implication, arbitrage opportunity, or defensive hedge recommended to capture benefit.]

🎬 **INTEGRATED PLAYER (STUDY CABIN)**
🔗 [Open Chart Scene in HIVEX Study Cabin](https://hivex-backend.vercel.app/share/{videoId}?start={startSeconds}&end={endSeconds})
🔗 [Full Video: {videoTitle}](https://hivex-backend.vercel.app/share/{videoId})

CRITICAL LAYOUT AND SYNTAX RULES (MANDATORY COMPLIANCE):
- The report starts directly with the header and goes immediately to the alerts. No introductions, greetings, signatures, or notes.
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

3. ABSOLUTE PROHIBITION OF METANARRATIVE, SELF-CORRECTION STEPS, AND AI REVIEWS: Do not write drafts, explanations, notes, or checklists. The report must end cleanly right after the last link of the last alert.
4. Generate ONLY standard Markdown. Do not use HTML tags at all.
5. Write the entire report in premium professional English.

Here is the data of the synchronized videos to synthesize:
${JSON.stringify(videoContexts, null, 2)}
`;

  const attempts = [
    {
      name: "Gemini 3.5 Flash (v1beta)",
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
    },
    {
      name: "Gemini 2.5 Flash (v1beta)",
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    },
  ];

  let reportContent = "";
  const errorDetails: string[] = [];

  for (const attempt of attempts) {
    try {
      console.log(`[Alerts Route] Attempting report generation using ${attempt.name}...`);

      const payload = {
        contents: [{ role: "user", parts: [{ text: promptText }] }],
        system_instruction: { parts: [{ text: systemInstruction }] },
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
        headers: { "Content-Type": "application/json" },
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
          console.log(`[Alerts Route] Success using ${attempt.name}.`);
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
    throw new Error(`Failed to generate alerts digest: ` + errorDetails.join("\n"));
  }
}

function generateDeterministicAlerts(videoContexts: any[], lang: string): string {
  const isSpanish = lang === "es";
  let output = "🚨 HIVEX Alerts - 24H\n---\n\n";

  videoContexts.forEach((video) => {
    const shareUrl = `https://hivex-backend.vercel.app/share/${video.id}?start=0&end=60`;
    output += `🚨 ${video.title.toUpperCase()}\n\n`;

    if (isSpanish) {
      output += `Análisis macroeconómico de alto impacto detectado en el canal de ${video.channel}. Se detalla un estudio exhaustivo sobre las tendencias recientes de los activos financieros y flujos de capital globales.\n\n`;
      output += `▫️ **El Incidente**: Movimientos de volumen atípicos o catalizadores geopolíticos bajo análisis activo en la cabina de estudio.\n`;
      output += `▫️ **Ventaja Inversora**: Se aconseja revisar los flujos de liquidez y realizar seguimiento de los niveles marcados en el gráfico para capturar ventajas operativas.\n\n`;
      output += `🎬 **REPRODUCTOR INTEGRADO (CABINA DE ESTUDIO)**\n`;
      output += `🔗 [Abrir Escena del Gráfico en la Cabina de HIVEX](${shareUrl})\n`;
      output += `🔗 [Vídeo Completo: ${video.title}](https://hivex-backend.vercel.app/share/${video.id})\n\n`;
    } else {
      output += `High-impact macroeconomic analysis detected on the ${video.channel} channel. A comprehensive study on recent financial asset trends and global capital flows is detailed inside.\n\n`;
      output += `▫️ **The Incident**: Unusual volume movements or geopolitical catalysts under active analysis in the study cabin.\n`;
      output += `▫️ **Investor Advantage**: Careful review of liquidity flows and tracking levels marked in the chart is advised to capture operational advantages.\n\n`;
      output += `🎬 **INTEGRATED PLAYER (STUDY CABIN)**\n`;
      output += `🔗 [Open Chart Scene in HIVEX Study Cabin](${shareUrl})\n`;
      output += `🔗 [Full Video: ${video.title}](https://hivex-backend.vercel.app/share/${video.id})\n\n`;
    }
  });

  return output.trim();
}
