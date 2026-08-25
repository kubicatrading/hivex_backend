import { NextResponse } from "next/server";

interface SpeakRequestBody {
  text: string;
  voice?: string;
}

/**
 * Prepend a standard 44-byte RIFF/WAVE header to raw 24kHz 16-bit mono linear PCM audio data.
 */
function addWavHeader(pcmBuffer: Buffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): Buffer {
  const header = Buffer.alloc(44);
  const dataSize = pcmBuffer.length;
  const chunkSize = 36 + dataSize;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;

  // RIFF identifier
  header.write("RIFF", 0);
  // File length minus RIFF and WAVE headers
  header.writeUInt32LE(chunkSize, 4);
  // RIFF type
  header.write("WAVE", 8);
  // Format chunk identifier
  header.write("fmt ", 12);
  // Format chunk length
  header.writeUInt32LE(16, 16);
  // Sample format (raw PCM is 1)
  header.writeUInt16LE(1, 20);
  // Channel count
  header.writeUInt16LE(numChannels, 22);
  // Sample rate
  header.writeUInt32LE(sampleRate, 24);
  // Byte rate
  header.writeUInt32LE(byteRate, 28);
  // Block align
  header.writeUInt16LE(blockAlign, 32);
  // Bits per sample
  header.writeUInt16LE(bitsPerSample, 34);
  // Data chunk identifier
  header.write("data", 36);
  // Data chunk length
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

/**
 * Formatting helper to translate decimal points into spoken equivalents (point / coma)
 * depending on the language of the text. This prevents Gemini TTS from treating
 * decimal periods as sentence-ending marks and introducing awkward silent gaps.
 */
function formatDecimalsForTTS(text: string, voice: string): string {
  // Simple vocabulary frequency count to identify English vs Spanish text
  const englishWords = /\b(the|of|and|to|in|is|that|with|for|it|on|as|by|at|an|be|this|are|from)\b/gi;
  const spanishWords = /\b(el|la|los|las|de|en|y|que|un|una|con|para|lo|del|al|por|su|es|como|se)\b/gi;
  
  const englishCount = (text.match(englishWords) || []).length;
  const spanishCount = (text.match(spanishWords) || []).length;
  
  const isEnglish = englishCount >= spanishCount;

  if (isEnglish) {
    // For English: replace e.g. "2.2" with "2 point 2"
    return text.replace(/(\d+)\.(\d+)/g, "$1 point $2");
  } else {
    // For Spanish: replace e.g. "2.2" with "2 coma 2"
    return text.replace(/(\d+)\.(\d+)/g, "$1 coma $2");
  }
}

// High-performance in-memory cache for synthesized audio WAV buffers
const ttsCache = new Map<string, { wavBuffer: Buffer; successfulModel: string; createdAt: number }>();
const MAX_CACHE_ENTRIES = 500;

/**
 * Core speech synthesis handler supporting both GET and POST requests.
 */
async function synthesizeSpeech(text: string, voice: string, request?: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: "Falta la variable de entorno GEMINI_API_KEY en el servidor." },
      { status: 500 }
    );
  }

  // Clean text from markdown symbols and pre-process decimals
  const cleanedText = text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/#+\s*/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[-*+]\s+/g, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const processedText = formatDecimalsForTTS(cleanedText, voice);
  const cacheKey = `${voice}:${processedText.trim()}`;

  // Check in-memory cache for instantaneous 1ms response
  if (ttsCache.has(cacheKey)) {
    const cached = ttsCache.get(cacheKey)!;
    console.log(`[Speak API Cache HIT] Returning cached TTS for "${processedText.trim().substring(0, 30)}..." (${cached.wavBuffer.length} bytes)`);
    
    const rangeHeader = request?.headers?.get("range");
    if (rangeHeader) {
      const totalLength = cached.wavBuffer.length;
      const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
      if (match) {
        let start = match[1] ? parseInt(match[1], 10) : 0;
        let end = match[2] ? parseInt(match[2], 10) : totalLength - 1;
        if (start >= totalLength) {
          return new Response("", {
            status: 416,
            headers: { "Content-Range": `bytes */${totalLength}`, "Accept-Ranges": "bytes" }
          });
        }
        if (end >= totalLength) end = totalLength - 1;
        if (start > end) start = end;

        const chunkSize = (end - start) + 1;
        const slicedBuffer = cached.wavBuffer.subarray(start, end + 1);

        return new Response(new Uint8Array(slicedBuffer), {
          status: 206,
          headers: {
            "Content-Type": "audio/wav",
            "Content-Range": `bytes ${start}-${end}/${totalLength}`,
            "Accept-Ranges": "bytes",
            "Content-Length": String(chunkSize),
            "X-Generated-By-Model": cached.successfulModel,
            "X-Cache": "HIT",
            "Cache-Control": "public, max-age=31536000, immutable"
          }
        });
      }
    }

    return new Response(new Uint8Array(cached.wavBuffer), {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Accept-Ranges": "bytes",
        "Content-Length": String(cached.wavBuffer.length),
        "X-Generated-By-Model": cached.successfulModel,
        "X-Cache": "HIT",
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    });
  }

  // Sequence of dedicated Gemini TTS models (Flash first for ~350ms ultra-low latency generation)
  const models = [
    "gemini-2.5-flash-preview-tts",
    "gemini-2.5-pro-preview-tts",
    "gemini-3.1-flash-tts-preview"
  ];

  let base64Audio = "";
  let successfulModel = "";
  const errorDetails: string[] = [];

  // Cap max text length to 1500 chars to avoid Gemini TTS API overload
  const safeText = processedText.trim().substring(0, 1500);

  // Attempt generation sequentially with per-fetch timeout guard
  for (const model of models) {
    try {
      console.log(`[Speak API] Trying model: ${model} with voice: ${voice} (text length: ${safeText.length})`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const payload = {
        contents: [
          {
            parts: [
              {
                text: safeText
              }
            ]
          }
        ],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voice
              }
            }
          }
        }
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 18000);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const part = data.candidates?.[0]?.content?.parts?.[0];
        
        if (part?.inlineData?.data) {
          base64Audio = part.inlineData.data;
          successfulModel = model;
          console.log(`[Speak API] Generation successful with model ${model}! Base64 length: ${base64Audio.length}`);
          break;
        } else {
          errorDetails.push(`${model}: No se encontraron datos binarios (inlineData) en la respuesta.`);
        }
      } else {
        const errText = await response.text();
        errorDetails.push(`${model} (HTTP ${response.status}): ${errText.substring(0, 200)}`);
      }
    } catch (err: any) {
      errorDetails.push(`${model} (Excepción): ${err?.message || err}`);
    }
  }

  if (!base64Audio) {
    console.error("[Speak API] Failed to synthesize speech across all models:", errorDetails);
    return NextResponse.json(
      { 
        success: false, 
        error: "Error al generar la síntesis de voz con todos los modelos disponibles.",
        details: errorDetails
      },
      { status: 500 }
    );
  }

  // Decode base64 PCM to raw binary Buffer
  const pcmBuffer = Buffer.from(base64Audio, "base64");

  // Package the raw signed 16-bit 24kHz linear PCM data with a 44-byte standard RIFF/WAV header
  const wavBuffer = addWavHeader(pcmBuffer, 24000, 1, 16);

  // Store in-memory cache for fast repeated reads
  if (ttsCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = ttsCache.keys().next().value;
    if (oldestKey) ttsCache.delete(oldestKey);
  }
  ttsCache.set(cacheKey, { wavBuffer, successfulModel, createdAt: Date.now() });

  const rangeHeader = request?.headers?.get("range");
  if (rangeHeader) {
    const totalLength = wavBuffer.length;
    // Format: "bytes=start-end"
    const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
    if (match) {
      const startStr = match[1];
      const endStr = match[2];

      let start = startStr ? parseInt(startStr, 10) : 0;
      let end = endStr ? parseInt(endStr, 10) : totalLength - 1;

      if (start >= totalLength) {
        return new Response("", {
          status: 416,
          headers: {
            "Content-Range": `bytes */${totalLength}`,
            "Accept-Ranges": "bytes"
          }
        });
      }

      if (end >= totalLength) {
        end = totalLength - 1;
      }

      if (start > end) {
        start = end;
      }

      const chunkSize = (end - start) + 1;
      const slicedBuffer = wavBuffer.subarray(start, end + 1);

      return new Response(new Uint8Array(slicedBuffer), {
        status: 206,
        headers: {
          "Content-Type": "audio/wav",
          "Content-Range": `bytes ${start}-${end}/${totalLength}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunkSize),
          "X-Generated-By-Model": successfulModel,
          "Cache-Control": "public, max-age=31536000, immutable"
        }
      });
    }
  }

  // Return the response as binary stream playable natively by browser Audio element
  return new Response(new Uint8Array(wavBuffer), {
    status: 200,
    headers: {
      "Content-Type": "audio/wav",
      "Accept-Ranges": "bytes",
      "Content-Length": String(wavBuffer.length),
      "X-Generated-By-Model": successfulModel,
      "Cache-Control": "public, max-age=31536000, immutable" // Highly cacheable summaries
    }
  });
}

export async function POST(request: Request) {
  try {
    const body: SpeakRequestBody = await request.json();
    const { text, voice = "Charon" } = body;

    if (!text || !text.trim()) {
      return NextResponse.json(
        { success: false, error: "El parámetro obligatorio 'text' está vacío o no fue suministrado." },
        { status: 400 }
      );
    }

    return await synthesizeSpeech(text, voice, request);
  } catch (error: any) {
    const errMsg = error?.message || "Ocurrió un error inesperado en la ruta de síntesis de voz POST.";
    console.error("[Speak API POST Error]:", error);
    return NextResponse.json(
      { success: false, error: errMsg },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const text = searchParams.get("text");
    const voice = searchParams.get("voice") || "Charon";

    if (!text || !text.trim()) {
      return NextResponse.json(
        { success: false, error: "El parámetro 'text' es obligatorio en la consulta GET." },
        { status: 400 }
      );
    }

    return await synthesizeSpeech(text, voice, request);
  } catch (error: any) {
    const errMsg = error?.message || "Ocurrió un error inesperado en la ruta de síntesis de voz GET.";
    console.error("[Speak API GET Error]:", error);
    return NextResponse.json(
      { success: false, error: errMsg },
      { status: 500 }
    );
  }
}
