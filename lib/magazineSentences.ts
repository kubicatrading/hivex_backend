/**
 * Shared sentence extraction and cleaning logic for Magazine Issues.
 * Used by both UI (app/dashboard/news/page.tsx) and Audio Generation Backend (app/api/magazines/generate-audio/route.ts)
 * to ensure 100% exact alignment between interactive UI sentence elements and TTS audio timestamps.
 */

export function cleanSummaryForSpeech(text: string): string {
  if (!text) return "";
  text = text.replace(/<[^>]*>/g, "");
  text = text.replace(/[*_~#`]/g, "");
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  text = text.replace(/https?:\/\/\S+/g, "");
  text = text.replace(/--+/g, " ");
  text = text.replace(/^\s*[-+*]\s+/gm, "");
  text = text.replace(/^\s*\d+\.\s+/gm, "");
  text = text.replace(/^\s*>\s*/gm, "");
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

export function splitParagraphIntoSentences(text: string): string[] {
  if (!text) return [];

  let protectedText = text;

  // 1. Protect ellipses (...) and Unicode ellipsis (…)
  protectedText = protectedText.replace(/…/g, " _ELLIP_ ");
  protectedText = protectedText.replace(/\.{2,}/g, " _ELLIP_ ");

  // 2. Protect numbers with decimals, including thousands separators (e.g. 2.0, 1.5, 3.14, $1.5, 1,500.50, 10.5%)
  protectedText = protectedText.replace(/\b(\d[\d,]*)\.(\d+)\b/g, "$1_DEC_DOT_$2");

  // 3. Protect Quarter designations like Q.1, Q.2, Q.3, Q.4
  protectedText = protectedText.replace(/\b([A-Za-z])\.(\d+)\b/g, "$1_ACR_DOT_$2");

  // 4. Protect known common acronyms that contain dots (U.S., U.K., E.U., U.N., U.S.A., EE.UU., etc.)
  const acronyms = ["U.S.", "U.K.", "E.U.", "U.N.", "U.S.A.", "EE.UU.", "a.m.", "p.m.", "e.g.", "i.e.", "vs.", "etc.", "approx.", "dept.", "est.", "ph.d."];
  acronyms.forEach((acr) => {
    const escaped = acr.replace(/\./g, "\\.");
    const replacement = acr.replace(/\./g, "_ACR_DOT_");
    const regex = new RegExp(`\\b${escaped}`, "gi");
    protectedText = protectedText.replace(regex, replacement);
  });

  // 5. Protect dotted letter sequences (e.g. A.I., F.B.I., C.I.A., N.Y.C.)
  protectedText = protectedText.replace(/\b([A-Za-zÁÉÍÓÚáéíóúñÑ])\.([A-Za-zÁÉÍÓÚáéíóúñÑ])\.(?=[A-Za-zÁÉÍÓÚáéíóúñÑ0-9\s])/gi, "$1_ACR_DOT_$2_ACR_DOT_");

  // 6. Protect known single-dot abbreviations / titles (English & Spanish)
  const abbrevs = [
    "mr", "mrs", "ms", "dr", "dra", "prof", "sr", "sra", "jr", "corp", "inc",
    "co", "ltd", "bros", "ca", "jan", "feb", "mar", "apr", "jun", "jul", "aug",
    "sep", "sept", "oct", "nov", "dec", "no", "nos", "st", "ave", "blvd", "vol",
    "vols", "ed", "eds", "pp", "pag", "pág", "cap", "num", "núm", "ing", "lic",
    "sen", "rep", "gov", "pres", "gen"
  ];
  abbrevs.forEach((abbrev) => {
    const regex = new RegExp(`\\b(${abbrev})\\.(?=\\s|$)`, "gi");
    protectedText = protectedText.replace(regex, "$1_ABB_DOT_");
  });

  // 7. Protect name initials (e.g., J. F. Kennedy)
  protectedText = protectedText.replace(/\b([A-ZÁÉÍÓÚ])\.(?=\s+[A-ZÁÉÍÓÚ])/g, "$1_INI_DOT_");

  // 8. Split on standard sentence-ending punctuation (. ? !) including attached closing quotes
  const sentences = protectedText.match(/[^.!?]+(?:[.!?]+["'’”»)]*|\s*$)/g) || [protectedText];

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

export interface MagazineSentenceChunk {
  sentenceIdx: number;
  text: string;
  elementId: string;
  articleId: string;
  pIdx?: number;
  sIdx?: number;
}

/**
 * Extracts the exact sequence of sentence chunks from sorted magazine articles.
 */
export function extractMagazineSentences(articles: any[]): MagazineSentenceChunk[] {
  const result: MagazineSentenceChunk[] = [];
  let globalIdx = 0;

  articles.forEach((art) => {
    const subcat = art.metadata?.subcategory || art.metadata?.category || "General";
    const titleText = subcat && subcat.trim().toUpperCase() !== (art.title || "").trim().toUpperCase()
      ? `${subcat}: ${art.title}.`
      : `${art.title}.`;

    result.push({
      sentenceIdx: globalIdx++,
      text: titleText,
      elementId: `article-title-${art.id}`,
      articleId: art.id
    });

    const paragraphs = art.metadata?.paragraphs || [art.description || ""];
    paragraphs.forEach((para: string, pIdx: number) => {
      const sentences = splitParagraphIntoSentences(para);
      if (sentences.length > 0) {
        sentences.forEach((s: string, sIdx: number) => {
          const cleanS = cleanSummaryForSpeech(s);
          if (cleanS.length > 0) {
            result.push({
              sentenceIdx: globalIdx++,
              text: cleanS,
              elementId: `sentence-${art.id}-${pIdx}-${sIdx}`,
              articleId: art.id,
              pIdx,
              sIdx
            });
          }
        });
      } else {
        const cleanP = cleanSummaryForSpeech(para);
        if (cleanP.length > 0) {
          result.push({
            sentenceIdx: globalIdx++,
            text: cleanP,
            elementId: `sentence-${art.id}-${pIdx}-0`,
            articleId: art.id,
            pIdx,
            sIdx: 0
          });
        }
      }
    });
  });

  return result;
}
