import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabase as defaultSupabase, isUsingMock } from "@/lib/supabase";
import { sendTelegramMessageWithPhotos } from "@/lib/telegram";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, history = [], useInternet = false, localDocuments = [] } = body;

    if (!message) {
      return NextResponse.json({ error: "Mensaje no proporcionado" }, { status: 400 });
    }

    // 1. Authenticate user using Authorization header Bearer token
    const authHeader = request.headers.get("Authorization");
    const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null;

    let userId = null;
    let userEmail = null;
    let supabaseClient = defaultSupabase;

    const supabaseUrl = process.env.SUPABASE_PRODUCTION_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_PRODUCTION_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!isUsingMock && supabaseUrl) {
      if (token) {
        try {
          const tempAdmin = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey!, {
            auth: { persistSession: false }
          });
          const { data: { user }, error: authErr } = await tempAdmin.auth.getUser(token);
          if (!authErr && user) {
            userId = user.id;
            userEmail = user.email;
            supabaseClient = createClient(supabaseUrl, supabaseAnonKey!, {
              global: {
                headers: { Authorization: `Bearer ${token}` }
              }
            });
          }
        } catch (authException) {
          console.error("[Assistant API] Authentication check failed:", authException);
        }
      }
    }

    // 2. Fetch all documents for the authenticated user (or fetch all in mock mode)
    let allDocs: any[] = [];
    try {
      if (isUsingMock) {
        if (localDocuments && localDocuments.length > 0) {
          allDocs = localDocuments;
        } else {
          const { data, error } = await defaultSupabase
            .from("documents")
            .select("*")
            .neq("type", "knowledge_transcription");
          if (!error && data) {
            allDocs = data;
          }
        }
      } else if (userId) {
        const { data, error } = await supabaseClient
          .from("documents")
          .select("*")
          .neq("type", "knowledge_transcription");
        if (!error && data) {
          allDocs = data;
        } else if (error) {
          console.warn("[Assistant API] Supabase fetch error:", error);
        }
      }
    } catch (dbErr) {
      console.error("[Assistant API] Database query failure:", dbErr);
    }

    // 3. Consolidate and structure the knowledge base
    const videos = allDocs.filter(d => d.type === "video");
    const transcriptions = allDocs.filter(d => d.type === "knowledge_transcription");
    const summaries = allDocs.filter(d => d.type === "knowledge_summary");
    const chartsList = allDocs.filter(d => d.type === "knowledge_charts");
    const analyses = allDocs.filter(d => d.type === "knowledge_analysis");

    // Group study assets by their file_url
    const consolidatedKnowledge = videos.map(video => {
      const videoUrl = video.file_url;
      const transcriptionDoc = transcriptions.find(t => t.file_url === videoUrl);
      const summaryDoc = summaries.find(s => s.file_url === videoUrl);
      const chartsDoc = chartsList.find(c => c.file_url === videoUrl);
      const analysisDoc = analyses.find(a => a.file_url === videoUrl);

      return {
        id: video.id,
        title: video.title,
        description: video.description || "",
        channel: video.metadata?.channel_title || "Andrei Jikh",
        publishedAt: video.metadata?.published_at || video.created_at,
        fileUrl: videoUrl,
        transcription: "[La transcripción literal de este vídeo está disponible en la plataforma HIVEX. Usa el resumen, gráficos e informe de análisis para responder de forma precisa]",
        summary: summaryDoc?.metadata?.resumen_markdown || summaryDoc?.metadata?.summary || "",
        charts: chartsDoc?.metadata?.graficos_markdown || chartsDoc?.metadata?.charts || "",
        analysis: analysisDoc?.metadata?.informe_completo || analysisDoc?.metadata?.report || ""
      };
    });

    // Compute statistics for platform help questions
    const totalVideos = videos.length;
    const channelsCount = videos.reduce((acc: Record<string, number>, v) => {
      const ch = v.metadata?.channel_title || "Andrei Jikh";
      acc[ch] = (acc[ch] || 0) + 1;
      return acc;
    }, {});

    const statsContext = {
      plataforma: "HIVEX SaaS",
      detallesPlataforma: "HIVEX es una plataforma premium e integral de estudio para inversores bursátiles y traders. Permite la sincronización en tiempo real de feeds de vídeo de YouTube de canales analíticos (Andrei Jikh, Judging Freedom, Cihat E. Çiçek, Zang International with Lynette Zang, The Rich Dad Channel, Trends Journal, Integral Forextv y Kanal Finans). La plataforma realiza de forma autónoma: transcripción a texto de alta fidelidad, generación de resúmenes detallados de contenido estructurados cronológicamente, detección de charts (gráficos) con títulos y leyendas, y redacción de informes financieros y macroeconómicos rigurosos como un analista bursátil experto. También incluye un traductor de audios con sintetizador de voz avanzado.",
      estadoBaseDatosSupabase: {
        totalVideosSincronizados: totalVideos,
        videosPorCanal: channelsCount,
        listaVideos: videos.map(v => ({
          id: v.id,
          titulo: v.title,
          canal: v.metadata?.channel_title || "Andrei Jikh",
          fechaSincronizacion: v.created_at,
          enlaceYoutube: v.file_url,
          tieneEstudioCompleto: consolidatedKnowledge.some(k => k.id === v.id && (k.summary || k.analysis))
        }))
      }
    };

    const currentDateTimeStr = new Date().toLocaleString("es-ES", { timeZone: "Europe/Madrid" });

    // 4. Build system instructions with strict parameters and the rich contextual database
    const systemInstruction = `Eres el Asistente AI Premium integrado en el SaaS de HIVEX.
Fecha y hora actual en España (zona horaria de Madrid): ${currentDateTimeStr}.
Tu tono es sofisticado, profesional, riguroso, asertivo y objetivo, como un analista bursátil o banquero de inversión de élite.

Tienes dos propósitos de servicio principales:

1. **SOPORTE Y AYUDA DE LA PLATAFORMA HIVEX**:
   - Responde preguntas sobre el funcionamiento del software (monitorización, transcripción, detección de charts, audios traducidos).
   - Tienes acceso en tiempo real a las estadísticas y datos almacenados en Supabase para este usuario:
     ${JSON.stringify(statsContext, null, 2)}
   - Si se te pregunta qué vídeos hay sincronizados, cuántos hay, de qué canales o si están analizados, debes responder utilizando estrictamente estos datos reales para garantizar veracidad absoluta sin adivinar.

2. **ASISTENTE BURSÁTIL PREMIUM**:
   - Responde preguntas relacionadas con mercados, tendencias, riesgo bursátil, consejos y tomas de decisiones financieras en cada momento.
   - Tu base de conocimiento es precisamente toda la información de estudio derivada de los vídeos sincronizados (resúmenes estructurados, gráficos/charts detectados e informe de análisis de la cabina de estudio; la transcripción literal completa está en la plataforma). Aquí está tu base de conocimiento actual de vídeos:
     ${JSON.stringify(consolidatedKnowledge, null, 2)}

NORMAS IMPORTANTES DE OPERACIÓN (CUMPLE SIN EXCEPCIONES):
- **Temperatura de IA**: Tu razonamiento se limita a una temperatura de 0.2 (preciso, estricto, factual).

- **4 REGLAS INQUEBRANTABLES**:
  1. **REGLA 1 (CIRCUNSCRIPCIÓN EXCLUSIVA A HIVEX)**: Tus respuestas se deben circunscribir de forma prioritaria y estricta a la base de conocimiento almacenada en HIVEX (los vídeos y estudios sincronizados). Solo si la información solicitada NO existe en absoluto en HIVEX, estarás autorizado a buscar la respuesta en Internet (Google Search Grounding).
  2. **REGLA 2 (CITAR TODAS LAS FUENTES CON ENLACES CLICABLES)**: Todas, absolutamente todas las respuestas deben citar de manera clara y explícita la fuente de donde se extrae la información mediante un link clicable en formato Markdown ([Texto](URL)) al que se pueda navegar para ampliar información.
     - Si la fuente procede de la base de conocimiento de HIVEX, el enlace debe dirigir obligatoriamente a la Cabina de Estudio utilizando una ruta relativa de SPA compatible con el panel: \`[Título del Vídeo o Texto descriptivo](/dashboard/videos?id=VIDEO_ID)\`, donde debes reemplazar \`VIDEO_ID\` por el \`id\` UUID real del vídeo.
     - Si la fuente procede de internet, debes incluir obligatoriamente los hipervínculos reales de las páginas o artículos web de donde proviene la información utilizando los URLs provistos por los resultados del buscador de Google Search Grounding.
     - Está terminantemente prohibido omitir el enlace clicable directo; cada afirmación relevante debe tener su hipervínculo clicable de respaldo.
  3. **REGLA 3 (PROHIBICIÓN ABSOLUTA DE RESPUESTAS SIMULADAS)**: Están estrictamente prohibidas las respuestas simuladas, ficticias, hipotéticas o inventadas. Todos los datos, cifras, precios, fechas y análisis deben basarse rigurosamente en fuentes verídicas de conocimiento real (la base de datos de HIVEX o la búsqueda web en tiempo real del Google Search Grounding actual de hoy, ${currentDateTimeStr}).
  4. **REGLA 4 (PRIORIZACIÓN CRONOLÓGICA EXTREMA / NOTICIAS RECIENTES)**: Para el inversor, el valor del conocimiento decae rápidamente con el tiempo. Las informaciones, noticias y análisis recientes tienen prioridad absoluta sobre los antiguos. Debes priorizar con fuerza y dar máximo protagonismo visual y de análisis a aquellas noticias, informaciones o vídeos que no tengan más de un par de días de antigüedad (últimas 48 horas) frente a todo el resto de la base de conocimiento, destacando estas novedades en primer lugar para darle el máximo valor posible al inversor. Prioricemos aquellas noticias que no tengan más de un par de días de antigüedad frente al resto, para darle más valor a estas primeras que a todas las demás.

- **Permiso Autorizado de Enlaces de YouTube (Marcas de Tiempo de Gráficos / Micro-Vídeos)**:
  - Está **totalmente autorizado y recomendado** incluir enlaces directos a YouTube únicamente cuando sigas el formato de micro-vídeo de gráfico: \`🎬 **Micro-vídeo del Gráfico:** [Ver escena en YouTube (Minuto MM:SS)](https://youtu.be/{youtubeId}?t={seconds})\`.
  - Sigue estando prohibido enviar enlaces genéricos o generales de YouTube sin marca de tiempo, salvo que el usuario lo solicite explícitamente.
  - **Interacción y Navegación Directa**: Explica siempre al usuario en la misma respuesta que este link interactúa directamente con la plataforma de producción de HIVEX y le permite la navegación dentro de ella, requiriendo iniciar sesión con su usuario y contraseña si no lo ha hecho previamente.

- **Falta de Conocimiento (Regla de Fallback Crítica)**: Si lo que se te pregunta no se encuentra dentro de esta base de conocimiento local, tu deber ineludible es informar al usuario y contestar utilizando EXACTAMENTE la siguiente frase:
  "actualmente, mi base de conocimiento no dispone de esa información. Pero si quieres puedo consultar en internet y darte una respuesta de mercado actualizada a día de hoy."
  IMPORTANTE: No uses conocimiento general de entrenamiento si no está en la base de conocimiento local provista. Di la frase exacta de fallback para que el sistema del frontend le permita al usuario hacer una consulta con búsqueda web en internet.

- **PROHIBICIÓN ABSOLUTA DE PLANES DE ACCIÓN EN JSON Y METAPLANS**:
  - BAJO NINGUNA CIRCUNSTANCIA respondas con un objeto JSON, bloques de código JSON de planificación, claves como 'query', 'metaplan' o estructuras de diseño de planes.
  - El sistema de HIVEX opera en modo de **petición única (Single-turn)**, lo que significa que no hay un bucle de agentes intermedio en el servidor para ejecutar planes de múltiples pasos.
  - Debes realizar toda la investigación, traducción y análisis en tu pensamiento interno y devolver **únicamente el resultado final redactado en lenguaje natural** formateado en Markdown estándar en tu primera y única respuesta.

- **Envío Autónomo a Telegram**: Tienes la capacidad y la herramienta \`send_telegram_notification\` para enviar avisos, alertas de mercado urgentes o resúmenes de inversión al grupo de Telegram de HIVEX. Si el usuario te pide explícitamente enviar un aviso o alertar al grupo (ej: "Envía una alerta diciendo que...", "Avisa al grupo sobre...", "Notifica en Telegram que..."), DEBES usar esta herramienta para realizar la transmisión. Redacta el mensaje de manera clara, con emojis bursátiles y con tu tono profesional antes de despacharlo.

${useInternet ? `
- **Búsqueda en Internet Autorizada**: El usuario ha aceptado explícitamente realizar una búsqueda en internet. Tienes acceso a Google Search Grounding. Úsala para recuperar información actualizada, veraz y de hoy (${new Date().toLocaleDateString("es-ES")}) para responder de manera rigurosa. Cita las URLs de internet correspondientes utilizando enlaces markdown.
` : ""}
`;

    // 5. Connect to Gemini API with robust fallbacks
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY environment variable.");
    }

    const attempts = [
      {
        name: "Gemini 3.5 Flash",
        url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent"
      },
      {
        name: "Gemini 2.5 Flash",
        url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
      }
    ];

    let geminiResponseText = "";
    let geminiData: any = null;
    let successfulModel = "";
    let errorDetails: string[] = [];

    // Map history to Gemini's role structures
    const contentsPayload = [
      ...history.map((h: any) => ({
        role: h.role === "user" ? "user" : "model",
        parts: [{ text: h.content }]
      })),
      {
        role: "user",
        parts: [{ text: message }]
      }
    ];

    for (const attempt of attempts) {
      try {
        const requestUrl = `${attempt.url}?key=${apiKey}`;
        const payload: Record<string, any> = {
          contents: contentsPayload,
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 8192,
            thinkingConfig: {
              thinkingBudget: 0
            }
          }
        };

        // Standard v1beta systemInstruction parameter
        payload.systemInstruction = {
          parts: [{ text: systemInstruction }]
        };

        // Enable tools: send_telegram_notification and googleSearch if useInternet is active
        const tools: any[] = [
          {
            functionDeclarations: [
              {
                name: "send_telegram_notification",
                description: "Envía una notificación o aviso urgente con análisis bursátil, un mensaje de texto, alerta o resumen de mercado a un grupo de Telegram.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    message: {
                      type: "STRING",
                      description: "Contenido del mensaje, resumen o alerta bursátil en formato de texto. Puede incluir viñetas, saltos de línea y emojis. Redáctalo con el tono premium característico del asistente de HIVEX."
                    }
                  },
                  required: ["message"]
                }
              }
            ]
          }
        ];

        if (useInternet) {
          tools.push({
            googleSearch: {}
          });
        }

        payload.tools = tools;

        const res = await fetch(requestUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          geminiData = await res.json();
          const candidate = geminiData.candidates?.[0];
          const parts = candidate?.content?.parts || [];
          
          const hasFunction = parts.some((p: any) => p.functionCall);
          const hasText = parts.some((p: any) => p.text && p.text.trim().length > 0);

          if (hasFunction || hasText) {
            successfulModel = attempt.name;
            break;
          }
          errorDetails.push(`${attempt.name}: Respuesta vacía o formato inválido.`);
        } else {
          const errText = await res.text();
          errorDetails.push(`${attempt.name} (HTTP ${res.status}): ${errText}`);
        }
      } catch (err: any) {
        errorDetails.push(`${attempt.name} (Error de red): ${err.message || String(err)}`);
      }
    }

    const candidate = geminiData?.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    if (parts.length === 0) {
      return NextResponse.json({
        error: "No se pudo obtener una respuesta válida de la API de Gemini. Detalles:\n" + errorDetails.join("\n")
      }, { status: 500 });
    }

    // Cleanly extract text by joining non-thought parts
    geminiResponseText = parts
      .filter((p: any) => !p.thought)
      .map((p: any) => p.text)
      .filter(Boolean)
      .join("") || "";

    const functionCallPart = parts.find((p: any) => p.functionCall);
    const functionCall = functionCallPart ? functionCallPart.functionCall : null;

    // Handle autonomous function call for Telegram
    if (functionCall && functionCall.name === "send_telegram_notification") {
      const messageArg = functionCall.args?.message;
      if (!messageArg) {
        geminiResponseText = "No se proporcionó el mensaje para la notificación de Telegram.";
      } else {
        const result = await sendTelegramMessageWithPhotos(messageArg);
        if (result.success) {
          return NextResponse.json({
            success: true,
            response: `🔔 <b>[Notificación de Telegram]</b> He enviado de forma autónoma el siguiente aviso al grupo de inversores:\n\n<blockquote>${messageArg}</blockquote>`,
            sources: [],
            searchedInternet: useInternet,
            modelUsed: successfulModel,
            telegramNotificationSent: true,
            telegramSimulated: result.simulated
          });
        } else {
          return NextResponse.json({
            error: `❌ Error al enviar la notificación de Telegram: ${result.error || "desconocido"}`
          }, { status: 500 });
        }
      }
    }

    // 6. Extract cited sources (from local video urls or internet grounding chunks)
    const sources: { title: string; url: string; type: "local" | "internet" }[] = [];

    // 6a. Extract from markdown links in the text
    const mdLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    let match;
    while ((match = mdLinkRegex.exec(geminiResponseText)) !== null) {
      const title = match[1];
      const url = match[2];
      
      const isLocalVideo = videos.some(v => v.file_url === url || url.includes("youtube.com/embed/") || url.includes("youtube.com/watch"));
      sources.push({
        title,
        url,
        type: isLocalVideo ? "local" : "internet"
      });
    }

    // 6b. Extract from Google Search Grounding metadata if available
    if (useInternet && geminiData?.candidates?.[0]?.groundingMetadata) {
      const metadata = geminiData.candidates[0].groundingMetadata;
      if (metadata.groundingChunks) {
        metadata.groundingChunks.forEach((chunk: any) => {
          if (chunk.web?.uri) {
            sources.push({
              title: chunk.web.title || "Artículo Web",
              url: chunk.web.uri,
              type: "internet"
            });
          }
        });
      }
    }

    // Replace flat UUID citations [UUID] with interactive Markdown links and register them as local sources
    geminiResponseText = geminiResponseText.replace(
      /\[([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/gi,
      (_, uuid) => {
        const video = videos.find(v => v.id === uuid);
        const title = video ? video.title : "Vídeo de Estudio";
        const url = `/dashboard/videos?id=${uuid}`;
        
        if (!sources.some(s => s.url === url)) {
          sources.push({
            title: `Ver Análisis: ${title}`,
            url,
            type: "local"
          });
        }
        
        return `[Ver Análisis: ${title}](${url})`;
      }
    );

    // Remove duplicate sources by URL
    const uniqueSources = Array.from(new Map(sources.map(s => [s.url, s])).values());

    return NextResponse.json({
      success: true,
      response: geminiResponseText,
      sources: uniqueSources,
      searchedInternet: useInternet,
      modelUsed: successfulModel
    });

  } catch (err: any) {
    console.error("[Assistant API] Fatal crash:", err);
    return NextResponse.json({
      error: "Error interno del servidor en el asistente AI: " + (err.message || String(err))
    }, { status: 500 });
  }
}
