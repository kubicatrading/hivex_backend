import * as fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { sendTelegramMessageWithPhotos } from '../lib/telegram';

// 1. Read and load all environment variables from .env.local
const envPath = path.join(__dirname, '../.env.local');
console.log(`[Test Dispatch] Loading environment variables from: ${envPath}`);
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, 'utf8');
  envText.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.\-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] || "";
      value = value.replace(/^["']|["']$/g, "").trim();
      process.env[match[1]] = value;
    }
  });
}

// Ensure critical variables are loaded
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const apiKey = process.env.GEMINI_API_KEY;
const supabaseUrl = process.env.SUPABASE_PRODUCTION_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_PRODUCTION_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!botToken || !chatId || !apiKey || !supabaseUrl || !supabaseServiceKey) {
  console.error("[Test Dispatch] Missing critical environment variables!");
  console.log({
    TELEGRAM_BOT_TOKEN: !!botToken,
    TELEGRAM_CHAT_ID: !!chatId,
    GEMINI_API_KEY: !!apiKey,
    SUPABASE_URL: !!supabaseUrl,
    SUPABASE_SERVICE_KEY: !!supabaseServiceKey
  });
  process.exit(1);
}

// Initialize Supabase Client
const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function queryGemini(prompt: string, withSearch: boolean, consolidatedKnowledge: any[], statsContext: any) {
  const currentDateTimeStr = new Date().toLocaleString("es-ES", { timeZone: "Europe/Madrid" });

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
  - **PROHIBIDO EL USO DE ETIQUETAS HTML**: Bajo ninguna circunstancia uses etiquetas HTML como <b>, <i>, <a>, <code>, etc. El procesador intermedio se encarga de convertir tu Markdown a HTML para Telegram. Si escribes etiquetas HTML directamente, el usuario las verá literalmente en su pantalla de Telegram como texto no procesado.
  - Estructura tu respuesta de forma estética usando los siguientes elementos Markdown:
    - **texto en negrita** para resaltar términos, conceptos clave o títulos de secciones.
    - *texto en cursiva* para énfasis o citas cortas.
    - \`código en línea\` para datos numéricos específicos, porcentajes, o variables.
    - > bloque de cita para fragmentos destacados de análisis o resúmenes de vídeos.
    - [texto del enlace](url) para enlaces a la cabina de estudio de HIVEX u otros sitios.
    - [título](url) para incluir enlaces a gráficos externos.
  - Para listas, utiliza viñetas estándar de Markdown (por ejemplo, "- elemento") o listas numeradas ("1. elemento").
`;

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

  const contentsPayload = [
    {
      role: "user",
      parts: [{ text: prompt }]
    }
  ];

  let geminiResponseText = "";

  for (const attempt of attempts) {
    try {
      console.log(`[Test Dispatch] Querying Gemini model: ${attempt.name} (withSearch: ${withSearch})...`);
      const requestUrl = `${attempt.url}?key=${apiKey}`;
      const payload: Record<string, any> = {
        contents: contentsPayload,
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096
        },
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        }
      };

      if (withSearch) {
        payload.tools = [
          {
            googleSearch: {}
          }
        ];
      }

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
          console.log(`[Test Dispatch] Gemini response obtained from ${attempt.name}. Text length: ${geminiResponseText.length} chars.`);
          break;
        } else {
          console.warn(`[Test Dispatch] ${attempt.name} returned empty text parts:`, JSON.stringify(resData));
        }
      } else {
        const errorText = await res.text();
        console.error(`[Test Dispatch] ${attempt.name} returned HTTP ${res.status}:`, errorText);
      }
    } catch (err) {
      console.error(`[Test Dispatch] Gemini attempt with ${attempt.name} failed:`, err);
    }
  }

  return geminiResponseText;
}

async function run() {
  console.log("[Test Dispatch] Querying Supabase for study base context...");
  
  // 1. Fetch study base documents
  let allDocs: any[] = [];
  try {
    const { data, error } = await supabaseClient
      .from("documents")
      .select("id, title, type, file_url, created_at, metadata, description")
      .in("type", ["video", "knowledge_summary", "knowledge_charts", "knowledge_analysis"])
      .order("created_at", { ascending: false })
      .limit(100);
    
    if (!error && data) {
      allDocs = data;
    } else if (error) {
      console.error("[Test Dispatch] Supabase error:", error);
      process.exit(1);
    }
  } catch (dbErr) {
    console.error("[Test Dispatch] DB query crash:", dbErr);
    process.exit(1);
  }

  // 2. Assemble context structured documents
  const videos = allDocs.filter(d => d.type === "video");
  const summaries = allDocs.filter(d => d.type === "knowledge_summary");
  const chartsList = allDocs.filter(d => d.type === "knowledge_charts");
  const analyses = allDocs.filter(d => d.type === "knowledge_analysis");

  const consolidatedKnowledge = videos.map(video => {
    const videoUrl = video.file_url;
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
    detallesPlataforma: "HIVEX es una plataforma premium e integral de estudio para inversores bursátiles.",
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

  console.log(`[Test Dispatch] Consolidated knowledge constructed with ${consolidatedKnowledge.length} videos.`);

  // Define the common question
  const promptQuery = "Por favor, brinda consejos de inversión de alta gama según el análisis de mercado de las últimas 48 horas (últimos vídeos y estudios en HIVEX).";

  // ==========================================
  // TEST 1: STRICT HIVEX CONTEXT (No Internet)
  // ==========================================
  console.log("\n========================================================");
  console.log("TEST 1: STRICT HIVEX CONTEXT (No Internet Search)");
  console.log("========================================================");
  
  const response1 = await queryGemini(promptQuery, false, consolidatedKnowledge, statsContext);
  if (response1) {
    // Replace flat UUID citations [UUID] with interactive Markdown links
    let formattedResponse1 = response1.replace(
      /\[([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/gi,
      (_, uuid) => {
        const video = videos.find(v => v.id === uuid);
        const title = video ? video.title : "Vídeo de Estudio";
        return `[${title}](https://hivex-backend.vercel.app/dashboard/videos?id=${uuid})`;
      }
    );

    console.log(`[Test 1] Dispatching response to Telegram Chat ID: ${chatId}...`);
    try {
      const result1 = await sendTelegramMessageWithPhotos(formattedResponse1, chatId);
      console.log("[Test 1] Dispatched successfully! Result:", result1);
    } catch (telegramErr) {
      console.error("[Test 1] Telegram send error:", telegramErr);
    }
  } else {
    console.error("[Test 1] Failed to obtain Gemini response.");
  }

  // Sleep for 3 seconds to preserve message ordering and respect Telegram limits
  console.log("[Test Dispatch] Waiting 3 seconds before Test 2...");
  await new Promise(resolve => setTimeout(resolve, 3000));

  // ==========================================
  // TEST 2: HIVEX CONTEXT + GOOGLE SEARCH GROUNDING
  // ==========================================
  console.log("\n========================================================");
  console.log("TEST 2: HIVEX CONTEXT + GOOGLE SEARCH GROUNDING");
  console.log("========================================================");
  
  const response2 = await queryGemini(promptQuery + " Complementa el análisis con las últimas noticias e indicadores macroeconómicos de Internet en tiempo real.", true, consolidatedKnowledge, statsContext);
  if (response2) {
    // Replace flat UUID citations [UUID] with interactive Markdown links
    let formattedResponse2 = response2.replace(
      /\[([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/gi,
      (_, uuid) => {
        const video = videos.find(v => v.id === uuid);
        const title = video ? video.title : "Vídeo de Estudio";
        return `[${title}](https://hivex-backend.vercel.app/dashboard/videos?id=${uuid})`;
      }
    );

    console.log(`[Test 2] Dispatching response to Telegram Chat ID: ${chatId}...`);
    try {
      const result2 = await sendTelegramMessageWithPhotos(formattedResponse2, chatId);
      console.log("[Test 2] Dispatched successfully! Result:", result2);
    } catch (telegramErr) {
      console.error("[Test 2] Telegram send error:", telegramErr);
    }
  } else {
    console.error("[Test 2] Failed to obtain Gemini response.");
  }

  console.log("\n[Test Dispatch] All tests completed!");
}

run();
