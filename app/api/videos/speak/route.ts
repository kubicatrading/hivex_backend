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
 * Core speech synthesis handler supporting both GET and POST requests.
 */
async function synthesizeSpeech(text: string, voice: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: "Falta la variable de entorno GEMINI_API_KEY en el servidor." },
      { status: 500 }
    );
  }

  // Sequence of dedicated Gemini TTS models to attempt
  const models = [
    "gemini-2.5-pro-preview-tts",
    "gemini-2.5-flash-preview-tts",
    "gemini-3.1-flash-tts-preview"
  ];

  let base64Audio = "";
  let successfulModel = "";
  const errorDetails: string[] = [];

  // Attempt generation sequentially
  for (const model of models) {
    try {
      console.log(`[Speak API] Trying model: ${model} with voice: ${voice}`);
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
          base64Audio = part.inlineData.data;
          successfulModel = model;
          console.log(`[Speak API] Generation successful with model ${model}! Base64 length: ${base64Audio.length}`);
          break;
        } else {
          errorDetails.push(`${model}: No se encontraron datos binarios (inlineData) en la respuesta.`);
        }
      } else {
        const errText = await response.text();
        errorDetails.push(`${model} (HTTP ${response.status}): ${errText}`);
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
      { status: 502 }
    );
  }

  // Decode base64 PCM to raw binary Buffer
  const pcmBuffer = Buffer.from(base64Audio, "base64");

  // Package the raw signed 16-bit 24kHz linear PCM data with a 44-byte standard RIFF/WAV header
  const wavBuffer = addWavHeader(pcmBuffer, 24000, 1, 16);

  // Return the response as binary stream playable natively by browser Audio element
  return new Response(new Uint8Array(wavBuffer), {
    status: 200,
    headers: {
      "Content-Type": "audio/wav",
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

    return await synthesizeSpeech(text, voice);
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

    return await synthesizeSpeech(text, voice);
  } catch (error: any) {
    const errMsg = error?.message || "Ocurrió un error inesperado en la ruta de síntesis de voz GET.";
    console.error("[Speak API GET Error]:", error);
    return NextResponse.json(
      { success: false, error: errMsg },
      { status: 500 }
    );
  }
}
