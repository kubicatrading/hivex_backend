import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTelegramMessage, markdownToTelegramHtml, splitMarkdown } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleInvestors(request);
}

export async function POST(request: NextRequest) {
  return handleInvestors(request);
}

async function handleInvestors(request: NextRequest) {
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
      console.warn("[Investors Route] Failed to parse query params:", urlErr);
    }

    console.log(`[Investors Route] Starting tactical decisions generation in Spanish. (dryRun: ${dryRun})`);

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

    // Query videos from the last 24 hours (Priority context)
    const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    console.log(`[Investors Route] Querying priority videos created on or after: ${cutoffDate}`);

    const { data: priorityVideos, error: priorityVideosError } = await supabaseAdmin
      .from("documents")
      .select("*")
      .eq("type", "video")
      .gte("created_at", cutoffDate)
      .order("created_at", { ascending: false });

    if (priorityVideosError) {
      console.error("[Investors Route] Error querying priority videos:", priorityVideosError);
      throw new Error(`Database query failed: ${priorityVideosError.message}`);
    }

    // Handle Empty State (No new videos in the last 24 hours)
    if (!priorityVideos || priorityVideos.length === 0) {
      console.log(`[Investors Route] No new videos found in the last ${hours} hours.`);
      
      const emptyStateMessage = `🚨 <b>HIVEX Investors - 24H</b>\n\nNo hay nuevas decisiones tácticas de inversión recomendadas para hoy. La base de conocimiento se mantiene actualizada para su consulta en la cabina de estudio.`;
      
      if (!dryRun) {
        await sendTelegramMessage(emptyStateMessage, customChatId || undefined);
      }

      return NextResponse.json({
        success: true,
        count: 0,
        message: `No new videos analyzed in the last ${hours} hours. Empty state notification dispatched.`,
        markdown: `🚨 HIVEX Investors - 24H\n\nNo hay nuevas decisiones tácticas de inversión recomendadas para hoy. La base de conocimiento se mantiene actualizada para su consulta en la cabina de estudio.`,
      });
    }

    // Query historical videos (Up to 15 recent videos from before the 24h window for broader knowledge base context)
    console.log(`[Investors Route] Querying historical videos created before: ${cutoffDate}`);
    const { data: historicalVideos, error: historicalVideosError } = await supabaseAdmin
      .from("documents")
      .select("*")
      .eq("type", "video")
      .lt("created_at", cutoffDate)
      .order("created_at", { ascending: false })
      .limit(15);

    if (historicalVideosError) {
      console.warn("[Investors Route] Warning: Failed to query historical videos:", historicalVideosError);
    }

    const allVideos = [...priorityVideos, ...(historicalVideos || [])];
    console.log(`[Investors Route] Total videos gathered for analysis: ${allVideos.length} (${priorityVideos.length} priority, ${(historicalVideos || []).length} historical)`);

    // Batch query associated documents
    const fileUrls = allVideos.map((v) => v.file_url).filter(Boolean);
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
    const videoContexts = allVideos.map((video) => {
      const isPriority = new Date(video.created_at).getTime() >= new Date(cutoffDate).getTime();
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

      const maxLen = 3000; // slightly lower max length per video due to the large combined context
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
        contextType: isPriority ? "Prioritario (Últimas 24 Horas)" : "Histórico (Base de Conocimiento General)",
      };
    });

    // Synthesize investors report via Gemini
    let reportMarkdown = "";
    try {
      console.log("[Investors Route] Synthesizing premium tactical decisions using Gemini...");
      reportMarkdown = await generateSynthesizedInvestors(videoContexts);
      console.log("[Investors Route] Synthesis completed successfully.");
    } catch (geminiErr: any) {
      console.warn("[Investors Route] Gemini API synthesis failed, falling back to deterministic:", geminiErr?.message || geminiErr);
      reportMarkdown = generateDeterministicInvestors(priorityVideos);
    }

    // Deliver to Telegram (unless dryRun)
    if (!dryRun) {
      console.log("[Investors Route] Converting tactical report to Telegram HTML and sending...");
      const delimiter = "🚨 DECISIÓN ";
      
      const parts = reportMarkdown.split(new RegExp(`(?=${delimiter}\\d+)`, "g"));
      
      if (parts.length > 1) {
        const header = parts[0].trim() ? parts[0].trim() + "\n\n" : "";
        const firstDecisionMarkdown = header + parts[1].trim();
        const firstDecisionHtml = markdownToTelegramHtml(firstDecisionMarkdown);
        
        console.log(`[Investors Route] Dispatching Decision 1 to Telegram...`);
        await sendTelegramMessage(firstDecisionHtml, customChatId || undefined);
        
        // Dispatch subsequent decisions with delay
        for (let i = 2; i < parts.length; i++) {
          const decisionMarkdown = parts[i].trim();
          if (decisionMarkdown) {
            const decisionHtml = markdownToTelegramHtml(decisionMarkdown);
            await new Promise((resolve) => setTimeout(resolve, 800));
            console.log(`[Investors Route] Dispatching Decision ${i} to Telegram...`);
            await sendTelegramMessage(decisionHtml, customChatId || undefined);
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
      console.log("[Investors Route] Decisions delivered successfully to Telegram.");
    } else {
      console.log("[Investors Route] Dry-run enabled. Skipping Telegram delivery.");
    }

    return NextResponse.json({
      success: true,
      count: priorityVideos.length,
      message: dryRun
        ? "Investors report generated successfully (Dry Run - No Telegram dispatch)."
        : "Investors report generated and delivered to Telegram successfully.",
      markdown: reportMarkdown,
      videos: priorityVideos.map((v) => ({ id: v.id, title: v.title, created_at: v.created_at })),
    });
  } catch (error: any) {
    console.error("[Investors Route] Critical failure:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Unexpected failure in investors route." },
      { status: 500 }
    );
  }
}

async function generateSynthesizedInvestors(videoContexts: any[]): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY.");
  }

  const systemInstruction = `You are an elite financial news editor and investment analyst. Your task is to synthesize a daily premium investment news digest in Spanish based on analyzed video materials, replicating a clean, high-impact, narrative-driven format. Always output standard Markdown without HTML tags.`;

  const promptText = `Eres un estratega jefe de inversiones en HIVEX y un editor financiero de primer nivel. Tu tarea es generar un informe diario estratégico en español titulado exactamente "🚨 HIVEX Investors - 24H".
  
Este informe debe recopilar y proponer todas las DECISIONES TÁCTICAS DE INVERSIÓN recomendadas para nuestros asociados, basándote en la base de datos de análisis financieros de HIVEX.

Sigue ESTRICTAMENTE las siguientes reglas de priorización y síntesis:
- PRIORIDAD MÁXIMA: Analiza en primer lugar e integra las tesis de los vídeos marcados como "contextType: Prioritario (Últimas 24 Horas)". Estas actualizaciones son el foco central de las recomendaciones del día.
- CONTEXTO HISTÓRICO: Complementa y enriquece estas decisiones estratégicas utilizando el trasfondo, tesis previas o datos de los vídeos marcados como "contextType: Histórico (Base de Conocimiento General)". Úsalos para cruzar datos y dar profundidad macroeconómica al informe bursátil.

Sigue ESTRICTAMENTE las siguientes reglas de formato y diseño:
1. El boletín debe iniciarse exactamente con el siguiente encabezado y una brevisima presentación formal:
🚨 HIVEX Investors - 24H
---

[Un párrafo de presentación formal del inversor de HIVEX extremadamente corto, sobrio, directo y premium (de un párrafo breve de no más de una o dos líneas, máximo 30-40 palabras) que exponga con claridad el propósito de las decisiones tácticas presentadas hoy, sirviendo como preámbulo formal al inicio absoluto de la comunicación antes de cualquier decisión.]

2. Cada decisión táctica debe estructurarse de manera premium tal como se describe abajo. Deja un doble salto de línea entre cada bloque:

🚨 DECISIÓN [Número]: [Título de la Recomendación en Mayúsculas]

[Párrafo editorial integrado de 3 a 5 líneas. Debe ser asertivo, sofisticado y de alto impacto financiero. Resume la tesis macroeconómica, el movimiento táctico propuesto (ej. rotación de sectores, compra de cobertura o toma de beneficios) y el razonamiento cruzado de por qué se toma esta decisión hoy en base a la información reciente e histórica.]

▫️ **Acción Recomendada**: [Qué hacer exactamente en cartera: compra de activos físicos, arbitraje temporal, reducción de apalancamiento, etc.]
▫️ **Fronteras y Soporte**: [Rangos numéricos exactos, precios, niveles clave de soporte, resistencia, o plazos estimados que determinan la validez de la recomendación.]

🎬 **REPRODUCTOR INTEGRADO (CABINA DE ESTUDIO)**
🔗 [Abrir Escena del Gráfico en la Cabina de HIVEX](https://hivex-backend.vercel.app/share/{videoId}?start={startSeconds}&end={endSeconds})
🔗 [Vídeo Completo: {videoTitle}](https://hivex-backend.vercel.app/share/{videoId})

REGLAS CRÍTICAS DE MAQUETACIÓN Y SINTAXIS (CUMPLIMIENTO OBLIGATORIO):
- En la primera recomendación, el título "🚨 HIVEX Investors - 24H" debe ir seguido inmediatamente por la línea de separación "---", la breve presentación formal, y un espacio en blanco antes de "🚨 DECISIÓN 1:".
- Deja una línea en blanco completa (doble salto de línea) entre cada una de las secciones de la decisión para mantener un diseño premium y respirable.
- PROHIBICIÓN ABSOLUTA DE ENLACES A YOUTUBE: Está terminantemente prohibido incluir enlaces a "youtube.com" o "youtu.be" en el cuerpo de texto del mensaje. El único hipervínculo que debe aparecer para el vídeo es el enlace público "/share/" de HIVEX.
- PROHIBICIÓN DE OTROS SÍMBOLOS O VIÑETAS EN ENLACES: Las líneas de "🎬 **REPRODUCTOR INTEGRADO (CABINA DE ESTUDIO)**" y "🔗" NO deben comenzar con viñetas de asteriscos, guiones ni puntos de lista. Deben ser líneas de texto independientes y limpias.
- PROHIBICIÓN DE COMILLAS INVERTIDAS: No utilices comillas invertidas (\`) ni bloques de código para envolver los títulos o las URLs.
- REGLA PARA CALCULAR {startSeconds} Y {endSeconds}:
  1. Para los vídeos que sustentan la decisión, busca cualquier marca de tiempo de gráfico relevante en el campo "charts" (ej. "12:20" -> 740s) y conviértela a segundos enteros. Si no hay marcas, usa 0. Ese es {startSeconds}.
  2. Suma siempre 60 segundos para obtener {endSeconds} (ej. si start es 740, end es 800).
- Para "🔗 [Abrir Escena del Gráfico en la Cabina de HIVEX](...)": Genera el enlace de compartir público apuntando a la escena del vídeo de origen relevante inyectando el {videoId} real y los segundos calculados.
- Para "🔗 [Vídeo Completo: {videoTitle}](...)": Añade obligatoriamente este segundo enlace apuntando al vídeo completo sin parámetros de tiempo utilizando el título real del vídeo (propiedad "title" del objeto de datos) como el texto del enlace {videoTitle} y "/share/{videoId}" como URL.

3. PROHIBICIÓN DE NOTAS, COMENTARIOS DE IA O TABLAS: No escribas borradores, explicaciones ni notas. Comienza directamente con "🚨 HIVEX Investors - 24H" y continúa inmediatamente con la línea de separación "---".
4. Genera únicamente Markdown estándar. No utilices etiquetas HTML en absoluto.
5. Redacta todo el informe en español de alta fidelidad macroeconómica.

Aquí tienes los datos de la base de conocimiento de HIVEX para sintetizar:
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
      console.log(`[Investors Route] Attempting report generation using ${attempt.name}...`);

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
          console.log(`[Investors Route] Success using ${attempt.name}.`);
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
    throw new Error(`Failed to generate investors digest: ` + errorDetails.join("\n"));
  }
}

function generateDeterministicInvestors(priorityVideos: any[]): string {
  let output = "🚨 HIVEX Investors - 24H\n---\n\n";

  priorityVideos.forEach((video, idx) => {
    const shareUrl = `https://hivex-backend.vercel.app/share/${video.id}?start=0&end=60`;
    output += `🚨 DECISIÓN ${idx + 1}: ASIGNACIÓN DEFENSIVA - ${video.title.toUpperCase()}\n\n`;
    output += `Se ha analizado una tesis crítica sobre flujos globales. Integramos esta perspectiva con las pautas de liquidez históricas de HIVEX para estructurar una decisión adaptativa de capital.\n\n`;
    output += `▫️ **Acción Recomendada**: Priorizar la asignación defensiva en activos tangibles o sectores con flujos de caja predecibles libres de deuda de corto plazo.\n`;
    output += `▫️ **Fronteras y Soporte**: Niveles técnicos clave bajo estudio activo en la cabina. Vigilar la velocidad de la rotación sectorial.\n\n`;
    output += `🎬 **REPRODUCTOR INTEGRADO (CABINA DE ESTUDIO)**\n`;
    output += `🔗 [Abrir Escena del Gráfico en la Cabina de HIVEX](${shareUrl})\n`;
    output += `🔗 [Vídeo Completo: ${video.title}](https://hivex-backend.vercel.app/share/${video.id})\n\n`;
  });

  return output.trim();
}
