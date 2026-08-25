import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Vercel maximum execution duration

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://lhtlrztsmkllcqiziftn.supabase.co";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy";
  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function POST(req: Request) {
  try {
    const { issueSlug, transcriptionText, docId, title } = await req.json();

    if (!issueSlug && !docId) {
      return NextResponse.json({ success: false, error: "Missing issueSlug or docId" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: "Missing GEMINI_API_KEY" }, { status: 500 });
    }

    console.log(`[News Summarize API] Generating Premium Markdown Summary for issue ${issueSlug || docId}...`);

    const supabase = getSupabaseClient();

    let textToSummarize = transcriptionText || "";

    // If textToSummarize was not provided, fetch articles from Supabase
    if (!textToSummarize) {
      const { data: articles } = await supabase
        .from("documents")
        .select("*")
        .in("type", ["knowledge_transcription", "knowledge_article_transcription", "knowledge_analysis"])
        .eq("metadata->>is_magazine_article", "true")
        .eq("metadata->>issue_slug", issueSlug)
        .order("created_at", { ascending: true });

      if (articles && articles.length > 0) {
        textToSummarize = articles.map(art => {
          const paras = art.metadata?.paragraphs ? art.metadata.paragraphs.join("\n\n") : (art.description || "");
          return `### ${art.title}\nCategoría: ${art.metadata?.category || "TENDENCIAS"}\n\n${paras}`;
        }).join("\n\n---\n\n");
      }
    }

    if (!textToSummarize) {
      textToSummarize = `Revista Semanal ${title || issueSlug}`;
    }

    // Gemini Flash models priority list in strict descending release order
    const modelsToTry = [
      "gemini-3.6-flash",
      "gemini-3.5-flash",
      "gemini-3.0-flash",
      "gemini-2.5-flash",
      "gemini-2.5-flash",
      "gemini-1.5-flash"
    ];

    const promptText = `Eres un analista macroeconómico y editor jefe de élite de HIVEX.
Tu objetivo es analizar la transcripción completa de la revista semanal de noticias y mercados y sintetizar un RESUMEN DETALLADO PREMIUM EN FORMATO MARKDOWN de la más alta calidad.

REGLAS ESTRUCTURALES Y DE ESTILO EN MARKDOWN (ESTRICTAS):
1. TÍTULO Y CABECERA: Comienza con un título en '# Resumen Detallado: [Nombre/Edición del Magazine]'.
2. SECCIONES CON NIVEL '##' Y '###': Divide el análisis en bloques temáticos claros (ejemplo: '## 1. Panorama Macroeconómico Global', '## 2. Mercados Financieros y Geopolítica', '## 3. Tesis Clave e Impacto Inversor').
3. VIÑETAS Y LISTAS ANIDADAS: Utiliza viñetas ('* ' o '- ') con sub-niveles e identado si fuera necesario para profundizar en datos numéricos, porcentajes y cotizaciones.
4. DESTACADOS Y FUENTES: Pon en negrita '**datos clave**', cifras numéricas y nombres de activos o analistas citados.
5. REDACCIÓN Y TONO: Redáctalo enteramente en español, con un tono serio, sobrio, formal y directo, propio de un despacho bursátil para inversores institucionales.
6. NO agregues introducciones conversacionales ni comentarios de la IA. Ve directamente al contenido formateado en Markdown.

TRANSCRIPCIÓN COMPLETA DEL MAGAZINE:
${textToSummarize}`;

    let generatedMarkdown = "";
    let usedModel = "";

    for (const modelName of modelsToTry) {
      try {
        console.log(`[News Summarize API] Querying model ${modelName}...`);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: promptText }] }],
            system_instruction: {
              parts: [{ text: "You are an elite financial editor. Produce a beautifully formatted Markdown detailed summary for institutional investors." }]
            },
            generationConfig: { temperature: 0.2, maxOutputTokens: 8192 }
          })
        });

        if (response.ok) {
          const resData = await response.json();
          const candidateText = resData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidateText && candidateText.length > 50) {
            generatedMarkdown = candidateText;
            usedModel = modelName;
            console.log(`[News Summarize API] Generated Markdown summary using ${modelName}. Length: ${generatedMarkdown.length} chars.`);
            break;
          }
        } else {
          console.warn(`[News Summarize API] Model ${modelName} returned status ${response.status}. Trying next...`);
        }
      } catch (mErr) {
        console.warn(`[News Summarize API] Error querying ${modelName}:`, mErr);
      }
    }

    if (!generatedMarkdown) {
      return NextResponse.json({
        success: false,
        error: "No se pudo generar el resumen Markdown con ningún modelo de la familia Gemini Flash."
      }, { status: 500 });
    }

    // Persist summary in Supabase document metadata if docId or issueSlug provided
    if (docId || issueSlug) {
      try {
        let query = supabase.from("documents").select("*");
        if (docId) query = query.eq("id", docId);
        else query = query.in("type", ["knowledge_transcription", "knowledge_summary"]).eq("metadata->>slug", issueSlug);

        const { data: matchedDocs } = await query.limit(1);
        if (matchedDocs && matchedDocs.length > 0) {
          const doc = matchedDocs[0];
          const updatedMeta = {
            ...(doc.metadata || {}),
            summary: generatedMarkdown
          };
          await supabase
            .from("documents")
            .update({ metadata: updatedMeta, updated_at: new Date().toISOString() })
            .eq("id", doc.id);
          console.log(`[News Summarize API] Updated summary metadata in Supabase for document ${doc.id}`);
        }
      } catch (dbErr) {
        console.warn(`[News Summarize API] Could not update document metadata in Supabase:`, dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      summary: generatedMarkdown,
      modelUsed: usedModel
    });

  } catch (error: any) {
    console.error("[News Summarize API Error]:", error);
    return NextResponse.json({
      success: false,
      error: error?.message || "Ocurrió un error al generar el resumen del magazine."
    }, { status: 500 });
  }
}
