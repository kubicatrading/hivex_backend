import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { encodePcmToMp3 } from "@/lib/audio/mp3Encoder";

interface SpeakRequestBody {
  text: string;
  voice?: string;
}

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_PRODUCTION_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_PRODUCTION_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
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

// High-performance in-memory cache for synthesized audio buffers
const ttsCache = new Map<string, { audioBuffer: Buffer; contentType: string; successfulModel: string; createdAt: number }>();
const MAX_CACHE_ENTRIES = 500;

function buildAudioResponse(
  audioBuffer: Buffer,
  contentType: string,
  successfulModel: string,
  cacheStatus: string,
  request?: Request
): Response {
  const rangeHeader = request?.headers?.get("range");
  if (rangeHeader) {
    const totalLength = audioBuffer.length;
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
      const slicedBuffer = audioBuffer.subarray(start, end + 1);

      return new Response(new Uint8Array(slicedBuffer), {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Range": `bytes ${start}-${end}/${totalLength}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunkSize),
          "X-Generated-By-Model": successfulModel,
          "X-Cache": cacheStatus,
          "Cache-Control": "public, max-age=31536000, immutable"
        }
      });
    }
  }

  return new Response(new Uint8Array(audioBuffer), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      "Content-Length": String(audioBuffer.length),
      "X-Generated-By-Model": successfulModel,
      "X-Cache": cacheStatus,
      "Cache-Control": "public, max-age=31536000, immutable"
    }
  });
}

/**
 * Core speech synthesis handler supporting both GET and POST requests.
 * Uses a 2-tier cache (1: In-memory RAM, 2: Persistent Supabase Storage) to prevent repeated Gemini TTS charges.
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
  // Cap max text length to 1500 chars to avoid Gemini TTS API overload
  const safeText = processedText.trim().substring(0, 1500);
  const cacheKey = `${voice}:${safeText}`;

  // Tier 1: Check in-memory cache for instantaneous 1ms response
  if (ttsCache.has(cacheKey)) {
    const cached = ttsCache.get(cacheKey)!;
    console.log(`[Speak API Memory Cache HIT] Returning cached TTS for "${safeText.substring(0, 30)}..." (${cached.audioBuffer.length} bytes)`);
    return buildAudioResponse(cached.audioBuffer, cached.contentType, cached.successfulModel, "MEMORY-HIT", request);
  }

  // Tier 2: Check persistent Supabase Storage cache so serverless cold starts never re-bill Gemini TTS
  const textHash = crypto.createHash("sha256").update(cacheKey).digest("hex");
  const safeVoice = voice.replace(/[^a-zA-Z0-9_-]/g, "") || "Charon";
  const storagePath = `tts_cache/${safeVoice}_${textHash}.mp3`;
  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      const { data: blob, error: dlErr } = await supabase.storage.from("documents").download(storagePath);
      if (!dlErr && blob) {
        const storedBuffer = Buffer.from(await blob.arrayBuffer());
        if (storedBuffer.length > 200) {
          if (ttsCache.size >= MAX_CACHE_ENTRIES) {
            const oldestKey = ttsCache.keys().next().value;
            if (oldestKey) ttsCache.delete(oldestKey);
          }
          ttsCache.set(cacheKey, {
            audioBuffer: storedBuffer,
            contentType: "audio/mpeg",
            successfulModel: "supabase-storage-cache",
            createdAt: Date.now()
          });
          console.log(`[Speak API Supabase Cache HIT] Serving persisted MP3 (${storedBuffer.length} bytes) for "${safeText.substring(0, 30)}..."`);
          return buildAudioResponse(storedBuffer, "audio/mpeg", "supabase-storage-cache", "SUPABASE-HIT", request);
        }
      }
    } catch (_) {
      // Proceed to synthesis on storage cache miss
    }
  }

  // Sequence of dedicated Flash Gemini TTS models (excluding expensive Pro TTS to minimize cost)
  const models = [
    "gemini-3.1-flash-tts-preview",
    "gemini-2.5-flash-preview-tts"
  ];

  let base64Audio = "";
  let successfulModel = "";
  const errorDetails: string[] = [];

  // Attempt generation sequentially with per-fetch timeout guard and retry on rate limit
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        console.log(`[Speak API] Trying model: ${model} (attempt ${attempt + 1}) with voice: ${voice} (text length: ${safeText.length})`);
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
          if (response.status === 429 || response.status === 503) {
            await new Promise((r) => setTimeout(r, (attempt + 1) * 1200));
          }
        }
      } catch (err: any) {
        errorDetails.push(`${model} (Excepción): ${err?.message || err}`);
      }
    }
    if (base64Audio) break;
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

  // Compress raw 24kHz 16-bit mono PCM to lightweight 48kbps MP3 (fallback to WAV if encoding fails)
  let finalBuffer: Buffer;
  let contentType = "audio/mpeg";
  try {
    finalBuffer = encodePcmToMp3(pcmBuffer, 24000, 48);
  } catch (_) {
    finalBuffer = addWavHeader(pcmBuffer, 24000, 1, 16);
    contentType = "audio/wav";
  }

  // Store in Tier 1 (in-memory cache)
  if (ttsCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = ttsCache.keys().next().value;
    if (oldestKey) ttsCache.delete(oldestKey);
  }
  ttsCache.set(cacheKey, { audioBuffer: finalBuffer, contentType, successfulModel, createdAt: Date.now() });

  // Store in Tier 2 (persistent Supabase Storage) asynchronously so we never re-synthesize this sentence
  if (supabase && contentType === "audio/mpeg") {
    supabase.storage
      .from("documents")
      .upload(storagePath, finalBuffer, { contentType: "audio/mpeg", upsert: true })
      .catch((err: any) => console.warn("[Speak API] Non-blocking Supabase cache upload warning:", err?.message || err));
  }

  return buildAudioResponse(finalBuffer, contentType, successfulModel, "MISS", request);
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
