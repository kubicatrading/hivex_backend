import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { encodePcmToMp3, addWavHeader } from "@/lib/audio/mp3Encoder";

export const maxDuration = 120; // Allow up to 120 seconds for full magazine audio synthesis

interface GenerateAudioRequestBody {
  documentId: string;
  voice?: string;
  language?: string;
  sentences?: string[];
  forceRegenerate?: boolean;
}

interface SentenceTimestamp {
  sentenceIdx: number;
  text: string;
  startTime: number;
  endTime: number;
}

import { cleanSummaryForSpeech as cleanTextForSpeech, splitParagraphIntoSentences as splitTextIntoSentences } from "@/lib/magazineSentences";

/**
 * Combines sentences into optimal ~1200-character chunks to minimize Gemini TTS API overhead.
 */
function groupTextIntoOptimalChunks(rawTexts: string[], maxChunkLen = 1200): string[] {
  const result: string[] = [];
  let currentChunk = "";

  rawTexts.forEach((text) => {
    const cleaned = cleanTextForSpeech(text).replace(/^[\s\-\|├─└]+/, "").trim();
    if (
      !cleaned ||
      cleaned === "---" ||
      cleaned.startsWith("├──") ||
      cleaned.startsWith("└──") ||
      cleaned.startsWith("Impacto en") ||
      cleaned.startsWith("Métricas de")
    ) {
      return;
    }

    if ((currentChunk + " " + cleaned).length > maxChunkLen) {
      if (currentChunk.trim().length > 0) {
        result.push(currentChunk.trim());
      }
      if (cleaned.length > maxChunkLen) {
        const sentences = splitTextIntoSentences(cleaned);
        sentences.forEach((s) => {
          if ((currentChunk + " " + s).length > maxChunkLen) {
            if (currentChunk.trim().length > 0) result.push(currentChunk.trim());
            currentChunk = s;
          } else {
            currentChunk += (currentChunk ? " " : "") + s;
          }
        });
      } else {
        currentChunk = cleaned;
      }
    } else {
      currentChunk += (currentChunk ? " " : "") + cleaned;
    }
  });

  if (currentChunk.trim().length > 0) {
    result.push(currentChunk.trim());
  }

  return result;
}

/**
  * Groups individual sentences into audio synthesis blocks of ~1000 characters max.
  */
function groupSentencesIntoBlocks(sentences: string[], maxCharsPerBlock = 1000): string[][] {
  const blocks: string[][] = [];
  let currentBlock: string[] = [];
  let currentLen = 0;

  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    if (currentLen > 0 && currentLen + s.length > maxCharsPerBlock) {
      blocks.push(currentBlock);
      currentBlock = [s];
      currentLen = s.length;
    } else {
      currentBlock.push(s);
      currentLen += s.length;
    }
  }
  if (currentBlock.length > 0) {
    blocks.push(currentBlock);
  }
  return blocks;
}

/**
 * Calls Gemini TTS API to synthesize speech for a given text fragment.
 */
async function synthesizeChunk(text: string, voice: string, apiKey: string): Promise<Buffer> {
  const models = [
    "gemini-3.1-flash-tts-preview",
    "gemini-2.5-flash-preview-tts",
    "gemini-2.5-pro-preview-tts"
  ];
  const safeText = text.substring(0, 1500);

  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const payload = {
          contents: [{ parts: [{ text: safeText }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voice }
              }
            }
          }
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 seconds timeout

        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const base64Data = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          if (base64Data) {
            const buf = Buffer.from(base64Data, "base64");
            if (buf.length > 1000) {
              return buf;
            }
          }
        } else {
          const errText = await res.text();
          console.warn(`[Generate Audio API] Model ${model} status ${res.status}: ${errText.substring(0, 200)}`);
          if (res.status === 429 || res.status === 503) {
            await new Promise((r) => setTimeout(r, (attempt + 1) * 2000));
          }
        }
      } catch (err: any) {
        console.warn(`[Generate Audio API] Model ${model} attempt ${attempt + 1} failed for chunk:`, err?.message || err);
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 1500));
        }
      }
    }
  }

  console.error(`[Generate Audio API] All attempts failed to synthesize chunk: "${text.substring(0, 40)}...". Returning silent fallback based on text duration.`);
  // Estimate ~14 characters per second of Spanish speech (48,000 PCM bytes per sec)
  const estimatedSec = Math.max(2, Math.round(safeText.length / 14));
  return Buffer.alloc(estimatedSec * 48000);
}

// Module-level set to prevent duplicate concurrent generation tasks for the same document
const activeJobs = new Set<string>();

export async function POST(request: Request) {
  const encoder = new TextEncoder();

  const customStream = new ReadableStream({
    async start(controller) {
      let isStreamClosed = false;
      const sendEvent = (data: any) => {
        if (isStreamClosed) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
        } catch (_) {
          isStreamClosed = true;
        }
      };

      const closeStream = () => {
        if (!isStreamClosed) {
          isStreamClosed = true;
          try {
            controller.close();
          } catch (_) {}
        }
      };

      let documentId = "";
      let jobKey = "";
      let supabaseClient: any = null;

      try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          sendEvent({ type: "error", success: false, error: "Falta la variable GEMINI_API_KEY en el servidor." });
          closeStream();
          return;
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
          sendEvent({ type: "error", success: false, error: "Faltan credenciales de Supabase en el servidor." });
          closeStream();
          return;
        }

        const body: GenerateAudioRequestBody = await request.json();
        const { documentId: reqDocId, voice = "Aoede", language = "en", forceRegenerate = false } = body;
        documentId = reqDocId;

        if (!documentId) {
          sendEvent({ type: "error", success: false, error: "El parámetro obligatorio 'documentId' no fue suministrado." });
          closeStream();
          return;
        }

        jobKey = `${documentId}_${voice}_${language}`;
        if (activeJobs.has(jobKey) && !forceRegenerate) {
          console.log(`[Generate Audio API] Job ${jobKey} is already active in background.`);
          sendEvent({ type: "progress", percent: 50, message: "Generación ya en curso en segundo plano..." });
          closeStream();
          return;
        }
        activeJobs.add(jobKey);

        supabaseClient = createClient(supabaseUrl, supabaseKey);
        const supabase = supabaseClient;

        // 1. Fetch document metadata
        const { data: doc, error: fetchErr } = await supabase
          .from("documents")
          .select("*")
          .eq("id", documentId)
          .single();

        if (fetchErr || !doc) {
          sendEvent({ type: "error", success: false, error: `Documento no encontrado (ID: ${documentId})` });
          closeStream();
          return;
        }

        const issueSlug = doc.metadata?.slug || doc.metadata?.issue_slug || "";

        // Look up protected HIVEX Knowledge Asset (knowledge_magazine_audio)
        const { data: knowledgeAudioDoc } = await supabase
          .from("documents")
          .select("*")
          .eq("type", "knowledge_analysis")
          .eq("metadata->>asset_subtype", "knowledge_magazine_audio")
          .or(`metadata->>issue_id.eq.${documentId},metadata->>issue_slug.eq.${issueSlug}`)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const existingMetadata = doc.metadata || {};
        const kAudioMeta = knowledgeAudioDoc?.metadata || {};

        const audioKey = `${voice}_${language}`;
        const cachedAudio = existingMetadata.audios?.[audioKey] || kAudioMeta.audios?.[audioKey];
        const hasValidCachedAudio = cachedAudio && cachedAudio.audio_url;
        const hasValidRootAudio = (existingMetadata.audio_url || kAudioMeta.audio_url) && (existingMetadata.audio_language === language || kAudioMeta.audio_language === language);
        const hasProtectedAsset = !!knowledgeAudioDoc;

        // Check if audio for this voice + language combination already exists or is protected
        if (!forceRegenerate && (hasValidCachedAudio || hasValidRootAudio || hasProtectedAsset)) {
          const targetAudioUrl = cachedAudio?.audio_url || existingMetadata.audio_url || kAudioMeta.audio_url;
          const targetTimestamps = cachedAudio?.sentence_timestamps || existingMetadata.sentence_timestamps || kAudioMeta.sentence_timestamps || [];

          // Self-heal DB metadata if status was stuck as processing
          if (existingMetadata.audio_status !== "ready" || existingMetadata.audio_progress_percent !== 100) {
            const updatedAudios = {
              ...(existingMetadata.audios || {}),
              [`${voice}_${language}`]: {
                audio_url: targetAudioUrl,
                sentence_timestamps: targetTimestamps,
                status: "ready"
              }
            };

            await supabase.from("documents").update({
              metadata: {
                ...existingMetadata,
                audio_url: targetAudioUrl,
                audio_status: "ready",
                audio_progress_percent: 100,
                audio_voice: voice,
                audio_language: language,
                sentence_timestamps: targetTimestamps,
                audios: updatedAudios
              }
            }).eq("id", documentId);
          }

          sendEvent({
            type: "complete",
            success: true,
            audioUrl: targetAudioUrl,
            timestamps: targetTimestamps,
            status: "ready",
            fromCache: true,
            percent: 100
          });
          closeStream();
          return;
        }

        // If forced regeneration, delete old knowledge_magazine_audio asset
        if (forceRegenerate && issueSlug) {
          console.log(`[Generate Audio API] Force regenerate requested for ${issueSlug}. Deleting old knowledge_magazine_audio assets...`);
          await supabase
            .from("documents")
            .delete()
            .eq("type", "knowledge_analysis")
            .eq("metadata->>asset_subtype", "knowledge_magazine_audio")
            .or(`metadata->>issue_id.eq.${documentId},metadata->>issue_slug.eq.${issueSlug}`);
        }

        // Ensure active job state
        const initialStartPercent = Math.max(10, existingMetadata.audio_progress_percent || 10);
        sendEvent({ type: "progress", percent: initialStartPercent, message: "Iniciando procesamiento de la revista..." });

        // Mark document status as processing in DB with audio_started_at timestamp
        await supabase.from("documents").update({
          metadata: {
            ...existingMetadata,
            audio_status: "processing",
            audio_progress_percent: initialStartPercent,
            audio_voice: voice,
            audio_language: language,
            audio_started_at: Date.now()
          }
        }).eq("id", documentId);

        // 2. Extract text sentences for audio synthesis
        let sentencesToSynthesize: string[] = [];

        // First choice: If client provided exact DOM sentences, use them directly for 100% parity
        if (Array.isArray(body.sentences) && body.sentences.length > 0) {
          sentencesToSynthesize = body.sentences.filter((s) => typeof s === "string" && s.trim().length > 0);
        }

        // Fallback 1: Extract sentence-by-sentence from individual transcribed articles in DB
        if (sentencesToSynthesize.length === 0) {
          const issueSlug = existingMetadata.slug || existingMetadata.issue_slug || "";
          const { data: dbArticles } = await supabase
            .from("documents")
            .select("*")
            .in("type", ["knowledge_transcription", "knowledge_article_transcription", "knowledge_article_analysis", "knowledge_analysis"])
            .eq("metadata->>is_magazine_article", "true")
            .eq("metadata->>issue_slug", issueSlug);

          if (dbArticles && dbArticles.length > 0) {
            const sortedArticles = [...dbArticles].sort((a, b) => {
              const orderA = Number(a.metadata?.order_index ?? 9999);
              const orderB = Number(b.metadata?.order_index ?? 9999);
              if (orderA !== orderB) return orderA - orderB;
              const catA = a.metadata?.category || "";
              const catB = b.metadata?.category || "";
              return catA.localeCompare(catB);
            });

            sortedArticles.forEach((art: any) => {
              let title = art.title || "";
              let subcategory = art.metadata?.subcategory || art.metadata?.category || "ARTÍCULO";
              let paragraphs: string[] = art.metadata?.paragraphs || (art.description ? [art.description] : []);

              if (language !== "en" && art.metadata?.translations?.[language]) {
                const trans = art.metadata.translations[language];
                if (trans.title) title = trans.title;
                if (trans.subcategory || trans.category) subcategory = trans.subcategory || trans.category;
                if (trans.paragraphs && Array.isArray(trans.paragraphs)) paragraphs = trans.paragraphs;
              }

              const titleText = `${subcategory}: ${title}.`;
              const cleanedTitle = cleanTextForSpeech(titleText);
              if (cleanedTitle.length > 0) sentencesToSynthesize.push(cleanedTitle);

              if (paragraphs && Array.isArray(paragraphs)) {
                paragraphs.forEach((p: string) => {
                  const sentences = splitTextIntoSentences(p);
                  if (sentences.length > 0) {
                    sentences.forEach((s) => {
                      const speechSentence = cleanTextForSpeech(s);
                      if (speechSentence.length > 0) sentencesToSynthesize.push(speechSentence);
                    });
                  } else {
                    const cleanP = cleanTextForSpeech(p);
                    if (cleanP.length > 0) sentencesToSynthesize.push(cleanP);
                  }
                });
              }
            });
          }
        }

        // Fallback 2: Extract sentence-by-sentence from metadata.articles
        if (sentencesToSynthesize.length === 0) {
          const articles = existingMetadata.articles || [];
          if (articles.length > 0) {
            articles.forEach((art: any) => {
              let title = art.title || "";
              let subcategory = art.subcategory || "TITULAR";
              let paragraphs: string[] = art.paragraphs || [];

              if (language !== "en" && art.translations?.[language]) {
                const trans = art.translations[language];
                if (trans.title) title = trans.title;
                if (trans.subcategory) subcategory = trans.subcategory;
                if (trans.paragraphs) paragraphs = trans.paragraphs;
              }

              const titleText = `${subcategory}: ${title}.`;
              const cleanedTitle = cleanTextForSpeech(titleText);
              if (cleanedTitle.length > 0) sentencesToSynthesize.push(cleanedTitle);

              if (paragraphs && Array.isArray(paragraphs)) {
                paragraphs.forEach((p: string) => {
                  const sentences = splitTextIntoSentences(p);
                  if (sentences.length > 0) {
                    sentences.forEach((s) => {
                      const speechSentence = cleanTextForSpeech(s);
                      if (speechSentence.length > 0) sentencesToSynthesize.push(speechSentence);
                    });
                  } else {
                    const cleanP = cleanTextForSpeech(p);
                    if (cleanP.length > 0) sentencesToSynthesize.push(cleanP);
                  }
                });
              }
            });
          } else {
            // Fallback 3: Executive summary sentences
            const fallbackText = existingMetadata.summary || doc.description || "";
            const sentences = splitTextIntoSentences(fallbackText);
            sentences.forEach((s) => {
              const cleaned = cleanTextForSpeech(s);
              if (cleaned.length > 0) sentencesToSynthesize.push(cleaned);
            });
          }
        }

        if (sentencesToSynthesize.length === 0) {
          sendEvent({ type: "error", success: false, error: "El documento no contiene texto sintetizable." });
          closeStream();
          return;
        }

        // Group sentences into synthesis blocks of ~1000 characters
        const blocks = groupSentencesIntoBlocks(sentencesToSynthesize, 1000);

        sendEvent({
          type: "progress",
          percent: 10,
          completed: 0,
          total: blocks.length,
          message: `Sintetizando ${sentencesToSynthesize.length} frases en ${blocks.length} bloques de audio...`
        });

        // Persist initial progress in DB monotonically
        const { data: initDoc } = await supabase.from("documents").select("metadata").eq("id", documentId).single();
        const initMeta = initDoc?.metadata || existingMetadata;
        const startPercent = Math.max(10, initMeta.audio_progress_percent || 10);

        await supabase.from("documents").update({
          metadata: {
            ...initMeta,
            audio_status: "processing",
            audio_progress_percent: startPercent,
            audio_voice: voice,
            audio_language: language
          }
        }).eq("id", documentId);

        // 3. Synthesize blocks in parallel batches (BATCH_SIZE=2) using Supabase Storage chunk caching
        const BATCH_SIZE = 2;
        const blockPcmBuffers: Buffer[] = new Array(blocks.length);

        // Fetch pre-existing chunks from Supabase Storage
        const { data: storageChunks } = await supabase.storage.from("documents").list(`magazines/chunks/${documentId}`, { limit: 500 });
        const existingChunkSet = new Set((storageChunks || []).map((f: any) => f.name));
        let completedBlocks = existingChunkSet.size;

        for (let i = 0; i < blocks.length; i += BATCH_SIZE) {
          const batchIndices = Array.from(
            { length: Math.min(BATCH_SIZE, blocks.length - i) },
            (_, k) => i + k
          );

          console.log(`[Generate Audio API] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(blocks.length / BATCH_SIZE)} (indices ${batchIndices.join(",")})...`);
          await Promise.all(
            batchIndices.map(async (idx) => {
              const chunkName = `block_${idx}.bin`;
              const storagePath = `magazines/chunks/${documentId}/${chunkName}`;

              if (existingChunkSet.has(chunkName)) {
                try {
                  const { data: blob, error: dlErr } = await supabase.storage.from("documents").download(storagePath);
                  if (!dlErr && blob) {
                    blockPcmBuffers[idx] = Buffer.from(await blob.arrayBuffer());
                    return;
                  }
                } catch (e) {}
              }

              const blockText = blocks[idx].join(" ");
              const pcm = await synthesizeChunk(blockText, voice, apiKey);
              if (pcm && pcm.length > 500) {
                blockPcmBuffers[idx] = pcm;
                existingChunkSet.add(chunkName);
                completedBlocks++;

                // Asynchronously save chunk to Supabase Storage
                supabase.storage.from("documents").upload(storagePath, pcm, {
                  contentType: "application/octet-stream",
                  upsert: true
                }).catch((e: any) => console.warn(`Notice on chunk upload block ${idx}:`, e));
              }
            })
          );

          const currentPercent = Math.min(95, Math.round((completedBlocks / blocks.length) * 100));
          
          let newPercent = currentPercent;
          try {
            const { data: latestDoc } = await supabase.from("documents").select("metadata").eq("id", documentId).single();
            const latestMeta = latestDoc?.metadata || existingMetadata;

            await supabase.from("documents").update({
              metadata: {
                ...latestMeta,
                audio_status: "processing",
                audio_progress_percent: currentPercent,
                audio_voice: voice,
                audio_language: language
              }
            }).eq("id", documentId);
          } catch (dbErr) {
            console.warn("[Generate Audio API] Non-fatal error updating progress DB:", dbErr);
          }

          console.log(`[Generate Audio API] Completed ${completedBlocks}/${blocks.length} blocks (${currentPercent}%)...`);
          
          sendEvent({
            type: "progress",
            percent: currentPercent,
            completed: completedBlocks,
            total: blocks.length
          });

          // Small delay between batches to respect rate limits
          if (i + BATCH_SIZE < blocks.length) {
            await new Promise((r) => setTimeout(r, 150));
          }
        }

        sendEvent({ type: "progress", percent: 92, message: "Ensamblando archivo WAV final..." });

        // 4. Build exact sentence timestamps by distributing block PCM duration proportionally across sentences
        const timestamps: SentenceTimestamp[] = [];
        let globalSentenceIdx = 0;
        let cumulativeTimeOffset = 0.0;
        const allPcmBuffers: Buffer[] = [];

        for (let bIdx = 0; bIdx < blocks.length; bIdx++) {
          const blockSentences = blocks[bIdx];
          const pcm = blockPcmBuffers[bIdx];
          allPcmBuffers.push(pcm);

          // 24kHz 16-bit mono PCM = 48,000 bytes per second
          const blockDurationSec = pcm.length / 48000.0;
          const totalBlockChars = blockSentences.reduce((acc, s) => acc + s.length, 0);

          let currentBlockTime = cumulativeTimeOffset;

          blockSentences.forEach((s) => {
            const prop = totalBlockChars > 0 ? s.length / totalBlockChars : 1 / blockSentences.length;
            const sDuration = blockDurationSec * prop;
            const startTime = Number(currentBlockTime.toFixed(2));
            const endTime = Number((currentBlockTime + sDuration).toFixed(2));

            timestamps.push({
              sentenceIdx: globalSentenceIdx,
              text: s,
              startTime,
              endTime
            });

            globalSentenceIdx++;
            currentBlockTime += sDuration;
          });

          cumulativeTimeOffset += blockDurationSec;
        }

        // Concatenate PCM buffers into a single linear PCM stream
        const fullPcmBuffer = Buffer.concat(allPcmBuffers);

        // Compress 24kHz 16-bit Mono PCM into 24kbps MP3 (~5.3 MB for 2.5 hours speech narration)
        const mp3AudioBuffer = encodePcmToMp3(fullPcmBuffer, 24000, 24);

        sendEvent({ type: "progress", percent: 96, message: "Guardando audio MP3 comprimido en Supabase Storage..." });

        // Upload compressed MP3 audio file to Supabase Storage
        const storagePath = `magazines/${documentId}_${voice}_${language}.mp3`;
        const { error: uploadErr } = await supabase.storage
          .from("documents")
          .upload(storagePath, mp3AudioBuffer, {
            contentType: "audio/mpeg",
            upsert: true
          });

        if (uploadErr) {
          console.error("[Generate Audio API] Storage upload failed:", uploadErr);
          throw new Error(`Error al guardar audio en Supabase Storage: ${uploadErr.message}`);
        }

        // Get public URL for uploaded audio
        const { data: publicUrlData } = supabase.storage
          .from("documents")
          .getPublicUrl(storagePath);

        const publicAudioUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

        // Fetch fresh metadata to avoid overwriting parallel fields
        const { data: freshDoc } = await supabase.from("documents").select("metadata").eq("id", documentId).single();
        const currentMeta = freshDoc?.metadata || existingMetadata;

        // Persist audio_url, sentence_timestamps, and ready status in DB metadata
        const updatedAudios = {
          ...(currentMeta.audios || {}),
          [`${voice}_${language}`]: {
            audio_url: publicAudioUrl,
            sentence_timestamps: timestamps,
            status: "ready"
          }
        };

        const finalMetadata = {
          ...currentMeta,
          audio_url: publicAudioUrl,
          audio_status: "ready",
          audio_progress_percent: 100,
          audio_voice: voice,
          audio_language: language,
          sentence_timestamps: timestamps,
          audios: updatedAudios
        };

        await supabase
          .from("documents")
          .update({ metadata: finalMetadata })
          .eq("id", documentId);

        // Auto-persist/upsert protected HIVEX Knowledge Asset for audio & sentence timestamps
        try {
          const kAudioDocId = crypto.randomUUID();
          await supabase.from("documents").upsert({
            id: kAudioDocId,
            user_id: doc.user_id || "00000000-0000-0000-0000-000000000000",
            title: `Audio & Sentence Timestamps - Trends Journal (${issueSlug}) - ${voice} v4`,
            description: `Documento blindado oficial de la base de conocimiento HIVEX (knowledge_magazine_audio) conteniendo el audio completo sintetizado y sincronizado con el parseador v4.`,
            type: "knowledge_analysis",
            metadata: {
              asset_subtype: "knowledge_magazine_audio",
              is_hivex_knowledge_asset: true,
              is_protected: true,
              immutable: true,
              issue_id: documentId,
              issue_slug: issueSlug,
              audio_url: publicAudioUrl,
              audio_voice: voice,
              audio_language: language,
              audio_status: "ready",
              total_sentences: timestamps.length,
              parser_version: "toc_page_sliced_v4",
              sentence_timestamps: timestamps,
              protected_at: new Date().toISOString()
            }
          });
        } catch (kErr) {
          console.error("[Generate Audio API] Warning: Failed to upsert protected knowledge_magazine_audio asset:", kErr);
        }

        sendEvent({
          type: "complete",
          success: true,
          audioUrl: publicAudioUrl,
          timestamps,
          status: "ready",
          percent: 100
        });

        closeStream();
      } catch (error: any) {
        console.error("[Generate Audio API Error]:", error);

        try {
          if (supabaseClient && documentId) {
            const { data: errDoc } = await supabaseClient.from("documents").select("metadata").eq("id", documentId).single();
            const errMeta = errDoc?.metadata || {};
            await supabaseClient.from("documents").update({
              metadata: {
                ...errMeta,
                audio_status: "error",
                audio_error: error?.message || "Error al generar audio"
              }
            }).eq("id", documentId);
          }
        } catch (_) {}

        sendEvent({
          type: "error",
          success: false,
          error: error?.message || "Error al generar el audio de la revista."
        });
        closeStream();
      } finally {
        if (jobKey) {
          activeJobs.delete(jobKey);
        }
      }
    }
  });

  return new Response(customStream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache, no-transform"
    }
  });
}
