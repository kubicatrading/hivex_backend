import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabase as defaultSupabase, isUsingMock } from "@/lib/supabase";
import { sendTelegramMessageWithPhotos } from "@/lib/telegram";
import {
  resolveOmnichannelUser,
  getOmnichannelConversation,
  saveOmnichannelTurn,
  formatGeminiMultiTurnPayload
} from "@/lib/omnichannelMemory";

export const maxDuration = 300;

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null;

    const supabaseUrl = process.env.SUPABASE_PRODUCTION_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseServiceKey = process.env.SUPABASE_PRODUCTION_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ success: false, history: [] });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    let userId: string | null = null;
    let userEmail: string | null = null;

    if (token) {
      const { data: { user } } = await adminClient.auth.getUser(token);
      if (user) {
        userId = user.id;
        userEmail = user.email || null;
      }
    }

    if (!userId && !userEmail) {
      return NextResponse.json({ success: false, history: [] });
    }

    const profile = await resolveOmnichannelUser(adminClient, {
      authUserId: userId,
      userEmail: userEmail
    });

    const { history } = await getOmnichannelConversation(adminClient, profile);

    return NextResponse.json({
      success: true,
      profile,
      history
    });
  } catch (err: any) {
    console.error("[Assistant API GET] Error loading conversation history:", err);
    return NextResponse.json({ success: false, history: [], error: err.message });
  }
}

export async function DELETE(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null;

    const supabaseUrl = process.env.SUPABASE_PRODUCTION_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseServiceKey = process.env.SUPABASE_PRODUCTION_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

    if (!supabaseUrl || !supabaseServiceKey || !token) {
      return NextResponse.json({ success: false });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    const { data: { user } } = await adminClient.auth.getUser(token);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const profile = await resolveOmnichannelUser(adminClient, {
      authUserId: user.id,
      userEmail: user.email
    });

    const { docId, metadata } = await getOmnichannelConversation(adminClient, profile);
    if (docId) {
      await adminClient.from("documents").update({
        metadata: {
          ...metadata,
          history: [],
          last_cleared: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      }).eq("id", docId);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[Assistant API DELETE] Error resetting history:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, useInternet = false, localDocuments = [] } = body;

    if (!message) {
      return NextResponse.json({ error: "Mensaje no proporcionado" }, { status: 400 });
    }

    // 1. Authenticate user using Authorization header Bearer token
    const authHeader = request.headers.get("Authorization");
    const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null;

    let userId: string | null = null;
    let userEmail: string | null = null;

    const supabaseUrl = process.env.SUPABASE_PRODUCTION_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const supabaseServiceKey = process.env.SUPABASE_PRODUCTION_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || supabaseAnonKey;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    let supabaseClient = defaultSupabase;

    if (!isUsingMock && supabaseUrl) {
      if (token) {
        try {
          const { data: { user }, error: authErr } = await adminClient.auth.getUser(token);
          if (!authErr && user) {
            userId = user.id;
            userEmail = user.email || null;
            supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
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

    // Resolve unified omnichannel profile (Web + Telegram)
    const resolvedProfile = await resolveOmnichannelUser(adminClient, {
      authUserId: userId,
      userEmail: userEmail
    });

    // Load user's persistent omnichannel conversation memory
    const { docId: omnichannelDocId, history: conversationHistory } = await getOmnichannelConversation(
      adminClient,
      resolvedProfile
    );

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
      } else {
        const { data, error } = await adminClient
          .from("documents")
          .select("id, title, type, file_url, created_at, metadata, description")
          .in("type", ["video", "knowledge_summary", "knowledge_charts", "knowledge_analysis"])
          .order("created_at", { ascending: false })
          .limit(100);
        if (!error && data) {
          allDocs = data;
        } else if (error) {
          console.warn("[Assistant API] Supabase fetch error:", error);
        }
      }
    } catch (dbErr) {
      console.error("[Assistant API] Database query failure:", dbErr);
    }

    // Load recent magazine articles (Trends Journal & HIVEX Magazines)
    let magazineArticles: any[] = [];
    try {
      const { data: magData, error: magErr } = await adminClient
        .from("documents")
        .select("id, title, description, metadata, created_at")
        .eq("type", "knowledge_transcription")
        .eq("metadata->>is_magazine_article", "true")
        .order("created_at", { ascending: false })
        .limit(70);

      if (!magErr && magData && magData.length > 0) {
        magazineArticles = magData.map(m => ({
          id: m.id,
          titulo: m.title,
          categoria: m.metadata?.category || m.metadata?.main_category || "Macroeconomía y Tendencias",
          subcategoria: m.metadata?.subcategory || "",
          edicion: m.metadata?.issue_slug || "Revista Semanal",
          pagina: m.metadata?.start_page || 1,
          textoExtracto: Array.isArray(m.metadata?.paragraphs) ? m.metadata.paragraphs.slice(0, 3).join("\n") : (m.description || "")
        }));
      }
    } catch (magErr) {
      console.error("[Assistant API] Error loading magazine articles:", magErr);
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
      detallesPlataforma: "HIVEX es una plataforma premium e integral de estudio para inversores bursátiles y traders. Permite la sincronización en tiempo real de feeds de vídeo de YouTube de canales analíticos (Andrei Jikh, Judging Freedom, Cihat E. Çiçek, Zang International with Lynette Zang, The Rich Dad Channel, Trends Journal, Integral Forextv y Kanal Finans) y hemeroteca de revistas semanales (Trends Journal con Gerald Celente). La plataforma realiza de forma autónoma: transcripción a texto de alta fidelidad, generación de resúmenes detallados de contenido estructurados cronológicamente, detección de charts (gráficos) con títulos y leyendas, y redacción de informes financieros y macroeconómicos rigurosos como un analista bursátil experto. También incluye un traductor de audios con sintetizador de voz avanzado.",
      estadoBaseDatosSupabase: {
        totalVideosSincronizados: totalVideos,
        totalArticulosRevistas: magazineArticles.length,
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

    // Build user identity details for greeting and tone
    let senderDetails = "";
    if (resolvedProfile.fullName) {
      senderDetails = `Te está hablando el inversor registrado ${resolvedProfile.fullName} (Email: ${resolvedProfile.email || "No especificado"}). Trátalo de manera profesional, asertiva y sofisticada como socio inversor de HIVEX.`;
    } else {
      senderDetails = `Te está hablando un inversor de la plataforma HIVEX. Trátalo de manera profesional, sobria y de máximo nivel.`;
    }

    // 4. Build system instructions incorporating the 5 Golden Rules tailored for the Web Platform
    const systemInstruction = `Eres el Asistente AI Premium integrado en la plataforma web de HIVEX SaaS.
Fecha y hora actual en España (zona horaria de Madrid): ${currentDateTimeStr}.
Tu tono es sofisticado, profesional, riguroso, asertivo y objetivo, como un analista bursátil o banquero de inversión de élite.

INFORMACIÓN SOBRE EL INTERLOCUTOR:
${senderDetails}

Tienes dos propósitos de servicio principales:

1. **SOPORTE Y AYUDA DE LA PLATAFORMA HIVEX**:
   - Responde preguntas sobre el funcionamiento del software (monitorización, transcripción, detección de charts, revistas semanales, audios traducidos).
   - Tienes acceso en tiempo real a las estadísticas y datos almacenados en Supabase:
     ${JSON.stringify(statsContext, null, 2)}
   - Si se te pregunta qué vídeos hay sincronizados, cuántos hay, de qué canales o si están analizados, debes responder utilizando estrictamente estos datos reales para garantizar veracidad absoluta sin adivinar.

2. **ASISTENTE BURSÁTIL PREMIUM (DESPACHO DE ANÁLISIS)**:
   - Responde preguntas relacionadas con mercados, tendencias, riesgo bursátil, consejos y tomas de decisiones financieras en cada momento.
   - Tu base de conocimiento prioritaria se compone de:
     A) **VÍDEOS Y ANÁLISIS DE MERCADO (Resúmenes estructurados, gráficos/charts detectados e informe de análisis de la cabina de estudio)**:
     ${JSON.stringify(consolidatedKnowledge, null, 2)}
     B) **REVISTAS SEMANALES Y TENDENCIAS MACROECONÓMICAS (HIVEX Magazines / Trends Journal con artículos, datos, cifras y previsiones)**:
     ${JSON.stringify(magazineArticles, null, 2)}

- **JERARQUÍA Y PRIORIDAD DE FUENTES (PIPELINE DE INFORMACIÓN OBLIGATORIO)**:
  Cuando proceses cualquier consulta, debes buscar, sintetizar y priorizar tus fuentes de información siguiendo estrictamente esta jerarquía obligatoria (de más prioritario a menos):
  1. **NIVEL 1: BASE DE CONOCIMIENTO PERSISTENTE DE HIVEX (MÁXIMA PRIORIDAD Y OBLIGATORIA)**:
     - Tu fuente primordial e innegociable es toda la base de conocimiento persistente de HIVEX:
       a) **Tarjetas de Gráficos Bursátiles** (\`knowledge_charts\`) con sus capturas fijas y marcas temporales (prioridad absoluta en análisis de mercado).
       b) **Informes de Análisis Macroeconómico** (\`knowledge_analysis\`) de los vídeos de la plataforma.
       c) **Resúmenes Ejecutivos y Cronológicos** (\`knowledge_summary\`).
       d) **Revistas Semanales y Análisis de Tendencias** (\`knowledge_transcription\` de HIVEX Magazines / Trends Journal con artículos, datos, cifras, consejos y previsiones de Gerald Celente).
     - Si la información, consejo, previsión o tendencia está en la base de datos de HIVEX, básate íntegramente en ella.
  2. **NIVEL 2: CONSULTA A INTERNET (ÚNICA Y ESTRICTAMENTE COMO ÚLTIMO RECURSO)**:
     - Utiliza la búsqueda en vivo en Internet (Google Search Grounding) ÚNICAMENTE como último recurso, si la consulta requiere hechos, eventos macroeconómicos o cotizaciones que NO existen en la base de datos de HIVEX o para contrastar precios de activos en tiempo real de hoy.
     - **REGLA OBLIGATORIA AL USAR INTERNET**: Cuando recurras a Internet, es **estrictamente obligatorio informar de cuándo ocurre** (fecha y momento preciso de la noticia o cotización) y citar de forma limpia y transparente la **fuente en particular** (nombre del medio o portal con su hipervínculo limpio). Jamás ocultes ni simules la procedencia de los datos externos.

- **5 REGLAS DE ORO OBLIGATORIAS DE COMUNICACIÓN EN HIVEX (MANDATORY)**:
  Estas 5 Reglas de Oro son inquebrantables y rigen obligatoriamente tu comunicación con cualquier usuario/cliente de HIVEX:
  1. **REGLA 1 (PRESENTACIÓN FORMAL DEL INVERSOR AL INICIO)**: Toda información o análisis bursátil solicitado en el chat debe ir precedido **obligatoriamente** por una breve presentación formal del inversor de HIVEX y el propósito claro de lo que se pretende presentar en ese mensaje. Esta presentación formal debe ubicarse en el **principio absoluto del mensaje**, antes de cualquier otra información, tabla o gráfico, asegurando que jamás aparezca al final de la comunicación. Esta presentación debe ser extremadamente corta, sobria, concisa y directa (de un párrafo breve de no más de una o dos líneas, máximo 30-40 palabras), evitando introducciones largas o rodeos.
  2. **REGLA 2 (ACOMPAÑAR TODA INFORMACIÓN DE SU FUENTE EXPLÍCITA)**: Toda información bursátil, datos macroeconómicos, cifras, precios o tendencias mostradas debe venir acompañada de la fuente sobre la que se basa. Esta fuente debe indicarse de forma limpia e integrada mediante un link hipervínculo utilizando el propio título de la fuente (ya sea el título del vídeo en la cabina de estudio de HIVEX, el titular del artículo de la revista de HIVEX, o bien el nombre limpio del artículo o web de donde provenga en Internet indicando de forma explícita cuándo ocurre).
  3. **REGLA 3 (BÚSQUEDA PRIORITARIA EN TARJETAS DE GRÁFICOS / KNOWLEDGE_CHARTS Y ESTRUCTURA JERÁRQUICA)**: Ante cualquier tipo de información o análisis de mercado solicitado, debes buscar **en primer lugar** en los gráficos detectados en la cabina de estudio (\`knowledge_charts\`). En este caso, la información debe presentarse estrictamente en formato "despacho premium" jerárquico:
     - **Prohibición de vídeo MP4 nativo**: Está terminantemente prohibido mostrar reproductores nativos MP4. En su lugar, el acceso a cada vídeo se realiza a través de su enlace amigable acompañado de su captura fija (\`snapshot\`).
     - **Estructura jerárquica estricta (enlace amigable + captura fija emparejados)** (con enlaces internos de navegación en la plataforma):
       1. Enlace amigable al fragmento de vídeo acotado: \`[Título Limpio del Gráfico](/dashboard/videos?id={videoId}&start={seconds}&end={endSeconds})\`.
       2. Captura fija del gráfico pegada inmediatamente debajo: \`![Título Limpio del Gráfico](/snapshots/{videoId}/{seconds}.jpg)\`.
       3. Enlace amigable al vídeo completo: \`[Vídeo Completo: Título del Vídeo](/dashboard/videos?id={videoId})\`.
       4. Carátula o portada del vídeo completo pegada inmediatamente debajo: \`![Título del Vídeo](/snapshots/{videoId}/0.jpg)\`.
     - **Si NO hay gráficos detectados**, se omiten estrictamente el enlace acotado y la captura fija, enviando solo el enlace al vídeo o revista y su carátula. Está terminantemente prohibido inventar marcas de tiempo o gráficos inexistentes.
     - Al hablar de información bursátil, lo más importante es apoyarse en cifras, números y tendencias visibles en esos gráficos. Completa y enriquece este análisis de gráficos utilizando la información de los otros documentos \`knowledge_*\` del contexto (resúmenes, informes de análisis y artículos de revistas).
  4. **REGLA 4 (ENLACES COMPLETAMENTE LIMPIOS)**: Todos los enlaces hipervínculos presentados deben ser limpios. El texto ancla del enlace debe ser el propio título descriptivo del recurso, de la fuente, o del gráfico (ej. \`[Título del Gráfico](/dashboard/videos?id=...)\`, \`[Andrei Jikh - Título de Vídeo](/dashboard/videos?id=...)\` o \`[Trends Journal - Título del Artículo](/dashboard/news)\`). Está terminantemente prohibido utilizar textos de enlace genéricos y repetitivos como "Ver escena", "Abrir escena", "Hacer clic aquí", "Ver enlace" o mostrar direcciones URL de forma cruda.
  5. **REGLA 5 (PROHIBICIÓN TOTAL DE INVENTAR O SIMULAR INFORMACIÓN)**: Está estrictamente prohibido simular o inventar datos, cifras, precios, fechas o análisis. Si algo no está respaldado por la base de conocimiento o búsquedas en tiempo real, no lo menciones. La veracidad y la precisión bursátil de los datos numéricos es fundamental.

- **CONTINUIDAD CONVERSACIONAL OMNICANAL**:
  - Tienes memoria persistente y compartida de la conversación con este usuario, incluyendo los mensajes intercambiados tanto a través de la plataforma web como desde Telegram.
  - Mantén coherencia absoluta y continúa los hilos de análisis de manera natural independientemente del canal utilizado.

- **Falta de Conocimiento (Regla de Fallback Crítica)**: Si lo que se te pregunta no se encuentra dentro de esta base de conocimiento local, tu deber ineludible es informar al usuario y contestar utilizando EXACTAMENTE la siguiente frase:
  "actualmente, mi base de conocimiento no dispone de esa información. Pero si quieres puedo consultar en internet y darte una respuesta de mercado actualizada a día de hoy."
  IMPORTANTE: Di la frase exacta de fallback para que el sistema del frontend le permita al usuario hacer una consulta con búsqueda web en internet.

- **PROHIBICIÓN ABSOLUTA DE PLANES DE ACCIÓN EN JSON Y METAPLANS**:
  - BAJO NINGUNA CIRCUNSTANCIA respondas con un objeto JSON, bloques de código JSON de planificación, claves como 'query', 'metaplan' o estructuras de diseño de planes.
  - El sistema de HIVEX opera en modo de **petición única (Single-turn)**.
  - Debes realizar toda la investigación, traducción y análisis en tu pensamiento interno y devolver **únicamente el resultado final redactado en lenguaje natural** formateado en Markdown estándar en tu primera y única respuesta.

- **Envío Autónomo a Telegram**: Tienes la herramienta \`send_telegram_notification\` para enviar avisos, alertas de mercado urgentes o resúmenes de inversión al grupo de Telegram de HIVEX. Si el usuario te pide explícitamente enviar un aviso o alertar al grupo (ej: "Envía una alerta diciendo que...", "Avisa al grupo sobre...", "Notifica en Telegram que..."), DEBES usar esta herramienta para realizar la transmisión. Redacta el mensaje de manera clara, con emojis bursátiles y con tu tono profesional antes de despacharlo.

${useInternet ? `
- **Búsqueda en Internet Autorizada**: El usuario ha aceptado explícitamente realizar una búsqueda en internet. Tienes acceso a Google Search Grounding. Úsala para recuperar información actualizada, veraz y de hoy (${new Date().toLocaleDateString("es-ES")}) para responder de manera rigurosa. Cita las URLs de internet correspondientes utilizando enlaces markdown y especifica la fecha exacta de publicación de la noticia o cotización.
` : ""}
`;

    // 5. Connect to Gemini API with robust fallbacks
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY environment variable.");
    }

    const attempts = [
      {
        name: "Gemini 3.8 Flash",
        url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent"
      },
      {
        name: "Gemini 3.7 Flash",
        url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent"
      },
      {
        name: "Gemini 3.6 Flash",
        url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent"
      },
      {
        name: "Gemini 3.5 Flash",
        url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent"
      },
      {
        name: "Gemini 3.0 Flash",
        url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.0-flash:generateContent"
      },
      {
        name: "Gemini 2.5 Flash",
        url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
      },
      {
        name: "Gemini 2.0 Flash",
        url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
      },
      {
        name: "Gemini 1.5 Flash",
        url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"
      }
    ];

    let geminiResponseText = "";
    let geminiData: any = null;
    let successfulModel = "";
    let errorDetails: string[] = [];

    // Format Gemini payload with omnichannel multi-turn history
    const contentsPayload = formatGeminiMultiTurnPayload(conversationHistory, message, "web");

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
      }, { status: 502 });
    }

    // Check if a tool call was triggered (send_telegram_notification)
    const functionCallPart = parts.find((p: any) => p.functionCall);
    if (functionCallPart) {
      const call = functionCallPart.functionCall;
      if (call.name === "send_telegram_notification") {
        const notificationMsg = call.args?.message;
        if (notificationMsg) {
          try {
            await sendTelegramMessageWithPhotos(notificationMsg);
            geminiResponseText = `📢 **Notificación enviada a Telegram con éxito.**\n\n> ${notificationMsg.replace(/\n/g, "\n> ")}`;
          } catch (teleErr: any) {
            geminiResponseText = `⚠️ Se intentó despachar el aviso a Telegram, pero ocurrió un error en el envío: ${teleErr.message || String(teleErr)}`;
          }
        }
      }
    }

    // If text was generated directly, extract it
    if (!geminiResponseText) {
      const textParts = parts.filter((p: any) => p.text).map((p: any) => p.text);
      geminiResponseText = textParts.join("\n\n");
    }

    // Parse sources (Grounding metadata + local video links)
    const sources: { title: string; url: string; type: "local" | "internet" }[] = [];

    // Extract Grounding Chunks if present
    if (candidate?.groundingMetadata) {
      const metadata = candidate.groundingMetadata;
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

    // Replace flat UUID citations [UUID] with clean interactive Markdown links
    geminiResponseText = geminiResponseText.replace(
      /\[([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/gi,
      (_, uuid) => {
        const video = videos.find(v => v.id === uuid);
        const title = video ? video.title : "Vídeo de Estudio";
        const url = `/dashboard/videos?id=${uuid}`;
        
        if (!sources.some(s => s.url === url)) {
          sources.push({
            title: title,
            url,
            type: "local"
          });
        }
        
        return `[${title}](${url})`;
      }
    );

    // Remove duplicate sources by URL
    const uniqueSources = Array.from(new Map(sources.map(s => [s.url, s])).values());

    // 6. Persist turn into unified omnichannel conversation memory
    try {
      if (resolvedProfile.authUserId || resolvedProfile.telegramUserId) {
        await saveOmnichannelTurn(adminClient, {
          docId: omnichannelDocId,
          profile: resolvedProfile,
          existingHistory: conversationHistory,
          userTurn: {
            text: message,
            source: "web",
            sender_name: resolvedProfile.fullName || "Inversor"
          },
          modelTurn: {
            text: geminiResponseText,
            source: "web"
          }
        });
      }
    } catch (saveErr) {
      console.error("[Assistant API] Error saving conversation memory:", saveErr);
    }

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
