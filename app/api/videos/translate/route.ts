import { NextResponse } from "next/server";

const SYSTEM_INSTRUCTION = `Eres un traductor profesional de élite especializado en finanzas, economía y análisis de inversiones. Tu tarea es traducir textos markdown de manera sumamente natural, fluida y con perfecta dicción al idioma solicitado, preservando estructuras complejas, marcas de tiempo y formatos técnicos.`;

interface TranslateRequestBody {
  text: string;
  targetLanguage: string;
}

async function translateSegment(
  segmentText: string,
  segmentIndex: number,
  targetLanguage: string,
  apiKey: string | null,
  googleToken: string | null,
  projectNumber: string
): Promise<{ translatedText: string; modelUsed: string }> {
  if (!segmentText.trim()) {
    return { translatedText: "", modelUsed: "none" };
  }

  // 1. Build customized segment prompt
  let partPrompt = "";
  if (segmentIndex === 0) {
    partPrompt = `Eres un traductor profesional de élite especializado en finanzas. Traduce la siguiente transcripción literal de un vídeo de inversión manteniendo estrictamente la primera persona del presentador original (Andrei Jikh), su tono fluido y conversacional, y conservando intactas todas las marcas de tiempo (ej. [05:20]) en el idioma de destino: "${targetLanguage}".\n\nContenido:\n${segmentText}`;
  } else if (segmentIndex === 1) {
    partPrompt = `Eres un traductor profesional de élite especializado en finanzas y economía. Traduce el siguiente resumen ejecutivo detallado de un vídeo de inversión manteniendo estrictamente el formato markdown, las listas de viñetas con guiones (-), las negritas, y conservando intactas todas las marcas de tiempo (ej. [05:20]) en el idioma de destino: "${targetLanguage}".\n\nContenido:\n${segmentText}`;
  } else if (segmentIndex === 2) {
    partPrompt = `Eres un traductor profesional de élite especializado en análisis de gráficos y visualizaciones técnicas de mercado. Traduce la siguiente lista de gráficos detectados en el vídeo manteniendo estrictamente el formato markdown, las marcas de tiempo de los encabezados (ej. #### [02:30]), las viñetas con guiones (-) y las líneas de leyenda en cursiva (como *Leyenda:* o *Key Takeaway:*) en el idioma de destino: "${targetLanguage}".\n\nContenido:\n${segmentText}`;
  } else if (segmentIndex === 3) {
    partPrompt = `Eres un traductor profesional de élite especializado en análisis macroeconómico y consultoría de inversiones. Traduce el siguiente informe de análisis de inversión manteniendo estrictamente el formato markdown, los encabezados de nivel tres (###) y todas las listas de viñetas con guiones (-) en el idioma de destino: "${targetLanguage}".\n\nContenido:\n${segmentText}`;
  } else {
    partPrompt = `Eres un traductor profesional de élite. Traduce el siguiente contenido de análisis financiero al idioma de destino: "${targetLanguage}", manteniendo estrictamente todo el formato markdown, las marcas de tiempo y las listas de viñetas.\n\nContenido:\n${segmentText}`;
  }

  const SYSTEM_INSTRUCTION_SEGMENT = `Eres un traductor profesional de élite especializado en finanzas, economía y análisis de inversiones. Tu única tarea es traducir el texto suministrado de manera sumamente natural, fluida y con perfecta dicción al idioma solicitado, preservando estructuras, marcas de tiempo y formatos técnicos. No agregues introducciones, explicaciones, ni notas del traductor.`;

  // 2. Resilient model fallback pool (strictly prioritizing Gemini 3.5 Flash)
  const attempts = [
    {
      name: "Google AI Studio Gemini 3.5 Flash (v1beta)",
      type: "google-ai",
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent`
    },
    {
      name: "Vertex AI Gemini 3.5 Flash",
      type: "vertex",
      url: `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectNumber}/locations/us-central1/publishers/google/models/gemini-3.5-flash:generateContent`
    },
    {
      name: "Google AI Studio Gemini 2.5 Flash (v1beta)",
      type: "google-ai",
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`
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
    }
  ];

  let translatedText = "";
  let successfulModel = "";
  const errorDetails: string[] = [];

  for (const attempt of attempts) {
    try {
      let requestUrl = attempt.url;
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };

      if (attempt.type === "google-ai" && apiKey) {
        requestUrl = `${attempt.url}?key=${apiKey}`;
      } else if (googleToken) {
        headers["Authorization"] = `Bearer ${googleToken}`;
      } else {
        errorDetails.push(`${attempt.name}: Sin credenciales.`);
        continue;
      }

      const payload: Record<string, any> = {
        contents: [
          {
            role: "user",
            parts: [{ text: partPrompt }]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192 // Incremented maximum number of tokens allowed per request
        }
      };

      if (attempt.type === "google-ai") {
        payload.system_instruction = {
          parts: [{ text: SYSTEM_INSTRUCTION_SEGMENT }]
        };
      } else {
        payload.systemInstruction = {
          parts: [{ text: SYSTEM_INSTRUCTION_SEGMENT }]
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
          break;
        } else {
          errorDetails.push(`${attempt.name}: Respuesta vacía.`);
        }
      } else {
        const errText = await response.text();
        errorDetails.push(`${attempt.name} (HTTP ${response.status}): ${errText}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errorDetails.push(`${attempt.name} (Excepción): ${msg}`);
    }
  }

  if (translatedText && translatedText.length > 0) {
    return { translatedText, modelUsed: successfulModel };
  } else {
    throw new Error(`Error al traducir segmento ${segmentIndex}: \n` + errorDetails.join("\n"));
  }
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

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "558326121700-ufp44b64pdnb0cisl7nu3c2dqc3vu82k.apps.googleusercontent.com";
    const projectNumber = clientId.split("-")[0] || "558326121700";

    // 2. Split document into its four core segments using robust divider regex
    // Matches --- dividers cleanly.
    const regexSplit = /\n\s*(?:---|===|\*\*\*|___|- - -)[^\n]*\n/;
    const parts = text.split(regexSplit);

    console.log(`Translate API: Split input document into ${parts.length} segments`);

    // 3. Translate segments in parallel
    const translationPromises = parts.map((part, index) =>
      translateSegment(part, index, targetLanguage, apiKey || null, googleToken, projectNumber)
    );

    const results = await Promise.all(translationPromises);

    // 4. Re-combine translated parts using the exact hardcoded divider
    const translatedText = results.map(r => r.translatedText).join("\n\n---\n\n");

    const modelsUsed = Array.from(new Set(results.map(r => r.modelUsed).filter(m => m !== "none")));
    const successfulModel = modelsUsed.join(", ") || "Gemini 3.5 Flash";

    return NextResponse.json({
      success: true,
      translatedText,
      modelUsed: successfulModel
    });

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Translate API route unexpected error.";
    console.error("Translate API route failure:", error);
    return NextResponse.json(
      { success: false, error: errMsg },
      { status: 500 }
    );
  }
}
