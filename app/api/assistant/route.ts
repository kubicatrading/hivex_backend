import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabase as defaultSupabase, isUsingMock } from "@/lib/supabase";
import { sendTelegramMessage } from "@/lib/telegram";

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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
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
            .select("*");
          if (!error && data) {
            allDocs = data;
          }
        }
      } else if (userId) {
        const { data, error } = await supabaseClient
          .from("documents")
          .select("*");
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
      detallesPlataforma: "HIVEX es una plataforma premium e integral de estudio para inversores bursátiles y traders. Permite la sincronización en tiempo real de feeds de vídeo de YouTube de canales analíticos (Andrei Jikh y Judging Freedom). La plataforma realiza de forma autónoma: transcripción a texto de alta fidelidad, generación de resúmenes detallados de contenido estructurados cronológicamente, detección de charts (gráficos) con títulos y leyendas, y redacción de informes financieros y macroeconómicos rigurosos como un analista bursátil experto. También incluye un traductor de audios con sintetizador de voz avanzado.",
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

    // 4. Build system instructions with strict parameters and the rich contextual database
    const systemInstruction = `Eres el Asistente AI Premium integrado en el SaaS de HIVEX.
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
- **Prohibición Estricta de Enlaces de YouTube y Enlace Obligatorio a la Cabina de Estudio**:
  - BAJO NINGUNA CIRCUNSTANCIA devuelvas enlaces directos de YouTube (como youtube.com/watch, youtube.com/embed, etc.), salvo que el usuario te lo pida explícitamente diciendo literalmente algo como: "Dame el enlace directo de YouTube" o "Pásame el link de YouTube".
  - **SÍ O SÍ, cada vez que menciones, listes, resumas o te refieras a un vídeo de la plataforma en tu respuesta, debes incluir OBLIGATORIAMENTE su link de acceso directo a la cabina de estudio en la plataforma de HIVEX.**
  - Para enlazar un vídeo o su cabina de estudio en el panel interno de HIVEX, utiliza el formato Markdown obligatorio: \`[Título del Vídeo](/dashboard/videos?id=VIDEO_ID)\`, donde debes reemplazar \`VIDEO_ID\` por el \`id\` (UUID) real del vídeo presente en la base de datos de conocimiento de Supabase.
  - Si mencionas el canal, añade un enlace interno como \`[Canal](/dashboard/videos?channel=NombreCanal)\`.
  - Ejemplo de cita de fuente: *Fuente: Vídeo [The Fed Just Made A Major Decision](/dashboard/videos?id=VIDEO_ID) en el canal [Andrei Jikh](/dashboard/videos?channel=Andrei%20Jikh)*.
  - El campo \`enlaceYoutube\` y \`fileUrl\` solo están provistos para tu referencia técnica. No los expongas en tus respuestas bajo ningún concepto.
  - **Interacción y Navegación Directa**: Explica siempre al usuario en la misma respuesta que este link interactúa directamente con la plataforma de producción de HIVEX y le permite la navegación dentro de ella, requiriendo iniciar sesión con su usuario y contraseña si no lo ha hecho previamente.
- **Falta de Conocimiento (Regra de Fallback Crítica)**: Si lo que se te pregunta no se encuentra dentro de esta base de conocimiento local, tu deber ineludible es informar al usuario y contestar utilizando EXACTAMENTE la siguiente frase:
  "actualmente, mi base de conocimiento no dispone de esa información. Pero si quieres puedo consultar en internet y darte una respuesta de mercado actualizada a día de hoy."
  IMPORTANTE: No uses conocimiento general de entrenamiento si no está en la base de conocimiento local provista. Di la frase exacta de fallback para que el sistema del frontend le permita al usuario hacer una consulta con búsqueda web en internet.
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
            maxOutputTokens: 8192
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
          const part = candidate?.content?.parts?.[0];
          
          if (part) {
            if (part.functionCall || (part.text && part.text.trim().length > 0)) {
              successfulModel = attempt.name;
              break;
            }
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
    const part = candidate?.content?.parts?.[0];

    if (!part) {
      return NextResponse.json({
        error: "No se pudo obtener una respuesta válida de la API de Gemini. Detalles:\n" + errorDetails.join("\n")
      }, { status: 500 });
    }

    geminiResponseText = part.text || "";
    const functionCall = part.functionCall || null;

    // Handle autonomous function call for Telegram
    if (functionCall && functionCall.name === "send_telegram_notification") {
      const messageArg = functionCall.args?.message;
      if (!messageArg) {
        geminiResponseText = "No se proporcionó el mensaje para la notificación de Telegram.";
      } else {
        const result = await sendTelegramMessage(messageArg);
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
