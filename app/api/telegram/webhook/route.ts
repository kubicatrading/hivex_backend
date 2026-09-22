import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabase as defaultSupabase, isUsingMock } from "@/lib/supabase";
import { markdownToTelegramHtml, splitMarkdown, sendTelegramMessageWithPhotos, escapeHtml, setTelegramLanguage } from "@/lib/telegram";

export const maxDuration = 300; // Extend Vercel execution duration to 300s (Pro plan limit) to prevent timeouts during complex Gemini queries with Search grounding

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
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent",
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.0-flash:generateContent",
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
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
                ],
                generationConfig: {
                  temperature: 0.1,
                  maxOutputTokens: 1024,
                  thinkingConfig: {
                    thinkingBudget: 0
                  }
                }
              })
            });

            if (res.ok) {
              const resData = await res.json();
              const parts = resData.candidates?.[0]?.content?.parts || [];
              const textPart = parts
                .filter((p: any) => !p.thought)
                .map((p: any) => p.text)
                .filter(Boolean)
                .join("") || "";
                
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

    // 2. Fetch user conversation history and documents from Supabase
    let allDocs: any[] = [];
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_PRODUCTION_URL;
    const supabaseServiceKey = process.env.SUPABASE_PRODUCTION_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    let supabaseClient = defaultSupabase;

    if (supabaseUrl && supabaseServiceKey) {
      supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false }
      });
    }

    // Load user's persistent conversation history for multi-turn conversational memory
    let userConversationDoc: any = null;
    let conversationHistory: Array<{
      role: "user" | "model";
      text: string;
      sender_id?: string;
      sender_name?: string;
      message_id?: number;
      timestamp?: number;
      reply_to_message_id?: number | null;
    }> = [];

    if (fromId) {
      try {
        const { data: convData, error: convErr } = await supabaseClient
          .from("documents")
          .select("id, metadata")
          .eq("type", "knowledge_transcription")
          .eq("metadata->>is_telegram_conversation", "true")
          .eq("metadata->>telegram_user_id", fromId)
          .maybeSingle();

        if (!convErr && convData) {
          userConversationDoc = convData;
          if (Array.isArray(convData.metadata?.history)) {
            conversationHistory = convData.metadata.history;
          }
          console.log(`[Telegram Webhook] Loaded ${conversationHistory.length} previous conversation turns for user ${fromId}.`);
        }
      } catch (convFetchErr) {
        console.error("[Telegram Webhook] Failed to fetch conversation history:", convFetchErr);
      }
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

    // 3. Fetch study base and magazine articles from Supabase
    try {
      // Query recent videos and study assets
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

    // Load recent magazine articles (Trends Journal & HIVEX Magazines)
    let magazineArticles: any[] = [];
    try {
      const { data: magData, error: magErr } = await supabaseClient
        .from("documents")
        .select("id, title, metadata, created_at, description")
        .eq("type", "knowledge_transcription")
        .eq("metadata->>is_magazine_article", "true")
        .order("created_at", { ascending: false })
        .limit(70);

      if (!magErr && magData) {
        magazineArticles = magData.map(m => ({
          id: m.id,
          titulo: m.title,
          categoria: m.metadata?.category || m.metadata?.main_category || "Macroeconomía y Tendencias",
          subcategoria: m.metadata?.subcategory || "",
          edicion: m.metadata?.issue_slug || "Revista Semanal",
          pagina: m.metadata?.start_page || 1,
          textoExtracto: Array.isArray(m.metadata?.paragraphs) ? m.metadata.paragraphs.slice(0, 3).join("\n") : (m.description || "")
        }));
        console.log(`[Telegram Webhook] Loaded ${magazineArticles.length} magazine articles into context.`);
      }
    } catch (magErr) {
      console.error("[Telegram Webhook] Error loading magazine articles:", magErr);
    }

    // Structure study base
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
      detallesPlataforma: "HIVEX es una plataforma premium e integral de estudio para inversores bursátiles y traders. Permite la sincronización en tiempo real de feeds de vídeo de YouTube de canales analíticos (Andrei Jikh, Judging Freedom, Cihat E. Çiçek, Zang International with Lynette Zang, The Rich Dad Channel, Trends Journal, Integral Forextv y Kanal Finans) y hemeroteca de revistas semanales (Trends Journal con Gerald Celente). La plataforma realiza de forma autónoma: transcripción de alta fidelidad, generación de resúmenes detallados de contenido estructurados cronológicamente, detección de charts (gráficos) con títulos y leyendas, y redacción de informes financieros y macroeconómicos rigurosos.",
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

    // 4. System prompt for Gemini tailored specifically for Telegram
    const systemInstruction = `Eres el Bot de Telegram de la plataforma premium HIVEX SaaS.
Fecha y hora actual en España (zona horaria de Madrid): ${currentDateTimeStr}.
Tu tono es sofisticado, profesional, riguroso, asertivo y objetivo, como un analista bursátil o banquero de inversión de élite.

INFORMACIÓN SOBRE EL INTERLOCUTOR:
${senderDetails}
Cuando respondas en el chat de grupo, debes saber exactamente con quién estás hablando. Trata a esa persona de manera personalizada según corresponda (por ejemplo, si te habla Ceren, trátala como Ceren y dirígete a ella como tal; si te habla Juanma, dirígete a él como Juanma y con un tono directo y asertivo de socio estratégico).

Tienes dos propósitos de servicio principales:

1. **SOPORTE Y AYUDA DE LA PLATAFORMA HIVEX**:
   - Responde preguntas sobre el funcionamiento de HIVEX (monitorización de vídeos, revistas semanales, transcripciones, análisis, traducción).
   - Tienes acceso en tiempo real a las estadísticas y datos de Supabase de los vídeos activos y revistas:
     ${JSON.stringify(statsContext, null, 2)}
   - Si se te pregunta qué vídeos hay sincronizados, cuántos hay o qué publicaciones existen, debes responder utilizando estrictamente estos datos reales para garantizar veracidad absoluta sin adivinar.

2. **ASISTENTE BURSÁTIL PREMIUM (ASESOR EN VIVO EN TELEGRAM)**:
   - Responde preguntas relacionadas con mercados, tendencias, riesgo bursátil, consejos y tomas de decisiones financieras en cada momento.
   - Tu base de conocimiento prioritaria e innegociable se compone de:
     A) **VÍDEOS Y ANÁLISIS DE MERCADO (Resúmenes, gráficos/charts e informes de análisis)**:
     ${JSON.stringify(consolidatedKnowledge, null, 2)}
     B) **REVISTAS SEMANALES Y TENDENCIAS MACROECONÓMICAS (HIVEX Magazines / Trends Journal)**:
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

- **REGLAS DE ORO OBLIGATORIAS DE COMUNICACIÓN EN TELEGRAM (5 NORMAS INQUEBRANTABLES)**:
  1. **REGLA 1 (PRESENTACIÓN FORMAL DEL INVERSOR AL INICIO)**: Toda información o análisis bursátil que se solicite en el chat debe ir precedida **obligatoriamente** por una breve presentación formal del inversor de HIVEX y qué se pretende presentar en ese mensaje. Esta presentación formal debe ubicarse en el **principio absoluto de tu respuesta**, antes de cualquier otra información, tabla o gráfico, asegurando que jamás aparezca al final de la comunicación. Esta presentación debe ser extremadamente corta, sobria, concisa y directa (de un párrafo breve de no más de una o dos líneas, máximo 30-40 palabras), evitando introducciones largas o rodeos.
  2. **REGLA 2 (ACOMPAÑAR TODA INFORMACIÓN DE SU FUENTE EXPLÍCITA)**: Toda información bursátil, datos macroeconómicos, cifras, precios o tendencias que se muestren debe venir acompañada de la fuente sobre la que se basa. Esta fuente debe indicarse de forma limpia e integrada mediante un link hipervínculo utilizando el propio título de la fuente (ya sea el título del vídeo en la cabina de estudio de HIVEX, el artículo de la revista de HIVEX, o bien el nombre limpio del artículo o web de donde provenga en Internet).
  3. **REGLA 3 (BÚSQUEDA PRIORITARIA EN TARJETAS DE GRÁFICOS / KNOWLEDGE_CHARTS Y ESTRUCTURA JERÁRQUICA)**: Ante cualquier tipo de información o análisis de mercado que se solicite, debes buscar **en primer lugar** en los gráficos detectados en la cabina de estudio (\`knowledge_charts\`). En este caso, la información debe presentarse estrictamente en formato "despacho premium" jerárquico:
     - **Prohibición de vídeo MP4 nativo**: Está terminantemente prohibido enviar archivos o reproductores nativos MP4 a Telegram. En su lugar, el acceso a cada vídeo se realiza a través de su enlace amigable acompañado de su captura fija (\`snapshot\`).
     - **Estructura jerárquica estricta (enlace + captura emparejados)**:
       1. Enlace amigable al fragmento de vídeo acotado: \`[Título Limpio del Gráfico](https://hivex-backend.vercel.app/dashboard/videos?id={videoId}&start={seconds}&end={endSeconds}&from=telegram)\`.
       2. Captura fija del gráfico pegada inmediatamente debajo: \`![Título Limpio del Gráfico](https://hivex-backend.vercel.app/snapshots/{videoId}/{seconds}.jpg)\`.
       3. Enlace amigable al vídeo completo: \`[Vídeo Completo: Título del Vídeo](https://hivex-backend.vercel.app/dashboard/videos?id={videoId}&from=telegram)\` (o en inglés: \`[Full Video: Video Title](https://hivex-backend.vercel.app/dashboard/videos?id={videoId}&from=telegram)\`).
       4. Carátula o portada del vídeo completo pegada inmediatamente debajo: \`![Título del Vídeo](https://hivex-backend.vercel.app/snapshots/{videoId}/0.jpg)\`.
     - **Si NO hay gráficos detectados**, se omiten estrictamente el enlace acotado y la captura fija, enviando solo el enlace al vídeo o revista y su carátula. Está terminantemente prohibido inventar marcas de tiempo o gráficos inexistentes.
     - Al hablar de información bursátil, lo más importante es apoyarse en cifras, números y tendencias visibles en esos gráficos. Completa y enriquece este análisis de gráficos utilizando la información de los otros documentos \`knowledge_*\` del contexto (análisis, resúmenes y artículos de revistas).
  4. **REGLA 4 (ENLACES COMPLETAMENTE LIMPIOS)**: Todos los enlaces hipervínculos que presentes deben ser limpios. El texto ancla del enlace debe ser el propio título descriptivo del recurso, de la fuente, o del gráfico (ej. \`[Título del Gráfico](url)\`, \`[Andrei Jikh - Título de Vídeo](url)\` o \`[Trends Journal - Título del Artículo](url)\`). Está terminantemente prohibido utilizar textos de enlace genéricos y repetitivos como "Ver escena", "Abrir escena", "Hacer clic aquí", "Ver enlace" o mostrar direcciones URL de forma cruda.
  5. **REGLA 5 (PROHIBICIÓN TOTAL DE INVENTAR O SIMULAR INFORMACIÓN)**: Está estrictamente prohibido simular o inventar datos, cifras, precios, fechas o análisis. Si algo no está respaldado por tu base de conocimiento o búsquedas en tiempo real, no lo menciones. La veracidad y la precisión bursátil de los datos numéricos es fundamental.

- **CONTINUIDAD CONVERSACIONAL Y SOPORTE DE REPLY (CITAS)**:
  - Tienes memoria activa de la conversación con este interlocutor. Mantén el hilo temático, las referencias previas y los acuerdos o advertencias dadas en turnos anteriores.
  - Si el usuario cita o hace "Reply" a un mensaje anterior (del bot o de otro miembro del grupo), tu respuesta debe retomar la conversación con absoluta fluidez en ese punto exacto, contestando a la nueva pregunta a la luz de lo que se dijo en el mensaje citado.

- **ADAPTACIÓN DE IDIOMA**:
  - Responde siempre en el idioma en que el usuario te hable o te solicite (español, inglés u otro). Las 5 Reglas de Oro se aplican con el mismo rigor adaptando los textos de forma natural al idioma solicitado.

- **PROHIBICIÓN ABSOLUTA DE PLANES DE ACCIÓN EN JSON Y METAPLANS**:
  - BAJO NINGUNA CIRCUNSTANCIA respondas con un objeto JSON, bloques de código JSON de planificación, claves como 'query', 'metaplan' o estructuras de diseño de planes.
  - El sistema de HIVEX opera en modo de **petición única (Single-turn)** para la llamada a Telegram.
  - Debes realizar toda la investigación, traducción y análisis en tu pensamiento interno y devolver **únicamente el resultado final redactado en lenguaje natural** formateado en Markdown estándar en tu primera y única respuesta.

- **Formateo de Respuesta (Markdown Estándar)**: 
  - IMPORTANTE: Tus respuestas se envían a un procesador intermedio. Debes redactar tus respuestas exclusivamente en **Markdown estándar**.
  - **PROHIBIDO EL USO DE ETIQUETAS HTML**: Bajo ninguna circunstancia uses etiquetas HTML como <b>, <i>, <a>, <code>, <blockquote>, etc. El procesador intermedio se encarga de convertir tu Markdown a HTML para Telegram. Si escribes etiquetas HTML directamente, el usuario las verá literalmente en su pantalla de Telegram como texto no procesado.
  - Estructura tu respuesta de forma estética usando Markdown estándar (**negrita**, *cursiva*, \`código en línea\`, > citas, [enlace limpio](url)).
`;

    // 5. Query Gemini with multi-turn conversation memory and search grounding
    if (!apiKey) {
      console.warn("[Telegram Webhook] Missing GEMINI_API_KEY environment variable.");
      return NextResponse.json({ ok: true });
    }

    // Clean any bot username references (e.g. @HivexBot) from the query
    let cleanedUserQuery = userText;
    if (cleanedUserQuery.includes("@")) {
      cleanedUserQuery = cleanedUserQuery.replace(/@\w+/g, "").trim();
    }

    // Format current turn incorporating Reply context if user quoted an earlier message
    let currentPromptText = cleanedUserQuery || userText;

    if (message.reply_to_message) {
      const replyMsg = message.reply_to_message;
      const replyFrom = replyMsg.from || {};
      const replyAuthor = replyFrom.first_name ? `${replyFrom.first_name} ${replyFrom.last_name || ""}`.trim() : (replyFrom.username || "Usuario");
      const replyDateStr = replyMsg.date ? new Date(replyMsg.date * 1000).toLocaleString("es-ES", { timeZone: "Europe/Madrid" }) : "Anterior";
      const replyText = replyMsg.text || replyMsg.caption || "[Mensaje multimedia / sin texto]";

      currentPromptText = `[CONTEXTO DE RESPUESTA A MENSAJE CITADO (REPLY)]:
El usuario está respondiendo específicamente al siguiente mensaje anterior en el chat de Telegram:
- Autor del mensaje citado: ${replyAuthor} (${replyFrom.is_bot ? "Bot HIVEX" : `@${replyFrom.username || "usuario"}`})
- Fecha del mensaje citado: ${replyDateStr}
- Mensaje citado:
"""
${replyText}
"""

[NUEVA PREGUNTA / MENSAJE DEL USUARIO]:
${currentPromptText}

(INSTRUCCIÓN OBLIGATORIA DE CONTINUIDAD: El usuario ha hecho un REPLY explícito para retomar o profundizar la conversación a partir de ese mensaje citado. Responde continuando la conversación exactamente desde ese punto, manteniendo coherencia total con lo que se dijo en el mensaje citado).`;
    }

    // Build multi-turn contents payload ensuring strictly alternating roles (user -> model -> user -> model)
    const contentsPayload: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

    // Take up to the last 10 turns (5 exchanges) from user's persistent memory
    const recentTurns = conversationHistory.slice(-10);
    let expectedRole: "user" | "model" = "user";

    for (const turn of recentTurns) {
      if (turn.role === expectedRole && turn.text) {
        contentsPayload.push({
          role: turn.role,
          parts: [{ text: turn.text }]
        });
        expectedRole = expectedRole === "user" ? "model" : "user";
      }
    }

    // Ensure the turn before our new message is 'model' (or array is empty)
    if (contentsPayload.length > 0 && contentsPayload[contentsPayload.length - 1].role === "user") {
      contentsPayload.pop();
    }

    // Append the current turn
    contentsPayload.push({
      role: "user",
      parts: [{ text: currentPromptText }]
    });

    console.log(`[Telegram Webhook] Successfully parsed payload. Chat ID: ${chatId}, User Text: "${userText}". Multi-turn count: ${contentsPayload.length}. Reply active: ${!!message.reply_to_message}.`);
    console.log(`[Telegram Webhook] Total videos in context: ${totalVideos}. DB docs count: ${allDocs.length}. Magazines count: ${magazineArticles.length}.`);

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
    let successfulModel = "";

    for (const attempt of attempts) {
      try {
        console.log(`[Telegram Webhook] Querying Gemini model: ${attempt.name}...`);
        const requestUrl = `${attempt.url}?key=${apiKey}`;
        const payload: Record<string, any> = {
          contents: contentsPayload,
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 8192,
            thinkingConfig: {
              thinkingBudget: 0
            }
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
          const parts = candidate?.content?.parts || [];
          const textResponse = parts
            .filter((p: any) => !p.thought)
            .map((p: any) => p.text)
            .filter(Boolean)
            .join("") || "";
            
          if (textResponse) {
            geminiResponseText = textResponse;
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

    // 7. Persist interaction into user's conversation memory in Supabase
    try {
      if (fromId && geminiResponseText) {
        const updatedHistory = [
          ...conversationHistory,
          {
            role: "user" as const,
            sender_id: fromId,
            sender_name: fromFullName || fromUsername || "Usuario",
            text: userText,
            message_id: message.message_id,
            timestamp: message.date || Math.floor(Date.now() / 1000),
            reply_to_message_id: message.reply_to_message?.message_id || null
          },
          {
            role: "model" as const,
            text: geminiResponseText,
            timestamp: Math.floor(Date.now() / 1000)
          }
        ];

        // Retain rolling window of up to 30 turns
        const cappedHistory = updatedHistory.slice(-30);

        if (userConversationDoc?.id) {
          await supabaseClient
            .from("documents")
            .update({
              metadata: {
                ...userConversationDoc.metadata,
                telegram_user_id: fromId,
                telegram_username: fromUsername,
                telegram_chat_id: chatId,
                last_updated: new Date().toISOString(),
                history: cappedHistory
              },
              updated_at: new Date().toISOString()
            })
            .eq("id", userConversationDoc.id);
        } else {
          await supabaseClient
            .from("documents")
            .insert({
              user_id: "5c8d65c6-0798-4f8a-aae3-dd2cebebd868",
              title: `[Telegram Context] - ${fromFullName || fromUsername || fromId} (${fromId})`,
              type: "knowledge_transcription",
              description: `Historial de conversación persistente en Telegram para ${fromFullName || fromUsername || fromId}`,
              metadata: {
                is_telegram_conversation: true,
                telegram_user_id: fromId,
                telegram_username: fromUsername,
                telegram_chat_id: chatId,
                last_updated: new Date().toISOString(),
                history: cappedHistory
              }
            });
        }
        console.log(`[Telegram Webhook] Successfully persisted conversation memory for user ${fromId} (${cappedHistory.length} turns).`);
      }
    } catch (saveMemoryErr) {
      console.error("[Telegram Webhook] Failed to persist conversation memory:", saveMemoryErr);
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[Telegram Webhook API Route Error]:", error);
    return NextResponse.json({ ok: true });
  }
}
