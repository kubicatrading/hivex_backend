import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabase as defaultSupabase, isUsingMock } from "@/lib/supabase";
import { markdownToTelegramHtml, splitMarkdown, sendTelegramMessageWithPhotos, escapeHtml, setTelegramLanguage } from "@/lib/telegram";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    console.log("[Telegram Webhook] Received update payload:", JSON.stringify(payload));

    const message = payload.message;
    if (!message) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!botToken) {
      console.warn("[Telegram Webhook] Missing TELEGRAM_BOT_TOKEN environment variable.");
      return NextResponse.json({ ok: true });
    }

    let userText = "";
    let isAudio = false;

    try {
      const voice = message.voice;
      const audio = message.audio;
      const audioObj = voice || audio;

      if (audioObj) {
        isAudio = true;
        const fileId = audioObj.file_id;
        const mimeType = audioObj.mime_type || "audio/ogg";

        if (!apiKey) {
          throw new Error("Missing GEMINI_API_KEY environment variable. Cannot transcribe audio.");
        }

        console.log(`[Telegram Webhook] Audio/Voice received. File ID: ${fileId}, Mime Type: ${mimeType}. Fetching file path...`);
        const getFileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
        if (!getFileRes.ok) {
          throw new Error(`Failed to get file info from Telegram. Status: ${getFileRes.status}`);
        }
        const getFileData = await getFileRes.json();
        if (!getFileData.ok || !getFileData.result?.file_path) {
          throw new Error(`Telegram getFile returned error or empty path: ${JSON.stringify(getFileData)}`);
        }

        const filePath = getFileData.result.file_path;
        console.log(`[Telegram Webhook] File path resolved: ${filePath}. Downloading binary...`);

        const downloadRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
        if (!downloadRes.ok) {
          throw new Error(`Failed to download audio file from Telegram. Status: ${downloadRes.status}`);
        }

        const arrayBuffer = await downloadRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Audio = buffer.toString("base64");
        console.log(`[Telegram Webhook] Audio downloaded and encoded to Base64. Size: ${buffer.byteLength} bytes.`);

        console.log("[Telegram Webhook] Invoking Gemini for audio transcription...");
        const transcriptionInstruction = "Por favor, transcribe exactamente lo que dice este mensaje de voz en español, palabra por palabra. Tu respuesta debe ser ÚNICAMENTE la transcripción literal sin comentarios, explicaciones, saludos ni notas.";

        const attemptTranscriptionUrls = [
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"
        ];

        let transcribedText = "";
        for (const url of attemptTranscriptionUrls) {
          try {
            console.log(`[Telegram Webhook] Trying transcription with Gemini API endpoint: ${url}...`);
            const res = await fetch(`${url}?key=${apiKey}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      {
                        inlineData: {
                          mimeType: mimeType,
                          data: base64Audio
                        }
                      },
                      {
                        text: transcriptionInstruction
                      }
                    ]
                  }
                ]
              })
            });

            if (res.ok) {
              const resData = await res.json();
              const textPart = resData.candidates?.[0]?.content?.parts?.[0]?.text;
              if (textPart) {
                transcribedText = textPart.trim();
                console.log(`[Telegram Webhook] Successfully transcribed. Result: "${transcribedText}"`);
                break;
              }
            } else {
              const errorText = await res.text();
              console.error(`[Telegram Webhook] Transcription API error (${url}):`, errorText);
            }
          } catch (transErr) {
            console.error(`[Telegram Webhook] Transcription attempt crashed for ${url}:`, transErr);
          }
        }

        if (!transcribedText) {
          throw new Error("Could not transcribe audio message with any available Gemini Flash models.");
        }

        userText = transcribedText;
      } else if (message.text) {
        userText = message.text.trim();
      } else {
        // Return ok if it is not text and not audio (e.g. photos, stickers)
        return NextResponse.json({ ok: true });
      }
    } catch (audioErr: any) {
      console.error("[Telegram Webhook] Audio processing/transcription crashed:", audioErr);
      const errorHtml = `🎙️ <b>Error de Mensaje de Voz</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nNo pudimos procesar o transcribir tu nota de voz de forma adecuada en este momento.\n\n<i>Detalle: ${escapeHtml(audioErr?.message || "Error de red o decodificación")}</i>\n\nPor favor, intenta grabar con mayor claridad o escribe tu consulta en formato de texto plano.`;

      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: errorHtml,
          parse_mode: "HTML",
        }),
      });
      return NextResponse.json({ ok: true });
    }

    // Language configuration detector
    const lowerText = userText.toLowerCase();
    let targetLang: "en" | "es" | null = null;

    if (lowerText.startsWith("/lang") || lowerText.startsWith("/idioma")) {
      const parts = lowerText.split(/\s+/);
      if (parts.includes("es") || parts.includes("spanish") || parts.includes("español")) {
        targetLang = "es";
      } else if (parts.includes("en") || parts.includes("english") || parts.includes("inglés") || parts.includes("ingles")) {
        targetLang = "en";
      }
    } else if (
      lowerText.includes("alertas en español") ||
      lowerText.includes("alertas en espanol") ||
      lowerText.includes("poner en español") ||
      lowerText.includes("poner en espanol") ||
      lowerText.includes("idioma español") ||
      lowerText.includes("idioma espanol") ||
      lowerText.includes("alerts in spanish") ||
      lowerText.includes("set language to spanish") ||
      lowerText.includes("change language to spanish")
    ) {
      targetLang = "es";
    } else if (
      lowerText.includes("alertas en inglés") ||
      lowerText.includes("alertas en ingles") ||
      lowerText.includes("poner en inglés") ||
      lowerText.includes("poner en ingles") ||
      lowerText.includes("idioma inglés") ||
      lowerText.includes("idioma ingles") ||
      lowerText.includes("alerts in english") ||
      lowerText.includes("set language to english") ||
      lowerText.includes("change language to english")
    ) {
      targetLang = "en";
    }

    if (targetLang) {
      const success = await setTelegramLanguage(targetLang);
      let confirmationText = "";
      
      if (targetLang === "es") {
        confirmationText = `🌐 <b>HIVEX Configuración de Idioma</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nEl idioma de las alertas de Telegram se ha configurado correctamente a: <b>Español</b>.\n\n<i>A partir de ahora, tanto los avisos de nuevos vídeos como los boletines diarios "HIVEX News - 24H" se generarán y enviarán en español.</i>`;
      } else {
        confirmationText = `🌐 <b>HIVEX Language Settings</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nTelegram alerts language has been successfully set to: <b>English</b> (Default).\n\n<i>From now on, both new video notifications and daily bulletins "HIVEX News - 24H" will be generated and dispatched in English.</i>`;
      }

      if (!success) {
        confirmationText = `⚠️ <b>Error de Configuración</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nNo se pudo persistir la configuración en la base de datos de producción. Por favor, verifica el estado de Supabase.`;
      }

      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: confirmationText,
          parse_mode: "HTML",
        }),
      });

      return NextResponse.json({ ok: true });
    }

    // 1. Handle Slash Commands (/start or /help)
    let commandText = userText;
    if (commandText.startsWith("/")) {
      commandText = commandText.replace(/@\w+/, "");
    }

    if (commandText === "/start" || commandText === "/help") {
      const welcomeMarkdown = `**🤖 ASISTENTE BURSÁTIL HIVEX**
━━━━━━━━━━━━━━━━━━━━━━━━━━

¡Bienvenido al canal interactivo de **HIVEX**!

Estoy conectado de forma segura y en tiempo real a tu base de conocimiento de videos de análisis macroeconómico sincronizados de tus 8 canales de inversión (*Andrei Jikh*, *Judging Freedom*, *Cihat E. Çiçek*, *Zang International*, *The Rich Dad*, *Trends Journal*, *Integral Forextv* y *Kanal Finans*) y dispongo de conexión a internet por satélite para tendencias de hoy.

**¿Cómo puedo ayudarte hoy?**
- Hazme preguntas sobre geopolítica o macroeconomía (ej: *“¿Cuál es el diferencial del precio del oro en Shanghái?”*).
- Pregúntame qué vídeos tienes sincronizados (ej: *“¿Cuántos vídeos tengo en Supabase?”*).
- Pídeme resúmenes de tus canales o análisis específicos de un ponente.

━━━━━━━━━━━━━━━━━━━━━━━━━━
*Temperatura de IA configurada en 0.2 (Análisis Factual de Alta Rigurosidad)*`;

      const welcomeText = markdownToTelegramHtml(welcomeMarkdown);

      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: welcomeText,
          parse_mode: "HTML",
        }),
      });

      return NextResponse.json({ ok: true });
    }

    // 2. Fetch all documents from Supabase to construct the prompt knowledge base
    let allDocs: any[] = [];
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_PRODUCTION_URL;
    const supabaseServiceKey = process.env.SUPABASE_PRODUCTION_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    let supabaseClient = defaultSupabase;

    if (supabaseUrl && supabaseServiceKey) {
      supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false }
      });
    }

    try {
      // Optimize query to avoid loading heavy columns (like full transcriptions)
      // and limit context size to the last 100 entries to prevent Telegram webhook timeouts.
      const { data, error } = await supabaseClient
        .from("documents")
        .select("id, title, type, file_url, created_at, metadata, description")
        .in("type", ["video", "knowledge_summary", "knowledge_charts", "knowledge_analysis"])
        .order("created_at", { ascending: false })
        .limit(100);
      if (!error && data) {
        allDocs = data;
      } else if (error) {
        console.error("[Telegram Webhook] Supabase error:", error);
      }
    } catch (dbErr) {
      console.error("[Telegram Webhook] DB query crash:", dbErr);
    }

    // 3. Structure study base
    const videos = allDocs.filter(d => d.type === "video");
    const transcriptions = allDocs.filter(d => d.type === "knowledge_transcription");
    const summaries = allDocs.filter(d => d.type === "knowledge_summary");
    const chartsList = allDocs.filter(d => d.type === "knowledge_charts");
    const analyses = allDocs.filter(d => d.type === "knowledge_analysis");

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

    const totalVideos = videos.length;
    const channelsCount = videos.reduce((acc: Record<string, number>, v) => {
      const ch = v.metadata?.channel_title || "Andrei Jikh";
      acc[ch] = (acc[ch] || 0) + 1;
      return acc;
    }, {});

    const statsContext = {
      plataforma: "HIVEX SaaS",
      detallesPlataforma: "HIVEX es una plataforma premium e integral de estudio para inversores bursátiles y traders. Permite la sincronización en tiempo real de feeds de vídeo de YouTube de canales analíticos (Andrei Jikh, Judging Freedom, Cihat E. Çiçek, Zang International with Lynette Zang, The Rich Dad Channel, Trends Journal, Integral Forextv y Kanal Finans). La plataforma realiza de forma autónoma: transcripción de alta fidelidad, generación de resúmenes detallados de contenido estructurados cronológicamente, detección de charts (gráficos) con títulos y leyendas, y redacción de informes financieros y macroeconómicos rigurosos.",
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

    // 4. System prompt for Gemini tailored specifically for Telegram
    const systemInstruction = `Eres el Bot de Telegram de la plataforma premium HIVEX SaaS.
Fecha y hora actual en España (zona horaria de Madrid): ${currentDateTimeStr}.
Tu tono es sofisticado, profesional, riguroso, asertivo y objetivo, como un analista bursátil o banquero de inversión de élite.

Tienes dos propósitos de servicio principales:

1. **SOPORTE Y AYUDA DE LA PLATAFORMA HIVEX**:
   - Responde preguntas sobre el funcionamiento de HIVEX (monitorización de vídeos, transcripciones, análisis, traducción).
   - Tienes acceso en tiempo real a las estadísticas y datos de Supabase:
     ${JSON.stringify(statsContext, null, 2)}
   - Si se te pregunta qué vídeos hay sincronizados o cuántos hay, debes responder utilizando estrictamente estos datos reales para garantizar veracidad absoluta sin adivinar.

2. **ASISTENTE BURSÁTIL PREMIUM (ASESOR EN VIVO EN TELEGRAM)**:
   - Responde preguntas relacionadas con mercados, tendencias, riesgo bursátil, consejos y tomas de decisiones financieras en cada momento.
   - Tu base de conocimiento prioritaria es la información de estudio derivada de los vídeos sincronizados (resúmenes estructurados, gráficos/charts detectados e informe de análisis de la cabina de estudio; la transcripción literal completa está en la plataforma):
     ${JSON.stringify(consolidatedKnowledge, null, 2)}

- **ENVÍO DE MICRO-VÍDEOS DE GRÁFICOS (CAPACIDAD MULTIMEDIA Y REPRODUCTOR INLINE)**:
  - Tienes la capacidad de inyectar micro-vídeos interactivos de los gráficos directamente en tus respuestas de Telegram para que se reproduzcan de forma nativa e inline dentro del chat.
  - **Está terminantemente prohibido usar el formato de imagen markdown \`![título](url_imagen)\` para capturas de gráficos locales (enlaces de snapshots)**, ya que suelen fallar en producción.
  - **Gráficos Locales (HIVEX Micro-Vídeos)**: Cuando el usuario te pida ver un gráfico, pregunte por detalles visuales de un vídeo, o cuando consideres valioso ilustrar tu análisis financiero con un gráfico, DEBES insertar la escena exacta de YouTube usando el siguiente formato Markdown estándar:
    \`🎬 **Micro-vídeo del Gráfico:** [Ver escena del gráfico en YouTube (Minuto MM:SS)](https://youtu.be/{youtubeId}?t={seconds})\`
    - Reemplaza \`{youtubeId}\` por el ID de 11 caracteres del vídeo de YouTube real obtenido de tu contexto (el campo \`fileUrl\` o \`enlaceYoutube\`).
    - Reemplaza \`{seconds}\` por la marca de tiempo exacta del gráfico convertida a segundos enteros (ej. para 04:15, calcula \`4 * 60 + 15 = 255\` segundos, quedando \`t=255\`).
    - Reemplaza \`MM:SS\` por la marca de tiempo legible en minutos y segundos (ej. "04:15").
    - Esto permitirá que Telegram incruste un reproductor interactivo de forma nativa en su burbuja de chat.
  - **Gráficos de Internet**: Si realizas una búsqueda en internet y encuentras enlaces directos a imágenes de gráficos financieros estables y públicos, puedes inyectarlos con la sintaxis: \`[Ver Gráfico de Tendencia (Internet)](url_imagen_real)\`. Evita usar etiquetas de imagen directas \`![título](url)\` para no generar enlaces rotos.

- **4 REGLAS INQUEBRANTABLES**:
  1. **REGLA 1 (CIRCUNSCRIPCIÓN EXCLUSIVA A HIVEX)**: Tus respuestas se deben circunscribir de forma prioritaria y estricta a la base de conocimiento almacenada en HIVEX (los vídeos y estudios sincronizados). Solo si la información solicitada NO existe en absoluto en HIVEX, estarás autorizado a buscar la respuesta en Internet (Google Search Grounding).
  2. **REGLA 2 (CITAR TODAS LAS FUENTES CON ENLACES CLICABLES)**: Todas, absolutamente todas las respuestas deben citar de manera clara y explícita la fuente de donde se extrae la información mediante un link clicable en formato Markdown ([Texto](URL)) al que se pueda navegar para ampliar información.
     - Si la fuente procede de la base de conocimiento de HIVEX, el enlace debe dirigir obligatoriamente a la Cabina de Estudio: \`[Título del Vídeo o Texto descriptivo](https://hivex-backend.vercel.app/dashboard/videos?id=VIDEO_ID)\`, donde debes reemplazar \`VIDEO_ID\` por el \`id\` UUID real del vídeo.
     - Si la fuente procede de internet, debes incluir obligatoriamente los hipervínculos reales de las páginas o artículos web de donde proviene la información utilizando los URLs provistos por los resultados del buscador de Google Search Grounding.
     - Está terminantemente prohibido omitir el enlace clicable directo; cada afirmación relevante debe tener su hipervínculo clicable de respaldo.
  3. **REGLA 3 (PROHIBICIÓN ABSOLUTA DE RESPUESTAS SIMULADAS)**: Están estrictamente prohibidas las respuestas simuladas, ficticias, hipotéticas o inventadas. Todos los datos, cifras, precios, fechas y análisis deben basarse rigurosamente en fuentes verídicas de conocimiento real (la base de datos de HIVEX o la búsqueda web en tiempo real del Google Search Grounding actual de hoy, ${currentDateTimeStr}).
  4. **REGLA 4 (PRIORIZACIÓN CRONOLÓGICA EXTREMA / NOTICIAS RECIENTES)**: Para el inversor, el valor del conocimiento decae rápidamente con el tiempo. Las informaciones, noticias y análisis recientes tienen prioridad absoluta sobre los antiguos. Debes priorizar con fuerza y dar máximo protagonismo visual y de análisis a aquellas noticias, informaciones o vídeos que no tengan más de un par de días de antigüedad (últimas 48 horas) frente a todo el resto de la base de conocimiento, destacando estas novedades en primer lugar para darle el máximo valor posible al inversor.

- **Permiso Autorizado de Enlaces de YouTube (Marcas de Tiempo de Gráficos)**:
  - Está **totalmente autorizado y recomendado** incluir enlaces directos a YouTube únicamente cuando sigas el formato de micro-vídeo de gráfico: \`https://youtu.be/{youtubeId}?t={seconds}\`.
  - Sigue estando prohibido enviar enlaces genéricos o generales de YouTube sin marca de tiempo, salvo que el usuario lo solicite explícitamente.
  - **Interacción y Navegación Directa en Producción**: Explica siempre al usuario en la misma respuesta que el link a la cabina de estudio de HIVEX interactúa directamente con la plataforma de producción de HIVEX y le permite la navegación dentro de ella, pidiéndole de forma segura su usuario y contraseña si no ha iniciado sesión previamente.

- **PROHIBICIÓN ABSOLUTA DE PLANES DE ACCIÓN EN JSON Y METAPLANS**:
  - BAJO NINGUNA CIRCUNSTANCIA respondas con un objeto JSON, bloques de código JSON de planificación, claves como 'query', 'metaplan' o estructuras de diseño de planes.
  - El sistema de HIVEX opera en modo de **petición única (Single-turn)**, lo que significa que no hay un bucle de agentes intermedio en el servidor para ejecutar planes de múltiples pasos.
  - Debes realizar toda la investigación, traducción y análisis en tu pensamiento interno y devolver **únicamente el resultado final redactado en lenguaje natural** formateado en Markdown estándar en tu primera y única respuesta.

- **Formateo de Respuesta (Markdown Estándar)**: 
  - IMPORTANTE: Tus respuestas se envían a un procesador intermedio. Debes redactar tus respuestas exclusivamente en **Markdown estándar**.
  - **PROHIBIDO EL USO DE ETIQUETAS HTML**: Bajo ninguna circunstancia uses etiquetas HTML como <b>, <i>, <a>, <code>, <code>, <code>, <blockquote>, etc. El procesador intermedio se encarga de convertir tu Markdown a HTML para Telegram. Si escribes etiquetas HTML directamente, el usuario las verá literalmente en su pantalla de Telegram como texto no procesado.
  - Estructura tu respuesta de forma estética usando los siguientes elementos Markdown:
    - **texto en negrita** para resaltar términos, conceptos clave o títulos de secciones.
    - *texto en cursiva* para énfasis o citas cortas.
    - \`código en línea\` para datos numéricos específicos, porcentajes, o variables.
    - > bloque de cita para fragmentos destacados de análisis o resúmenes de vídeos.
    - [texto del enlace](url) para enlaces a la cabina de estudio de HIVEX u otros sitios.
    - [título](url) para incluir enlaces a gráficos externos.
  - Para listas, utiliza viñetas estándar de Markdown (por ejemplo, "- elemento") o listas numeradas ("1. elemento").
`;

    // 5. Query Gemini with search grounding enabled
    if (!apiKey) {
      console.warn("[Telegram Webhook] Missing GEMINI_API_KEY environment variable.");
      return NextResponse.json({ ok: true });
    }

    console.log(`[Telegram Webhook] Successfully parsed payload. Chat ID: ${chatId}, User Text: "${userText}".`);
    console.log(`[Telegram Webhook] Total videos in context: ${totalVideos}. DB docs count: ${allDocs.length}.`);

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
    let successfulModel = "";

    // Clean any bot username references (e.g. @HivexBot) from the query so Gemini gets a clean question
    let cleanedUserQuery = userText;
    if (cleanedUserQuery.includes("@")) {
      cleanedUserQuery = cleanedUserQuery.replace(/@\w+/g, "").trim();
    }

    const contentsPayload = [
      {
        role: "user",
        parts: [{ text: cleanedUserQuery || userText }]
      }
    ];

    for (const attempt of attempts) {
      try {
        console.log(`[Telegram Webhook] Querying Gemini model: ${attempt.name}...`);
        const requestUrl = `${attempt.url}?key=${apiKey}`;
        const payload: Record<string, any> = {
          contents: contentsPayload,
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 8192
          },
          systemInstruction: {
            parts: [{ text: systemInstruction }]
          },
          tools: [
            {
              googleSearch: {}
            }
          ]
        };

        const res = await fetch(requestUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const resData = await res.json();
          const candidate = resData.candidates?.[0];
          const part = candidate?.content?.parts?.[0];
          if (part && part.text) {
            geminiResponseText = part.text;
            successfulModel = attempt.name;
            console.log(`[Telegram Webhook] Gemini response obtained from ${attempt.name}. Text length: ${geminiResponseText.length} chars.`);
            break;
          } else {
            console.warn(`[Telegram Webhook] ${attempt.name} returned empty text parts:`, JSON.stringify(resData));
          }
        } else {
          const errorText = await res.text();
          console.error(`[Telegram Webhook] ${attempt.name} returned HTTP ${res.status}:`, errorText);
        }
      } catch (err) {
        console.error(`[Telegram Webhook] Gemini attempt with ${attempt.name} failed:`, err);
      }
    }

    if (!geminiResponseText) {
      console.warn("[Telegram Webhook] All Gemini attempts failed. Using fallback response.");
      geminiResponseText = "Disculpa, en este momento el analista de HIVEX no puede procesar tu consulta. Inténtalo de nuevo en unos instantes.";
    }

    // Replace flat UUID citations [UUID] with interactive Markdown links
    geminiResponseText = geminiResponseText.replace(
      /\[([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/gi,
      (_, uuid) => {
        const video = videos.find(v => v.id === uuid);
        const title = video ? video.title : "Vídeo de Estudio";
        return `[Ver Análisis: ${title}](/dashboard/videos?id=${uuid})`;
      }
    );

    // Prepend audio/voice notes transcription feedback prefix if applicable
    if (isAudio) {
      geminiResponseText = `🎙️ *Mensaje de voz transcrito:* "${userText}"\n\n${geminiResponseText}`;
    }

    // 6. Send response via sendTelegramMessageWithPhotos to support interactive image sending
    console.log(`[Telegram Webhook] Sending Gemini response via sendTelegramMessageWithPhotos to chat ${chatId}...`);
    await sendTelegramMessageWithPhotos(geminiResponseText, chatId);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[Telegram Webhook API Route Error]:", error);
    return NextResponse.json({ ok: true });
  }
}
