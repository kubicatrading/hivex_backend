import { NextResponse } from "next/server";
import { YoutubeTranscript } from "youtube-transcript";
import { extractSnapshotsInBackground } from "@/lib/snapshotExtractor";

export const maxDuration = 300; // Extend Vercel execution duration to 300s (Pro plan limit) to prevent timeouts during transcription


// Exact system instruction matching user requirements for Google Gemini
const SYSTEM_INSTRUCTION = `You are the Google Gemini model, a high-precision professional transcriber and elite content analyst. Your task is to process a raw, auto-generated transcript of a YouTube video and generate a JSON response with exactly two properties: "transcription" (verbatim refinement) and "analysis" (objective summary and investment report).`;

interface TranscribeRequestBody {
  videoId: string;
  fileUrl: string;
  title: string;
  description?: string;
  duration?: string;
}

export function extractYoutubeId(fileUrl: string, videoId?: string): string | null {
  if (!fileUrl) {
    if (videoId && videoId.length === 11 && !videoId.startsWith("yt-video-")) {
      return videoId;
    }
    return null;
  }
  
  // Try to parse from various YouTube URL formats
  // 1. embed: https://www.youtube.com/embed/dQw4w9WgXcQ
  // 2. watch: https://www.youtube.com/watch?v=dQw4w9WgXcQ
  // 3. short: https://youtu.be/dQw4w9WgXcQ
  // 4. shorts: https://www.youtube.com/shorts/dQw4w9WgXcQ
  
  const regexes = [
    /youtube\.com\/embed\/([a-zA-Z0-9_\-]{11})/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_\-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_\-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_\-]{11})/
  ];

  for (const regex of regexes) {
    const match = fileUrl.match(regex);
    if (match && match[1]) {
      return match[1];
    }
  }

  // If videoId is a direct 11-char ID
  if (videoId && videoId.length === 11 && !videoId.startsWith("yt-video-")) {
    return videoId;
  }

  // If fileUrl itself is exactly 11 chars and looks like a video ID
  const trimmedFileUrl = fileUrl.trim();
  if (trimmedFileUrl.length === 11 && /^[a-zA-Z0-9_\-]{11}$/.test(trimmedFileUrl)) {
    return trimmedFileUrl;
  }

  // If videoId contains a clean 11-char ID at the end
  if (videoId) {
    const cleanId = videoId.startsWith("yt-video-") ? videoId.slice(9) : videoId;
    if (cleanId.length === 11 && /^[a-zA-Z0-9_\-]{11}$/.test(cleanId)) {
      return cleanId;
    }
  }

  return null;
}

function getRecommendedIntervalText(durationStr: string): string {
  if (!durationStr) return "cada 3 o 4 minutos";
  
  const parts = durationStr.split(":").map(p => parseInt(p, 10));
  if (parts.some(isNaN)) return "cada 3 o 4 minutos";
  
  let totalSeconds = 0;
  if (parts.length === 3) {
    totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    totalSeconds = parts[0] * 60 + parts[1];
  } else if (parts.length === 1) {
    totalSeconds = parts[0];
  } else {
    return "cada 3 o 4 minutos";
  }

  if (totalSeconds <= 600) {
    return "cada 1 o 2 minutos";
  } else if (totalSeconds <= 1800) {
    return "cada 3 o 4 minutos";
  } else if (totalSeconds <= 3600) {
    return "cada 5 o 6 minutos";
  } else if (totalSeconds <= 7200) {
    return "cada 8 o 10 minutos";
  } else {
    return "cada 12 o 15 minutos";
  }
}

function cleanGeminiJsonResponse(rawText: string): string {
  let cleaned = rawText.trim();
  
  // 1. Remove markdown code block wraps (```json ... ``` or ``` ... ```)
  if (cleaned.startsWith("```")) {
    const match = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (match) {
      cleaned = match[1].trim();
    }
  }
  
  // 2. Extract content between the first '{' and the last '}' inclusive.
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  
  return cleaned;
}

function sanitizeJsonString(raw: string): string {
  let inString = false;
  let result = "";
  let i = 0;
  while (i < raw.length) {
    const char = raw[i];
    if (char === '"') {
      let backslashes = 0;
      let j = i - 1;
      while (j >= 0 && raw[j] === '\\') {
        backslashes++;
        j--;
      }
      if (backslashes % 2 === 0) {
        inString = !inString;
      }
      result += char;
    } else if (inString) {
      if (char === '\n') {
        result += '\\n';
      } else if (char === '\r') {
        result += '\\r';
      } else if (char === '\t') {
        result += '\\t';
      } else {
        const code = char.charCodeAt(0);
        if (code < 32) {
          result += "\\u" + code.toString(16).padStart(4, "0");
        } else {
          result += char;
        }
      }
    } else {
      result += char;
    }
    i++;
  }
  return result;
}

function tryExtractAndRepairJson(raw: string): { transcription?: string; analysis: string } | null {
  try {
    const clean = raw.trim();
    
    // Check if "analysis" is present
    const analysisRegex = /['"]?analysis['"]?\s*:\s*['"]/i;
    const analysisMatch = analysisRegex.exec(clean);
    if (!analysisMatch) return null;
    
    const analysisStartPos = analysisMatch.index + analysisMatch[0].length;
    
    // Check if "transcription" is also present
    const transcriptionRegex = /['"]?transcription['"]?\s*:\s*['"]/i;
    const transcriptionMatch = transcriptionRegex.exec(clean);
    
    let transcriptionValue: string | undefined = undefined;
    let analysisValue = "";
    
    const normalizeUnescape = (str: string) => {
      return str
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\\\/g, '\\');
    };

    if (transcriptionMatch) {
      // Both transcription and analysis are present
      // Determine order
      if (transcriptionMatch.index < analysisMatch.index) {
        // transcription comes first
        const tStart = transcriptionMatch.index + transcriptionMatch[0].length;
        const tEnd = analysisMatch.index;
        const rawTVal = clean.slice(tStart, tEnd);
        const cleanTVal = rawTVal.replace(/['"]\s*,\s*$/, "").replace(/^\s*['"]/, "").replace(/['"]\s*$/, "");
        transcriptionValue = normalizeUnescape(cleanTVal);
        
        // analysis is second
        const rawAVal = clean.slice(analysisStartPos);
        const cleanAVal = rawAVal.replace(/['"]\s*\}\s*$/, "").replace(/^\s*['"]/, "").replace(/['"]\s*$/, "");
        analysisValue = normalizeUnescape(cleanAVal);
      } else {
        // analysis comes first
        const aStart = analysisStartPos;
        const aEnd = transcriptionMatch.index;
        const rawAVal = clean.slice(aStart, aEnd);
        const cleanAVal = rawAVal.replace(/['"]\s*,\s*$/, "").replace(/^\s*['"]/, "").replace(/['"]\s*$/, "");
        analysisValue = normalizeUnescape(cleanAVal);
        
        const tStart = transcriptionMatch.index + transcriptionMatch[0].length;
        const rawTVal = clean.slice(tStart);
        const cleanTVal = rawTVal.replace(/['"]\s*\}\s*$/, "").replace(/^\s*['"]/, "").replace(/['"]\s*$/, "");
        transcriptionValue = normalizeUnescape(cleanTVal);
      }
    } else {
      // Only analysis is present
      const rawAVal = clean.slice(analysisStartPos);
      const cleanAVal = rawAVal.replace(/['"]\s*\}\s*$/, "").replace(/^\s*['"]/, "").replace(/['"]\s*$/, "");
      analysisValue = normalizeUnescape(cleanAVal);
    }
    
    return {
      transcription: transcriptionValue,
      analysis: analysisValue
    };
  } catch (e) {
    console.warn("tryExtractAndRepairJson error:", e);
    return null;
  }
}

function generateNonSimulatedGenericResponse(title: string, description: string, duration: string): { transcription: string; modelUsed: string } {
  const verbatimPart = `This video is a direct file upload titled "${title}". Verbatim automated transcription and high-precision financial analysis are only available for verified video sources with verified subtitles.`;

  const cleanDesc = description || "No se ha proporcionado una descripción detallada para este recurso.";

  const analysisPart = `### 📝 Detailed Content Summary

#### [00:00] **Análisis del Recurso Directo: ${title}**
- **Título del recurso**: ${title}.
- **Descripción provista**: ${cleanDesc}.
- **Estado del análisis**: Al tratarse de una subida directa de archivo de video sin subtítulos verificados de origen, no se dispone de una transcripción temporalizada para segmentar cronológicamente el contenido de forma secuencial de principio a fin.

---

### 📊 Gráficos y Visualizaciones Detectadas

*No se detectaron gráficos en este vídeo.*

---

### 💼 Investment Analysis Report

### 📈 Macroeconomic Trends & Markets
- **Sin datos verificados**: No es posible identificar tendencias macroeconómicas ni dinámicas de mercado fiables a partir de un archivo directo sin transcripción textual contrastada.
- **Rigor analítico**: Para evitar la generación de información ficticia o alucinaciones que afecten a la toma de decisiones, se omite el análisis macroeconómico.

### 💼 Investment Vehicles & Assets
- **Ausencia de activos verificados**: No se han identificado ni listado vehículos de inversión, acciones o fondos en este recurso.
- **Recomendación de prudencia**: Se sugiere contrastar cualquier información con las fuentes y folletos oficiales de los emisores.

### 🌍 Geopolitical Factors & Logistics
- **Análisis geopolítico no disponible**: No se dispone de datos de contexto geopolítico contrastables en este archivo de video.

### 🎯 Investment Decisions & Key Signals
- **Sin señales de inversión**: Este recurso no contiene señales ni decisiones de inversión autorizadas o validadas.
- **Enfoque real**: HIVEX prioriza la precisión absoluta y no proporciona sugerencias de compra o venta basadas en datos insuficientes o no verificados.

### ⚠️ Risk Alerts & Breaking News
- **Alerta de seguridad**: No tome decisiones de inversión basadas en recursos sin transcripción verificada o análisis automatizados de origen incierto.
- **Mitigación de riesgos**: Consulte asesores financieros certificados antes de realizar cualquier asignación de capital.`;

  const finalOutput = `${verbatimPart}\n\n---\n\n${analysisPart}`;

  return {
    transcription: finalOutput,
    modelUsed: "Local Non-Simulated Generator"
  };
}

export async function transcribeVideoCore(params: {
  videoId: string;
  fileUrl: string;
  title: string;
  description?: string;
  duration?: string;
  apiKey?: string;
  googleToken?: string | null;
}) {
  const { videoId, fileUrl, title, description = "", duration = "12:00", apiKey = process.env.GEMINI_API_KEY, googleToken = null } = params;

  if (!googleToken && !apiKey) {
    throw new Error("Falta la autenticación de Gemini. Por favor, configura la clave GEMINI_API_KEY en tu archivo .env.local para continuar.");
  }

  // Extract and preserve YouTube Case-Sensitive ID from fileUrl or videoId
  const actualYtId = extractYoutubeId(fileUrl, videoId);
  
  if (!actualYtId) {
    console.log(`Direct video URL detected (no YouTube ID): ${fileUrl}. Returning local non-simulated response.`);
    return generateNonSimulatedGenericResponse(title, description, duration);
  }

  const intervalText = getRecommendedIntervalText(duration);
  let promptText = "";
  const SYSTEM_INSTRUCTION_ANALYSIS_ONLY = `You are the Google Gemini model, an elite financial analyst and content summarizer. Your task is to process a raw, auto-generated transcript of a YouTube video and generate a JSON response with exactly one property: "analysis" (containing the objective summary, detected charts, and the investment analysis report).`;
  let currentSystemInstruction = SYSTEM_INSTRUCTION_ANALYSIS_ONLY;
  let cleanRealTranscript = "";

  console.log(`Starting verbatim Gemini transcription for actual YouTube ID: ${actualYtId} (title: ${title})`);

  // Fetch real YouTube transcript using Supadata API (Primary in production) or local library (Local development fallback)
  let rawTranscriptText = "";
  let isLightweightFallback = false;

  try {
    let transcriptLines: { text: string; offset: number; duration: number }[] = [];

    if (process.env.SUPADATA_API_KEY) {
      console.log(`[Transcript] SUPADATA_API_KEY detected. Attempting high-resiliency fetch from Supadata API for ID: ${actualYtId}...`);
      try {
        const url = `https://api.supadata.ai/v1/youtube/transcript?videoId=${actualYtId}&mode=auto`;
        const res = await fetch(url, {
          headers: {
            "x-api-key": process.env.SUPADATA_API_KEY
          }
        });
        if (!res.ok) {
          throw new Error(`Supadata API returned status code ${res.status}`);
        }
        const data = await res.json();
        if (data && Array.isArray(data.content)) {
          transcriptLines = data.content.map((item: any) => ({
            text: String(item.text || ""),
            offset: Number(item.offset ?? 0),
            duration: Number(item.duration ?? 0)
          }));
          console.log(`[Transcript] Successfully retrieved ${transcriptLines.length} lines from Supadata API.`);
        } else {
          throw new Error("Supadata response body does not contain a valid content array.");
        }
      } catch (supaErr: unknown) {
        const errMessage = supaErr instanceof Error ? supaErr.message : String(supaErr);
        if (process.env.VERCEL) {
          console.error(`[Transcript] Supadata API failed on Vercel: ${errMessage}. Local scraper fallback disabled (Fail-Fast).`);
          throw new Error(`Supadata API failed on Vercel: ${errMessage}. Local scraper fallback disabled.`);
        }
        console.warn(`[Transcript] Supadata API failed: ${errMessage}. Falling back to local scraper...`);
        transcriptLines = await YoutubeTranscript.fetchTranscript(actualYtId);
      }
    } else {
      if (process.env.VERCEL) {
        console.error("[Transcript] SUPADATA_API_KEY not set on Vercel. Local scraper fallback disabled (Fail-Fast).");
        throw new Error("SUPADATA_API_KEY not configured. Local scraper fallback disabled on Vercel.");
      }
      console.log(`[Transcript] SUPADATA_API_KEY not set. Using local youtube-transcript scraper for ID: ${actualYtId}...`);
      transcriptLines = await YoutubeTranscript.fetchTranscript(actualYtId);
    }

    if (transcriptLines && transcriptLines.length > 0) {
      // Format each line with its starting timestamp [MM:SS] or [HH:MM:SS] so that Gemini gets accurate timing information
      rawTranscriptText = transcriptLines.map(line => {
        const totalSeconds = Math.floor((line.offset || 0) / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = Math.floor(totalSeconds % 60);
        const timestamp = hours > 0
          ? `[${hours.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}]`
          : `[${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}]`;
        return `${timestamp} ${line.text}`;
      }).join("\n");
      
      // Construct clean real transcript for returning
      cleanRealTranscript = transcriptLines.map(line => line.text).join(" ")
        .replace(/[#*>\-`_~]/g, "")
        .replace(/[\r\n]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      console.log(`Successfully fetched ${transcriptLines.length} transcript lines from YouTube with injected timestamps!`);
    } else {
      throw new Error(`La descarga de subtítulos para el vídeo con ID ${actualYtId} retornó un conjunto vacío.`);
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.log(`[Transcript Fallback] Fetching transcript failed for ID ${actualYtId}: ${errMsg}. Checking if it is a Live stream...`);
    
    // Check if it is a live stream by fetching the watch page HTML
    let isLive = false;
    try {
      const url = `https://www.youtube.com/watch?v=${actualYtId}`;
      const watchResponse = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
      if (watchResponse.ok) {
        const html = await watchResponse.text();
        const hasLiveContent = html.includes('"isLiveContent":true');
        const hasLiveBroadcast = html.includes('itemprop="isLiveBroadcast"');
        const hasLiveStream = html.includes('"isLiveStream":true');
        const hasIsLive = html.includes('"isLive":true');
        isLive = hasLiveContent || hasLiveBroadcast || hasLiveStream || hasIsLive;
      }
    } catch (checkErr) {
      console.error(`[Transcript Fallback] Failed to fetch watch page to check live status:`, checkErr);
    }

    if (isLive) {
      throw new Error(`DISCARD_VIDEO: Live stream detected for video ID ${actualYtId}`);
    }

    // If not a live stream, throw a normal error indicating subtitles/transcript failed
    throw new Error(`Subtitles download failed for standard video ${actualYtId}: ${errMsg}`);
  }

  if (isLightweightFallback) {
    promptText = `You are processing a YouTube video where subtitles/transcription are unavailable (e.g., because it is a live stream or transcripts are disabled).
You must perform a high-fidelity meta-analysis based ONLY on the video's Title and Description:
- Title: "${title}"
- Description: "${description || "No description provided."}"
- Duration: ${duration}

CRITICAL FINANCIAL RIGOR RULE: Financial accuracy is of absolute, strict importance. You MUST capture and preserve all numerical values, price levels, asset figures, interest rates, dates, and currency values EXACTLY as they are stated in the provided metadata.

The "analysis" property MUST be written entirely in English with a high-fidelity, extremely detailed narrative adopting the persona of a professional investor and seasoned financial analyst.

INSTRUCTIONS FOR THE "analysis" SECTIONS:
1. ### 📝 Detailed Content Summary
Provide a comprehensive summary and thematic breakdown of what the video covers based on its title and description. Structure your overview with clear paragraphs and bullet points detailing the expected topics, concepts, and market context.

2. ### 📊 Detected Charts & Visualizations
Write exactly: *No se detectaron gráficos en este vídeo al tratarse de una transmisión en vivo sin transcripción temporalizada.*

3. ### 💼 Investment Analysis Report
Adopt the persona of a professional investor. Structure strictly under the five headings listed below. Under each of these five headings, you MUST write at least 2-3 detailed bullet points in English using hyphens (-) and bold text to highlight key concepts and strategic insights:
### 📈 Macroeconomic Trends & Markets
### 💼 Investment Vehicles & Assets
### 🌍 Geopolitical Factors & Logistics
### 🎯 Investment Decisions & Key Signals
### ⚠️ Risk Alerts & Breaking News

You MUST return a JSON object with exactly the following structure:
{
  "analysis": "### 📝 Detailed Content Summary\\n\\n*Este vídeo es una transmisión en vivo y no tiene transcripción disponible.*\\n\\n[Write your detailed summary of the expected topics here]\\n\\n---\\n\\n### 📊 Detected Charts & Visualizations\\n\\n*No se detectaron gráficos en este vídeo al tratarse de una transmisión en vivo sin transcripción temporalizada.*\\n\\n---\\n\\n### 💼 Investment Analysis Report\\n\\n### 📈 Macroeconomic Trends & Markets\\n- **[Concept 1]** [Detail 1]\\n- **[Concept 2]** [Detail 2]\\n\\n### 💼 Investment Vehicles & Assets\\n- **[Concept 1]** [Detail 1]\\n- **[Concept 2]** [Detail 2]\\n\\n### 🌍 Geopolitical Factors & Logistics\\n- **[Concept 1]** [Detail 1]\\n- **[Concept 2]** [Detail 2]\\n\\n### 🎯 Investment Decisions & Key Signals\\n- **[Concept 1]** [Detail 1]\\n- **[Concept 2]** [Detail 2]\\n\\n### ⚠️ Risk Alerts & Breaking News\\n- **[Concept 1]** [Detail 1]\\n- **[Concept 2]** [Detail 2]"
}`;
  } else {
    // Build high-fidelity unified refinement and summary prompt focusing strictly on analysis output to prevent token limits truncation
    promptText = `Below is the raw, auto-generated transcript of a YouTube video titled "${title}". Every spoken line is prefixed with its starting timestamp in brackets like [MM:SS] or [HH:MM:SS].
Your task is to analyze it and generate an objective summary, detected charts, and a detailed investment analysis report in English.

CRITICAL FINANCIAL RIGOR RULE: Financial accuracy is of absolute, strict importance. You MUST capture and preserve all numerical values, price levels (e.g., $4,100, etc.), asset figures, interest rates, dates, and currency values EXACTLY as they are stated in the transcript. You are strictly forbidden from "correcting", hallucinating, or substituting spoken transcript numbers with historical values or expectations from your pre-training memory (e.g., if the speaker or transcript states a level or target of $4,100, do NOT output $2,100 under any circumstance). 100% faithfulness to spoken figures is mandatory.

The "analysis" property MUST be written entirely in English with a high-fidelity, extremely detailed narrative adopting the persona of a professional investor and seasoned financial analyst.

INSTRUCTIONS FOR THE "analysis" SECTIONS:

1. ### 📝 Detailed Content Summary
- CRITICAL FULL COVERAGE RULE: The video lasts a total of ${duration}. It is mandatory to structure the detailed summary sequentially and uniformly covering the entire length of the video from start [00:00] to the end or closing minutes of the video (near ${duration}), ensuring timestamps are balanced across the duration (for example, ${intervalText}) and not just summarizing the beginning or first half.
- Divide the summary into logical segments with fourth-level chronological headings such as: #### [MM:SS] or #### [HH:MM:SS] **Bold Heading of the Segment** (without bullets or hyphens in the headings).
- Under each heading, add bulleted sub-paragraphs using hyphens (-) and bold text to highlight key concepts.
- Strictly objective, neutral, without financial analysis. Do NOT copy the prompt instructions into this section! Write actual summarized content from the transcript!

2. ### 📊 Detected Charts & Visualizations
- Chronologically identify any chart, data table, diagram, or visual resource shown on screen or discussed.
- CRITICAL DETECTION RULE: If during the video precise percentages, numbers, or statistical data are mentioned sequentially (for example, yield figures, spreads, interest rates, or projections), assume with total confidence that at that moment a visual card or static data chart with little movement (split screen or fixed data frame for more than 5 seconds) was projected on screen. You must identify these parts as charts or data visualization resources if they are grounded in the actual transcript.
- GOLDEN RULE OF TRUTHFULNESS & NUMERICAL PRESERVATION: Extract only charts and visualizations that stem realistically and directly from the figures and topics detailed in the video. It is strictly forbidden to hallucinate financial assets, percentages, or specific timestamps that do not appear in the actual transcript. You must report all price levels and metrics exactly as they are detailed in the transcript (e.g., if the transcript says $4,100, do not alter it).
- For each detected chart, add a section with a chronological heading showing its start and end range like: #### [MM:SS - MM:SS] or #### [HH:MM:SS - HH:MM:SS] **Descriptive Title of the Chart** showing precisely when the chart starts and ends in the video.
- Under each heading, write a bulleted list (-) describing the key metrics, data, or axes shown.
- Immediately after the bullets, add a single line in italics: *Legend: [Brief summary explaining the key takeaway at the bottom of the chart].*
- If the video does not contain charts or data visual resources, write exactly: *No charts were detected in this video.*

3. ### 💼 Investment Analysis Report
- Adopt the persona of a professional investor. Structure strictly under the five headings listed below. Under each of these five headings, you MUST write at least 2-3 detailed bullet points using hyphens (-) and bold text to highlight key concepts and strategic insights (DO NOT write plain prose paragraphs, use the exact same bulleted structure as the detailed summary):
### 📈 Macroeconomic Trends & Markets
### 💼 Investment Vehicles & Assets
### 🌍 Geopolitical Factors & Logistics
### 🎯 Investment Decisions & Key Signals
### ⚠️ Risk Alerts & Breaking News

You MUST return a JSON object with exactly the following structure:
{
  "analysis": "### 📝 Detailed Content Summary\\n\\n[Write your actual sequential, detailed summary covering from [00:00] to the end of the video near ${duration} here. Use headings like #### [MM:SS] **Segment Title** and write bullet points under them]\\n\\n---\\n\\n### 📊 Detected Charts & Visualizations\\n\\n[Write your actual detected charts list here following the format, or say 'No charts were detected in this video']\\n\\n---\\n\\n### 💼 Investment Analysis Report\\n\\n### 📈 Macroeconomic Trends & Markets\\n- **[Concept 1]** [Detail 1]\\n- **[Concept 2]** [Detail 2]\\n\\n### 💼 Investment Vehicles & Assets\\n- **[Concept 1]** [Detail 1]\\n- **[Concept 2]** [Detail 2]\\n\\n### 🌍 Geopolitical Factors & Logistics\\n- **[Concept 1]** [Detail 1]\\n- **[Concept 2]** [Detail 2]\\n\\n### 🎯 Investment Decisions & Key Signals\\n- **[Concept 1]** [Detail 1]\\n- **[Concept 2]** [Detail 2]\\n\\n### ⚠️ Risk Alerts & Breaking News\\n- **[Concept 1]** [Detail 1]\\n- **[Concept 2]** [Detail 2]"
}

Raw transcript text:
${rawTranscriptText}`;
  }

  // Query Gemini with a highly resilient sequential fallback mechanism
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "558326121700-ufp44b64pdnb0cisl7nu3c2dqc3vu82k.apps.googleusercontent.com";
  const projectNumber = clientId.split("-")[0] || "558326121700";

  const attempts = [
    {
      name: "Google AI Studio Gemini 3.6 Flash (v1beta)",
      type: "google-ai",
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent`
    },
    {
      name: "Google AI Studio Gemini 3.5 Flash (v1beta)",
      type: "google-ai",
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent`
    },
    {
      name: "Google AI Studio Gemini 3.0 Flash (v1beta)",
      type: "google-ai",
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.0-flash:generateContent`
    },
    {
      name: "Google AI Studio Gemini 2.5 Flash (v1beta)",
      type: "google-ai",
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`
    },
    {
      name: "Google AI Studio Gemini 2.0 Flash (v1beta)",
      type: "google-ai",
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`
    },
    {
      name: "Google AI Studio Gemini 1.5 Flash (v1beta)",
      type: "google-ai",
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`
    }
  ];

  let finalOutput = "";
  let successfulModel = "";
  const errorDetails: string[] = [];

  for (const attempt of attempts) {
    try {
      console.log(`Transcription: Attempting ${attempt.name} for video "${title}"...`);
      
      let requestUrl = attempt.url;
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };

      if (attempt.type === "google-ai" && apiKey) {
        requestUrl = `${attempt.url}?key=${apiKey}`;
        console.log(`Transcription: Using local GEMINI_API_KEY for ${attempt.name}`);
      } else if (googleToken) {
        headers["Authorization"] = `Bearer ${googleToken}`;
      } else {
        console.warn(`Transcription warning: No credentials available for ${attempt.name}, skipping.`);
        errorDetails.push(`${attempt.name}: Sin credenciales válidas.`);
        continue;
      }

      const payload: Record<string, any> = {
        contents: [
          {
            role: "user",
            parts: [{ text: promptText }]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          maxOutputTokens: 8192,
          thinkingConfig: {
            thinkingBudget: 0
          }
        }
      };

      if (attempt.type === "google-ai") {
        payload.system_instruction = {
          parts: [{ text: currentSystemInstruction }]
        };
      } else {
        payload.systemInstruction = {
          parts: [{ text: currentSystemInstruction }]
        };
      }

      const response = await fetch(requestUrl, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(payload)
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
          try {
            const cleanedResponse = cleanGeminiJsonResponse(apiResponse);
            let parsed;
            const repaired = tryExtractAndRepairJson(cleanedResponse);
            if (repaired) {
              console.log(`[Parser] Successfully extracted and repaired JSON fields structurally.`);
              parsed = repaired;
            } else {
              console.log(`[Parser] Structural extraction failed, falling back to stateful sanitizer and JSON.parse...`);
              const sanitized = sanitizeJsonString(cleanedResponse);
              parsed = JSON.parse(sanitized);
            }
            
            // Prefer cleanRealTranscript for actual YouTube subtitles to ensure 100% genuine verbatim subtitle data!
            const transcriptionPart = (parsed.transcription || cleanRealTranscript)
              .replace(/[#*>\-`_~]/g, "")
              .replace(/[\r\n]+/g, " ")
              .replace(/\s+/g, " ")
              .trim();
              
            const analysisPart = parsed.analysis || "";
            
            if (transcriptionPart && analysisPart) {
              finalOutput = `${transcriptionPart}\n\n---\n\n${analysisPart}`;
              successfulModel = attempt.name;
              console.log(`Transcription: Successful unified refinement & summary using ${attempt.name}!`);
              break;
            } else {
              errorDetails.push(`${attempt.name}: El objeto JSON devuelto no contiene el campo obligatorio "analysis".`);
            }
          } catch (jsonErr) {
            const errorMsg = jsonErr instanceof Error ? jsonErr.message : String(jsonErr);
            console.error(`[Parser Error] Failed to parse JSON response from ${attempt.name}. Error: ${errorMsg}\nRaw text received (first 1000 chars):\n${apiResponse}`);
            errorDetails.push(`${attempt.name}: Error al decodificar la respuesta JSON (${errorMsg}).`);
          }
        } else {
          errorDetails.push(`${attempt.name}: Respuesta vacía sin contenido.`);
        }
      } else {
        const errText = await response.text();
        let errMsg = errText;
        try {
          const parsed = JSON.parse(errText);
          if (parsed.error?.message) {
            errMsg = parsed.error.message;
          }
        } catch {}
        errorDetails.push(`${attempt.name} (HTTP ${response.status}): ${errMsg}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errorDetails.push(`${attempt.name} (Error de red/sistema): ${msg}`);
    }
  }

  if (finalOutput && finalOutput.length > 0) {
    let finalModelName = successfulModel;
    if (isLightweightFallback) {
      finalModelName = `${successfulModel}\nEste vídeo es una transmisión en vivo y no tiene transcripción disponible.`;
    }
    return {
      transcription: finalOutput,
      modelUsed: finalModelName
    };
  } else {
    throw new Error(
      `La llamada a las APIs de Gemini falló para todos los modelos intentados. Detalles:\n` +
      errorDetails.map(d => `- ${d}`).join("\n")
    );
  }
}


// Helper functions for server-side database updates to avoid RLS and desync issues

function splitTranscription(text: string) {
  if (!text) return { transcription: "", summary: "", charts: "", report: "" };
  
  const regexSplit = /\n\s*(?:---|===|\*\*\*|___|- - -)[^\n]*\n/;
  const parts = text.split(regexSplit);
  
  let transcription = "";
  let summary = "";
  let charts = "";
  let report = "";
  
  if (parts.length >= 4) {
    transcription = parts[0] || "";
    summary = parts[1] || "";
    charts = parts[2] || "";
    report = parts.slice(3).join("\n---\n") || "";
  } else if (parts.length === 3) {
    transcription = parts[0] || "";
    summary = parts[1] || "";
    charts = "";
    report = parts[2] || "";
  } else {
    const lines = text.split("\n");
    let summaryIdx = -1;
    let chartsIdx = -1;
    let reportIdx = -1;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim().toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      
      if (trimmed.startsWith("#") || trimmed.startsWith("- #") || trimmed.startsWith("**")) {
        const headerText = trimmed.replace(/^[\s\-\*#]*/, "").replace(/^\*\*|\*\*$/g, "").trim();
        
        if (summaryIdx === -1) {
          if (headerText.includes("resumen") || headerText.includes("summary") || headerText.includes("zusammenfassung") || headerText.includes("ozet") || headerText.includes("part 2") || headerText.includes("parte 2") || headerText.includes("teil 2") || headerText.includes("bolum 2") || headerText.includes("kisim 2")) {
            summaryIdx = i;
          }
        } else if (chartsIdx === -1) {
          if (headerText.includes("grafico") || headerText.includes("grafik") || headerText.includes("chart") || headerText.includes("diagram") || headerText.includes("visualizac") || headerText.includes("visualis") || headerText.includes("gorsel") || headerText.includes("part 3") || headerText.includes("parte 3") || headerText.includes("teil 3") || headerText.includes("bolum 3") || headerText.includes("kisim 3")) {
            const isReport = headerText.includes("informe") || headerText.includes("report") || headerText.includes("bericht") || headerText.includes("rapor") || headerText.includes("analisis") || headerText.includes("analysis") || headerText.includes("analyse") || headerText.includes("analiz") || headerText.includes("invers") || headerText.includes("invest") || headerText.includes("yatirim");
            if (isReport && !headerText.includes("grafic") && !headerText.includes("grafik") && !headerText.includes("chart") && !headerText.includes("visualizac") && !headerText.includes("visualis") && !headerText.includes("gorsel")) {
              reportIdx = i;
            } else {
              chartsIdx = i;
            }
          }
        } else if (reportIdx === -1) {
          if (headerText.includes("informe") || headerText.includes("report") || headerText.includes("bericht") || headerText.includes("rapor") || headerText.includes("analisis") || headerText.includes("analysis") || headerText.includes("analyse") || headerText.includes("analiz") || headerText.includes("invers") || headerText.includes("invest") || headerText.includes("yatirim") || headerText.includes("part 4") || headerText.includes("parte 4") || headerText.includes("teil 4") || headerText.includes("bolum 4") || headerText.includes("kisim 4")) {
            reportIdx = i;
          }
        }
      }
    }

    if (summaryIdx !== -1 && chartsIdx !== -1 && reportIdx !== -1 && reportIdx > chartsIdx && chartsIdx > summaryIdx) {
      transcription = lines.slice(0, summaryIdx).join("\n");
      summary = lines.slice(summaryIdx, chartsIdx).join("\n");
      charts = lines.slice(chartsIdx, reportIdx).join("\n");
      report = lines.slice(reportIdx).join("\n");
    } else if (summaryIdx !== -1 && reportIdx !== -1 && reportIdx > summaryIdx) {
      transcription = lines.slice(0, summaryIdx).join("\n");
      summary = lines.slice(summaryIdx, reportIdx).join("\n");
      charts = "";
      report = lines.slice(reportIdx).join("\n");
    } else if (summaryIdx !== -1 && chartsIdx !== -1 && chartsIdx > summaryIdx) {
      transcription = lines.slice(0, summaryIdx).join("\n");
      summary = lines.slice(summaryIdx, chartsIdx).join("\n");
      charts = lines.slice(chartsIdx).join("\n");
      report = "";
    } else if (summaryIdx !== -1) {
      transcription = lines.slice(0, summaryIdx).join("\n");
      summary = lines.slice(summaryIdx).join("\n");
      charts = "";
      report = "";
    } else {
      transcription = parts[0] || "";
      summary = parts[1] || "";
      charts = parts[2] || "";
      report = parts.slice(3).join("\n---\n") || "";
      
      if (parts.length === 1) {
        transcription = text;
        summary = "";
        charts = "";
        report = "";
      } else if (parts.length === 2) {
        transcription = parts[0] || "";
        summary = parts[1] || "";
        charts = "";
        report = "";
      } else if (parts.length === 3) {
        transcription = parts[0] || "";
        summary = parts[1] || "";
        charts = "";
        report = parts[2] || "";
      }
    }
  }
  
  const cleanSummary = summary.replace(/^#*\s*(?:Resumen Detallado|Resumen Detallado del Contenido|Resumen|Detailed Summary|Zusammenfassung|Ozet|Part 2|Parte 2|Teil 2|Teil2|Bolum 2|Kisim 2)[^\n]*\n+/i, "").trim();
  const cleanCharts = charts.replace(/^#*\s*(?:Graficos y Visualizaciones Detectadas|Graficos y Visualizaciones|Graficos|Charts and Visualizations|Charts|Visualizaciones|Erkannte Grafiken und Visualisierungen|Erkannte Grafiken|Tespit Edilen Grafikler ve Gorsellestirmeler|Tespit Edilen Grafikler|Part 3|Parte 3|Teil 3|Teil3|Bolum 3|Kisim 3)[^\n]*\n+/i, "").trim();
  const cleanReport = report.replace(/^#*\s*(?:Informe de Inversión|Informe de Análisis|Informe|Investment Report|Investitionsbericht|Investitionsanalysebericht|Rapor|Yatirim Analiz Raporu|Analysis|Analyse|Analiz|Part 4|Parte 4|Teil 4|Teil4|Bolum 4|Kisim 4|Part 3|Parte 3)[^\n]*\n+/i, "").trim();
  
  return {
    transcription: transcription.trim(),
    summary: cleanSummary,
    charts: cleanCharts,
    report: cleanReport
  };
}

async function saveVideoKnowledgeBaseServer(
  supabaseAdmin: any,
  videoDoc: { id: string; title: string; file_url?: string; metadata?: any },
  transcriptionText: string
) {
  const adminId = "5c8d65c6-0798-4f8a-aae3-dd2cebebd868";
  const splitResult = splitTranscription(transcriptionText);
  const channelTitle = videoDoc.metadata?.channel_title || "Andrei Jikh";
  const dateStr = new Date().toISOString();
  const fileUrl = videoDoc.file_url || "";

  // 1. Literal transcription
  const transcriptionDoc = {
    user_id: adminId,
    title: `[Transcripción] - ${videoDoc.title}`,
    description: `Transcripción completa literal de ${videoDoc.title}`,
    type: "knowledge_transcription",
    file_url: fileUrl,
    metadata: {
      fecha_transcripcion: dateStr,
      canal_origen: channelTitle,
      nombre_video: videoDoc.title,
      texto_transcripcion: splitResult.transcription
    }
  };

  // 2. Content summary
  const summaryDoc = {
    user_id: adminId,
    title: `[Resumen] - ${videoDoc.title}`,
    description: `Resumen de contenido completo de ${videoDoc.title}`,
    type: "knowledge_summary",
    file_url: fileUrl,
    metadata: {
      fecha_resumen: dateStr,
      canal_origen: channelTitle,
      nombre_video: videoDoc.title,
      resumen_markdown: splitResult.summary
    }
  };

  // 3. Charts and Visualizations
  const chartsDoc = {
    user_id: adminId,
    title: `[Gráficos] - ${videoDoc.title}`,
    description: `Gráficos y visualizaciones detectadas de ${videoDoc.title}`,
    type: "knowledge_charts",
    file_url: fileUrl,
    metadata: {
      fecha_graficos: dateStr,
      canal_origen: channelTitle,
      nombre_video: videoDoc.title,
      graficos_markdown: splitResult.charts
    }
  };

  // 4. Investment analysis report
  const analysisDoc = {
    user_id: adminId,
    title: `[Análisis] - ${videoDoc.title}`,
    description: `Informe de análisis financiero de ${videoDoc.title}`,
    type: "knowledge_analysis",
    file_url: fileUrl,
    metadata: {
      fecha_informe: dateStr,
      canal_origen: channelTitle,
      nombre_video: videoDoc.title,
      informe_completo: splitResult.report
    }
  };

  const docsToInsert = [
    { doc: transcriptionDoc, type: "knowledge_transcription" },
    { doc: summaryDoc, type: "knowledge_summary" },
    { doc: chartsDoc, type: "knowledge_charts" },
    { doc: analysisDoc, type: "knowledge_analysis" }
  ];

  for (const item of docsToInsert) {
    const { data: existing, error: checkErr } = await supabaseAdmin
      .from("documents")
      .select("id")
      .eq("type", item.type)
      .eq("file_url", fileUrl);

    if (checkErr) {
      console.warn(`[Base de Conocimiento Server] Error al verificar existencia de ${item.type}:`, checkErr);
    }

    if (!existing || existing.length === 0) {
      const { error: insertErr } = await supabaseAdmin
        .from("documents")
        .insert(item.doc);
      if (insertErr) {
        console.warn(`[Base de Conocimiento Server] Error al insertar ${item.type} para ${videoDoc.title}:`, insertErr);
      } else {
        console.log(`[Base de Conocimiento Server] Persistido con éxito ${item.type} para: ${videoDoc.title}`);
      }
    } else {
      const { error: updateErr } = await supabaseAdmin
        .from("documents")
        .update(item.doc)
        .eq("id", existing[0].id);
      if (updateErr) {
        console.warn(`[Base de Conocimiento Server] Error al actualizar ${item.type} para ${videoDoc.title}:`, updateErr);
      } else {
        console.log(`[Base de Conocimiento Server] Actualizado con éxito ${item.type} para: ${videoDoc.title}`);
      }
    }
  }
}

async function syncVideoAndKnowledgeBaseServer(
  supabaseAdmin: any,
  fileUrl: string,
  title: string,
  transcriptionText: string,
  modelUsed: string
) {
  try {
    console.log(`[Transcribe API Server Sync] Buscando documento de vídeo para: ${title}...`);
    const { data: videos, error: findErr } = await supabaseAdmin
      .from("documents")
      .select("*")
      .eq("type", "video")
      .eq("file_url", fileUrl)
      .limit(1);

    if (findErr) {
      console.error("[Transcribe API Server Sync] Error al buscar vídeo:", findErr);
      return;
    }

    if (videos && videos.length > 0) {
      const videoDoc = videos[0];
      console.log(`[Transcribe API Server Sync] Actualizando metadatos del vídeo ${videoDoc.id}...`);

      const updatedMetadata = {
        ...(videoDoc.metadata || {}),
        transcription: transcriptionText,
        transcription_model: modelUsed || "Google Vertex AI Gemini 1.5 Pro"
      };

      const { error: updateErr } = await supabaseAdmin
        .from("documents")
        .update({ metadata: updatedMetadata })
        .eq("id", videoDoc.id);

      if (updateErr) {
        console.error("[Transcribe API Server Sync] Error al actualizar metadatos del vídeo:", updateErr);
      } else {
        console.log(`[Transcribe API Server Sync] Metadatos del vídeo ${videoDoc.id} actualizados correctamente.`);
      }

      // Sincronizar las cuatro tarjetas de conocimiento bajo ADMIN_ID
      await saveVideoKnowledgeBaseServer(supabaseAdmin, videoDoc, transcriptionText);
    } else {
      console.warn(`[Transcribe API Server Sync] No se encontró el documento de vídeo para URL: ${fileUrl}`);
    }
  } catch (err) {
    console.error("[Transcribe API Server Sync] Error inesperado durante la sincronización:", err);
  }
}

export async function POST(request: Request) {
  try {
    const body: TranscribeRequestBody & { transcription?: string } = await request.json();
    const { videoId, fileUrl, title, duration = "12:00", transcription } = body;

    // Inicializar el cliente Supabase Admin para actualización/sincronización en el servidor sin RLS
    const supabaseUrl = process.env.SUPABASE_PRODUCTION_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_PRODUCTION_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    let supabaseAdmin: any = null;
    if (supabaseUrl && serviceRoleKey) {
      const { createClient } = await import("@supabase/supabase-js");
      supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false }
      });
    }

    if (transcription) {
      console.log(`[Transcribe API] Received pre-existing transcription for video ${videoId}. Skipping Gemini call and proceeding to extract snapshots.`);
      // Fire-and-forget background job to extract charts snapshots via ffmpeg
      extractSnapshotsInBackground(videoId, fileUrl, transcription);

      // Sincronizar en la base de datos en segundo plano bajo ADMIN_ID
      if (supabaseAdmin) {
        syncVideoAndKnowledgeBaseServer(supabaseAdmin, fileUrl, title, transcription, "Pre-existing (Skipped Gemini call)").catch(err => {
          console.error("[Transcribe API Server Sync] Error sincronizando transcripción existente:", err);
        });
      }

      return NextResponse.json({
        success: true,
        videoId,
        title,
        duration,
        transcription,
        modelUsed: "Pre-existing (Skipped Gemini call)",
        status: "completado"
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const authHeader = request.headers.get("Authorization");
    let googleToken: string | null = null;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      googleToken = authHeader.substring(7).trim();
    }

    const result = await transcribeVideoCore({
      videoId,
      fileUrl,
      title,
      duration,
      apiKey,
      googleToken
    });

    // Fire-and-forget background job to extract charts snapshots via ffmpeg
    if (result.transcription) {
      extractSnapshotsInBackground(videoId, fileUrl, result.transcription);

      // Sincronizar en la base de datos en segundo plano bajo ADMIN_ID
      if (supabaseAdmin) {
        syncVideoAndKnowledgeBaseServer(supabaseAdmin, fileUrl, title, result.transcription, result.modelUsed).catch(err => {
          console.error("[Transcribe API Server Sync] Error sincronizando nueva transcripción:", err);
        });
      }
    }

    return NextResponse.json({
      success: true,
      videoId,
      title,
      duration,
      transcription: result.transcription,
      modelUsed: result.modelUsed,
      status: "completado"
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Unexpected transcription route error.";
    console.error("Transcription pipeline failure:", error);
    return NextResponse.json(
      { success: false, error: errMsg },
      { status: 500 }
    );
  }
}
