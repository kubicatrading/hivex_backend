import { NextResponse } from "next/server";

const SYSTEM_INSTRUCTION = `Eres un traductor profesional de élite especializado en finanzas, economía y análisis de inversiones. Tu tarea es traducir textos markdown de manera sumamente natural, fluida y con perfecta dicción al idioma solicitado, preservando estructuras complejas, marcas de tiempo y formatos técnicos.`;

interface TranslateRequestBody {
  text: string;
  targetLanguage: string;
}

export async function POST(request: Request) {
  try {
    const body: TranslateRequestBody = await request.json();
    const { text, targetLanguage } = body;

    if (!text || !targetLanguage) {
      return NextResponse.json(
        { success: false, error: "Faltan los parámetros obligatorios: 'text' o 'targetLanguage'." },
        { status: 400 }
      );
    }

    // 1. Verify credentials (GEMINI_API_KEY or Google OAuth token)
    const apiKey = process.env.GEMINI_API_KEY;
    const authHeader = request.headers.get("Authorization");
    let googleToken: string | null = null;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      googleToken = authHeader.substring(7).trim();
    }

    if (!googleToken && !apiKey) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Falta la autenticación de Gemini para realizar la traducción. Por favor configure GEMINI_API_KEY o inicie sesión de Google." 
        },
        { status: 401 }
      );
    }

    console.log(`Translate API: Translating content of size ${text.length} characters to "${targetLanguage}"`);

    // 2. Build high-fidelity translation prompt
    const promptText = `A continuación se muestra el contenido del estudio de un video estructurado en tres partes separadas por la línea '---'.
Tu tarea es traducir absolutamente todo el texto al idioma de destino: "${targetLanguage}", manteniendo la terminología correcta y las reglas especificadas abajo.

Estructura de las tres partes:
- Parte 1: Transcripción literal en primera persona, manteniendo la voz del hablante original (Andrei Jikh).
- Parte 2: Resumen Detallado y Objetivo del Contenido (con encabezados ### y ####, marcas de tiempo [MM:SS] y listas de viñetas indentadas).
- Parte 3: Informe de Análisis de Inversión (con secciones macroeconómicas, de activos, geopolíticas y alertas).

REGLAS ABSOLUTAS:
1. Traduce fielmente todo el texto al idioma solicitado: "${targetLanguage}".
2. Conserva EXACTAMENTE el formato markdown, los encabezados (#, ##, ###, ####), los guiones de lista (-), negritas (**) y todos los separadores '---'.
3. Las marcas de tiempo (por ejemplo, [05:20], [10:15]) deben permanecer EXACTAMENTE idénticas y con el mismo formato. No las alteres, no las traduzcas ni las elimines.
4. Mantén la primera persona de Andrei en la transcripción (ej: si traduces al inglés, usa "I", "my", etc.).
5. Traduce la terminología de inversión, mercados, criptomonedas y geopolítica con el vocabulario técnico más adecuado y natural en el idioma de destino (ej: en inglés usa "yield curve", en alemán "Renditekurve", en turco "verim eğrisi").
6. No agregues ninguna nota explicativa, comentario del traductor, introducción ni despedida. Devuelve únicamente el texto traducido.

Contenido a traducir:
${text}`;

    // 3. Resilient model fallback pool
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "558326121700-ufp44b64pdnb0cisl7nu3c2dqc3vu82k.apps.googleusercontent.com";
    const projectNumber = clientId.split("-")[0] || "558326121700";

    const attempts = [
      {
        name: "Google AI Studio Gemini 2.5 Flash (v1beta)",
        type: "google-ai",
        url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`
      },
      {
        name: "Google AI Studio Gemini 3.5 Flash (v1beta)",
        type: "google-ai",
        url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent`
      },
      {
        name: "Google AI Studio Gemini 2.5 Pro (v1beta)",
        type: "google-ai",
        url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent`
      },
      {
        name: "Vertex AI Gemini 2.5 Flash",
        type: "vertex",
        url: `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectNumber}/locations/us-central1/publishers/google/models/gemini-2.5-flash:generateContent`
      },
      {
        name: "Vertex AI Gemini 3.5 Flash",
        type: "vertex",
        url: `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectNumber}/locations/us-central1/publishers/google/models/gemini-3.5-flash:generateContent`
      }
    ];

    let translatedText = "";
    let successfulModel = "";
    const errorDetails: string[] = [];

    for (const attempt of attempts) {
      try {
        console.log(`Translate API: Attempting translation with ${attempt.name}...`);
        
        let requestUrl = attempt.url;
        const headers: Record<string, string> = {
          "Content-Type": "application/json"
        };

        if (attempt.type === "google-ai" && apiKey) {
          requestUrl = `${attempt.url}?key=${apiKey}`;
        } else if (googleToken) {
          headers["Authorization"] = `Bearer ${googleToken}`;
        } else {
          errorDetails.push(`${attempt.name}: Sin credenciales válidas (configura GEMINI_API_KEY o inicia sesión).`);
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
            temperature: 0.1
          }
        };

        if (attempt.type === "google-ai") {
          payload.system_instruction = {
            parts: [{ text: SYSTEM_INSTRUCTION }]
          };
        } else {
          payload.systemInstruction = {
            parts: [{ text: SYSTEM_INSTRUCTION }]
          };
        }

        const response = await fetch(requestUrl, {
          method: "POST",
          headers: headers,
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          const geminiData = await response.json();
          const apiResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

          if (apiResponse && apiResponse.trim().length > 0) {
            translatedText = apiResponse.trim();
            successfulModel = attempt.name;
            console.log(`Translate API: Successful translation using ${attempt.name}!`);
            break;
          } else {
            errorDetails.push(`${attempt.name}: Respuesta vacía de la API.`);
          }
        } else {
          const errText = await response.text();
          errorDetails.push(`${attempt.name} (HTTP ${response.status}): ${errText}`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errorDetails.push(`${attempt.name} (Excepción de red): ${msg}`);
      }
    }

    if (translatedText && translatedText.length > 0) {
      return NextResponse.json({
        success: true,
        translatedText,
        modelUsed: successfulModel
      });
    } else {
      return NextResponse.json(
        { 
          success: false, 
          error: "No se pudo completar la traducción automática con ningún modelo de Gemini. Detalles de errores:\n" + errorDetails.join("\n")
        },
        { status: 500 }
      );
    }

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Translate API route unexpected error.";
    console.error("Translate API route failure:", error);
    return NextResponse.json(
      { success: false, error: errMsg },
      { status: 500 }
    );
  }
}
