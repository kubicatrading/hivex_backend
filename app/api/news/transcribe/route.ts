import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFParse } from "pdf-parse";
import crypto from "crypto";
import { sendMagazineNotification } from "@/lib/telegram";
import { encodePcmToMp3 } from "@/lib/audio/mp3Encoder";

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

const TTS_MODELS = [
  "gemini-2.5-flash-preview-tts",
  "gemini-2.5-pro-preview-tts"
];

function cleanPageText(rawPage: string): string {
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

function cleanLeadingHeaders(rawBody: string, mainCategory = "", subcategory = "", title = ""): string {
  let text = rawBody.trim();

  const headersToStrip = [
    mainCategory,
    subcategory,
    title,
    ...MAJOR_SECTIONS
  ].filter(Boolean);

  let changed = true;
  while (changed) {
    changed = false;
    text = text.trim();

    for (const hdr of headersToStrip) {
      const cleanHdr = hdr.trim();
      if (!cleanHdr) continue;

      if (text.toUpperCase().startsWith(cleanHdr.toUpperCase())) {
        text = text.substring(cleanHdr.length).trim();
        changed = true;
      }

      const lines = text.split("\n");
      if (lines.length > 0 && lines[0].trim().toUpperCase() === cleanHdr.toUpperCase()) {
        text = lines.slice(1).join("\n").trim();
        changed = true;
      }
    }
  }

  const lines = text.split("\n");
  while (lines.length > 0 && lines[0].trim().length < 90 && lines[0].trim() === lines[0].trim().toUpperCase() && !lines[0].trim().endsWith(".")) {
    const firstLine = lines[0].trim();
    if (headersToStrip.some(h => firstLine.includes(h.toUpperCase()) || h.toUpperCase().includes(firstLine))) {
      lines.shift();
      text = lines.join("\n").trim();
    } else {
      break;
    }
  }

  return text;
}

function cleanSummaryForSpeech(text: string): string {
  if (!text) return "";
  let clean = text.replace(/<[^>]*>/g, "");
  clean = clean.replace(/[*_~#`]/g, "");
  clean = clean.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  clean = clean.replace(/https?:\/\/\S+/g, "");
  clean = clean.replace(/--+/g, " ");
  clean = clean.replace(/^\s*[-+*]\s+/gm, "");
  clean = clean.replace(/^\s*\d+\.\s+/gm, "");
  clean = clean.replace(/^\s*>\s*/gm, "");
  clean = clean.replace(/\s+/g, " ").trim();
  return clean;
}

function splitParagraphIntoSentences(text: string): string[] {
  if (!text) return [];
  let protectedText = text;

  // Protect ellipses
  protectedText = protectedText.replace(/…/g, " _ELLIP_ ");
  protectedText = protectedText.replace(/\.{2,}/g, " _ELLIP_ ");

  // Protect decimal numbers
  protectedText = protectedText.replace(/\b(\d+)\.(\d+)\b/g, "$1_DEC_DOT_$2");

  // Protect acronyms
  protectedText = protectedText.replace(/\b([A-Za-z]{1,4}(?:\.[A-Za-z]{1,4})+)\b\.?/gi, (match) => {
    return match.replace(/\./g, "_ACR_DOT_");
  });

  // Protect common abbreviations
  const abbrevs = [
    "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "vs", "fed", "corp", "inc",
    "co", "ltd", "bros", "ca", "jan", "feb", "mar", "apr", "jun", "jul", "aug",
    "sep", "oct", "nov", "dec", "etc", "no", "nos", "st", "ave", "blvd", "vol",
    "vols", "ed", "eds", "pp", "p.m", "a.m"
  ];
  abbrevs.forEach(abbrev => {
    const regex = new RegExp("\\b(" + abbrev + ")\\.(?=\\s|$)", "gi");
    protectedText = protectedText.replace(regex, "$1_ABB_DOT_");
  });

  // Protect initials
  protectedText = protectedText.replace(/\b([A-Z])\.(?=\s+[A-Z])/g, "$1_INI_DOT_");

  const sentences = protectedText.match(/[^.!?]+[.!?]*/g) || [protectedText];

  return sentences
    .map((s) => {
      return s
        .replace(/_DEC_DOT_/g, ".")
        .replace(/_ACR_DOT_/g, ".")
        .replace(/_ABB_DOT_/g, ".")
        .replace(/_INI_DOT_/g, ".")
        .replace(/_ELLIP_/g, "...")
        .trim();
    })
    .filter((s) => {
      const clean = s.replace(/[\s.!?…"':;,\-–—()\[\]]/g, "");
      return clean.length > 0;
    });
}

function deduplicateArticles(rawList: any[]): any[] {
  const seen = new Set<string>();
  const clean: any[] = [];
  for (const item of rawList) {
    const key = `${(item.title || "").trim().toUpperCase()}_${item.startPage}`;
    if (!seen.has(key)) {
      seen.add(key);
      clean.push({
        mainCategory: (item.mainCategory || item.category || "").trim(),
        subcategory: (item.subcategory || "").trim(),
        title: (item.title || "").trim(),
        startPage: Number(item.startPage)
      });
    }
  }
  return clean.sort((a, b) => a.startPage - b.startPage);
}

async function parseTOCWithGemini(tocText: string, apiKey: string) {
  const prompt = `You are an elite data extraction assistant.
Parse the following Table of Contents text from the Trends Journal magazine into a clean JSON array of articles.
Each entry must represent an article, with its 3-level hierarchy:
1. "mainCategory": The overall section header (e.g. "TRENDS ON THE ECONOMIC AND MARKET FRONT", "TRENDS ON THE GLOBAL ECONOMIC FRONT", "THE IRAN WAR", "THE ISRAEL WAR", "FEATURED TRENDS GUEST ARTICLES", "TRENDS IN GEOPOLITICS", "PRESIDENTIAL REALITY SHOW", "TRENDS EYE VIEW", "TRENDS IN HI-TECH SCIENCE", "TRENDS IN AI").
2. "subcategory": The sub-heading or thematic area if present (if identical to the section or article, use that).
3. "title": The specific headline of the article (without any page numbers).
4. "startPage": The starting page number as an integer.

RULES:
- Do NOT include section category headers without an article name as articles.
- Output ONLY valid JSON array with schema:
[
  {
    "mainCategory": "TRENDS ON THE ECONOMIC AND MARKET FRONT",
    "subcategory": "ECONOMIC UPDATE",
    "title": "ECONOMIC UPDATE",
    "startPage": 7
  }
]

Table of Contents Text:
${tocText}`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
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
  return JSON.parse(text) as { mainCategory: string; subcategory: string; title: string; startPage: number }[];
}

async function synthesizeChunk(text: string, apiKey: string, voice = "Aoede"): Promise<Buffer> {
  const promptText = `Please read aloud clearly in American English:\n\n${text}`;
  const payload = {
    contents: [{ parts: [{ text: promptText }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voice }
        }
      }
    }
  };

  let attempt = 0;
  while (true) {
    const model = TTS_MODELS[attempt % TTS_MODELS.length];
    attempt++;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.status === 429 || res.status >= 500) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }

      if (!res.ok) {
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }

      const data = await res.json();
      const candidate = data.candidates?.[0];
      const part = candidate?.content?.parts?.[0];
      if (part?.inlineData?.data) {
        const audioBuf = Buffer.from(part.inlineData.data, "base64");
        if (audioBuf.length > 44 && audioBuf.subarray(0, 4).toString() === "RIFF") {
          return audioBuf.subarray(44);
        }
        return audioBuf;
      }
      throw new Error("No audio inlineData received from Gemini TTS");
    } catch (e: any) {
      if (attempt > 6) throw e;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

/**
 * Consolidates the full v7 magazine pipeline:
 * 1. PDF Download & Page Slicing via hierarchical 3-level TOC (Gemini Flash).
 * 2. Supabase Article insertion with authentic start_page and clean verbatim paragraphs.
 * 3. Text shielding & Canonical chunk creation.
 * 4. Gemini TTS synthesis (Aoede) with MP3 encoding at strict 18kbps.
 * 5. Full issue upload to Supabase Storage and sentence_timestamps mapping.
 * 6. Telegram notification dispatch.
 */
export async function processMagazineTranscribeAndSynthesis(issueSlug: string, force = false) {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable");
  }

  const supabase = getSupabaseClient();

  // 1. Fetch parent issue document
  const { data: issueDocs, error: issueErr } = await supabase
    .from("documents")
    .select("id, user_id, title, file_url, metadata, created_at")
    .eq("metadata->>is_magazine_issue", "true")
    .eq("metadata->>slug", issueSlug)
    .limit(1);

  if (issueErr || !issueDocs || issueDocs.length === 0) {
    throw new Error(`Magazine parent issue not found for slug: ${issueSlug}`);
  }

  const mainDoc = issueDocs[0];
  const targetUserId = mainDoc.user_id || "5c8d65c6-0798-4f8a-aae3-dd2cebebd868";

  // 2. Strict Immutability & Idempotency Check
  if (!force) {
    const isAudioReady = mainDoc.metadata?.audio_url && mainDoc.metadata?.audio_status === "ready";
    const hasTimestamps = Array.isArray(mainDoc.metadata?.sentence_timestamps) && mainDoc.metadata.sentence_timestamps.length > 100;

    const { data: existingArts } = await supabase
      .from("documents")
      .select("id, metadata")
      .eq("type", "knowledge_transcription")
      .eq("metadata->>is_magazine_article", "true")
      .eq("metadata->>issue_slug", issueSlug)
      .limit(10);

    const hasValidArticles = existingArts && existingArts.length > 0 && existingArts.every(a => a.metadata?.start_page !== undefined);

    if (isAudioReady && hasTimestamps && hasValidArticles) {
      console.log(`[News Transcribe v7] Magazine issue ${issueSlug} is already fully transcribed, page-mapped, and synthesized. Skipping.`);
      return {
        success: true,
        articleCount: existingArts.length,
        audioUrl: mainDoc.metadata?.audio_url,
        cached: true,
        message: "Magazine transcription, start_page mapping, and 18kbps audio are already complete and protected."
      };
    }
  }

  console.log(`[News Transcribe v7] Starting full v7 pipeline for ${issueSlug} (force: ${!!force})...`);

  // 3. Download PDF binary
  let pdfBuffer: Buffer | null = null;
  const storagePdfPath = `magazines/${issueSlug}.pdf`;
  const { data: storageBlob } = await supabase.storage.from("documents").download(storagePdfPath);

  if (storageBlob) {
    pdfBuffer = Buffer.from(await storageBlob.arrayBuffer());
  } else if (mainDoc.file_url) {
    console.log(`[News Transcribe v7] Downloading PDF from file_url: ${mainDoc.file_url}`);
    const fRes = await fetch(mainDoc.file_url);
    if (!fRes.ok) throw new Error(`Failed to download PDF from file_url (${fRes.status})`);
    pdfBuffer = Buffer.from(await fRes.arrayBuffer());
  }

  if (!pdfBuffer || pdfBuffer.length === 0) {
    throw new Error(`Could not obtain PDF binary for magazine issue: ${issueSlug}`);
  }

  // 4. Extract pages with PDFParse
  console.log(`[News Transcribe v7] Extracting pages from PDF binary (${(pdfBuffer.length / (1024 * 1024)).toFixed(2)} MB)...`);
  const pdfParser = new PDFParse({ data: pdfBuffer });
  const textResult = await pdfParser.getText();

  const pages: string[] = [];
  if (textResult.pages && textResult.pages.length > 0) {
    for (const p of textResult.pages) {
      pages[p.num] = p.text || "";
    }
  } else {
    // Fallback page regex
    const fullText = textResult.text || "";
    const pageRegex = /--\s*(\d+)\s+of\s+(\d+)\s*--/g;
    let match;
    let lastIndex = 0;
    while ((match = pageRegex.exec(fullText)) !== null) {
      const pageNum = parseInt(match[1], 10);
      pages[pageNum] = fullText.substring(lastIndex, match.index).trim();
      lastIndex = match.index + match[0].length;
    }
  }

  const totalPages = pages.length > 0 ? pages.length - 1 : 1;
  console.log(`[News Transcribe v7] Total pages parsed: ${totalPages}`);

  // 5. Parse TOC from Pages 3-6 with Gemini Flash
  const tocText = [pages[3] || "", pages[4] || "", pages[5] || "", pages[6] || ""].join("\n\n");
  console.log(`[News Transcribe v7] Extracting 3-level hierarchical TOC with Gemini Flash...`);
  const rawToc = await parseTOCWithGemini(tocText, geminiApiKey);
  const cleanToc = deduplicateArticles(rawToc);
  console.log(`[News Transcribe v7] Extracted ${cleanToc.length} distinct hierarchical articles from TOC.`);

  // 6. Slice pages into clean articles with verbatim paragraphs
  const articles: any[] = [];
  for (let i = 0; i < cleanToc.length; i++) {
    const art = cleanToc[i];
    const nextArt = i < cleanToc.length - 1 ? cleanToc[i + 1] : null;

    const startP = art.startPage;
    const endP = nextArt ? nextArt.startPage : totalPages;

    const combinedPageText: string[] = [];
    for (let p = startP; p <= endP && p <= totalPages; p++) {
      if (pages[p]) {
        combinedPageText.push(cleanPageText(pages[p]));
      }
    }

    let rawBody = combinedPageText.join("\n\n");

    if (nextArt && nextArt.title && nextArt.title !== art.title) {
      const nextTitleSnip = nextArt.title.substring(0, Math.min(30, nextArt.title.length)).trim();
      const nextIdx = rawBody.indexOf(nextTitleSnip);
      if (nextIdx > 50) {
        rawBody = rawBody.substring(0, nextIdx).trim();
      }
    }

    rawBody = cleanLeadingHeaders(rawBody, art.mainCategory, art.subcategory, art.title);

    const rawParagraphs = rawBody.split(/\n\s*\n/);
    const paragraphs: string[] = [];

    for (const pBlock of rawParagraphs) {
      let cleanP = pBlock.split("\n").map(l => l.trim()).join(" ").replace(/\s+/g, " ").trim();

      if (paragraphs.length === 0) {
        if (cleanP.toUpperCase().startsWith(art.mainCategory.toUpperCase())) {
          cleanP = cleanP.substring(art.mainCategory.length).trim();
        }
        if (cleanP.toUpperCase().startsWith(art.subcategory.toUpperCase())) {
          cleanP = cleanP.substring(art.subcategory.length).trim();
        }
        if (cleanP.toUpperCase().startsWith(art.title.toUpperCase())) {
          cleanP = cleanP.substring(art.title.length).trim();
        }
      }

      if (cleanP.length > 20) {
        if (MAJOR_SECTIONS.some(sec => cleanP.toUpperCase() === sec.toUpperCase())) continue;
        if (/^\d+$/.test(cleanP)) continue;
        paragraphs.push(cleanP);
      }
    }

    articles.push({
      orderIndex: i,
      mainCategory: art.mainCategory,
      subcategory: art.subcategory,
      title: art.title,
      startPage: startP,
      paragraphs: paragraphs.length > 0 ? paragraphs : [rawBody.substring(0, 300)]
    });
  }

  // 7. Atomic cleanup and insertion into Supabase
  console.log(`[News Transcribe v7] Replacing old articles in database for ${issueSlug}...`);
  await supabase
    .from("documents")
    .delete()
    .eq("metadata->>issue_slug", issueSlug)
    .eq("metadata->>is_magazine_article", "true");

  const insertedArticles: any[] = [];
  const chunkSize = 15;
  for (let i = 0; i < articles.length; i += chunkSize) {
    const chunk = articles.slice(i, i + chunkSize).map((art, idx) => ({
      id: crypto.randomUUID(),
      user_id: targetUserId,
      title: art.title,
      description: art.paragraphs.join("\n\n"),
      type: "knowledge_transcription",
      metadata: {
        document_type: "knowledge_magazine_transcription",
        is_magazine_transcription: true,
        is_magazine_article: "true",
        issue_slug: issueSlug,
        main_category: art.mainCategory,
        category: art.subcategory || art.mainCategory,
        subcategory: art.subcategory,
        paragraphs: art.paragraphs,
        start_page: art.startPage,
        order_index: i + idx + 1,
        transcription_verbatim: "true",
        parser_version: "toc_page_sliced_v7"
      }
    }));

    const { data: batchData, error: insErr } = await supabase
      .from("documents")
      .insert(chunk)
      .select("id, title, metadata");

    if (insErr) {
      console.error(`[News Transcribe v7] Error inserting chunk ${i}:`, insErr);
    } else if (batchData) {
      insertedArticles.push(...batchData);
    }
  }

  console.log(`[News Transcribe v7] Successfully inserted ${insertedArticles.length} clean articles with start_page into Supabase!`);

  // 8. Build Canonical Chunks with v7 sentence shielding
  const canonicalChunks: any[] = [];
  let globalSentenceIdx = 0;

  for (const art of insertedArticles) {
    const cleanTitle = cleanSummaryForSpeech(art.title);
    if (cleanTitle) {
      canonicalChunks.push({
        sentenceIdx: globalSentenceIdx++,
        text: cleanTitle,
        elementId: `title-${art.id}`,
        articleId: art.id,
        pIdx: -1,
        sIdx: 0,
        page: Number(art.metadata?.start_page || 1)
      });
    }

    const paragraphs: string[] = art.metadata?.paragraphs || [];
    for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
      const pText = cleanSummaryForSpeech(paragraphs[pIdx]);
      const sentences = splitParagraphIntoSentences(pText);
      for (let sIdx = 0; sIdx < sentences.length; sIdx++) {
        const sText = sentences[sIdx];
        canonicalChunks.push({
          sentenceIdx: globalSentenceIdx++,
          text: sText,
          elementId: `p-${art.id}-${pIdx}-${sIdx}`,
          articleId: art.id,
          pIdx,
          sIdx,
          page: Number(art.metadata?.start_page || 1)
        });
      }
    }
  }

  console.log(`[News Transcribe v7] Prepared ${canonicalChunks.length} canonical sentence chunks for Aoede audio synthesis.`);

  // 9. Group into blocks of ~1000 characters
  const blocks: any[][] = [];
  let currentBlock: any[] = [];
  let currentBlockLength = 0;

  for (const chunk of canonicalChunks) {
    if (currentBlockLength + chunk.text.length > 1000 && currentBlock.length > 0) {
      blocks.push(currentBlock);
      currentBlock = [];
      currentBlockLength = 0;
    }
    currentBlock.push(chunk);
    currentBlockLength += chunk.text.length + 1;
  }
  if (currentBlock.length > 0) {
    blocks.push(currentBlock);
  }

  console.log(`[News Transcribe v7] Synthesizing ${blocks.length} audio blocks with voice Aoede...`);

  // 10. Synthesize audio blocks with concurrency limit of 6
  const blockPcmBuffers: Buffer[] = new Array(blocks.length);
  const BATCH_SIZE = 6;

  for (let i = 0; i < blocks.length; i += BATCH_SIZE) {
    const batchIndices = Array.from(
      { length: Math.min(BATCH_SIZE, blocks.length - i) },
      (_, k) => i + k
    );

    await Promise.all(
      batchIndices.map(async (bIdx) => {
        const blockText = blocks[bIdx].map(c => c.text).join(" ");
        const pcm = await synthesizeChunk(blockText, geminiApiKey, "Aoede");
        blockPcmBuffers[bIdx] = pcm;
      })
    );
  }

  const fullPcmBuffer = Buffer.concat(blockPcmBuffers.filter(Boolean));
  const totalSamples = fullPcmBuffer.length / 2;
  const totalAudioDurationSec = totalSamples / 24000;
  console.log(`[News Transcribe v7] Full PCM assembled: ${(fullPcmBuffer.length / (1024 * 1024)).toFixed(2)} MB (${totalAudioDurationSec.toFixed(1)}s)`);

  // 11. Encode to MP3 at strict 18kbps
  console.log(`[News Transcribe v7] Encoding MP3 at strict 18kbps (optimized for Supabase Storage)...`);
  const mp3Buffer = encodePcmToMp3(fullPcmBuffer, 24000, 18);
  console.log(`[News Transcribe v7] MP3 compressed size: ${(mp3Buffer.length / (1024 * 1024)).toFixed(2)} MB`);

  // 12. Upload MP3 to Supabase Storage
  const storageFileName = `magazines/full_issue_${mainDoc.id}_v4_aoede.mp3`;
  console.log(`[News Transcribe v7] Uploading MP3 to Supabase Storage: ${storageFileName}...`);

  const { error: uploadErr } = await supabase.storage
    .from("documents")
    .upload(storageFileName, mp3Buffer, {
      contentType: "audio/mpeg",
      upsert: true
    });

  if (uploadErr) {
    throw new Error(`Failed to upload MP3 to Supabase Storage: ${uploadErr.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from("documents")
    .getPublicUrl(storageFileName);

  const publicAudioUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

  // 13. Calculate exact proportional sentence timestamps
  let currentBlockStartSample = 0;
  const sentenceTimestamps = blocks.flatMap((blockChunks, bIdx) => {
    const blockPcm = blockPcmBuffers[bIdx];
    const blockSamples = blockPcm ? blockPcm.length / 2 : 0;
    const blockDuration = blockSamples / 24000;
    const blockStartSec = currentBlockStartSample / 24000;
    currentBlockStartSample += blockSamples;

    const totalChars = blockChunks.reduce((acc, c) => acc + c.text.length, 0);
    let chunkOffsetSec = 0;

    return blockChunks.map((chunk) => {
      const proportion = totalChars > 0 ? chunk.text.length / totalChars : 1 / blockChunks.length;
      const chunkDur = blockDuration * proportion;
      const startTime = blockStartSec + chunkOffsetSec;
      const endTime = startTime + chunkDur;
      chunkOffsetSec += chunkDur;

      return {
        sentenceIdx: chunk.sentenceIdx,
        text: chunk.text,
        elementId: chunk.elementId,
        articleId: chunk.articleId,
        page: chunk.page,
        startTime: parseFloat(startTime.toFixed(3)),
        endTime: parseFloat(endTime.toFixed(3))
      };
    });
  });

  // 14. Update parent issue document in Supabase
  console.log(`[News Transcribe v7] Updating master issue document ${mainDoc.id} with audio and timestamps...`);
  const updatedMetadata = {
    ...(mainDoc.metadata || {}),
    audio_url: publicAudioUrl,
    audio_status: "ready",
    voice: "Aoede",
    audio_duration: Math.round(totalAudioDurationSec),
    sentence_timestamps: sentenceTimestamps,
    audios: {
      en: {
        url: publicAudioUrl,
        voice: "Aoede",
        duration: Math.round(totalAudioDurationSec),
        sentence_timestamps: sentenceTimestamps
      }
    }
  };

  await supabase
    .from("documents")
    .update({ metadata: updatedMetadata })
    .eq("id", mainDoc.id);

  // 15. Telegram Alert
  if (!mainDoc.metadata?.telegram_notified) {
    try {
      const coverUrl = mainDoc.metadata?.cover_url || `https://lhtlrztsmkllcqiziftn.supabase.co/storage/v1/object/public/documents/covers/${issueSlug}.jpg`;
      const tgResult = await sendMagazineNotification({
        title: mainDoc.title,
        channelName: "Trends Journal",
        publishedAt: mainDoc.metadata?.published_at || mainDoc.created_at,
        documentId: mainDoc.id,
        issueSlug: issueSlug,
        coverUrl: coverUrl
      });

      if (tgResult.success) {
        await supabase
          .from("documents")
          .update({
            metadata: {
              ...updatedMetadata,
              telegram_notified: true
            }
          })
          .eq("id", mainDoc.id);
      }
    } catch (tgErr: any) {
      console.warn(`[News Transcribe v7] Warning: Telegram notification failed for ${issueSlug}:`, tgErr.message);
    }
  }

  return {
    success: true,
    articleCount: insertedArticles.length,
    audioUrl: publicAudioUrl,
    totalDuration: totalAudioDurationSec,
    totalSentences: sentenceTimestamps.length,
    message: "Magazine transcription, start_page mapping, and 18kbps audio successfully processed and saved."
  };
}

export async function POST(req: Request) {
  try {
    const { issueSlug, force } = await req.json();

    if (!issueSlug) {
      return NextResponse.json({ success: false, error: "Missing issueSlug parameter" }, { status: 400 });
    }

    const result = await processMagazineTranscribeAndSynthesis(issueSlug, !!force);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[News Transcribe API Error]:", error);
    return NextResponse.json({
      success: false,
      error: error?.message || "Ocurrió un error al procesar la transcripción del magazine."
    }, { status: 500 });
  }
}
