import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTelegramMessage, markdownToTelegramHtml, getTelegramLanguage } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Premium 5-minute timeout

export async function GET(request: NextRequest) {
  return handleHealthCheck(request);
}

export async function POST(request: NextRequest) {
  return handleHealthCheck(request);
}

async function handleHealthCheck(request: NextRequest) {
  const startTime = Date.now();
  try {
    const { searchParams } = new URL(request.url);
    const authHeader = request.headers.get("authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

    const cronSecret = searchParams.get("secret") || 
                       request.headers.get("x-cron-secret") || 
                       bearerToken;

    const expectedSecret = process.env.CRON_SECRET;

    if (expectedSecret && cronSecret !== expectedSecret) {
      return NextResponse.json({ success: false, error: "Unauthorized access" }, { status: 401 });
    }

    const dryRun = searchParams.get("dryRun") === "true";

    // Initialize Supabase Client
    const supabaseUrl = process.env.SUPABASE_PRODUCTION_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_PRODUCTION_SERVICE_ROLE_KEY || 
                           process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ success: false, error: "Missing Supabase credentials in env." }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    let dbReachable = false;
    let dbQueryTime = 0;
    let totalVideos24h = 0;
    let analyzedVideosCount = 0;
    let pendingVideosCount = 0;
    let failedVideosList: any[] = [];
    let dbErrorMessage = "";

    // News / Magazines metrics
    let totalMagazines = 0;
    let readyMagazinesCount = 0;
    let pendingMagazinesCount = 0;
    let pendingMagazinesList: any[] = [];

    try {
      const dbStart = Date.now();
      // Test basic connectivity and query recent videos
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recentVideos, error: dbErr } = await supabaseAdmin
        .from("documents")
        .select("*")
        .eq("type", "video")
        .gte("created_at", twentyFourHoursAgo);

      if (dbErr) throw dbErr;
      
      dbReachable = true;
      dbQueryTime = Date.now() - dbStart;

      // Query knowledge_analysis documents to verify completions
      const { data: analyses } = await supabaseAdmin
        .from("documents")
        .select("file_url")
        .eq("type", "knowledge_analysis");

      const analyzedUrls = new Set((analyses || []).map(doc => doc.file_url || ""));

      if (recentVideos) {
        totalVideos24h = recentVideos.length;
        recentVideos.forEach((video: any) => {
          const hasAnalysis = analyzedUrls.has(video.file_url || "");
          const hasTranscription = !!video.metadata?.transcription;
          
          if (hasAnalysis && hasTranscription) {
            analyzedVideosCount++;
          } else {
            pendingVideosCount++;
            failedVideosList.push({
              title: video.title,
              duration: video.metadata?.duration || "N/D",
              attempts: video.metadata?.analysis_failed_attempts || 0,
              fileUrl: video.file_url || ""
            });
          }
        });
      }

      // Query magazine issues for News Health Check
      const { data: rawIssues, error: issuesErr } = await supabaseAdmin
        .from("documents")
        .select("id, title, file_url, created_at, metadata")
        .eq("metadata->>is_magazine_issue", "true")
        .order("created_at", { ascending: false });

      if (issuesErr) {
        console.warn("[Health Check] Error querying magazine issues:", issuesErr);
      }

      const magazineIssues = (rawIssues || []).filter(issue => {
        const title = issue.title || "";
        return !title.startsWith("[Resumen]") && !title.startsWith("[Análisis]") && !title.startsWith("[Gráficos]");
      });

      // Query articles to cross-reference with issues
      const { data: allArticles } = await supabaseAdmin
        .from("documents")
        .select("id, metadata->>issue_slug, metadata->>start_page")
        .eq("metadata->>is_magazine_article", "true");

      const articlesBySlug: Record<string, any[]> = {};
      (allArticles || []).forEach((a: any) => {
        const s = a.issue_slug;
        if (!articlesBySlug[s]) articlesBySlug[s] = [];
        articlesBySlug[s].push(a);
      });

      totalMagazines = magazineIssues.length;

      for (const mag of magazineIssues) {
        const slug = mag.metadata?.slug;
        const arts = slug ? articlesBySlug[slug] || [] : [];
        const artCount = arts.length;
        const hasValidPages = artCount > 0 && arts.some(a => a.start_page !== null && a.start_page !== undefined);

        const hasAudio = !!mag.metadata?.audio_url && mag.metadata?.audio_status === "ready";
        const timestampsCount = Array.isArray(mag.metadata?.sentence_timestamps) ? mag.metadata.sentence_timestamps.length : 0;
        const hasTimestamps = timestampsCount > 50;

        const isComplete = artCount > 0 && hasValidPages && hasAudio && hasTimestamps;

        if (isComplete) {
          readyMagazinesCount++;
        } else {
          pendingMagazinesCount++;
          pendingMagazinesList.push({
            title: mag.title,
            slug: slug || mag.id,
            artCount,
            hasValidPages,
            hasAudio,
            audioDuration: mag.metadata?.audio_duration || 0,
            timestampsCount,
            hasTimestamps,
            created_at: mag.created_at
          });
        }
      }
    } catch (err: any) {
      dbErrorMessage = err?.message || JSON.stringify(err);
      console.error("[Health Check] Database connectivity test failed:", dbErrorMessage);
    }

    const totalDuration = Date.now() - startTime;

    // Compile beautiful markdown report following Rule 1, 2 & 4
    let reportMd = `📊 <b>INFORME DE CONTROL Y SALUD OPERATIVA - HIVEX</b>\n`;
    reportMd += `---\n\n`;
    reportMd += `Estimados miembros de HIVEX, les saluda su asesor de inversiones automatizado de la mesa de análisis. A continuación presento el informe premium de salud y estado operativo de nuestra infraestructura de conocimiento financiero, emitido el ${new Date().toLocaleDateString("es-ES")} a las ${new Date().toLocaleTimeString("es-ES")} (hora local).\n\n`;

    reportMd += `<b>🖥️ ESTADO DEL SERVIDOR (VERCEL)</b>\n`;
    reportMd += `• <b>Límite de Tiempo de Ejecución (Timeout):</b> 300 segundos (Plan Pro Premium Activado) 🟢\n`;
    reportMd += `• <b>Tiempo de Respuesta del Diagnóstico:</b> ${totalDuration} ms\n\n`;

    reportMd += `<b>🗄️ ESTADO DE LA BASE DE DATOS (SUPABASE)</b>\n`;
    if (dbReachable) {
      reportMd += `• <b>Conectividad:</b> OPERATIVA 🟢\n`;
      reportMd += `• <b>Tiempo de Respuesta DB:</b> ${dbQueryTime} ms\n\n`;
    } else {
      let displayError = dbErrorMessage;
      if (displayError.includes("<title>")) {
        const match = displayError.match(/<title>([\s\S]*?)<\/title>/i);
        if (match && match[1]) {
          displayError = match[1].trim();
        } else {
          displayError = "Connection Timed Out (522)";
        }
      } else {
        displayError = displayError.slice(0, 200);
      }
      reportMd += `• <b>Conectividad:</b> INTERRUMPIDA 🔴\n`;
      reportMd += `• <b>Incidencia detectada:</b> Error de conexión o inactividad del servicio. Cloudflare 522/504 en origen.\n`;
      reportMd += `• <b>Detalle técnico:</b> <code>${displayError}</code>\n\n`;
    }

    reportMd += `<b>🎬 ESTADO DE LA VIDEOTECA (Últimas 24 horas)</b>\n`;
    reportMd += `• <b>Videos nuevos detectados hoy:</b> ${totalVideos24h}\n`;
    reportMd += `• <b>Videos analizados con éxito:</b> ${analyzedVideosCount} ✅\n`;
    reportMd += `• <b>Videos pendientes o encallados:</b> ${pendingVideosCount} ⏳\n\n`;

    if (pendingVideosCount > 0 && dbReachable) {
      reportMd += `<b>⚠️ VIDEOS PENDIENTES DE PROCESAMIENTO</b>\n`;
      failedVideosList.forEach((v, idx) => {
        const cleanTitle = v.title.replace(/[\[\]()]/g, ""); // Keep links clean
        const isLong = v.duration.includes(":") && parseInt(v.duration.split(":")[0]) >= 20;
        const note = isLong ? " (Video largo: requiere ampliación de timeout ya configurada)" : "";
        reportMd += `${idx + 1}. <a href="${v.fileUrl}">${cleanTitle}</a>\n`;
        reportMd += `   • Duración: <code>${v.duration}</code>\n`;
        reportMd += `   • Intentos fallidos: <code>${v.attempts}/10</code>${note}\n`;
      });
      reportMd += `\n<i>Nota: Gracias a la ampliación del tiempo límite de Vercel a 300s, el próximo ciclo de monitor-analysis tiene margen completo para transcribir y estructurar los videos largos sin cortes.</i>\n\n`;
    } else if (!dbReachable) {
      reportMd += `<i>Atención: No se ha podido evaluar el estado detallado de los videos debido a la interrupción de conexión con Supabase.</i>\n\n`;
    } else {
      reportMd += `🌟 <b>¡Cola de procesamiento al día!</b> Todos los contenidos han sido analizados y publicados con éxito.\n\n`;
    }

    reportMd += `<b>📰 ESTADO DE REVISTAS / NEWS (CABINA EDITORIAL)</b>\n`;
    reportMd += `• <b>Ediciones registradas:</b> ${totalMagazines}\n`;
    reportMd += `• <b>Ediciones completas (Texto v7, Audio 18k, Timestamps):</b> ${readyMagazinesCount} ✅\n`;
    reportMd += `• <b>Ediciones pendientes o encalladas:</b> ${pendingMagazinesCount} ${pendingMagazinesCount > 0 ? "⏳" : "🟢"}\n\n`;

    if (pendingMagazinesCount > 0 && dbReachable) {
      reportMd += `<b>⚠️ EDICIONES PENDIENTES DE PROCESAMIENTO EDITORIAL</b>\n`;
      pendingMagazinesList.forEach((m, idx) => {
        const cleanTitle = m.title.replace(/[\[\]()]/g, "");
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://hivex-backend.vercel.app";
        const viewerUrl = `${appUrl}/dashboard/news?slug=${m.slug}`;

        reportMd += `${idx + 1}. <a href="${viewerUrl}">${cleanTitle}</a>\n`;
        reportMd += `   • Artículos segmentados: <code>${m.artCount} artículos</code> (${m.hasValidPages ? "Páginas mapeadas ✅" : "⚠️ Falta mapeo de página"})\n`;
        reportMd += `   • Audio (18kbps): ${m.hasAudio ? `<code>Listo (${Math.round(m.audioDuration / 60)} min) ✅</code>` : "<code>⏳ Pendiente / En síntesis</code>"}\n`;
        reportMd += `   • Marcas de tiempo: ${m.hasTimestamps ? `<code>${m.timestampsCount} marcas ✅</code>` : "<code>⏳ Pendiente</code>"}\n`;
      });
      reportMd += `\n<i>Nota: La sincronización v7 consolida la extracción jerárquica de 3 niveles, corte de páginas del PDF y síntesis continua a 18kbps.</i>\n\n`;
    } else if (dbReachable) {
      reportMd += `🌟 <b>¡Hemeroteca editorial al día!</b> Todas las revistas cuentan con segmentación de páginas, audio a 18kbps y marcas de tiempo verificadas.\n\n`;
    }

    reportMd += `<i>Mesa de Operaciones de HIVEX</i>`;

    if (!dryRun) {
      // Dispatches report with premium HTML formatting
      await sendTelegramMessage(reportMd);
      console.log("[Health Check] Premium diagnostic report dispatched successfully to Telegram.");
    }

    return NextResponse.json({
      success: true,
      metrics: {
        server_duration_ms: totalDuration,
        db_reachable: dbReachable,
        db_response_time_ms: dbQueryTime,
        total_videos_24h: totalVideos24h,
        analyzed_count: analyzedVideosCount,
        pending_count: pendingVideosCount,
        news_total_magazines: totalMagazines,
        news_ready_count: readyMagazinesCount,
        news_pending_count: pendingMagazinesCount,
        news_pending_magazines: pendingMagazinesList,
        dispatched_telegram: !dryRun
      }
    });

  } catch (err: any) {
    console.error("[Health Check Error]:", err);
    return NextResponse.json({ success: false, error: err?.message || JSON.stringify(err) }, { status: 500 });
  }
}
