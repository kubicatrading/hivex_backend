import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SYSTEM_INSTRUCTION = `Eres un traductor profesional de élite especializado en finanzas, economía, geopolítica y análisis de mercados. Tu única tarea es traducir el texto suministrado de manera sumamente natural, fluida y con perfecta dicción al idioma solicitado, preservando listas, nombres propios y estructura markdown. No agregues introducciones, explicaciones, ni notas del traductor.`;

const ATTEMPTS = [
  {
    name: "Google AI Studio Gemini 3.6 Flash",
    url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent"
  },
  {
    name: "Google AI Studio Gemini 3.5 Flash",
    url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent"
  },
  {
    name: "Google AI Studio Gemini 3.0 Flash",
    url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.0-flash:generateContent"
  },
  {
    name: "Google AI Studio Gemini 2.5 Flash",
    url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
  }
];

async function translateTextWithGemini(prompt: string, apiKey: string): Promise<string> {
  let lastError = "";

  for (const attempt of ATTEMPTS) {
    try {
      const response = await fetch(`${attempt.url}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          generationConfig: { temperature: 0.1, maxOutputTokens: 8192 }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts
          ?.filter((p: any) => !p.thought)
          ?.map((p: any) => p.text)
          ?.join("") || "";

        if (text.trim().length > 0) {
          return text.trim();
        }
      } else {
        const errText = await response.text();
        lastError = `${attempt.name} HTTP ${response.status}: ${errText}`;
      }
    } catch (e: any) {
      lastError = `${attempt.name} Exception: ${e?.message || String(e)}`;
    }
  }

  throw new Error(`Fallback translation failed: ${lastError}`);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { articleId, title, category, subcategory, paragraphs, targetLanguage } = body;

    if (!targetLanguage || !paragraphs) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: targetLanguage or paragraphs" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "GEMINI_API_KEY is not configured on the server." },
        { status: 500 }
      );
    }

    const inputContent = `TITLE: ${title || ""}\nCATEGORY: ${category || ""}\nSUBCATEGORY: ${subcategory || ""}\n\n${(paragraphs || []).join("\n\n")}`;
    const prompt = `Traduce el siguiente artículo completo de revista financiera/económica al idioma de destino "${targetLanguage}".
Conserva exactamente los prefijos "TITLE:", "CATEGORY:" y "SUBCATEGORY:" al inicio de las primeras líneas.

Contenido:
${inputContent}`;

    const translatedRaw = await translateTextWithGemini(prompt, apiKey);

    // Parse translated components
    let transTitle = title || "";
    let transCat = category || "";
    let transSubcat = subcategory || "";

    const titleMatch = /TITLE:\s*([^\n]+)/i.exec(translatedRaw);
    if (titleMatch) transTitle = titleMatch[1].trim();

    const catMatch = /CATEGORY:\s*([^\n]+)/i.exec(translatedRaw);
    if (catMatch) transCat = catMatch[1].trim();

    const subcatMatch = /SUBCATEGORY:\s*([^\n]+)/i.exec(translatedRaw);
    if (subcatMatch) transSubcat = subcatMatch[1].trim();

    let bodyText = translatedRaw;
    if (translatedRaw.includes("\n\n")) {
      const parts = translatedRaw.split("\n\n");
      bodyText = parts.slice(1).join("\n\n");
    }

    let transParas = bodyText
      .split("\n\n")
      .map((p) => p.replace(/^(TITLE|CATEGORY|SUBCATEGORY):\s*[^\n]+\n?/gi, "").trim())
      .filter((p) => p.length > 3);

    if (transParas.length === 0) {
      transParas = paragraphs;
    }

    const translationObject = {
      title: transTitle,
      category: transCat,
      subcategory: transSubcat,
      paragraphs: transParas
    };

    // Server-side database persistence using Service Role Key to bypass RLS constraints
    if (articleId) {
      const supabaseUrl = process.env.SUPABASE_PRODUCTION_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_PRODUCTION_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

      if (supabaseUrl && serviceRoleKey) {
        try {
          const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false }
          });

          const { data: docData } = await supabaseAdmin
            .from("documents")
            .select("metadata")
            .eq("id", articleId)
            .maybeSingle();

          if (docData) {
            const currentMetadata = docData.metadata || {};
            const updatedMetadata = {
              ...currentMetadata,
              translations: {
                ...(currentMetadata.translations || {}),
                [targetLanguage]: translationObject
              }
            };

            await supabaseAdmin
              .from("documents")
              .update({ metadata: updatedMetadata })
              .eq("id", articleId);
          }
        } catch (dbErr) {
          console.error("[News Translate Route] DB update error:", dbErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      translation: translationObject
    });
  } catch (err: any) {
    console.error("[News Translate Route] Error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
