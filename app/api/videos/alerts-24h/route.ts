import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTelegramMessageWithPhotos, sendTelegramMessage, markdownToTelegramHtml, splitMarkdown, getTelegramLanguage } from "@/lib/telegram";

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

    console.log(`[Alerts Route] Starting daily alerts generation. (Language: ${lang}, dryRun: ${dryRun})`);

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

    // Query videos processed in the last 24 hours
    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    console.log(`[Alerts Route] Querying videos created on or after: ${cutoffDate}`);

    const { data: videos, error: videosError } = await supabaseAdmin
      .from("documents")
      .select("*")
      .eq("type", "video")
      .gte("created_at", cutoffDate)
      .order("created_at", { ascending: false });

    if (videosError) {
      console.error("[Alerts Route] Error querying videos:", videosError);
      throw new Error(`Database query failed: ${videosError.message}`);
    }

    // Filter out videos that have already been sent in an alert
    const unalertedVideos = (videos || []).filter((v) => {
      return !v.metadata?.alert_sent;
    });

    console.log(`[Alerts Route] Found ${videos?.length || 0} total videos in last 24h, of which ${unalertedVideos.length} have not been alerted.`);

    // Handle Empty State (No new videos to alert)
    if (unalertedVideos.length === 0) {
      console.log("[Alerts Route] No new unalerted videos found in the last 24 hours. Skipping Telegram notification.");
      
      const notifyEmpty = searchParams.get("notifyEmpty") === "true";
      if (notifyEmpty && !dryRun) {
        const emptyStateMessage = lang === "es"
          ? `🚨 <b>HIVEX Alerts - 24H</b>\n\nNo se han detectado nuevas alertas en las últimas 24 horas. Todos los vídeos recientes ya han sido procesados y comunicados.`
          : `🚨 <b>HIVEX Alerts - 24H</b>\n\nNo new market alerts detected in the last 24 hours. All recent videos have already been processed and communicated.`;
        await sendTelegramMessage(emptyStateMessage, customChatId || undefined);
      }

      return NextResponse.json({
        success: true,
        count: 0,
        message: "No new unalerted videos found. Telegram notification skipped.",
        markdown: lang === "es" 
          ? `🚨 HIVEX Alerts - 24H\n\nNo se han detectado nuevas alertas en las últimas 24 horas.` 
          : `🚨 HIVEX Alerts - 24H\n\nNo new market alerts detected in the last 24 hours.`,
      });
    }

    // Batch query associated documents (knowledge_analysis, knowledge_summary, knowledge_charts)
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
      let contentType = "Análisis Completo";

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
      console.log("[Alerts Route] Converting alerts report to Telegram multimedia messages and sending...");
      const delimiter = "🚨 ";
      
      // Split the generated markdown into separate segments using positive lookahead
      const parts = reportMarkdown.split(new RegExp(`(?=${delimiter})`, "g")).filter(p => p.trim());
      
      if (parts.length > 1) {
        // First part is the header: "🚨 HIVEX Alerts - 24H\n---\n\n"
        const hasHeader = parts[0].includes("HIVEX Alerts");
        const startIndex = hasHeader ? 1 : 0;

        if (hasHeader && parts[0].trim()) {
          console.log(`[Alerts Route] Dispatching Header to Telegram...`);
          const headerHtml = markdownToTelegramHtml(parts[0].trim());
          await sendTelegramMessage(headerHtml, customChatId || undefined);
        }

        for (let i = startIndex; i < parts.length; i++) {
          const alertMarkdown = parts[i].trim();
          if (alertMarkdown) {
            if (i > startIndex) {
              await new Promise((resolve) => setTimeout(resolve, 800));
            }
            console.log(`[Alerts Route] Dispatching Alert ${i + 1 - startIndex} with photo/multimedia to Telegram...`);
            await sendTelegramMessageWithPhotos(alertMarkdown, customChatId || undefined);
          }
        }
      } else {
        // Fallback to sending as a single multimedia message
        await sendTelegramMessageWithPhotos(reportMarkdown, customChatId || undefined);
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
    ? `Eres un editor de noticias financieras de élite y un estratega bursátil en HIVEX. Tu tarea es generar un informe unificado en español titulado exactamente "🚨 HIVEX Alerts - 24H" que recopile todas las alertas oportunas de la videoteca desde la perspectiva de un inversor astuto y premium.
  
Debes enfocar este reporte estrictamente en:
- Aspectos de importancia, urgencia o carácter atípico de los flujos de mercado y tendencias geopolíticas/macroeconómicas.
- Ofrecer una ventaja inversora clara y asertiva que beneficie a nuestros asociados del canal.

Sigue ESTRICTAMENTE las siguientes reglas de formato y diseño (5 Reglas de Oro inquebrantables de HIVEX):
1. El boletín debe iniciarse exactamente con el siguiente encabezado y una brevisima presentación formal del inversor (REGLA 1):
🚨 HIVEX Alerts - 24H
---

[Un párrafo de presentación formal del inversor de HIVEX extremadamente corto, sobrio, directo, conciso y premium (de 1 a 2 líneas, máximo 30-40 palabras) que exponga con claridad el propósito de las alertas presentadas hoy, sirviendo como preámbulo formal al inicio absoluto de la comunicación antes de cualquier alerta.]

2. Cada vídeo debe presentarse con la estructura de ALERTA premium descrita a continuación. Deja un doble salto de línea entre cada sección de la alerta para mantener un formato limpio. Está TERMINANTEMENTE PROHIBIDO anteponer etiquetas secuenciales como "ALERTA [numero]" o "ALERTA:":

🚨 [Título de Impacto en Mayúsculas]

[Párrafo narrativo integrado de 3 a 5 líneas. Flujo de redacción fluido, sumamente premium, asertivo y de alto nivel, que sintetiza la tesis central del ponente, la urgencia de la situación macroeconómica y el evento de mercado detectado. No utilices subtítulos intermedios rígidos.]

▫️ **El Incidente**: [Dato cuantitativo preciso, porcentaje, precio, nivel técnico de soporte/resistencia, o anomalía detectada.]
▫️ **Ventaja Inversora**: [La implicación táctica directa, oportunidad de arbitraje o cobertura defensiva recomendada para obtener beneficio.]

🎬 **REPRODUCTOR INTEGRADO (CABINA DE ESTUDIO)**
🔗 [{cleanChartTitle}](https://hivex-backend.vercel.app/dashboard/videos?id={videoId}&start={startSeconds}&end={endSeconds}&from=telegram)
![{cleanChartTitle}](https://hivex-backend.vercel.app/snapshots/{videoId}/{startSeconds}.jpg)

🔗 [Vídeo Completo: {videoTitle}](https://hivex-backend.vercel.app/dashboard/videos?id={videoId}&from=telegram)
![{videoTitle}](https://hivex-backend.vercel.app/snapshots/{videoId}/0.jpg)

REGLAS CRÍTICAS DE MAQUETACIÓN Y SINTAXIS (CUMPLIMIENTO OBLIGATORIO):
- En la primera alerta, el título "🚨 HIVEX Alerts - 24H" debe ir seguido inmediatamente por la línea de separación "---", la breve presentación formal, y un espacio en blanco antes de la primera alerta. No agregues firmas ni notas explicativas.
- Deja una línea en blanco completa (doble salto de línea) entre cada una de las secciones de la alerta para mantener el diseño premium y aireado.
- PROHIBICIÓN ABSOLUTA DE ENLACES A YOUTUBE: Está terminantemente prohibido incluir enlaces a "youtube.com" o "youtu.be" en el cuerpo de texto del mensaje. El único hipervínculo que debe aparecer para el vídeo es el enlace de la cabina de HIVEX.
- PROHIBICIÓN DE OTROS SÍMBOLOS O VIÑETAS EN ENLACES: Las líneas de "🎬 **REPRODUCTOR INTEGRADO (CABINA DE ESTUDIO)**" y "🔗" NO deben comenzar con viñetas de asteriscos, guiones ni puntos de lista. Devuelven líneas de texto independientes y limpias.
- PROHIBICIÓN DE COMILLAS INVERTIDAS: No utilices comillas invertidas (\`) ni bloques de código para envolver los títulos o las URLs.
- REGLA 3 & REGLA 4 PARA LA CABINA DE ESTUDIO (GRÁFICOS / CHARTS):
  - Si el vídeo tiene gráficos detectados en el campo "charts":
    1. Busca la marca de tiempo exacta del gráfico en el campo "charts" (ej. "04:15") y conviértela a segundos enteros ({startSeconds}). ESTÁ TERMINANTEMENTE PROHIBIDO inventar marcas de tiempo o extraer segundos arbitrarios si no existe un gráfico real detectado.
    2. Suma siempre 60 segundos para obtener {endSeconds}.
    3. Extrae el título limpio, descriptivo y representativo del gráfico {cleanChartTitle} (ej. "Curva de Tipos 10A vs 2A", "Flujos Globales de Liquidez"). ESTÁ TERMINANTEMENTE PROHIBIDO usar textos genéricos como "Abrir Escena", "Ver gráfico", "Hacer clic aquí" o URLs en crudo.
    4. Estructura la sección de la cabina de estudio con la jerarquía exacta de 4 pasos (pegando cada captura a su enlace correspondiente):
       🎬 **REPRODUCTOR INTEGRADO (CABINA DE ESTUDIO)**
       🔗 [{cleanChartTitle}](https://hivex-backend.vercel.app/dashboard/videos?id={videoId}&start={startSeconds}&end={endSeconds}&from=telegram)
       ![{cleanChartTitle}](https://hivex-backend.vercel.app/snapshots/{videoId}/{startSeconds}.jpg)

       🔗 [Vídeo Completo: {videoTitle}](https://hivex-backend.vercel.app/dashboard/videos?id={videoId}&from=telegram)
       ![{videoTitle}](https://hivex-backend.vercel.app/snapshots/{videoId}/0.jpg)
  - Si en el campo "charts" de un vídeo no se detectó ningún gráfico (o el campo está vacío o indica que no hay gráficos):
    NO agregues la cabecera "🎬 **REPRODUCTOR INTEGRADO (CABINA DE ESTUDIO)**", ni el enlace del gráfico acotado, ni ninguna captura de fragmento. Incluye ÚNICAMENTE la línea del vídeo completo y su carátula:
    🔗 [Vídeo Completo: {videoTitle}](https://hivex-backend.vercel.app/dashboard/videos?id={videoId}&from=telegram)
    ![{videoTitle}](https://hivex-backend.vercel.app/snapshots/{videoId}/0.jpg)

3. PROHIBICIÓN ABSOLUTA DE METANARRATIVA, PASOS DE AUTO-CORRECCIÓN Y REVISIONES DE IA: No escribas borradores, explicaciones, notas, listas de cumplimiento, ni textos de autocomprobación. El informe debe terminar de forma limpia y directa inmediatamente después del último enlace de la última alerta.
4. Genera únicamente Markdown estándar. No utilices etiquetas HTML en absoluto.
5. Redacta todo el informe en español de alta gama profesional.

Aquí tienes los datos de los vídeos sincronizados para sintetizar:
${JSON.stringify(videoContexts, null, 2)}
`
    : `You are an elite financial news editor and a market strategist at HIVEX. Your task is to generate a unified English report titled exactly "🚨 HIVEX Alerts - 24H" summarizing all timely alerts from the video library from the perspective of an astute and premium investor.
  
You must focus this report strictly on:
- Matters of significance, urgency, or unusual market flows and geopolitical/macroeconomic trends.
- Offering a clear, assertive investment edge that benefits our channel associates.

STRICTLY follow the formatting and style rules below (HIVEX 5 Unbending Golden Rules):
1. The newsletter must start exactly with the following header and an extremely short formal investor presentation (RULE 1):
🚨 HIVEX Alerts - 24H
---

[A formal investor presentation paragraph that is extremely short, sober, direct, concise, and premium (1 to 2 lines, maximum 30-40 words) clearly setting out the purpose of the alerts presented today, serving as the formal opening of the communication before any alert.]

2. Each video must be presented with the premium ALERT structure described below. Leave a double newline between each section of the alert to maintain a clean layout. DO NOT prepend sequential labels like "ALERT [number]" or "ALERT:":

🚨 [Impact Title in Uppercase]

[Narrative integrated paragraph of 3 to 5 lines. Fluid, highly premium, assertive, and high-level writing style synthesizing the speaker's core thesis, the urgency of the macroeconomic situation, and the detected market event. Do not use rigid subheaders.]

▫️ **The Incident**: [Precise quantitative data, percentage, price, technical support/resistance level, or anomaly detected.]
▫️ **Investor Advantage**: [The direct tactical implication, arbitrage opportunity, or defensive hedge recommended to capture benefit.]

🎬 **INTEGRATED PLAYER (STUDY CABIN)**
🔗 [{cleanChartTitle}](https://hivex-backend.vercel.app/dashboard/videos?id={videoId}&start={startSeconds}&end={endSeconds}&from=telegram)
![{cleanChartTitle}](https://hivex-backend.vercel.app/snapshots/{videoId}/{startSeconds}.jpg)

🔗 [Full Video: {videoTitle}](https://hivex-backend.vercel.app/dashboard/videos?id={videoId}&from=telegram)
![{videoTitle}](https://hivex-backend.vercel.app/snapshots/{videoId}/0.jpg)

CRITICAL LAYOUT AND SYNTAX RULES (MANDATORY COMPLIANCE):
- In the first alert, the main title "🚨 HIVEX Alerts - 24H" must be followed immediately by the separator line "---", the brief formal presentation, and a blank space before the first alert. No introductions, greetings, signatures, or notes.
- Leave a full blank line (double newline) between every section of the alert to keep the design premium and airy.
- ABSOLUTE PROHIBITION OF YOUTUBE LINKS: Do NOT include any links pointing to "youtube.com" or "youtu.be" inside the message text body. The only allowed URL is the public HIVEX dashboard URL.
- NO BULLETS ON LINKS OR HEADERS: The lines starting with "🎬 **INTEGRATED PLAYER (STUDY CABIN)**" and "🔗" MUST NOT start with bullets, asterisks, or hyphens. They must be clean, top-level text lines.
- NO BACKTICKS: Do NOT use backticks (\`) anywhere around the titles, markdown links, or URLs.
- RULE 3 & RULE 4 FOR THE STUDY CABIN (CHARTS):
  - If the video has charts in the "charts" field:
    1. Look up the exact chart timestamp in the "charts" field (e.g. "04:15") and convert it to integer seconds ({startSeconds}). It is STRICTLY FORBIDDEN to invent timestamps or pick arbitrary seconds if no actual chart was detected.
    2. Always add 60 seconds to obtain {endSeconds}.
    3. Extract a clean, descriptive, and representative chart title {cleanChartTitle} (e.g. "10Y vs 2Y Yield Curve", "Global Liquidity Flows"). STRICTLY FORBIDDEN to use generic link texts such as "Open Scene", "View Chart", "Click here", or raw URLs.
    4. Structure the cabin section with the mandatory 4-step hierarchy (gluing each snapshot to its companion link):
       🎬 **INTEGRATED PLAYER (STUDY CABIN)**
       🔗 [{cleanChartTitle}](https://hivex-backend.vercel.app/dashboard/videos?id={videoId}&start={startSeconds}&end={endSeconds}&from=telegram)
       ![{cleanChartTitle}](https://hivex-backend.vercel.app/snapshots/{videoId}/{startSeconds}.jpg)

       🔗 [Full Video: {videoTitle}](https://hivex-backend.vercel.app/dashboard/videos?id={videoId}&from=telegram)
       ![{videoTitle}](https://hivex-backend.vercel.app/snapshots/{videoId}/0.jpg)
  - If no chart was detected in the "charts" field (field is empty or indicates no charts):
    Do NOT include the "🎬 **INTEGRATED PLAYER (STUDY CABIN)**" heading, nor the short bounded link, nor any clip snapshot. Include ONLY the full video link and its cover:
    🔗 [Full Video: {videoTitle}](https://hivex-backend.vercel.app/dashboard/videos?id={videoId}&from=telegram)
    ![{videoTitle}](https://hivex-backend.vercel.app/snapshots/{videoId}/0.jpg)

3. ABSOLUTE PROHIBITION OF METANARRATIVE, SELF-CORRECTION STEPS, AND AI REVIEWS: Do not write drafts, explanations, notes, or checklists. The report must end cleanly right after the last link of the last alert.
4. Generate ONLY standard Markdown. Do not use HTML tags at all.
5. Write the entire report in premium professional English.

Here is the data of the synchronized videos to synthesize:
${JSON.stringify(videoContexts, null, 2)}
`;

  const attempts = [
    {
      name: "Gemini 3.8 Flash (v1beta)",
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`,
    },
    {
      name: "Gemini 3.7 Flash (v1beta)",
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=${apiKey}`,
    },
    {
      name: "Gemini 3.6 Flash (v1beta)",
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
    },
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

function parseTimestampToSeconds(ts?: string): number {
  if (!ts) return 60;
  const parts = ts.split(":").map((p) => parseInt(p, 10));
  if (parts.some(isNaN)) return 60;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 60;
}

function generateDeterministicAlerts(videoContexts: any[], lang: string): string {
  const isSpanish = lang === "es";
  const formalIntro = isSpanish
    ? "Estimados asociados de HIVEX: Presentamos la selección de alertas bursátiles detectadas en las últimas horas, orientadas a identificar anomalías y optimizar posiciones tácticas."
    : "Dear HIVEX Associates: We present the selection of market alerts detected over recent hours, aimed at pinpointing anomalies and optimizing tactical positions.";

  let output = `🚨 HIVEX Alerts - 24H\n---\n\n${formalIntro}\n\n`;

  videoContexts.forEach((video) => {
    output += `🚨 ${video.title.toUpperCase()}\n\n`;

    const hasCharts = Array.isArray(video.charts) && video.charts.length > 0;
    const firstChart = hasCharts ? video.charts[0] : null;
    const startSec = firstChart ? parseTimestampToSeconds(firstChart.timestamp) : 60;
    const endSec = startSec + 60;

    if (isSpanish) {
      const fullVideoUrl = `https://hivex-backend.vercel.app/dashboard/videos?id=${video.id}&from=telegram`;

      output += `Análisis macroeconómico de alto impacto detectado en el canal de ${video.channel}. Se detalla un estudio exhaustivo sobre las tendencias recientes de los activos financieros y flujos de capital globales.\n\n`;
      output += `▫️ **El Incidente**: Movimientos de volumen atípicos o catalizadores geopolíticos bajo análisis activo en la cabina de estudio.\n`;
      output += `▫️ **Ventaja Inversora**: Se aconseja revisar los flujos de liquidez y realizar seguimiento de los niveles marcados en el gráfico para capturar ventajas operativas.\n\n`;

      if (firstChart) {
        const startSec = parseTimestampToSeconds(firstChart.timestamp);
        const endSec = startSec + 60;
        const chartTitle = firstChart.title || `Gráfico de Análisis: ${video.title}`;
        const boundedUrl = `https://hivex-backend.vercel.app/dashboard/videos?id=${video.id}&start=${startSec}&end=${endSec}&from=telegram`;

        output += `🎬 **REPRODUCTOR INTEGRADO (CABINA DE ESTUDIO)**\n`;
        output += `🔗 [${chartTitle}](${boundedUrl})\n`;
        output += `![${chartTitle}](https://hivex-backend.vercel.app/snapshots/${video.id}/${startSec}.jpg)\n\n`;
      }

      output += `🔗 [Vídeo Completo: ${video.title}](${fullVideoUrl})\n`;
      output += `![${video.title}](https://hivex-backend.vercel.app/snapshots/${video.id}/0.jpg)\n\n`;
    } else {
      const fullVideoUrl = `https://hivex-backend.vercel.app/dashboard/videos?id=${video.id}&from=telegram`;

      output += `High-impact macroeconomic analysis detected on the ${video.channel} channel. A comprehensive study on recent financial asset trends and global capital flows is detailed inside.\n\n`;
      output += `▫️ **The Incident**: Unusual volume movements or geopolitical catalysts under active analysis in the study cabin.\n`;
      output += `▫️ **Investor Advantage**: Careful review of liquidity flows and tracking levels marked in the chart is advised to capture operational advantages.\n\n`;

      if (firstChart) {
        const startSec = parseTimestampToSeconds(firstChart.timestamp);
        const endSec = startSec + 60;
        const chartTitle = firstChart.title || `Analysis Chart: ${video.title}`;
        const boundedUrl = `https://hivex-backend.vercel.app/dashboard/videos?id=${video.id}&start=${startSec}&end=${endSec}&from=telegram`;

        output += `🎬 **INTEGRATED PLAYER (STUDY CABIN)**\n`;
        output += `🔗 [${chartTitle}](${boundedUrl})\n`;
        output += `![${chartTitle}](https://hivex-backend.vercel.app/snapshots/${video.id}/${startSec}.jpg)\n\n`;
      }

      output += `🔗 [Full Video: ${video.title}](${fullVideoUrl})\n`;
      output += `![${video.title}](https://hivex-backend.vercel.app/snapshots/${video.id}/0.jpg)\n\n`;
    }
  });

  return output.trim();
}
