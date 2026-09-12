import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTelegramMessageWithPhotos, sendTelegramMessage, markdownToTelegramHtml, splitMarkdown, getTelegramLanguage, getYoutubeId } from "@/lib/telegram";

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
      console.log("[Digest Route] Converting report to Telegram multimedia messages and sending...");
      
      // Split the generated markdown into header + individual alert segments
      const parts = reportMarkdown.split(/(?=🚨\s+(?:ALERTA|ALERT)\s+\d+:|🚨\s+(?!HIVEX\s+Alerts)[A-Z0-9])/i);
      
      if (parts.length > 1) {
        // parts[0] contains the header + formal presentation
        const hasHeader = parts[0].includes("HIVEX Alerts");
        const startIndex = hasHeader ? 1 : 0;

        if (hasHeader && parts[0].trim()) {
          console.log(`[Digest Route] Dispatching Header and Formal Presentation to Telegram...`);
          const headerHtml = markdownToTelegramHtml(parts[0].trim());
          await sendTelegramMessage(headerHtml, customChatId || undefined);
        }

        // Dispatch each alert with full multimedia (snapshots and video covers)
        for (let i = startIndex; i < parts.length; i++) {
          const alertMarkdown = parts[i].trim();
          if (alertMarkdown) {
            if (i > startIndex) {
              await new Promise((resolve) => setTimeout(resolve, 800));
            }
            console.log(`[Digest Route] Dispatching Alert ${i + 1 - startIndex} with photo/multimedia to Telegram...`);
            await sendTelegramMessageWithPhotos(alertMarkdown, customChatId || undefined);
          }
        }
      } else {
        // Fallback to sending as a single multimedia message
        await sendTelegramMessageWithPhotos(reportMarkdown, customChatId || undefined);
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
    ? `Eres un editor de noticias financieras de élite y un estratega bursátil en HIVEX. Tu tarea es generar un informe unificado en español titulado exactamente "🚨 HIVEX Alerts - 24H" que sintetice las ideas clave y alertas oportunas de los vídeos analizados recientemente en HIVEX de forma extremadamente premium, limpia, sobria y asertiva.

Sigue ESTRICTAMENTE las siguientes reglas de formato y diseño (5 Reglas de Oro inquebrantables de HIVEX):
1. El boletín debe iniciarse exactamente con el siguiente encabezado y una brevisima presentación formal del inversor (REGLA 1):
🚨 HIVEX Alerts - 24H
---

[Un párrafo de presentación formal del inversor de HIVEX extremadamente corto, sobrio, directo, conciso y premium (de 1 a 2 líneas, máximo 30-40 palabras) que exponga con claridad el propósito de las alertas presentadas hoy, sirviendo como preámbulo formal al inicio absoluto de la comunicación antes de cualquier alerta.]

2. Cada vídeo analizado debe presentarse con la estructura de ALERTA premium descrita a continuación. Asegúrate de dejar una línea en blanco completa (doble salto de línea) entre cada apartado para una legibilidad óptima en móviles:

🚨 ALERTA [Número]: [Título de Impacto en Mayúsculas]

[Párrafo narrativo integrado de 3 a 5 líneas. Debe ser un flujo editorial fluido, asertivo y de muy alto nivel, resumiendo de forma contundente la tesis central, la urgencia de la situación macroeconómica y el evento de mercado detectado, sin usar subtítulos intermedios rígidos.]

▫️ **El Incidente**: [Dato cuantitativo preciso, porcentaje, precio, nivel técnico de soporte/resistencia, o anomalía detectada.]
▫️ **Ventaja Inversora**: [La implicación táctica directa, oportunidad de arbitraje o cobertura defensiva recomendada para obtener beneficio.]

🎬 **REPRODUCTOR INTEGRADO (CABINA DE ESTUDIO)**
🔗 [{cleanChartTitle}](https://hivex-backend.vercel.app/dashboard/videos?id={videoId}&start={startSeconds}&end={endSeconds}&from=telegram)
![{cleanChartTitle}](https://hivex-backend.vercel.app/snapshots/{videoId}/{startSeconds}.jpg)

🔗 [Vídeo Completo: {videoTitle}](https://hivex-backend.vercel.app/dashboard/videos?id={videoId}&from=telegram)
![{videoTitle}](https://hivex-backend.vercel.app/snapshots/{videoId}/0.jpg)

REGLAS CRÍTICAS DE MAQUETACIÓN Y SINTAXIS (CUMPLIMIENTO OBLIGATORIO):
- En la primera alerta, el título "🚨 HIVEX Alerts - 24H" debe ir seguido inmediatamente por la línea de separación "---", la breve presentación formal, y un espacio en blanco antes de "🚨 ALERTA 1:".
- Deja una línea en blanco completa (doble salto de línea) entre cada una de las secciones de la alerta para mantener el diseño premium y aireado.
- PROHIBICIÓN ABSOLUTA DE ENLACES A YOUTUBE: Está terminantemente prohibido incluir enlaces a "youtube.com" o "youtu.be" en el cuerpo de texto del mensaje. El único hipervínculo que debe aparecer para el vídeo es el enlace de la cabina de HIVEX.
- PROHIBICIÓN DE OTROS SÍMBOLOS O VIÑETAS EN ENLACES: Las líneas de "🎬 **REPRODUCTOR INTEGRADO (CABINA DE ESTUDIO)**" y "🔗" NO deben comenzar con viñetas de asteriscos, guiones ni puntos de lista. Deben ser líneas de texto independientes y limpias.
- PROHIBICIÓN DE COMILLAS INVERTIDAS: No utilices comillas invertidas (\`) ni bloques de código para envolver los títulos o las URLs.
- REGLA 3 & REGLA 4 PARA GRÁFICOS (CABINA DE ESTUDIO) - FORMATO JERÁRQUICO 4 PASOS:
  - Si el vídeo tiene gráficos detectados en el campo "charts":
    1. Busca la marca de tiempo del gráfico relevante en el campo "charts" (ej. "12:20" -> 740s) para {startSeconds}.
    2. Suma siempre 60 segundos para obtener {endSeconds} (ej. si start es 740, end es 800).
    3. Inyecta el bloque exactamente con los 4 elementos emparejados (enlace acotado + captura fija JPG, y luego enlace completo + carátula 0.jpg):
       🎬 **REPRODUCTOR INTEGRADO (CABINA DE ESTUDIO)**
       🔗 [{cleanChartTitle}](https://hivex-backend.vercel.app/dashboard/videos?id={videoId}&start={startSeconds}&end={endSeconds}&from=telegram)
       ![{cleanChartTitle}](https://hivex-backend.vercel.app/snapshots/{videoId}/{startSeconds}.jpg)

       🔗 [Vídeo Completo: {videoTitle}](https://hivex-backend.vercel.app/dashboard/videos?id={videoId}&from=telegram)
       ![{videoTitle}](https://hivex-backend.vercel.app/snapshots/{videoId}/0.jpg)
  - Si el vídeo NO tiene gráficos detectados (el campo "charts" está vacío, indica que no hay gráficos o no tiene marcas de tiempo):
    - Está TERMINANTEMENTE PROHIBIDO inventar gráficos o segundos.
    - OMITIR POR COMPLETO el encabezado "🎬 **REPRODUCTOR INTEGRADO (CABINA DE ESTUDIO)**", el enlace de fragmento acotado y la captura fija del gráfico.
    - Incluir ÚNICAMENTE el enlace del vídeo completo emparejado con su carátula:
    🔗 [Vídeo Completo: {videoTitle}](https://hivex-backend.vercel.app/dashboard/videos?id={videoId}&from=telegram)
    ![{videoTitle}](https://hivex-backend.vercel.app/snapshots/{videoId}/0.jpg)

- REGLA 4 DE ENLACES COMPLETAMENTE LIMPIOS:
  - El texto ancla del enlace debe ser el propio título descriptivo del gráfico o recurso (ej. \`[S&P 500 Soporte Clave](...)\` o \`[Vídeo Completo: Título]\`).
  - Está TERMINANTEMENTE PROHIBIDO usar textos genéricos como "Abrir Escena del Gráfico en la Cabina de HIVEX", "Ver escena", "Hacer clic aquí", "Ver enlace" o poner URLs desnudas.
- REGLA 5 DE PRECISIÓN Y VERACIDAD:
  - Prohibido inventar datos, cotizaciones, fechas o análisis. Solo hechos sustentados en la videoteca.

3. PROHIBICIÓN DE NOTAS O COMENTARIOS DE IA: No escribas borradores, explicaciones ni notas finales. Comienza directamente con "🚨 HIVEX Alerts - 24H".
4. Genera únicamente Markdown estándar. No utilices etiquetas HTML en absoluto.
5. Redacta todo el informe en español.

Aquí tienes los datos de los vídeos recién analizados para sintetizar:
${JSON.stringify(videoContexts, null, 2)}
`
    : `You are an elite financial news editor and an investment strategist at HIVEX. Your task is to generate a unified English report titled exactly "🚨 HIVEX Alerts - 24H" that synthesizes the key insights and timely alerts from recently analyzed videos in HIVEX in an extremely premium, clean, sober, and assertive manner.

STRICTLY follow the formatting and style rules below (HIVEX 5 Unbending Golden Rules):
1. The bulletin must begin exactly with the following header and an extremely short formal investor presentation (RULE 1):
🚨 HIVEX Alerts - 24H
---

[A formal investor presentation paragraph that is extremely short, sober, direct, concise, and premium (1 to 2 lines, maximum 30-40 words) clearly setting out the purpose of the alerts presented today, serving as the formal opening of the communication before any alert.]

2. Each analyzed video must be presented with the premium ALERT structure described below. Make sure to leave a full blank line (double newline) between each section for easy readability on mobile:

🚨 ALERT [Number]: [Impact Title in Uppercase]

[Narrative integrated paragraph of 3 to 5 lines. It must be a fluid, high-level, and assertive editorial flow, summarizing the central thesis, the urgency of the macroeconomic situation, and the detected market event, without using rigid intermediate subheaders.]

▫️ **The Incident**: [A precise numerical data point, percentage, price, technical support/resistance level, or detected anomaly.]
▫️ **Investor Advantage**: [The direct tactical implication, arbitrage opportunity, or defensive hedge recommended to gain advantage.]

🎬 **INTEGRATED PLAYER (STUDY CABIN)**
🔗 [{cleanChartTitle}](https://hivex-backend.vercel.app/dashboard/videos?id={videoId}&start={startSeconds}&end={endSeconds}&from=telegram)
![{cleanChartTitle}](https://hivex-backend.vercel.app/snapshots/{videoId}/{startSeconds}.jpg)

🔗 [Full Video: {videoTitle}](https://hivex-backend.vercel.app/dashboard/videos?id={videoId}&from=telegram)
![{videoTitle}](https://hivex-backend.vercel.app/snapshots/{videoId}/0.jpg)

CRITICAL LAYOUT AND SYNTAX RULES (MANDATORY COMPLIANCE):
- In the first alert, the main title "🚨 HIVEX Alerts - 24H" must be followed immediately by the separator line "---", the brief formal presentation, and a blank space before "🚨 ALERT 1:".
- Leave a full blank line (double newline) between every section of the alert to keep the design premium and airy.
- ABSOLUTE PROHIBITION OF YOUTUBE LINKS: Do NOT include any links pointing to "youtube.com" or "youtu.be" inside the message text body. The only allowed URL is the HIVEX study cabin URL.
- NO BULLETS ON LINKS OR HEADERS: The lines starting with "🎬 **INTEGRATED PLAYER (STUDY CABIN)**" and "🔗" MUST NOT start with bullets, asterisks, or hyphens. They must be clean, top-level text lines.
- NO BACKTICKS: Do NOT use backticks (\`) anywhere around the titles, markdown links, or URLs.
- RULE 3 & RULE 4 FOR CHARTS (STUDY CABIN) - 4-STEP HIERARCHICAL FORMAT:
  - If the video has charts detected in the "charts" field:
    1. Find the timestamp of the relevant chart in the "charts" field (e.g. "12:20" -> 740s) for {startSeconds}.
    2. Always add 60 seconds to get {endSeconds} (e.g. if start is 740, end is 800).
    3. Inject the block with the 4 paired elements (bounded link + fixed JPG snapshot, and then full video link + cover 0.jpg):
       🎬 **INTEGRATED PLAYER (STUDY CABIN)**
       🔗 [{cleanChartTitle}](https://hivex-backend.vercel.app/dashboard/videos?id={videoId}&start={startSeconds}&end={endSeconds}&from=telegram)
       ![{cleanChartTitle}](https://hivex-backend.vercel.app/snapshots/{videoId}/{startSeconds}.jpg)

       🔗 [Full Video: {videoTitle}](https://hivex-backend.vercel.app/dashboard/videos?id={videoId}&from=telegram)
       ![{videoTitle}](https://hivex-backend.vercel.app/snapshots/{videoId}/0.jpg)
  - If the video has NO charts detected (the "charts" field is empty, states that no charts were detected, or has no valid timestamps):
    - It is STRICTLY FORBIDDEN to hallucinate charts or timestamps.
    - COMPLETELY OMIT the "🎬 **INTEGRATED PLAYER (STUDY CABIN)**" heading, the bounded clip link, and the fixed snapshot.
    - Include ONLY the full video link paired with its cover:
    🔗 [Full Video: {videoTitle}](https://hivex-backend.vercel.app/dashboard/videos?id={videoId}&from=telegram)
    ![{videoTitle}](https://hivex-backend.vercel.app/snapshots/{videoId}/0.jpg)

- RULE 4 FOR COMPLETELY CLEAN LINKS:
  - The anchor text must be the clean descriptive title of the chart or resource (e.g. \`[S&P 500 Key Support](...)\` or \`[Full Video: Title]\`).
  - It is STRICTLY FORBIDDEN to use generic anchor texts such as "Open Chart Scene in HIVEX Study Cabin", "View scene", "Click here", "View link", or raw URLs.
- RULE 5 OF ACCURACY AND TRUTHFULNESS:
  - Do not invent data, prices, dates, or analyses. Only facts backed by the video library.

3. NO NOTES OR AI COMMENTARY: Do not output any draft table, ID list, or final notes. Start immediately with "🚨 HIVEX Alerts - 24H".
4. Generate ONLY standard Markdown. Do not use HTML tags at all.
5. Write the entire report in English.

Here is the data of the recently analyzed videos to synthesize:
${JSON.stringify(videoContexts, null, 2)}
`;

  const attempts = [
    {
      name: "Google AI Studio Gemini 3.8 Flash (v1beta)",
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`,
    },
    {
      name: "Google AI Studio Gemini 3.7 Flash (v1beta)",
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=${apiKey}`,
    },
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

function parseTimestampToSeconds(ts?: string): number {
  if (!ts) return 60;
  const parts = ts.split(":").map((p) => parseInt(p, 10));
  if (parts.some(isNaN)) return 60;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 60;
}

function generateDeterministicDigest(videoContexts: any[], lang: string): string {
  const isSpanish = lang === "es";
  const formalIntro = isSpanish
    ? "Estimados asociados de HIVEX: Presentamos la síntesis de alertas y dinámicas de mercado detectadas en la videoteca durante las últimas 24 horas, orientadas a proteger capital y detectar ventajas tácticas."
    : "Dear HIVEX Associates: We present the synthesized analysis of market alerts and dynamics detected in the video library over the last 24 hours, aimed at capital protection and tactical advantage.";

  let output = `🚨 HIVEX Alerts - 24H\n---\n\n${formalIntro}\n\n`;
  const label = isSpanish ? "ALERTA" : "ALERT";

  videoContexts.forEach((video, idx) => {
    const keyAnalysisText = extractKeyAnalysis(video.content);
    const hasCharts = video.charts && video.charts.trim().length > 0 && !video.charts.toLowerCase().includes("no se detectaron");
    const videoTitle = video.title.replace(/^[🚨\s\*]+|[🚨\s\*]+$/g, "").trim();

    output += `🚨 ${label} ${idx + 1}: ${cleanHeadline(video.title)}\n\n`;

    if (isSpanish) {
      output += `Análisis de mercado de alto impacto detectado en el canal de ${video.channel}. Se detalla un estudio exhaustivo sobre las tendencias recientes de los activos financieros y flujos de capital globales.\n\n`;
      output += `▫️ **El Incidente**: ${keyAnalysisText.slice(0, 160)}...\n`;
      output += `▫️ **Ventaja Inversora**: Se aconseja revisar detenidamente la liquidez del mercado y el panel en la cabina de HIVEX.\n\n`;

      if (hasCharts) {
        const tsMatch = video.charts.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
        const startSec = tsMatch ? parseTimestampToSeconds(tsMatch[1]) : 60;
        const endSec = startSec + 60;
        const chartTitle = `Gráfico Clave: ${videoTitle.slice(0, 45)}`;
        const boundedUrl = `https://hivex-backend.vercel.app/dashboard/videos?id=${video.id}&start=${startSec}&end=${endSec}&from=telegram`;
        const fullVideoUrl = `https://hivex-backend.vercel.app/dashboard/videos?id=${video.id}&from=telegram`;

        output += `🎬 **REPRODUCTOR INTEGRADO (CABINA DE ESTUDIO)**\n`;
        output += `🔗 [${chartTitle}](${boundedUrl})\n`;
        output += `![${chartTitle}](https://hivex-backend.vercel.app/snapshots/${video.id}/${startSec}.jpg)\n\n`;
        output += `🔗 [Vídeo Completo: ${videoTitle}](${fullVideoUrl})\n`;
        output += `![${videoTitle}](https://hivex-backend.vercel.app/snapshots/${video.id}/0.jpg)\n\n`;
      } else {
        const fullVideoUrl = `https://hivex-backend.vercel.app/dashboard/videos?id=${video.id}&from=telegram`;
        output += `🔗 [Vídeo Completo: ${videoTitle}](${fullVideoUrl})\n`;
        output += `![${videoTitle}](https://hivex-backend.vercel.app/snapshots/${video.id}/0.jpg)\n\n`;
      }
    } else {
      output += `High-impact market analysis detected on the ${video.channel} channel. A comprehensive study on recent financial asset trends and global capital flows is detailed inside.\n\n`;
      output += `▫️ **The Incident**: ${keyAnalysisText.slice(0, 160)}...\n`;
      output += `▫️ **Investor Advantage**: Careful review of market liquidity and the dashboard in the HIVEX cabin is advised.\n\n`;

      if (hasCharts) {
        const tsMatch = video.charts.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
        const startSec = tsMatch ? parseTimestampToSeconds(tsMatch[1]) : 60;
        const endSec = startSec + 60;
        const chartTitle = `Key Chart: ${videoTitle.slice(0, 45)}`;
        const boundedUrl = `https://hivex-backend.vercel.app/dashboard/videos?id=${video.id}&start=${startSec}&end=${endSec}&from=telegram`;
        const fullVideoUrl = `https://hivex-backend.vercel.app/dashboard/videos?id=${video.id}&from=telegram`;

        output += `🎬 **INTEGRATED PLAYER (STUDY CABIN)**\n`;
        output += `🔗 [${chartTitle}](${boundedUrl})\n`;
        output += `![${chartTitle}](https://hivex-backend.vercel.app/snapshots/${video.id}/${startSec}.jpg)\n\n`;
        output += `🔗 [Full Video: ${videoTitle}](${fullVideoUrl})\n`;
        output += `![${videoTitle}](https://hivex-backend.vercel.app/snapshots/${video.id}/0.jpg)\n\n`;
      } else {
        const fullVideoUrl = `https://hivex-backend.vercel.app/dashboard/videos?id=${video.id}&from=telegram`;
        output += `🔗 [Full Video: ${videoTitle}](${fullVideoUrl})\n`;
        output += `![${videoTitle}](https://hivex-backend.vercel.app/snapshots/${video.id}/0.jpg)\n\n`;
      }
    }
  });

  return output.trim();
}

