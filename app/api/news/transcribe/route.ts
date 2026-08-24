import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFParse } from "pdf-parse";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://lhtlrztsmkllcqiziftn.supabase.co";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy";
  return createClient(supabaseUrl, supabaseServiceKey);
}

const MAJOR_SECTIONS = [
  "TRENDS ON THE ECONOMIC AND MARKET FRONT",
  "TRENDS ON THE GLOBAL ECONOMIC FRONT",
  "THE IRAN WAR",
  "THE ISRAEL WAR",
  "FEATURED TRENDS GUEST ARTICLES",
  "TRENDS IN GEOPOLITICS",
  "PRESIDENTIAL REALITY SHOW",
  "TRENDS EYE VIEW",
  "TRENDS IN HI-TECH SCIENCE",
  "TRENDS IN AI",
  "ECONOMIC UPDATE"
];

function cleanPageText(rawPage: string) {
  if (!rawPage) return "";
  const lines = rawPage.split("\n");
  const filtered = lines.filter(line => {
    const trimmed = line.trim();
    if (/^Trends Journal\s+\d+/i.test(trimmed)) return false;
    if (/^--\s*\d+\s+of\s+\d+\s*--$/i.test(trimmed)) return false;
    if (/^PAGE\s+\d+/i.test(trimmed)) return false;
    return true;
  });
  return filtered.join("\n").trim();
}

async function parseTOCWithGemini(tocText: string, apiKey: string) {
  const prompt = `You are an elite data extraction assistant.
Parse the following Table of Contents text from the Trends Journal magazine into a clean JSON array of articles.

For each article, extract:
1. "category": The section/category name (e.g., "TRENDS ON THE ECONOMIC AND MARKET FRONT", "TRENDS ON THE GLOBAL ECONOMIC FRONT", "THE IRAN WAR", "THE ISRAEL WAR", "FEATURED TRENDS GUEST ARTICLES", "TRENDS IN GEOPOLITICS", "PRESIDENTIAL REALITY SHOW", "TRENDS EYE VIEW", "TRENDS IN HI-TECH SCIENCE", "TRENDS IN AI").
2. "title": The full clean title of the article (without the page number at the end).
3. "startPage": The starting page number as an integer.

IMPORTANT RULES:
- Do NOT include section category headers without an article name as articles.
- Output ONLY valid JSON array with schema:
[
  { "category": "THE IRAN WAR", "title": "RUBIO SAYS THERE HAS BEEN PROGRESS...", "startPage": 61 }
]

Table of Contents Text:
${tocText}`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    })
  });

  if (!res.ok) {
    throw new Error(`Gemini API returned status ${res.status}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return JSON.parse(text) as { category: string; title: string; startPage: number }[];
}

export async function POST(req: Request) {
  try {
    const { issueSlug, pdfUrl, title } = await req.json();

    if (!issueSlug) {
      return NextResponse.json({ success: false, error: "Missing issueSlug" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: "Missing GEMINI_API_KEY" }, { status: 500 });
    }

    console.log(`[News Transcribe API] Initiating TOC-Guided Page Slicing Pipeline for issue ${issueSlug}...`);
    const supabase = getSupabaseClient();

    // Fetch magazine issue parent document to retrieve target user_id
    const { data: issueDocs } = await supabase
      .from("documents")
      .select("id, user_id, file_url")
      .eq("metadata->>is_magazine_issue", "true")
      .limit(1);

    const parentIssue = issueDocs?.[0];
    const targetUserId = parentIssue?.user_id || "5c8d65c6-0798-4f8a-aae3-dd2cebebd868";
    const targetPdfUrl = pdfUrl || parentIssue?.file_url;

    if (!targetPdfUrl) {
      return NextResponse.json({ success: false, error: "No PDF URL found for magazine issue" }, { status: 400 });
    }

    console.log(`[News Transcribe API] Downloading PDF binary from: ${targetPdfUrl}`);
    const pRes = await fetch(targetPdfUrl);
    if (!pRes.ok) {
      return NextResponse.json({ success: false, error: `Failed to download PDF binary from URL (${pRes.status})` }, { status: 500 });
    }

    const arrayBuffer = await pRes.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // 1. Extract verbatim text using PDFParse
    console.log(`[News Transcribe API] Extracting raw verbatim text via PDFParse...`);
    const pdfInstance = new PDFParse(uint8Array);
    const textResult = await pdfInstance.getText();
    const fullVerbatimText = textResult?.text || "";

    if (!fullVerbatimText || fullVerbatimText.length < 500) {
      return NextResponse.json({ success: false, error: "Could not extract text from PDF file" }, { status: 500 });
    }

    // 2. Split full text into pages
    const pageRegex = /--\s*(\d+)\s+of\s+(\d+)\s*--/g;
    let match;
    const pages: string[] = [];
    let lastIndex = 0;

    while ((match = pageRegex.exec(fullVerbatimText)) !== null) {
      const pageNum = parseInt(match[1], 10);
      const pageContent = fullVerbatimText.substring(lastIndex, match.index).trim();
      pages[pageNum] = pageContent;
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < fullVerbatimText.length) {
      pages[pages.length] = fullVerbatimText.substring(lastIndex).trim();
    }

    // 3. Extract Table of Contents (Pages 3-6) and parse with Gemini Flash
    const tocText = [pages[3] || "", pages[4] || "", pages[5] || "", pages[6] || ""].join("\n\n");
    console.log(`[News Transcribe API] Parsing TOC with Gemini Flash...`);
    const tocArticles = await parseTOCWithGemini(tocText, apiKey);
    console.log(`[News Transcribe API] Extracted ${tocArticles.length} articles from TOC.`);

    // 4. Slice pages and build clean articles
    const cleanArticles = [];
    const totalPages = pages.length - 1;

    for (let i = 0; i < tocArticles.length; i++) {
      const art = tocArticles[i];
      const nextArt = (i < tocArticles.length - 1) ? tocArticles[i + 1] : null;

      const startP = art.startPage;
      const endP = nextArt ? nextArt.startPage : totalPages;

      let combinedPageText = [];
      for (let p = startP; p <= endP && p <= totalPages; p++) {
        if (pages[p]) {
          combinedPageText.push(cleanPageText(pages[p]));
        }
      }

      let rawBody = combinedPageText.join("\n\n");

      // Cut off at next article's title snippet
      if (nextArt && nextArt.title) {
        const titleSnippet = nextArt.title.substring(0, Math.min(30, nextArt.title.length)).trim();
        const nextTitleIdx = rawBody.indexOf(titleSnippet);
        if (nextTitleIdx > 50) {
          rawBody = rawBody.substring(0, nextTitleIdx).trim();
        }
      }

      // Remove trailing major section headers
      for (const sec of MAJOR_SECTIONS) {
        if (rawBody.toUpperCase().endsWith(sec.toUpperCase())) {
          rawBody = rawBody.substring(0, rawBody.length - sec.length).trim();
        }
      }

      // Remove leading title snippet
      const currentSnippet = art.title.substring(0, Math.min(30, art.title.length)).trim();
      if (rawBody.startsWith(currentSnippet)) {
        const firstNL = rawBody.indexOf("\n");
        if (firstNL > 0 && firstNL < 200) {
          rawBody = rawBody.substring(firstNL).trim();
        }
      }

      // Remove leading section headers
      for (const sec of MAJOR_SECTIONS) {
        if (rawBody.toUpperCase().startsWith(sec.toUpperCase())) {
          const firstNL = rawBody.indexOf("\n");
          if (firstNL > 0 && firstNL < 150) {
            rawBody = rawBody.substring(firstNL).trim();
          }
        }
      }

      // Format paragraphs
      const rawParagraphs = rawBody.split(/\n\s*\n/);
      const paragraphs = [];

      for (let pBlock of rawParagraphs) {
        const cleanP = pBlock.split("\n").map(l => l.trim()).join(" ").replace(/\s+/g, " ").trim();
        if (cleanP.length > 20) {
          if (MAJOR_SECTIONS.some(sec => cleanP.toUpperCase() === sec.toUpperCase())) continue;
          if (/^\d+$/.test(cleanP)) continue;
          paragraphs.push(cleanP);
        }
      }

      cleanArticles.push({
        title: art.title,
        category: art.category,
        startPage: art.startPage,
        paragraphs
      });
    }

    // 5. Delete old articles for this issue slug
    await supabase
      .from("documents")
      .delete()
      .in("type", ["knowledge_article_transcription", "knowledge_analysis"])
      .eq("metadata->>is_magazine_article", "true")
      .eq("metadata->>issue_slug", issueSlug);

    // 6. Batch upsert clean articles to Supabase
    const payloadList = cleanArticles.map((art, idx) => ({
      id: crypto.randomUUID(),
      user_id: targetUserId,
      title: art.title,
      description: art.paragraphs.join("\n\n"),
      type: "knowledge_transcription",
      metadata: {
        is_magazine_article: "true",
        issue_slug: issueSlug,
        category: art.category,
        paragraphs: art.paragraphs,
        start_page: art.startPage,
        order_index: idx + 1,
        transcription_verbatim: "true",
        parser_version: "toc_page_sliced_v4"
      }
    }));

    let savedCount = 0;
    const chunkSize = 15;
    for (let i = 0; i < payloadList.length; i += chunkSize) {
      const chunk = payloadList.slice(i, i + chunkSize);
      const { error: batchErr } = await supabase.from("documents").upsert(chunk);
      if (!batchErr) {
        savedCount += chunk.length;
      } else {
        console.warn(`[News Transcribe API] Error upserting chunk ${i}:`, batchErr);
      }
    }

    console.log(`[News Transcribe API] Successfully saved/upserted ${savedCount} clean articles to Supabase for issue ${issueSlug}.`);

    // Asynchronously trigger background audio generation without blocking transcription response
    if (issueDocs && issueDocs.length > 0) {
      const parentDocId = issueDocs[0].id;
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://hivex-backend.vercel.app";
      fetch(`${appUrl}/api/magazines/generate-audio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: parentDocId,
          voice: "Aoede",
          language: "es",
          forceRegenerate: false
        })
      }).catch((bgErr) => console.warn("[News Transcribe API] Background audio trigger warning:", bgErr?.message || bgErr));
    }

    return NextResponse.json({
      success: true,
      articleCount: savedCount,
      totalChars: fullVerbatimText.length,
      modelUsed: "toc-page-sliced-v4"
    });

  } catch (error: any) {
    console.error("[News Transcribe API Error]:", error);
    return NextResponse.json({
      success: false,
      error: error?.message || "Ocurrió un error al procesar la transcripción del magazine."
    }, { status: 500 });
  }
}
