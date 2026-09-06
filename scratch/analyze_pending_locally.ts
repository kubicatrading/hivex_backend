import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// 1. Load environment variables FIRST synchronously
try {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, "utf8");
    envFile.split("\n").forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const index = trimmed.indexOf("=");
      if (index === -1) return;
      const key = trimmed.substring(0, index).trim();
      const val = trimmed.substring(index + 1).trim().replace(/^['"]|['"]$/g, "");
      process.env[key] = val;
    });
    console.log("Loaded process.env.SUPABASE_PRODUCTION_URL:", process.env.SUPABASE_PRODUCTION_URL ? "Exists" : "Missing");
    console.log("Loaded process.env.GEMINI_API_KEY:", process.env.GEMINI_API_KEY ? "Exists" : "Missing");
  } else {
    console.error(".env.local file not found at:", envPath);
  }
} catch (err) {
  console.warn("Failed to manually load env file:", err);
}

// 2. NOW dynamically import modules so process.env is already set when they evaluate
async function run() {
  const { transcribeVideoCore } = await import("../app/api/videos/transcribe/route");
  const { formatVideoNotification, sendVideoNotification, getTelegramLanguage, sendTelegramMessage } = await import("../lib/telegram");

  // Server-side helper to split transcription
  function splitTranscription(text: string) {
    if (!text) return { transcription: "", summary: "", charts: "", report: "" };
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
      const lines = text.split("\n");
      let summaryIdx = -1;
      let chartsIdx = -1;
      let reportIdx = -1;

      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (trimmed.startsWith("#") || trimmed.startsWith("- #") || trimmed.startsWith("**")) {
          const headerText = trimmed.replace(/^[\s\-\*#]*/, "").replace(/^\*\*|\*\*$/g, "").trim();
          if (summaryIdx === -1) {
            if (headerText.includes("resumen") || headerText.includes("summary")) summaryIdx = i;
          } else if (chartsIdx === -1) {
            if (headerText.includes("grafico") || headerText.includes("chart")) chartsIdx = i;
          } else if (reportIdx === -1) {
            if (headerText.includes("informe") || headerText.includes("report")) reportIdx = i;
          }
        }
      }

      if (summaryIdx !== -1 && chartsIdx !== -1 && reportIdx !== -1 && reportIdx > chartsIdx && chartsIdx > summaryIdx) {
        transcription = lines.slice(0, summaryIdx).join("\n");
        summary = lines.slice(summaryIdx, chartsIdx).join("\n");
        charts = lines.slice(chartsIdx, reportIdx).join("\n");
        report = lines.slice(reportIdx).join("\n");
      } else {
        transcription = text;
      }
    }

    return {
      transcription: transcription.trim(),
      summary: summary.trim(),
      charts: charts.trim(),
      report: report.trim()
    };
  }

  async function saveVideoKnowledgeBaseServer(
    supabaseAdmin: any,
    videoDoc: { id: string; title: string; file_url?: string; created_at?: string; metadata?: any },
    transcriptionText: string
  ) {
    const adminId = "5c8d65c6-0798-4f8a-aae3-dd2cebebd868";
    const splitResult = splitTranscription(transcriptionText);
    const channelTitle = videoDoc.metadata?.channel_title || "Andrei Jikh";
    const dateStr = new Date().toISOString();
    const fileUrl = videoDoc.file_url || "";

    const docs = [
      {
        type: "knowledge_transcription",
        doc: {
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
        }
      },
      {
        type: "knowledge_summary",
        doc: {
          user_id: adminId,
          title: `[Resumen] - ${videoDoc.title}`,
          description: `Resumen detallado estructurado cronológicamente de ${videoDoc.title}`,
          type: "knowledge_summary",
          file_url: fileUrl,
          metadata: {
            fecha_resumen: dateStr,
            canal_origen: channelTitle,
            nombre_video: videoDoc.title,
            texto_resumen: splitResult.summary
          }
        }
      },
      {
        type: "knowledge_charts",
        doc: {
          user_id: adminId,
          title: `[Gráficos] - ${videoDoc.title}`,
          description: `Gráficos y visualizaciones detectadas de ${videoDoc.title}`,
          type: "knowledge_charts",
          file_url: fileUrl,
          metadata: {
            fecha_analisis: dateStr,
            canal_origen: channelTitle,
            nombre_video: videoDoc.title,
            texto_graficos: splitResult.charts
          }
        }
      },
      {
        type: "knowledge_analysis",
        doc: {
          user_id: adminId,
          title: videoDoc.title,
          description: `Informe de inversión y análisis táctico de ${videoDoc.title}`,
          type: "knowledge_analysis",
          file_url: fileUrl,
          metadata: {
            fecha_analisis: dateStr,
            canal_origen: channelTitle,
            nombre_video: videoDoc.title,
            texto_analisis: splitResult.report
          }
        }
      }
    ];

    for (const item of docs) {
      const { data: existing } = await supabaseAdmin
        .from("documents")
        .select("id")
        .eq("type", item.type)
        .eq("file_url", fileUrl);

      if (!existing || existing.length === 0) {
        await supabaseAdmin.from("documents").insert(item.doc);
        console.log(`[Base de Conocimiento] Persistido con éxito ${item.type} para: ${videoDoc.title}`);
      } else {
        await supabaseAdmin.from("documents").update(item.doc).eq("id", existing[0].id);
        console.log(`[Base de Conocimiento] Actualizado con éxito ${item.type} para: ${videoDoc.title}`);
      }
    }

    // Telegram alert
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

    console.log(`[Base de Conocimiento] Triggering automatic Telegram notification for ${videoDoc.title}...`);
    try {
      const activeLang = await getTelegramLanguage();
      const coverUrl = videoDoc.metadata?.thumbnail || (ytId ? `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg` : undefined);

      const telegramResult = await sendVideoNotification({
        videoTitle: videoDoc.title,
        channelName: channelTitle,
        analysisSummary: splitResult.summary || splitResult.report || "Análisis bursátil guardado con éxito.",
        youtubeId: ytId || undefined,
        videoId: videoDoc.id,
        coverUrl: coverUrl,
        publishedAt: videoDoc.created_at || videoDoc.metadata?.published_at,
        lang: activeLang,
      });

      if (telegramResult.success) {
        console.log(`[Base de Conocimiento] Telegram notification dispatched successfully!`);
      } else {
        console.warn(`[Base de Conocimiento] Telegram notification dispatch failed:`, telegramResult.error);
      }
    } catch (err) {
      console.error(`[Base de Conocimiento] Failed to call Telegram notification:`, err);
    }
  }

  const supabaseUrl = process.env.SUPABASE_PRODUCTION_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_PRODUCTION_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing Supabase credentials in env.");
    return;
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // Query all videos
  const { data: videos, error: videosError } = await supabaseAdmin
    .from("documents")
    .select("*")
    .eq("type", "video")
    .order("created_at", { ascending: false });

  if (videosError) throw videosError;

  // Query existing knowledge_analysis documents to cross-reference
  const { data: existingAnalyses } = await supabaseAdmin
    .from("documents")
    .select("file_url")
    .eq("type", "knowledge_analysis");

  const analyzedUrls = new Set<string>((existingAnalyses || []).map(doc => doc.file_url || ""));

  const pendingVideos = (videos || []).filter((video: any) => {
    const hasAnalysisDoc = analyzedUrls.has(video.file_url || "");
    const hasTranscriptionInMetadata = !!video.metadata?.transcription;
    const failedAttempts = video.metadata?.analysis_failed_attempts || 0;
    return (!hasTranscriptionInMetadata || !hasAnalysisDoc) && failedAttempts < 10;
  });

  console.log(`Found ${pendingVideos.length} pending videos to process locally...`);

  if (pendingVideos.length === 0) {
    console.log("No pending videos. Exit.");
    return;
  }

  const targetVideo = pendingVideos[0];
  console.log(`\n=== PROCESSING VIDEO LOCALLY: "${targetVideo.title}" ===`);
  console.log(`File URL: ${targetVideo.file_url}`);
  
  try {
    const result = await transcribeVideoCore({
      videoId: targetVideo.id,
      fileUrl: targetVideo.file_url || "",
      title: targetVideo.title,
      description: targetVideo.description || targetVideo.metadata?.description || "",
      duration: targetVideo.metadata?.duration || "32:00",
      apiKey: process.env.GEMINI_API_KEY,
    });

    if (result && result.transcription) {
      console.log("Analysis succeeded! Verbatim length:", result.transcription.length);
      
      const updatedMetadata = {
        ...(targetVideo.metadata || {}),
        transcription: result.transcription,
        transcription_model: result.modelUsed || "Google AI Studio Gemini 3.5 Flash (v1beta)",
        analysis_failed_attempts: 0
      };

      await supabaseAdmin
        .from("documents")
        .update({ metadata: updatedMetadata })
        .eq("id", targetVideo.id);

      await saveVideoKnowledgeBaseServer(supabaseAdmin, targetVideo, result.transcription);
      console.log("Locally analyzed and saved successfully!");
    } else {
      console.error("Transcription failed.");
    }
  } catch (err: any) {
    console.error("Local analysis error:", err?.message || err);
  }
}

run().catch(err => {
  console.error("Top-level execution error:", err);
});
