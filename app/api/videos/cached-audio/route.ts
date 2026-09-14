import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { encodePcmToMp3 } from "@/lib/audio/mp3Encoder";

export const maxDuration = 60; // 60 seconds serverless execution ceiling

interface CachedAudioRequestBody {
  videoId: string;
  track: "summary" | "report";
  voice?: string;
  language?: string;
  sentences: string[];
}

interface SentenceTimestamp {
  sentenceIdx: number;
  text: string;
  startTime: number;
  endTime: number;
}

/**
 * Format decimals into spoken format so Gemini TTS does not pause mid-number.
 */
function formatDecimalsForTTS(text: string): string {
  const englishWords = /\b(the|of|and|to|in|is|that|with|for|it|on|as|by|at|an|be|this|are|from)\b/gi;
  const spanishWords = /\b(el|la|los|las|de|en|y|que|un|una|con|para|lo|del|al|por|su|es|como|se)\b/gi;
  const isEnglish = (text.match(englishWords) || []).length >= (text.match(spanishWords) || []).length;

  if (isEnglish) {
    return text.replace(/(\d+)\.(\d+)/g, "$1 point $2");
  } else {
    return text.replace(/(\d+)\.(\d+)/g, "$1 coma $2");
  }
}

/**
 * Group sentences into blocks of ~1200 characters max for high-efficiency batch TTS calls.
 */
function groupSentencesIntoBlocks(sentences: string[], maxCharsPerBlock = 1200): { sentences: string[]; blockText: string }[] {
  const blocks: { sentences: string[]; blockText: string }[] = [];
  let currentGroup: string[] = [];
  let currentLen = 0;

  for (const s of sentences) {
    const trimmed = s.trim();
    if (!trimmed) continue;

    if (currentLen > 0 && currentLen + trimmed.length > maxCharsPerBlock) {
      blocks.push({
        sentences: currentGroup,
        blockText: currentGroup.join(" ")
      });
      currentGroup = [trimmed];
      currentLen = trimmed.length;
    } else {
      currentGroup.push(trimmed);
      currentLen += trimmed.length + 1;
    }
  }

  if (currentGroup.length > 0) {
    blocks.push({
      sentences: currentGroup,
      blockText: currentGroup.join(" ")
    });
  }

  return blocks;
}

/**
 * Synthesizes speech for a text block using Gemini TTS models with fallback.
 */
async function synthesizeBlock(text: string, voice: string, apiKey: string): Promise<Buffer> {
  const models = [
    "gemini-2.5-flash-preview-tts",
    "gemini-3.1-flash-tts-preview",
    "gemini-2.5-pro-preview-tts"
  ];
  const processed = formatDecimalsForTTS(text).substring(0, 1500);

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const payload = {
          contents: [{ parts: [{ text: processed }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voice }
              }
            }
          }
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 16000);

        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const base64Data = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          if (base64Data) {
            return Buffer.from(base64Data, "base64");
          }
        }
      } catch (err: any) {
        console.warn(`[Cached Audio] Model ${model} failed (attempt ${attempt + 1}):`, err?.message || err);
      }
    }
  }

  console.error(`[Cached Audio] All models failed for block: "${text.substring(0, 30)}...". Generating fallback silence.`);
  const estimatedSec = Math.max(2, Math.round(text.length / 14));
  return Buffer.alloc(estimatedSec * 48000);
}

/**
 * Volatile cache cleaner: ensures videos_cache folder stays clean (<24 hours old, max 35 files).
 */
async function triggerVolatileCacheCleanup(supabase: any) {
  try {
    const { data: files, error } = await supabase.storage.from("documents").list("videos_cache", {
      limit: 100,
      sortBy: { column: "created_at", order: "asc" }
    });

    if (error || !files || files.length === 0) return;

    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const toDelete: string[] = [];

    // 1. Files older than 24 hours
    files.forEach((f: any) => {
      if (f.created_at) {
        const fileAge = now - new Date(f.created_at).getTime();
        if (fileAge > oneDayMs) {
          toDelete.push(`videos_cache/${f.name}`);
        }
      }
    });

    // 2. LRU: If still more than 35 files, purge oldest
    const remaining = files.filter((f: any) => !toDelete.includes(`videos_cache/${f.name}`));
    if (remaining.length > 35) {
      const excess = remaining.slice(0, remaining.length - 30);
      excess.forEach((f: any) => toDelete.push(`videos_cache/${f.name}`));
    }

    if (toDelete.length > 0) {
      console.log(`[Cached Audio Volatile Cleanup] Purging ${toDelete.length} expired cache files from Supabase Storage`);
      await supabase.storage.from("documents").remove(toDelete);
    }
  } catch (err) {
    console.warn("[Cached Audio Volatile Cleanup] Non-blocking cleanup warning:", err);
  }
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ success: false, error: "Falta GEMINI_API_KEY en el servidor." }, { status: 500 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ success: false, error: "Faltan credenciales de Supabase en el servidor." }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body: CachedAudioRequestBody = await request.json();
    const { videoId, track, voice = "Aoede", language = "en", sentences } = body;

    if (!videoId || !track || !Array.isArray(sentences) || sentences.length === 0) {
      return NextResponse.json({ success: false, error: "Parámetros requeridos inválidos (videoId, track, sentences)." }, { status: 400 });
    }

    const safeVideoId = videoId.replace(/[^a-zA-Z0-9_-]/g, "");
    const baseKey = `${safeVideoId}_${track}_${voice}_${language}`;
    const mp3StoragePath = `videos_cache/${baseKey}.mp3`;
    const jsonStoragePath = `videos_cache/${baseKey}.json`;

    // 1. Check if volatile cache already has this audio ready (< 24 hours)
    try {
      const { data: jsonBlob, error: jsonErr } = await supabase.storage.from("documents").download(jsonStoragePath);
      if (!jsonErr && jsonBlob) {
        const jsonText = await jsonBlob.text();
        const cachedMeta = JSON.parse(jsonText);

        const { data: publicUrlData } = supabase.storage.from("documents").getPublicUrl(mp3StoragePath);
        console.log(`[Cached Audio API] Volatile Cache HIT for ${baseKey}! Serving instant URL.`);

        return NextResponse.json({
          success: true,
          audioUrl: publicUrlData.publicUrl,
          sentenceTimestamps: cachedMeta.sentenceTimestamps,
          totalDuration: cachedMeta.totalDuration,
          fromCache: true
        });
      }
    } catch (_) {
      // If download fails or json is corrupt, proceed to fresh synthesis
    }

    console.log(`[Cached Audio API] Volatile Cache MISS for ${baseKey}. Synthesizing ${sentences.length} sentences on-demand...`);

    // 2. Group into optimal blocks (~1200 chars)
    const blocks = groupSentencesIntoBlocks(sentences, 1200);

    // 3. Synthesize blocks concurrently in parallel
    const pcmPromises = blocks.map((b) => synthesizeBlock(b.blockText, voice, apiKey));
    const pcmBuffers = await Promise.all(pcmPromises);

    // 4. Calculate exact proportional sentence timestamps
    const timestamps: SentenceTimestamp[] = [];
    let cumulativeOffset = 0;
    let globalSentenceIdx = 0;

    for (let bIdx = 0; bIdx < blocks.length; bIdx++) {
      const block = blocks[bIdx];
      const pcm = pcmBuffers[bIdx];
      const blockDurationSec = pcm.length / 48000; // 24kHz * 16-bit mono = 48000 bytes/sec
      const totalBlockChars = block.sentences.reduce((acc, s) => acc + s.length, 0);

      let currentBlockTime = cumulativeOffset;
      block.sentences.forEach((s) => {
        const prop = totalBlockChars > 0 ? s.length / totalBlockChars : 1 / block.sentences.length;
        const sDuration = blockDurationSec * prop;
        const startTime = Number(currentBlockTime.toFixed(2));
        const endTime = Number((currentBlockTime + sDuration).toFixed(2));

        timestamps.push({
          sentenceIdx: globalSentenceIdx,
          text: s,
          startTime,
          endTime
        });

        globalSentenceIdx++;
        currentBlockTime += sDuration;
      });

      cumulativeOffset += blockDurationSec;
    }

    // 5. Concatenate and compress PCM to lightweight MP3 (48kbps mono ~1-2 MB)
    const fullPcm = Buffer.concat(pcmBuffers);
    const mp3Buffer = encodePcmToMp3(fullPcm, 24000, 48);

    // 6. Upload MP3 and JSON metadata to Supabase Storage in videos_cache/
    const { error: mp3UploadErr } = await supabase.storage.from("documents").upload(mp3StoragePath, mp3Buffer, {
      contentType: "audio/mpeg",
      upsert: true
    });

    if (mp3UploadErr) {
      console.error("[Cached Audio API] Failed to upload MP3 to Supabase Storage:", mp3UploadErr);
      throw new Error(`Error al subir MP3 a Supabase: ${mp3UploadErr.message}`);
    }

    const metadataPayload = {
      videoId,
      track,
      voice,
      language,
      totalDuration: Number(cumulativeOffset.toFixed(2)),
      sentenceTimestamps: timestamps,
      createdAt: new Date().toISOString()
    };

    await supabase.storage.from("documents").upload(
      jsonStoragePath,
      Buffer.from(JSON.stringify(metadataPayload), "utf-8"),
      { contentType: "application/json", upsert: true }
    );

    const { data: publicUrlData } = supabase.storage.from("documents").getPublicUrl(mp3StoragePath);

    // 7. Non-blocking trigger of volatile cache cleanup
    triggerVolatileCacheCleanup(supabase).catch(() => {});

    console.log(`[Cached Audio API] Completed on-demand synthesis for ${baseKey} (${Number(cumulativeOffset.toFixed(1))}s, ${mp3Buffer.length} bytes)`);

    return NextResponse.json({
      success: true,
      audioUrl: publicUrlData.publicUrl,
      sentenceTimestamps: timestamps,
      totalDuration: Number(cumulativeOffset.toFixed(2)),
      fromCache: false
    });
  } catch (err: any) {
    console.error("[Cached Audio API] Error synthesizing cached audio:", err);
    return NextResponse.json({ success: false, error: err.message || "Error interno al sintetizar audio." }, { status: 500 });
  }
}
