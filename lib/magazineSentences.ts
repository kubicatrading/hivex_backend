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

  // 1. Protect ellipses (...) and Unicode ellipsis (...)
  protectedText = protectedText.replace(/…/g, " _ELLIP_ ");
  protectedText = protectedText.replace(/\.{2,}/g, " _ELLIP_ ");

  // 2. Protect numbers with decimals (e.g. 2.0, 1.5, 3.14, $1.5, 10.5%)
  protectedText = protectedText.replace(/\b(\d+)\.(\d+)\b/g, "$1_DEC_DOT_$2");

  // 3. Protect acronyms / dotted abbreviations (e.g., U.S., U.S.A., EE.UU., a.m., p.m.)
  protectedText = protectedText.replace(/\b([A-Za-z]{1,4}(?:\.[A-Za-z]{1,4})+)\b\.?/gi, (match) => {
    return match.replace(/\./g, "_ACR_DOT_");
  });

  // 4. Protect known abbreviations (e.g., Mr., Fed., Corp., etc.)
  const abbrevs = [
    "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "vs", "fed", "corp", "inc",
    "co", "ltd", "bros", "ca", "jan", "feb", "mar", "apr", "jun", "jul", "aug",
    "sep", "oct", "nov", "dec", "etc", "no", "nos", "st", "ave", "blvd", "vol",
    "vols", "ed", "eds", "pp", "p.m", "a.m"
  ];
  abbrevs.forEach(abbrev => {
    const regex = new RegExp(`\\b(${abbrev})\\.(?=\\s|$)`, "gi");
    protectedText = protectedText.replace(regex, "$1_ABB_DOT_");
  });

  // 5. Protect name initials (e.g., J. F. Kennedy)
  protectedText = protectedText.replace(/\b([A-Z])\.(?=\s+[A-Z])/g, "$1_INI_DOT_");

  // Split on standard sentence-ending punctuation (. ? !)
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
    const subcat = art.metadata?.category || "General";
    const titleText = `${subcat}: ${art.title}.`;

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
