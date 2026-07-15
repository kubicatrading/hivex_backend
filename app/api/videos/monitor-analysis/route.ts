import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { transcribeVideoCore } from "../transcribe/route";
import { extractSnapshotsInBackground } from "@/lib/snapshotExtractor";
import { sendTelegramMessage, formatVideoNotification, getTelegramLanguage } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Extend Vercel execution duration to 60s to prevent timeouts during long transcripts


// Server-side helper to split transcription into verbatim, summary, charts, and report segments
function splitTranscription(text: string) {
  if (!text) return { transcription: "", summary: "", charts: "", report: "" };
  
  // Step 1: Attempt standard robust split using various markdown horizontal line syntaxes
  const regexSplit = /\n\s*(?:---|===|\*\*\*|___|- - -)[^\n]*\n/;
  const parts = text.split(regexSplit);
  
  let transcription = "";
  let summary = "";
  let charts = "";
  let report = "";
  
  if (parts.length >= 4) {
    transcription = parts[0] || "";
    summary = parts[1] || "";
    charts = parts[2] || "";
    report = parts.slice(3).join("\n---\n") || "";
  } else if (parts.length === 3) {
    transcription = parts[0] || "";
    summary = parts[1] || "";
    charts = "";
    report = parts[2] || "";
  } else {
    // Step 2: Heuristic Heading-based Fallback Slicing
    const lines = text.split("\n");
    let summaryIdx = -1;
    let chartsIdx = -1;
    let reportIdx = -1;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim().toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // strip accents
      
      if (trimmed.startsWith("#") || trimmed.startsWith("- #") || trimmed.startsWith("**")) {
        const headerText = trimmed.replace(/^[\s\-\*#]*/, "").replace(/^\*\*|\*\*$/g, "").trim();
        
        if (summaryIdx === -1) {
          if (headerText.includes("resumen") || headerText.includes("summary") || headerText.includes("zusammenfassung") || headerText.includes("ozet") || headerText.includes("part 2") || headerText.includes("parte 2") || headerText.includes("teil 2") || headerText.includes("bolum 2") || headerText.includes("kisim 2")) {
            summaryIdx = i;
          }
        } else if (chartsIdx === -1) {
          if (headerText.includes("grafico") || headerText.includes("grafik") || headerText.includes("chart") || headerText.includes("diagram") || headerText.includes("visualizac") || headerText.includes("visualis") || headerText.includes("gorsel") || headerText.includes("part 3") || headerText.includes("parte 3") || headerText.includes("teil 3") || headerText.includes("bolum 3") || headerText.includes("kisim 3")) {
            const isReport = headerText.includes("informe") || headerText.includes("report") || headerText.includes("bericht") || headerText.includes("rapor") || headerText.includes("analisis") || headerText.includes("analysis") || headerText.includes("analyse") || headerText.includes("analiz") || headerText.includes("invers") || headerText.includes("invest") || headerText.includes("yatirim");
            if (isReport && !headerText.includes("grafic") && !headerText.includes("grafik") && !headerText.includes("chart") && !headerText.includes("visualizac") && !headerText.includes("visualis") && !headerText.includes("gorsel")) {
              reportIdx = i;
            } else {
              chartsIdx = i;
            }
          }
        } else if (reportIdx === -1) {
          if (headerText.includes("informe") || headerText.includes("report") || headerText.includes("bericht") || headerText.includes("rapor") || headerText.includes("analisis") || headerText.includes("analysis") || headerText.includes("analyse") || headerText.includes("analiz") || headerText.includes("invers") || headerText.includes("invest") || headerText.includes("yatirim") || headerText.includes("part 4") || headerText.includes("parte 4") || headerText.includes("teil 4") || headerText.includes("bolum 4") || headerText.includes("kisim 4")) {
            reportIdx = i;
          }
        }
      }
    }

    if (summaryIdx !== -1 && chartsIdx !== -1 && reportIdx !== -1 && reportIdx > chartsIdx && chartsIdx > summaryIdx) {
      transcription = lines.slice(0, summaryIdx).join("\n");
      summary = lines.slice(summaryIdx, chartsIdx).join("\n");
      charts = lines.slice(chartsIdx, reportIdx).join("\n");
      report = lines.slice(reportIdx).join("\n");
    } else if (summaryIdx !== -1 && reportIdx !== -1 && reportIdx > summaryIdx) {
      transcription = lines.slice(0, summaryIdx).join("\n");
      summary = lines.slice(summaryIdx, reportIdx).join("\n");
      charts = "";
      report = lines.slice(reportIdx).join("\n");
    } else if (summaryIdx !== -1 && chartsIdx !== -1 && chartsIdx > summaryIdx) {
      transcription = lines.slice(0, summaryIdx).join("\n");
      summary = lines.slice(summaryIdx, chartsIdx).join("\n");
      charts = lines.slice(chartsIdx).join("\n");
      report = "";
    } else if (summaryIdx !== -1) {
      transcription = lines.slice(0, summaryIdx).join("\n");
      summary = lines.slice(summaryIdx).join("\n");
      charts = "";
      report = "";
    } else {
      transcription = parts[0] || "";
      summary = parts[1] || "";
      charts = parts[2] || "";
      report = parts.slice(3).join("\n---\n") || "";
      
      if (parts.length === 1) {
        transcription = text;
        summary = "";
        charts = "";
        report = "";
      } else if (parts.length === 2) {
        transcription = parts[0] || "";
        summary = parts[1] || "";
        charts = "";
        report = "";
      } else if (parts.length === 3) {
        transcription = parts[0] || "";
        summary = parts[1] || "";
        charts = "";
        report = parts[2] || "";
      }
    }
  }
  
  const cleanSummary = summary.replace(/^#*\s*(?:Resumen Detallado|Resumen Detallado del Contenido|Resumen|Detailed Summary|Zusammenfassung|Ozet|Part 2|Parte 2|Teil 2|Teil2|Bolum 2|Kisim 2)[^\n]*\n+/i, "").trim();
  const cleanCharts = charts.replace(/^#*\s*(?:Graficos y Visualizaciones Detectadas|Graficos y Visualizaciones|Graficos|Charts and Visualizations|Charts|Visualizaciones|Erkannte Grafiken und Visualisierungen|Erkannte Grafiken|Tespit Edilen Grafikler ve Gorsellestirmeler|Tespit Edilen Grafikler|Part 3|Parte 3|Teil 3|Teil3|Bolum 3|Kisim 3)[^\n]*\n+/i, "").trim();
  const cleanReport = report.replace(/^#*\s*(?:Informe de Inversión|Informe de Análisis|Informe|Investment Report|Investitionsbericht|Investitionsanalysebericht|Rapor|Yatirim Analiz Raporu|Analysis|Analyse|Analiz|Part 4|Parte 4|Teil 4|Teil4|Bolum 4|Kisim 4|Part 3|Parte 3)[^\n]*\n+/i, "").trim();
  
  return {
    transcription: transcription.trim(),
    summary: cleanSummary,
    charts: cleanCharts,
    report: cleanReport
  };
}

// Persist / update the four knowledge base documents under the system ADMIN user ID
async function saveVideoKnowledgeBaseServer(
  supabaseAdmin: any,
  videoDoc: { id: string; title: string; file_url?: string; metadata?: any },
  transcriptionText: string
) {
  const adminId = "5c8d65c6-0798-4f8a-aae3-dd2cebebd868";
  const splitResult = splitTranscription(transcriptionText);
  const channelTitle = videoDoc.metadata?.channel_title || "Andrei Jikh";
  const dateStr = new Date().toISOString();
  const fileUrl = videoDoc.file_url || "";

  // 1. Literal transcription
  const transcriptionDoc = {
    user_id: adminId,
    title: `[Transcripción] - ${videoDoc.title}`,
    description: `Transcripción completa literal de ${videoDoc.title}`,
    type: "knowledge_transcription",
    file_url: fileUrl,
    metadata: {
      fecha_transcripcion: dateStr,
      canal_origen: channelTitle,
      nombre_video: videoDoc.title,
      texto_transcripcion: splitResult.transcription
    }
  };

  // 2. Content summary
  const summaryDoc = {
    user_id: adminId,
    title: `[Resumen] - ${videoDoc.title}`,
    description: `Resumen de contenido completo de ${videoDoc.title}`,
    type: "knowledge_summary",
    file_url: fileUrl,
    metadata: {
      fecha_resumen: dateStr,
      canal_origen: channelTitle,
      nombre_video: videoDoc.title,
      resumen_markdown: splitResult.summary
    }
  };

  // 3. Charts and Visualizations
  const chartsDoc = {
    user_id: adminId,
    title: `[Gráficos] - ${videoDoc.title}`,
    description: `Gráficos y visualizaciones detectadas de ${videoDoc.title}`,
    type: "knowledge_charts",
    file_url: fileUrl,
    metadata: {
      fecha_graficos: dateStr,
      canal_origen: channelTitle,
      nombre_video: videoDoc.title,
      graficos_markdown: splitResult.charts
    }
  };

  // 4. Investment analysis report
  const analysisDoc = {
    user_id: adminId,
    title: `[Análisis] - ${videoDoc.title}`,
    description: `Informe de análisis financiero de ${videoDoc.title}`,
    type: "knowledge_analysis",
    file_url: fileUrl,
    metadata: {
      fecha_informe: dateStr,
      canal_origen: channelTitle,
      nombre_video: videoDoc.title,
      informe_completo: splitResult.report
    }
  };

  const docsToInsert = [
    { doc: transcriptionDoc, type: "knowledge_transcription" },
    { doc: summaryDoc, type: "knowledge_summary" },
    { doc: chartsDoc, type: "knowledge_charts" },
    { doc: analysisDoc, type: "knowledge_analysis" }
  ];

  let newlyAnalyzed = false;

  for (const item of docsToInsert) {
    const { data: existing, error: checkErr } = await supabaseAdmin
      .from("documents")
      .select("id")
      .eq("type", item.type)
      .eq("file_url", fileUrl);

    if (checkErr) {
      console.warn(`[Base de Conocimiento Monitor] Error al verificar existencia de ${item.type}:`, checkErr);
    }

    if (!existing || existing.length === 0) {
      const { error: insertErr } = await supabaseAdmin
        .from("documents")
        .insert(item.doc);
      if (insertErr) {
        console.warn(`[Base de Conocimiento Monitor] Error al insertar ${item.type} para ${videoDoc.title}:`, insertErr);
      } else {
        console.log(`[Base de Conocimiento Monitor] Persistido con éxito ${item.type} para: ${videoDoc.title}`);
        if (item.type === "knowledge_analysis") {
          newlyAnalyzed = true;
        }
      }
    } else {
      const { error: updateErr } = await supabaseAdmin
        .from("documents")
        .update(item.doc)
        .eq("id", existing[0].id);
      if (updateErr) {
        console.warn(`[Base de Conocimiento Monitor] Error al actualizar ${item.type} para ${videoDoc.title}:`, updateErr);
      } else {
        console.log(`[Base de Conocimiento Monitor] Actualizado con éxito ${item.type} para: ${videoDoc.title}`);
        if (item.type === "knowledge_analysis") {
          newlyAnalyzed = true;
        }
      }
    }
  }

  if (newlyAnalyzed) {
    // Extract youtubeId from fileUrl
    let ytId = "";
    const regexes = [
      /youtube\.com\/embed\/([a-zA-Z0-9_\-]{11})/,
      /youtube\.com\/watch\?v=([a-zA-Z0-9_\-]{11})/,
      /youtu\.be\/([a-zA-Z0-9_\-]{11})/,
      /youtube\.com\/shorts\/([a-zA-Z0-9_\-]{11})/
    ];
    for (const regex of regexes) {
      const match = fileUrl.match(regex);
      if (match && match[1]) {
        ytId = match[1];
        break;
      }
    }

    console.log(`[Base de Conocimiento Monitor] Triggering automatic Telegram notification for newly analyzed video: ${videoDoc.title}`);
    try {
      const activeLang = await getTelegramLanguage();
      const textToSend = formatVideoNotification({
        videoTitle: videoDoc.title,
        channelName: channelTitle,
        analysisSummary: splitResult.summary || splitResult.report || "Análisis bursátil guardado con éxito.",
        youtubeId: ytId || undefined,
        videoId: videoDoc.id,
        lang: activeLang,
      });

      const telegramResult = await sendTelegramMessage(textToSend);
      if (telegramResult.success) {
        console.log(`[Base de Conocimiento Monitor] Telegram notification dispatched successfully! ${telegramResult.simulated ? "(Simulated)" : ""}`);
      } else {
        console.warn(`[Base de Conocimiento Monitor] Telegram notification dispatch failed:`, telegramResult.error);
      }
    } catch (err) {
      console.error(`[Base de Conocimiento Monitor] Failed to call Telegram notification:`, err);
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    // 1. Validate Secret Auth Token to prevent unauthorized invocation
    const { searchParams } = new URL(request.url);
    const authHeader = request.headers.get("authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

    const cronSecret = searchParams.get("secret") || 
                       request.headers.get("x-cron-secret") || 
                       bearerToken;

    const expectedSecret = process.env.CRON_SECRET || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (expectedSecret && cronSecret !== expectedSecret) {
      return NextResponse.json({ success: false, error: "Unauthorized access" }, { status: 401 });
    }

    // 2. Initialize Supabase Admin Client
    const supabaseUrl = process.env.SUPABASE_PRODUCTION_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey =
      process.env.SUPABASE_PRODUCTION_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase admin credentials.");
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // 3. Query all videos
    const { data: videos, error: videosError } = await supabaseAdmin
      .from("documents")
      .select("*")
      .eq("type", "video")
      .order("created_at", { ascending: false });

    if (videosError) throw videosError;
    if (!videos || videos.length === 0) {
      return NextResponse.json({ success: true, processed: [], message: "No videos found in the system." });
    }

    // 4. Query existing knowledge_analysis documents to cross-reference
    const { data: existingAnalyses, error: analysesError } = await supabaseAdmin
      .from("documents")
      .select("file_url")
      .eq("type", "knowledge_analysis");

    if (analysesError) throw analysesError;

    const analyzedUrls = new Set<string>((existingAnalyses || []).map(doc => doc.file_url || ""));

    // 5. Filter videos that are pending financial analysis
    const pendingVideos = videos.filter((video: any) => {
      const hasAnalysisDoc = analyzedUrls.has(video.file_url || "");
      const hasTranscriptionInMetadata = !!video.metadata?.transcription;
      const failedAttempts = video.metadata?.analysis_failed_attempts || 0;

      const isPending = !hasTranscriptionInMetadata || !hasAnalysisDoc;
      const isFailedPermanently = failedAttempts >= 5;
      return isPending && !isFailedPermanently;
    });

    // Sort pending videos: prioritize those with fewer failed attempts (0 attempts first) to avoid a blocked video stalling the queue
    pendingVideos.sort((a: any, b: any) => {
      const attemptsA = a.metadata?.analysis_failed_attempts || 0;
      const attemptsB = b.metadata?.analysis_failed_attempts || 0;
      if (attemptsA !== attemptsB) {
        return attemptsA - attemptsB;
      }
      return Date.parse(b.created_at) - Date.parse(a.created_at);
    });

    console.log(`[Monitor Cron] Found ${pendingVideos.length} pending videos. (Out of ${videos.length} total videos)`);

    if (pendingVideos.length === 0) {
      return NextResponse.json({
        success: true,
        processed: [],
        message: "All videos are up-to-date and fully analyzed. Zero pending."
      });
    }

    // 6. Secure batching: process a maximum of 1 video per execution sequentially to avoid Vercel timeouts and Gemini API bottlenecks
    const batch = pendingVideos.slice(0, 1);
    const results = [];

    for (const video of batch) {
      try {
        console.log(`[Monitor Cron] Analyzing pending video: ${video.title} (${video.file_url})`);

        const result = await transcribeVideoCore({
          videoId: video.id,
          fileUrl: video.file_url || "",
          title: video.title,
          description: video.description || video.metadata?.description || "",
          duration: video.metadata?.duration || "12:00",
          apiKey: process.env.GEMINI_API_KEY,
        });

        if (result && result.transcription) {
          // Update the video document's metadata with transcription and model used
          const updatedMetadata = {
            ...(video.metadata || {}),
            transcription: result.transcription,
            transcription_model: result.modelUsed || "Google Vertex AI Gemini 1.5 Pro",
            analysis_failed_attempts: 0 // Reset counter on success
          };

          const { error: updateError } = await supabaseAdmin
            .from("documents")
            .update({ metadata: updatedMetadata })
            .eq("id", video.id);

          if (updateError) {
            console.error(`[Monitor Cron] Error updating video metadata for ${video.title}:`, updateError);
          }

          // Extract snapshots for charts detected in the transcription
          try {
            extractSnapshotsInBackground(video.id, video.file_url || "", result.transcription);
          } catch (snapErr) {
            console.warn(`[Monitor Cron] Chart snapshots extraction warning for ${video.title}:`, snapErr);
          }

          // Save / update the knowledge base split documents
          await saveVideoKnowledgeBaseServer(supabaseAdmin, video, result.transcription);

          results.push({
            id: video.id,
            title: video.title,
            status: "success",
            modelUsed: result.modelUsed
          });
        } else {
          throw new Error("Verbatim result returned empty from Gemini pipeline.");
        }
      } catch (err: any) {
        const errorMsg = err?.message || String(err);
        console.error(`[Monitor Cron] Failed to analyze video "${video.title}":`, errorMsg);
        
        if (errorMsg.includes("DISCARD_VIDEO")) {
          console.log(`[Monitor Cron] Discarding live video from database: ${video.title} (${video.id})`);
          const { error: deleteErr } = await supabaseAdmin
            .from("documents")
            .delete()
            .eq("id", video.id);
          
          if (deleteErr) {
            console.error(`[Monitor Cron] Failed to delete video ${video.title} from Supabase:`, deleteErr);
          } else {
            console.log(`[Monitor Cron] Discarded video ${video.title} successfully.`);
          }

          results.push({
            id: video.id,
            title: video.title,
            status: "discarded",
            reason: errorMsg
          });
          continue;
        }

        const failedAttempts = (video.metadata?.analysis_failed_attempts || 0) + 1;
        const updatedMetadata = {
          ...(video.metadata || {}),
          analysis_failed_attempts: failedAttempts,
          analysis_last_error: errorMsg
        };

        await supabaseAdmin
          .from("documents")
          .update({ metadata: updatedMetadata })
          .eq("id", video.id);

        results.push({
          id: video.id,
          title: video.title,
          status: "failed",
          attempts: failedAttempts,
          error: errorMsg
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results,
      remaining_pending: Math.max(0, pendingVideos.length - batch.length)
    });

  } catch (error: any) {
    console.error("[Monitor Cron Route] Internal Error:", error);
    return NextResponse.json({ success: false, error: error?.message || "Internal Server Error" }, { status: 500 });
  }
}
