import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabase as defaultSupabase, isUsingMock } from "@/lib/supabase";
import { markdownToTelegramHtml, splitMarkdown, sendTelegramMessageWithPhotos, escapeHtml, setTelegramLanguage } from "@/lib/telegram";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    console.log("[Telegram Webhook] Received update payload:", JSON.stringify(payload));

    const message = payload.message || payload.edited_message;
    if (!message) {
      return NextResponse.json({ ok: true });
    }

    const fromUser = message.from || {};
    const fromId = fromUser.id?.toString() || "";
    const fromUsername = fromUser.username || "";
    const fromFirstName = fromUser.first_name || "";
    const fromLastName = fromUser.last_name || "";
    const fromFullName = `${fromFirstName} ${fromLastName}`.trim();

    console.log(`[Telegram Webhook] Sender Info - ID: ${fromId}, Username: ${fromUsername}, Full Name: ${fromFullName}`);

    let identifiedName = "";
    let senderDetails = "";


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

    // Determine sender identity and role dynamically or via hardcoded fallback rules
    const normalizedUsername = fromUsername.toLowerCase();
    const normalizedFirstName = fromFirstName.toLowerCase();
    const normalizedLastName = fromLastName.toLowerCase();
    const normalizedFullName = fromFullName.toLowerCase();

    const isCeren = fromId === "8963408509" || 
                    normalizedUsername === "cyildirim" || 
                    normalizedUsername === "cerendeinert" || 
                    normalizedFirstName.includes("ceren") ||
                    normalizedLastName.includes("yildirim") ||
                    normalizedLastName.includes("deinert") ||
                    normalizedFullName.includes("ceren");

    const isJuanma = fromId === "1450113787" || 
                     normalizedUsername === "jsaavedra" || 
                     normalizedUsername.includes("juanma") || 
                     normalizedFirstName.includes("juan") || 
                     normalizedFirstName.includes("juanma") ||
                     fromId === "111111"; // Mock ID for local tests

    console.log(`[Telegram Webhook] Identity checks - isCeren: ${isCeren}, isJuanma: ${isJuanma} (Normalized Username: "${normalizedUsername}", First: "${normalizedFirstName}", Last: "${normalizedLastName}", Full: "${normalizedFullName}")`);

    if (isCeren) {
      identifiedName = "Ceren Yildirim";
      senderDetails = "Te está hablando Ceren Yildirim (cofundadora de HIVEX, inversora principal y usuaria cyildirim). Dirígete a ella como Ceren con un trato premium, sofisticado y de máxima consideración.";
    } else if (isJuanma) {
      identifiedName = "Juan Manuel Saavedra";
      senderDetails = "Te está hablando Juanma (Juan Manuel Saavedra, fundador de HIVEX y director de análisis, usuario jsaavedra). Dirígete a él como Juanma con un trato profesional, asertivo y directo.";
    }

    try {
      if (fromId || fromUsername) {
        let dbQuery = supabaseClient.from("profiles").select("full_name, email, telegram_username, telegram_user_id");
        if (fromId) {
          dbQuery = dbQuery.or(`telegram_user_id.eq.${fromId},telegram_username.eq.${fromUsername}`);
        } else {
          dbQuery = dbQuery.eq("telegram_username", fromUsername);
        }
        
        const { data: dbProfiles, error: pError } = await dbQuery;
        
        if (!pError && dbProfiles && dbProfiles.length > 0) {
          const profile = dbProfiles[0];
          console.log("[Telegram Webhook] Matched sender profile in Supabase DB:", JSON.stringify(profile));
          if (!identifiedName) {
            identifiedName = profile.full_name || "";
            if (profile.email === "cerendeinert@hotmail.de") {
              senderDetails = "Te está hablando Ceren Yildirim (cofundadora de HIVEX, inversora principal y usuaria cyildirim). Dirígete a ella como Ceren con un trato premium, sofisticado y de máxima consideración.";
            } else if (profile.email === "semeviene@hotmail.es") {
              senderDetails = "Te está hablando Juanma (Juan Manuel Saavedra, fundador de HIVEX y director de análisis, usuario jsaavedra). Dirígete a él como Juanma con un trato profesional, asertivo y directo.";
            } else {
              senderDetails = `Te está hablando el usuario registrado ${profile.full_name} (Email: ${profile.email}). Trátalo de manera profesional, asertiva y sofisticada.`;
            }
          }
        }
      }
    } catch (profileErr) {
      console.error("[Telegram Webhook] Error matching sender profile in DB:", profileErr);
    }

    if (!senderDetails) {
      senderDetails = `Te está hablando un miembro del grupo con nombre "${fromFullName}" (ID de Telegram: ${fromId}, Username: @${fromUsername}). Trátalo de manera profesional y sofisticada como a todo inversor de HIVEX.`;
    }

    // Handle identity query /whoami to help debug ID / username issues in production
    let checkCommand = userText;
    if (checkCommand.startsWith("/")) {
      checkCommand = checkCommand.replace(/@\w+/, "");
    }
    if (checkCommand === "/whoami") {
      let recogName = "No reconocido (Usuario general)";
      if (isCeren) {
        recogName = "Ceren Yildirim (Cofundadora - Detectada por estática)";
      } else if (isJuanma) {
        recogName = "Juan Manuel Saavedra (Fundador - Detectado por estática)";
      } else if (identifiedName) {
        recogName = `${identifiedName} (Reconocido vía Base de Datos)`;
      }

      const whoamiMarkdown = `**🔍 DIAGNÓSTICO DE IDENTIDAD HIVEX**
━━━━━━━━━━━━━━━━━━━━━━━━━━
Aquí están tus datos de Telegram detectados en tiempo real:

• **ID de Telegram**: \`${fromId}\`
• **Nombre de usuario**: ${fromUsername ? `@${fromUsername}` : "*Ninguno*"}
• **Nombre de pila**: \`${fromFirstName}\`
• **Apellido**: \`${fromLastName || ""}\`
• **Nombre completo**: \`${fromFullName}\`

• **Identificación**: **${recogName}**
• **Detalles de Rol**:
${senderDetails}
━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      const whoamiText = markdownToTelegramHtml(whoamiMarkdown);

      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: whoamiText,
          parse_mode: "HTML",
        }),
      });

      return NextResponse.json({ ok: true });
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

INFORMACIÓN SOBRE EL INTERLOCUTOR:
${senderDetails}
Cuando respondas en el chat de grupo, debes saber exactamente con quién estás hablando. Trata a esa persona de manera personalizada según corresponda (por ejemplo, si te habla Ceren, trátala como Ceren y dirígete a ella como tal; si te habla Juanma, dirígete a él como Juanma y con un tono directo y asertivo de socio estratégico).

Tienes dos propósitos de servicio principales:

1. **SOPORTE Y AYUDA DE LA PLATAFORMA HIVEX**:
   - Responde preguntas sobre el funcionamiento de HIVEX (monitorización de vídeos, transcripciones, análisis, traducción).
   - Tienes acceso en tiempo real a las estadísticas y datos de Supabase:
     ${JSON.stringify(statsContext, null, 2)}
   - Si se te pregunta qué vídeos hay sincronizados o cuántos hay, debes responder utilizando estrictamente estos datos reales para garantizar veracidad absoluta sin adivinar.

2. **ASISTENTE BURSÁTIL PREMIUM (ASESOR EN VIVO EN TELEGRAM)**:
   - Responde preguntas relacionadas con mercados, tendencias, riesgo bursátil, consejos y tomas de decisiones financieras en cada momento.
   - Tu base de conocimiento prioritaria es la información de estudio de los vídeos sincronizados (resúmenes, gráficos/charts e informe de análisis):
     ${JSON.stringify(consolidatedKnowledge, null, 2)}

- **REGLAS DE ORO OBLIGATORIAS DE COMUNICACIÓN EN TELEGRAM (5 NORMAS INQUEBRANTABLES)**:
  1. **REGLA 1 (PRESENTACIÓN FORMAL DEL INVERSOR AL INICIO)**: Toda información o análisis bursátil que se solicite en el chat debe ir precedida **obligatoriamente** por una breve presentación formal del inversor de HIVEX y qué se pretende presentar en ese mensaje. Esta presentación formal debe ubicarse en el **principio absoluto de tu respuesta**, antes de cualquier otra información, tabla o gráfico, asegurando que jamás aparezca al final de la comunicación. Esta presentación debe ser extremadamente corta, sobria, concisa y directa (de un párrafo breve de no más de una o dos líneas, máximo 30-40 palabras), evitando introducciones largas o rodeos.
  2. **REGLA 2 (ACOMPAÑAR TODA INFORMACIÓN DE SU FUENTE EXPLÍCITA)**: Toda información bursátil, datos macroeconómicos, cifras, precios o tendencias que se muestren debe venir acompañada de la fuente sobre la que se basa. Esta fuente debe indicarse de forma limpia e integrada mediante un link hipervínculo utilizando el propio título de la fuente (ya sea el título del vídeo en la cabina de estudio de HIVEX, o bien el nombre limpio del artículo o web de donde provenga en Internet).
  3. **REGLA 3 (BÚSQUEDA PRIORITARIA EN TARJETAS DE GRÁFICOS / KNOWLEDGE_CHARTS)**: Ante cualquier tipo de información o análisis de mercado que se solicite, debes buscar **en primer lugar** en los mini vídeos guardados en la videoteca dentro de las tarjetas de gráficos detectados en la cabina de estudio (\`knowledge_charts\`). En este caso, la información debe presentarse estrictamente en formato "despacho premium":
     - Debes incluir la referencia visual del gráfico usando la sintaxis: \`![Título Limpio del Gráfico](https://lhtlrztsmkllcqiziftn.supabase.co/storage/v1/object/public/documents/clips/{videoId}/{seconds}.mp4)\` (nuestro procesador intermedio interceptará automáticamente este URL de clips y lo convertirá en la captura fija JPG para optimización de costes y seguridad, por lo que tú debes escribir esta URL exactamente con este formato de clips).
     - El enlace de acceso premium hacia el fragmento de vídeo acotado dentro de la cabina de estudio debe ser **el propio nombre o título del gráfico**: \`[Título Limpio del Gráfico](https://hivex-backend.vercel.app/dashboard/videos?id={videoId}&start={seconds}&end={endSeconds}&from=telegram)\`.
     - **Siempre, obligatoriamente**, debes añadir además el enlace de la fuente enlazando al vídeo completo en la cabina de estudio de HIVEX: \`[Vídeo Completo: Título del Vídeo](https://hivex-backend.vercel.app/dashboard/videos?id={videoId})\`.
     - Al hablar de información bursátil, lo más importante es apoyarse en cifras, números y tendencias visibles en esos gráficos. Completa y enriquece este análisis de gráficos utilizando la información de los otros documentos \`knowledge_*\` del contexto.
  4. **REGLA 4 (ENLACES COMPLETAMENTE LIMPIOS)**: Todos los enlaces hipervínculos que presentes deben ser limpios. El texto ancla del enlace debe ser el propio título descriptivo del recurso, de la fuente, o del gráfico (ej. \`[Título del Gráfico](url)\` o \`[Andrei Jikh - Título de Vídeo](url)\`). Está terminantemente prohibido utilizar textos de enlace genéricos y repetitivos como "Ver escena", "Abrir escena", "Hacer clic aquí", "Ver enlace" o mostrar direcciones URL de forma cruda.
  5. **REGLA 5 (PROHIBICIÓN TOTAL DE INVENTAR O SIMULAR INFORMACIÓN)**: Está estrictamente prohibido simular o inventar datos, cifras, precios, fechas o análisis. Si algo no está respaldado por tu base de conocimiento o búsquedas en tiempo real, no lo menciones. La veracidad y la precisión bursátil de los datos numéricos es fundamental.

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
