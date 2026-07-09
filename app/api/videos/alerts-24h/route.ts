import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTelegramMessage, markdownToTelegramHtml, splitMarkdown } from "@/lib/telegram";

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

    // Parse parameters (default to 24 hours, Spanish, and production chat)
    let hours = 24;
    let dryRun = false;
    let customChatId = "";

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
    } catch (urlErr) {
      console.warn("[Alerts Route] Failed to parse query params:", urlErr);
    }

    console.log(`[Alerts Route] Starting daily alerts generation (24h) in Spanish. (dryRun: ${dryRun})`);

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

    // Query videos from the last X hours
    const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    console.log(`[Alerts Route] Querying video documents created on or after: ${cutoffDate}`);

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

    // Handle Empty State (No videos in the last 24 hours)
    if (!videos || videos.length === 0) {
      console.log(`[Alerts Route] No videos found in the last ${hours} hours.`);
      
      const emptyStateMessage = `🚨 <b>HIVEX Alerts - 24H</b>\n\nNo se han detectado nuevos análisis de vídeo o alertas críticas en las últimas 24 horas. La cabina de estudio se mantiene al día y monitorizando el mercado en tiempo real.`;
      
      if (!dryRun) {
        await sendTelegramMessage(emptyStateMessage, customChatId || undefined);
      }

      return NextResponse.json({
        success: true,
        count: 0,
        message: `No videos analyzed in the last ${hours} hours. Empty state notification dispatched.`,
        markdown: `🚨 HIVEX Alerts - 24H\n\nNo se han detectado nuevos análisis de vídeo o alertas críticas en las últimas 24 horas. La cabina de estudio se mantiene al día y monitorizando el mercado en tiempo real.`,
      });
    }

    console.log(`[Alerts Route] Found ${videos.length} videos. Fetching associated analyses, summaries, and charts...`);

    // Batch query associated documents
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

      analyses = analysesRes.data || [];
      summaries = summariesRes.data || [];
      charts = chartsRes.data || [];
    }

    // Structure video contexts
    const videoContexts = videos.map((video) => {
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
      reportMarkdown = await generateSynthesizedAlerts(videoContexts);
      console.log("[Alerts Route] Synthesis completed successfully.");
    } catch (geminiErr: any) {
      console.warn("[Alerts Route] Gemini API synthesis failed, falling back to deterministic:", geminiErr?.message || geminiErr);
      reportMarkdown = generateDeterministicAlerts(videoContexts);
    }

    // Deliver to Telegram (unless dryRun)
    if (!dryRun) {
      console.log("[Alerts Route] Converting alerts report to Telegram HTML and sending...");
      const delimiter = "🚨 ALERTA ";
      
      // Split the generated markdown into separate alert segments using positive lookahead
      const parts = reportMarkdown.split(new RegExp(`(?=${delimiter}\\d+)`, "g"));
      
      if (parts.length > 1) {
        const header = parts[0].trim() ? parts[0].trim() + "\n\n" : "";
        const firstAlertMarkdown = header + parts[1].trim();
        const firstAlertHtml = markdownToTelegramHtml(firstAlertMarkdown);
        
        console.log(`[Alerts Route] Dispatching Alert 1 to Telegram...`);
        await sendTelegramMessage(firstAlertHtml, customChatId || undefined);
        
        // Dispatch subsequent alerts chronologically with delay
        for (let i = 2; i < parts.length; i++) {
          const alertMarkdown = parts[i].trim();
          if (alertMarkdown) {
            const alertHtml = markdownToTelegramHtml(alertMarkdown);
            await new Promise((resolve) => setTimeout(resolve, 800));
            console.log(`[Alerts Route] Dispatching Alert ${i} to Telegram...`);
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
      console.log("[Alerts Route] Alerts delivered successfully to Telegram.");
    } else {
      console.log("[Alerts Route] Dry-run enabled. Skipping Telegram delivery.");
    }

    return NextResponse.json({
      success: true,
      count: videos.length,
      message: dryRun
        ? "Alerts generated successfully (Dry Run - No Telegram dispatch)."
        : "Alerts generated and delivered to Telegram successfully.",
      markdown: reportMarkdown,
      videos: videos.map((v) => ({ id: v.id, title: v.title, created_at: v.created_at })),
    });
  } catch (error: any) {
    console.error("[Alerts Route] Critical failure:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Unexpected failure in alerts route." },
      { status: 500 }
    );
  }
}

async function generateSynthesizedAlerts(videoContexts: any[]): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY.");
  }

  const systemInstruction = `You are an elite financial news editor and investment analyst. Your task is to synthesize a daily premium investment news digest in Spanish based on analyzed video materials, replicating a clean, high-impact, narrative-driven format. Always output standard Markdown without HTML tags.`;

  const promptText = `Eres un editor de noticias financieras de élite y un estratega bursátil en HIVEX. Tu tarea es generar un informe unificado en español titulado exactamente "🚨 HIVEX Alerts - 24H" que recopile todas las alertas oportunas de las últimas 24 horas desde la perspectiva de un inversor astuto.
  
Debes enfocar este reporte estrictamente en:
- Aspectos de importancia, urgencia o carácter atípico de los flujos de mercado y tendencias geopolíticas/macroeconómicas.
- Ofrecer una ventaja inversora clara y asertiva que beneficie a nuestros asociados del canal.

Sigue ESTRICTAMENTE las siguientes reglas de formato y diseño:
1. El título principal del boletín debe ser exactamente:
🚨 HIVEX Alerts - 24H
---

2. Cada vídeo analizado debe presentarse con la estructura de ALERTA premium descrita a continuación. Deja un doble salto de línea entre cada sección de la alerta para mantener un formato limpio:

🚨 ALERTA [Número]: [Título de Impacto en Mayúsculas]

[Párrafo narrativo integrado de 3 a 5 líneas. Flujo editorial extremadamente premium, asertivo y de alto nivel, que sintetiza la tesis central del ponente, la urgencia de la situación macroeconómica y el evento detectado. Sin títulos intermedios rígidos.]

▫️ **El Incidente**: [Dato preciso, porcentaje, precio, nivel técnico de soporte/resistencia, o anomalía cuantitativa detectada.]
▫️ **Ventaja Inversora**: [La implicación táctica directa, oportunidad de arbitraje o cobertura defensiva recomendada para obtener beneficio.]

🎬 **REPRODUCTOR INTEGRADO (CABINA DE ESTUDIO)**
🔗 [Abrir Escena del Gráfico en la Cabina de HIVEX](https://hivex-backend.vercel.app/share/{videoId}?start={startSeconds}&end={endSeconds})
🔗 [Vídeo Completo: {videoTitle}](https://hivex-backend.vercel.app/share/{videoId})

REGLAS CRÍTICAS DE MAQUETACIÓN Y SINTAXIS (CUMPLIMIENTO OBLIGATORIO):
- En la primera alerta, el título "🚨 HIVEX Alerts - 24H" debe ir seguido inmediatamente por la línea de separación "---", y un espacio en blanco antes de "🚨 ALERTA 1:".
- Deja una línea en blanco completa (doble salto de línea) entre cada una de las secciones de la alerta para mantener el diseño premium y aireado.
- PROHIBICIÓN ABSOLUTA DE ENLACES A YOUTUBE: Está terminantemente prohibido incluir enlaces a "youtube.com" o "youtu.be" en el cuerpo de texto del mensaje. El único hipervínculo que debe aparecer para el vídeo es el enlace público "/share/" de HIVEX.
- PROHIBICIÓN DE OTROS SÍMBOLOS O VIÑETAS EN ENLACES: Las líneas de "🎬 **REPRODUCTOR INTEGRADO (CABINA DE ESTUDIO)**" y "🔗" NO deben comenzar con viñetas de asteriscos, guiones ni puntos de lista. Devuelven líneas de texto independientes y limpias.
- PROHIBICIÓN DE COMILLAS INVERTIDAS: No utilices comillas invertidas (\`) ni bloques de código para envolver los títulos o las URLs.
- REGLA PARA CALCULAR {startSeconds} Y {endSeconds}:
  1. Busca cualquier marca de tiempo de gráfico en el campo "charts" (ej. "04:15") y conviértela a segundos enteros (4 * 60 + 15 = 255). Si no hay marcas, usa 0. Ese es {startSeconds}.
  2. Suma siempre 60 segundos para obtener {endSeconds} (ej. si start es 255, end es 315).
- Para "🔗 [Abrir Escena del Gráfico en la Cabina de HIVEX](...)": Genera un link markdown directo apuntando a la ruta de compartir de HIVEX inyectando el {videoId} real (su UUID en HIVEX) y los parámetros de tiempo de inicio ({startSeconds}) y fin ({endSeconds}) calculados en la URL de "/share/".
- Para "🔗 [Vídeo Completo: {videoTitle}](...)": Añade obligatoriamente este segundo enlace apuntando al vídeo completo sin parámetros de tiempo utilizando el título real del vídeo (propiedad "title" del objeto de datos) como el texto del enlace {videoTitle} y "/share/{videoId}" como URL.

3. PROHIBICIÓN DE NOTAS, COMENTARIOS DE IA O TABLAS: No escribas borradores, explicaciones ni notas. Comienza directamente con "🚨 HIVEX Alerts - 24H" y continúa inmediatamente con la línea de separación "---".
4. Genera únicamente Markdown estándar. No utilices etiquetas HTML en absoluto.
5. Redacta todo el informe en español de alta gama profesional.

Aquí tienes los datos de los vídeos sincronizados en las últimas 24 horas para sintetizar:
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
        generationConfig: { temperature: 0.15, maxOutputTokens: 8192 },
      };

      const response = await fetch(attempt.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

function generateDeterministicAlerts(videoContexts: any[]): string {
  let output = "🚨 HIVEX Alerts - 24H\n---\n\n";

  videoContexts.forEach((video, idx) => {
    const shareUrl = `https://hivex-backend.vercel.app/share/${video.id}?start=0&end=60`;
    output += `🚨 ALERTA ${idx + 1}: ${video.title.toUpperCase()}\n\n`;
    output += `Análisis macroeconómico de alto impacto detectado en el canal de ${video.channel}. Se detalla un estudio exhaustivo sobre las tendencias recientes de los activos financieros y flujos de capital globales.\n\n`;
    output += `▫️ **El Incidente**: Movimientos de volumen atípicos o catalizadores geopolíticos bajo análisis activo en la cabina de estudio.\n`;
    output += `▫️ **Ventaja Inversora**: Se aconseja revisar los flujos de liquidez y realizar seguimiento de los niveles marcados en el gráfico para capturar ventajas operativas.\n\n`;
    output += `🎬 **REPRODUCTOR INTEGRADO (CABINA DE ESTUDIO)**\n`;
    output += `🔗 [Abrir Escena del Gráfico en la Cabina de HIVEX](${shareUrl})\n`;
    output += `🔗 [Vídeo Completo: ${video.title}](https://hivex-backend.vercel.app/share/${video.id})\n\n`;
  });

  return output.trim();
}
