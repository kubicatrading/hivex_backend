import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabase as defaultSupabase, isUsingMock } from "@/lib/supabase";

/**
 * Basic markdown-to-Telegram-HTML conversion utility to ensure
 * formatted text is robustly parsed by Telegram's strict HTML parser.
 */
function markdownToTelegramHtml(markdown: string): string {
  if (!markdown) return "";

  // 1. First escape raw HTML tags
  let html = markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // 2. Convert Headings (e.g., ### Title -> <b>Title</b>)
  html = html.replace(/^###?\s+(.*)$/gm, "<b>$1</b>");
  html = html.replace(/^##\s+(.*)$/gm, "<b>$1</b>");
  html = html.replace(/^#\s+(.*)$/gm, "<b>$1</b>");

  // 3. Convert bold (**text** or __text__)
  html = html.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
  html = html.replace(/__(.*?)__/g, "<b>$1</b>");

  // 4. Convert italic (*text* or _text_)
  html = html.replace(/\*(.*?)\*/g, "<i>$1</i>");
  html = html.replace(/_([^_]+)_/g, "<i>$1</i>");

  // 5. Convert inline code (`code`)
  html = html.replace(/`(.*?)`/g, "<code>$1</code>");

  // 6. Convert markdown links: [text](url) -> <a href="url">text</a>
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');

  // 7. Convert lists (- item or * item -> • item)
  html = html.replace(/^\s*[-*+]\s+(.*)$/gm, "• $1");

  return html;
}

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
      const welcomeText = `<b>🤖 ASISTENTE BURSÁTIL HIVEX</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━

¡Bienvenido al canal interactivo de <b>HIVEX</b>!

Estoy conectado de forma segura y en tiempo real a tu base de conocimiento de videos de análisis macroeconómico sincronizados (<i>Andrei Jikh</i> y <i>Judging Freedom</i>) y dispongo de conexión a internet por satélite para tendencias de hoy.

<b>¿Cómo puedo ayudarte hoy?</b>
• Hazme preguntas sobre geopolítica o macroeconomía (ej: <i>"¿Cuál es el diferencial del precio del oro en Shanghái?"</i>).
• Pregúntame qué vídeos tienes sincronizados (ej: <i>"¿Cuántos vídeos tengo en Supabase?"</i>).
• Pídeme resúmenes de tus canales o análisis específicos de un ponente.

━━━━━━━━━━━━━━━━━━━━━━━━━━
<i>Temperatura de IA configurada en 0.2 (Análisis Factual de Alta Rigurosidad)</i>`;

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
- **Formato HTML de Telegram**: 
  - IMPORTANTE: Tus respuestas se envían directamente a Telegram y serán interpretadas por su parseador de HTML con parse_mode='HTML'.
  - Debes estructurar tu respuesta de forma estética usando EXCLUSIVAMENTE las siguientes etiquetas HTML permitidas por Telegram:
    - <b>negrita</b>
    - <i>cursiva</i>
    - <code>código en línea</code>
    - <pre>bloque de código</pre>
    - <blockquote>bloque de cita</blockquote>
    - <a href="url">enlace</a>
  - EVITA CUALQUIER OTRA ETIQUETA (como <h1>, <h2>, <ul>, <li>, <p>, etc.) ya que romperían el parseador de Telegram y el mensaje no se entregaría. Para las listas, utiliza el carácter viñeta física como "• " al inicio de la línea y saltos de línea normales.
- **Formato de Enlaces**: Usa enlaces HTML estándar: <a href="https://...">Texto</a>.
`;

    // 5. Query Gemini with search grounding enabled
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("[Telegram Webhook] Missing GEMINI_API_KEY environment variable.");
      return NextResponse.json({ ok: true });
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
    let successfulModel = "";

    const contentsPayload = [
      {
        role: "user",
        parts: [{ text: userText }]
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
            break;
          }
        }
      } catch (err) {
        console.error(`[Telegram Webhook] Gemini attempt with ${attempt.name} failed:`, err);
      }
    }

    if (!geminiResponseText) {
      geminiResponseText = "Disculpa, en este momento el analista de HIVEX no puede procesar tu consulta. Inténtalo de nuevo en unos instantes.";
    }

    // 6. Convert Gemini's markdown response to Telegram-compatible HTML
    const telegramHtml = markdownToTelegramHtml(geminiResponseText);

    // 7. Send the reply back to the Telegram chat
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: telegramHtml,
        parse_mode: "HTML",
        disable_web_page_preview: false,
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[Telegram Webhook API Route Error]:", error);
    return NextResponse.json({ ok: true });
  }
}
