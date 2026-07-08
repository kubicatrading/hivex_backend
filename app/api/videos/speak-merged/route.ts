import { NextResponse } from "next/server";

interface MergedSpeakRequestBody {
  chunks: string[];
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
 * Synthesizes a single chunk of text to raw PCM bytes using Gemini's TTS model suite.
 * If synthesis fails, returns a 0.5-second silent PCM buffer as a resilient fallback.
 */
async function synthesizeSingleChunk(text: string, voice: string, apiKey: string): Promise<Buffer> {
  const models = [
    "gemini-2.5-pro-preview-tts",
    "gemini-2.5-flash-preview-tts",
    "gemini-3.1-flash-tts-preview"
  ];

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [
          {
            parts: [
              {
                text: text.trim()
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

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        const part = data.candidates?.[0]?.content?.parts?.[0];
        if (part?.inlineData?.data) {
          return Buffer.from(part.inlineData.data, "base64");
        }
      }
    } catch (err) {
      console.warn(`[Speak Merged] Model ${model} failed for chunk: "${text.substring(0, 30)}..."`, err);
    }
  }

  // Resilient fallback: 0.5s of raw silent PCM (sampleRate 24000, 16-bit mono -> 24000 * 2 * 0.5 = 24000 bytes)
  console.error(`[Speak Merged] All models failed for chunk: "${text.substring(0, 40)}...". Emitting 0.5s of silence.`);
  return Buffer.alloc(24000);
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "Falta la variable de entorno GEMINI_API_KEY en el servidor." },
        { status: 500 }
      );
    }

    const body: MergedSpeakRequestBody = await request.json();
    const { chunks, voice = "Charon" } = body;

    if (!chunks || !Array.isArray(chunks) || chunks.length === 0) {
      return NextResponse.json(
        { success: false, error: "El parámetro obligatorio 'chunks' debe ser un arreglo de texto no vacío." },
        { status: 400 }
      );
    }

    console.log(`[Speak Merged API] Processing ${chunks.length} chunks in parallel with voice ${voice}`);

    // Synthesize all text chunks concurrently
    const pcmBuffers = await Promise.all(
      chunks.map((chunk) => synthesizeSingleChunk(chunk, voice, apiKey))
    );

    // Concatenate raw PCM buffers and compute mathematically precise start times & durations
    // 24kHz 16-bit mono = 48,000 bytes per second
    const bytesPerSecond = 48000;
    const timestamps: Array<{ text: string; startTime: number; duration: number }> = [];
    let cumulativeByteOffset = 0;

    for (let i = 0; i < chunks.length; i++) {
      const bufferLength = pcmBuffers[i].length;
      const duration = bufferLength / bytesPerSecond;
      const startTime = cumulativeByteOffset / bytesPerSecond;

      timestamps.push({
        text: chunks[i],
        startTime: Number(startTime.toFixed(4)),
        duration: Number(duration.toFixed(4))
      });

      cumulativeByteOffset += bufferLength;
    }

    const mergedPcm = Buffer.concat(pcmBuffers);
    const wavBuffer = addWavHeader(mergedPcm, 24000, 1, 16);

    return NextResponse.json({
      success: true,
      base64Audio: wavBuffer.toString("base64"),
      timestamps
    });
  } catch (error: any) {
    console.error("[Speak Merged Route Error]:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Ocurrió un error inesperado al fusionar la síntesis de voz." },
      { status: 500 }
    );
  }
}
