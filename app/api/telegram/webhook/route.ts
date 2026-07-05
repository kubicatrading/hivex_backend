import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabase as defaultSupabase, isUsingMock } from "@/lib/supabase";
import { markdownToTelegramHtml } from "@/lib/telegram";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    console.log("[Telegram Webhook] Received update payload:", JSON.stringify(payload));

    // Telegram sends message details inside payload.message
    const message = payload.message;
    if (!message || !message.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const userText = message.text.trim();
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
      console.warn("[Telegram Webhook] Missing TELEGRAM_BOT_TOKEN environment variable.");
      return NextResponse.json({ ok: true });
    }

    // 1. Handle Slash Commands (/start or /help)
    if (userText === "/start" || userText === "/help") {
      const welcomeMarkdown = `**🤖 ASISTENTE BURSÁTIL HIVEX**
━━━━━━━━━━━━━━━━━━━━━━━━━━

¡Bienvenido al canal interactivo de **HIVEX**!

Estoy conectado de forma segura y en tiempo real a tu base de conocimiento de videos de análisis macroeconómico sincronizados (*Andrei Jikh* y *Judging Freedom*) y dispongo de conexión a internet por satélite para tendencias de hoy.

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
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_PRODUCTION_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    let supabaseClient = defaultSupabase;

    if (supabaseUrl && supabaseServiceKey) {
      supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false }
      });
    }

    try {
      const { data, error } = await supabaseClient
        .from("documents")
        .select("*");
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
        transcription: transcriptionDoc?.metadata?.texto_transcripcion || transcriptionDoc?.metadata?.transcription || "",
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
      detallesPlataforma: "HIVEX es una plataforma premium e integral de estudio para inversores bursátiles y traders. Permite la sincronización en tiempo real de feeds de vídeo de YouTube de canales analíticos (Andrei Jikh y Judging Freedom). La plataforma realiza de forma autónoma: transcripción de alta fidelidad, generación de resúmenes detallados de contenido estructurados cronológicamente, detección de charts (gráficos) con títulos y leyendas, y redacción de informes financieros y macroeconómicos rigurosos.",
      estadoBaseDatosSupabase: {
        totalVideosSincronizados: totalVideos,
        videosPorCanal: channelsCount,
        listaVideos: videos.map(v => ({
          titulo: v.title,
          canal: v.metadata?.channel_title || "Andrei Jikh",
          fechaSincronizacion: v.created_at,
          enlaceYoutube: v.file_url,
          tieneEstudioCompleto: consolidatedKnowledge.some(k => k.id === v.id && (k.summary || k.analysis))
        }))
      }
    };

    // 4. System prompt for Gemini tailored specifically for Telegram
    const systemInstruction = `Eres el Bot de Telegram de la plataforma premium HIVEX SaaS.
Tu tono es sofisticado, profesional, riguroso, asertivo y objetivo, como un analista bursátil o banquero de inversión de élite.

Tienes dos propósitos de servicio principales:

1. **SOPORTE Y AYUDA DE LA PLATAFORMA HIVEX**:
   - Responde preguntas sobre el funcionamiento de HIVEX (monitorización de vídeos, transcripciones, análisis, traducción).
   - Tienes acceso en tiempo real a las estadísticas y datos de Supabase:
     ${JSON.stringify(statsContext, null, 2)}
   - Si se te pregunta qué vídeos hay sincronizados o cuántos hay, debes responder utilizando estrictamente estos datos reales para garantizar veracidad absoluta sin adivinar.

2. **ASISTENTE BURSÁTIL PREMIUM (ASESOR EN VIVO EN TELEGRAM)**:
   - Responde preguntas relacionadas con mercados, tendencias, riesgo bursátil, consejos y tomas de decisiones financieras en cada momento.
   - Tu base de conocimiento prioritaria es la información de estudio derivada de los vídeos sincronizados (transcripción literal completa, resúmenes estructurados, gráficos/charts detectados e informe de análisis):
     ${JSON.stringify(consolidatedKnowledge, null, 2)}

NORMAS IMPORTANTES DE OPERACIÓN (CUMPLE SIN EXCEPCIONES):
- **Temperatura de IA**: Tu razonamiento se limita a una temperatura de 0.2 (preciso, estricto, factual).
- **Búsqueda en Internet Autorizada (Google Search Grounding)**: Tienes acceso directo a internet de forma ilimitada para dar respuestas en tiempo real de hoy (${new Date().toLocaleDateString("es-ES")}).
- **Lógica de Respuestas**:
  - Si el usuario te pregunta sobre temas cubiertos en la base de conocimiento local (los vídeos sincronizados), debes responder fundamentándote en ella y citar el vídeo correspondiente (indicando su título y canal).
  - Si el usuario te pregunta sobre tendencias de hoy, cotizaciones en tiempo real o temas bursátiles generales que NO están cubiertos en los vídeos de HIVEX, DEBES realizar de forma inmediata una búsqueda en Google (Search Grounding) para proporcionar una respuesta de mercado rigurosa y de hoy. No inventes datos ni devuelvas fallbacks textuales de falta de información; en Telegram debes solventar la consulta del inversor al instante buscando en la web.
- **Formato de Respuesta (Markdown Estándar)**: 
  - IMPORTANTE: Tus respuestas se envían a un procesador intermedio. Debes redactar tus respuestas exclusivamente en **Markdown estándar**.
  - **PROHIBIDO EL USO DE ETIQUETAS HTML**: Bajo ninguna circunstancia uses etiquetas HTML como <b>, <i>, <a>, <code>, <blockquote>, etc. El procesador intermedio se encarga de convertir tu Markdown a HTML para Telegram. Si escribes etiquetas HTML directamente, el usuario las verá literalmente en su pantalla de Telegram como texto no procesado.
  - Estructura tu respuesta de forma estética usando los siguientes elementos Markdown:
    - **texto en negrita** para resaltar términos, conceptos clave o títulos de secciones.
    - *texto en cursiva* para énfasis o citas cortas.
    - \`código en línea\` para datos numéricos específicos, porcentajes, o variables.
    - > bloque de cita para fragmentos destacados de análisis o resúmenes de vídeos.
    - [texto del enlace](url) para enlaces a páginas web o videos de Youtube.
  - Para listas, utiliza viñetas estándar de Markdown (por ejemplo, "- elemento") o listas numeradas ("1. elemento").

`;

    // 5. Query Gemini with search grounding enabled
    const apiKey = process.env.GEMINI_API_KEY;
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

    const contentsPayload = [
      {
        role: "user",
        parts: [{ text: userText }]
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

    // 6. Convert Gemini's markdown response to Telegram-compatible HTML
    const telegramHtml = markdownToTelegramHtml(geminiResponseText);
    console.log(`[Telegram Webhook] Final formatted Telegram HTML (length: ${telegramHtml.length} chars):\n`, telegramHtml);

    // 7. Send the reply back to the Telegram chat
    console.log(`[Telegram Webhook] Sending reply to Telegram chat ${chatId}...`);
    const telRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: telegramHtml,
        parse_mode: "HTML",
        disable_web_page_preview: false,
      }),
    });

    const telData = await telRes.json();
    if (!telRes.ok || !telData.ok) {
      console.error("[Telegram Webhook] Failed to send message to Telegram API:", telData.description || `HTTP ${telRes.status}`);
    } else {
      console.log("[Telegram Webhook] Message sent successfully to Telegram API! Message ID:", telData.result?.message_id);
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[Telegram Webhook API Route Error]:", error);
    return NextResponse.json({ ok: true });
  }
}
