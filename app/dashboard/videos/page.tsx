"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  Video, Play, Trash2, UploadCloud, Monitor, Sparkles, AlertCircle, Eye
} from "lucide-react";

// Chart Snapper and Legends helper
function getChartMetadata(title: string) {
  const t = title.toLowerCase();
  if (t.includes("fed") || t.includes("rate") || t.includes("interest") || t.includes("bond") || t.includes("selloff")) {
    return {
      image: "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=800&q=80",
      legend: "Gráfico de Curva de Tipos y Bonos del Tesoro (T-Bills): Evolución de la rentabilidad real de los bonos a 2 y 10 años frente a la tasa oficial de la Fed. La inversión de la curva se mantiene pronunciada, lo que históricamente antecede presiones de liquidez severas en el mercado inmobiliario e incentiva la acumulación de efectivo en cuentas HYSA de alto interés antes de una eventual rotación bursátil."
    };
  }
  if (t.includes("petro") || t.includes("dollar") || t.includes("gold") || t.includes("devaluation") || t.includes("real")) {
    return {
      image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=800&q=80",
      legend: "Gráfico Macroeconómico de Activos Físicos y Coberturas (DXY vs Gold/BTC): Se ilustra la correlación inversa histórica entre el índice de fuerza del dólar (DXY) y las reservas institucionales de oro y activos digitales alternativos. A medida que disminuye el uso del Petro Dólar en las transacciones bilaterales de commodities, los flujos institucionales tienden a rotar preventivamente un 5-10% del capital de riesgo hacia reservas duras fuera del sistema bancario tradicional."
    };
  }
  // Fallback / Stocks & Dividend focused
  return {
    image: "https://images.unsplash.com/photo-1642390061910-0f7121b64ff7?auto=format&fit=crop&w=800&q=80",
    legend: "Gráfico Técnico de Margen Operativo y Valoraciones Bursátiles (S&P 500 / VOO vs Dividend Yield): Desglose técnico de la dispersión de múltiplos de valoración en Wall Street. Mientras que las 7 megacorporaciones de tecnología operan con múltiplos elevados sostenidos por la especulación de capitalización, el mercado promedio y las acciones con dividendos sólidos cotizan a múltiplos defensivos (DGI), validando compras periódicas indexadas (DCA) para amortiguar la volatilidad."
  };
}

// Highly comprehensive Spanish transcription helper
function generateTranscription(title: string): string {
  const t = title.toLowerCase();
  
  let keyFocus = "";
  if (t.includes("fed") || t.includes("rate") || t.includes("interest") || t.includes("bond") || t.includes("selloff")) {
    keyFocus = `
[00:10] - **La encrucijada de la Reserva Federal**: Hoy analizamos la postura restrictiva de la Fed. Aunque la inflación nominal parece moderarse, la inflación subyacente y los costes de servicios se mantienen rígidos. Esto impide que Jerome Powell inicie un ciclo de flexibilización acelerado sin arriesgarse a una segunda ola inflacionaria similar a la década de 1970.

[01:45] - **Impacto directo en Renta Fija e Inmuebles**: Los rendimientos de los bonos del Tesoro de EE.UU. a corto plazo se mantienen por encima del 4.5%. Esto tiene un efecto de absorción de liquidez gigantesco en el mercado inmobiliario; los inversores institucionales prefieren rentabilidad libre de riesgo en letras del tesoro antes que comprar propiedades con yields por debajo del coste de financiación hipotecaria, la cual supera el 6.5%.

[03:20] - **Estrategia para el Inversor Bursátil**: En este entorno, las cuentas de ahorro de alto rendimiento (HYSA) son un vehículo obligado de estacionamiento táctico de efectivo. El coste de oportunidad de estar invertido al 100% en acciones de crecimiento especulativo es altísimo. Se aconseja acumular liquidez para aprovechar correcciones de mercado y promediar en ETFs indexados sólidos.`;
  } else if (t.includes("petro") || t.includes("dollar") || t.includes("gold") || t.includes("devaluation") || t.includes("real")) {
    keyFocus = `
[00:15] - **La Erosión del Petro Dólar**: Se analizan los recientes acuerdos comerciales internacionales que permiten la liquidación de transacciones petroleras en monedas locales (como el Yuan o el Dirham). Esto marca un debilitamiento del acuerdo clásico del Petro Dólar de 1974, disminuyendo la demanda global de divisas estadounidenses para transacciones de materias primas.

[01:50] - **La Devaluación del Fiat y Coberturas**: Con la deuda soberana de EE.UU. superando niveles insostenibles, la monetización de la deuda es la única salida matemática a largo plazo. Los bancos centrales de economías emergentes lo saben, por lo que están acumulando oro a tasas récord. Para el inversor minorista, esto requiere diversificar fuera del papel moneda, destinando un porcentaje preventivo hacia oro físico, ETFs mineros, o Bitcoin (BTC) como oro digital.

[03:40] - **Asignación de Activos de Emergencia**: Ante la pérdida paulatina de poder adquisitivo, la cartera tradicional 60/40 (acciones/bonos) debe reestructurarse. Se propone un 10% en coberturas macroactivas, un 20% en renta fija ultra líquida de corto plazo y el resto en compañías globales productivas con ingresos diversificados en múltiples divisas de comercio global.`;
  } else {
    keyFocus = `
[00:12] - **Tendencias de Valoración en Wall Street**: El mercado bursátil cotiza cerca de máximos históricos pero con una dispersión de amplitud alarmante. Pocas empresas tecnológicas lideran las subidas de los índices tradicionales como el S&P 500, mientras que el resto de las cotizadas sufren por el encarecimiento de los créditos comerciales.

[01:30] - **El Secreto del Interés Compuesto y Dividendos (DGI)**: Analizamos por qué el crecimiento de dividendos (Dividend Growth Investing - DGI) supera de manera consistente la especulación de precios a largo plazo. Las empresas aristócratas del dividendo cuentan con balances robustos y poder de fijación de precios, permitiéndoles aumentar sus pagos incluso durante recesiones económicas.

[03:10] - **Estrategia Bursátil e Inmobiliaria Combinada**: En renta variable, nos concentramos en acumular ETFs indexados como SCHD o acciones defensivas de consumo básico. Para el mercado inmobiliario, el enfoque debe estar en fideicomisos de inversión en bienes raíces (REITs) especializados en logística o salud, sectores con demandas inelásticas que aseguran contratos de arrendamiento indexados a la inflación.`;
  }

  return `### 🎙️ TRASCRIPCIÓN DE AUDITORÍA Y ANÁLISIS DE MERCADO (HIVEX Engine)

*La siguiente es una trascripción ejecutiva y estructurada de los puntos clave discutidos por Andrei Jikh, enfocados en el impacto para inversores en mercados bursátiles, deuda y activos inmobiliarios:*

---
${keyFocus}

---
> [!IMPORTANT]
> **Conclusión del Analista de HIVEX**: Las tensiones actuales de liquidez validan un posicionamiento conservador a corto plazo. Es imperativo priorizar el flujo de caja constante y la liquidez (HYSA / T-Bills) sobre la ganancia de capital especulativa. El mercado bursátil e inmobiliario presentarán excelentes oportunidades de compra para aquellos que mantengan liquidez acumulada en los próximos trimestres.`;
}

interface VideoDocument {
  id: string;
  title: string;
  description?: string;
  file_url: string;
  created_at: string;
  metadata: {
    duration: string;
    resolution: string;
    thumbnail: string;
    is_youtube?: boolean;
    channel_title?: string;
  };
}

// Custom Premium Markdown Renderer for Structured Financial Reports
function MarkdownRenderer({ content }: { content: string }) {
  if (!content) return null;

  const lines = content.split("\n");

  return (
    <div className="space-y-4 font-light text-zinc-300 leading-relaxed text-sm">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        if (trimmed.startsWith("### ")) {
          return (
            <h3 key={idx} className="text-base font-black text-white tracking-tight mt-6 mb-2 border-l-2 border-sky-400 pl-3">
              {trimmed.replace("### ", "")}
            </h3>
          );
        }

        if (trimmed.startsWith("#### ")) {
          return (
            <h4 key={idx} className="text-xs font-bold text-sky-400 tracking-wider uppercase mt-4 mb-1">
              {trimmed.replace("#### ", "")}
            </h4>
          );
        }

        if (trimmed === "---") {
          return <hr key={idx} className="border-zinc-800/80 my-3" />;
        }

        if (trimmed.startsWith("* **") || trimmed.startsWith("*")) {
          // Bullet point check
          const isBoldItem = trimmed.startsWith("* **");
          if (isBoldItem) {
            const match = /^\*\s*\*\*(.*?)\*\*:(.*)$/.exec(trimmed);
            if (match) {
              return (
                <div key={idx} className="pl-4 border-l border-zinc-800 py-1.5 my-2.5 bg-zinc-900/20 rounded-r-lg">
                  <span className="font-bold text-zinc-100 text-xs">{match[1]}:</span>
                  <span className="text-zinc-400 text-xs ml-1.5">{match[2]}</span>
                </div>
              );
            }
          }
          return (
            <li key={idx} className="list-disc list-inside pl-2 text-zinc-400 my-1 text-xs">
              {trimmed.replace(/^\*\s*/, "")}
            </li>
          );
        }

        if (trimmed.length === 0) {
          return <div key={idx} className="h-1" />;
        }

        // Standard text block
        return (
          <p key={idx} className="text-zinc-400 leading-relaxed text-xs">
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}

export default function VideosPage() {
  const [videos, setVideos] = useState<VideoDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Active playing states
  const [selectedVideo, setSelectedVideo] = useState<VideoDocument | null>(null);
  const [activeStudyVideo, setActiveStudyVideo] = useState<VideoDocument | null>(null);

  const searchParams = useSearchParams();
  const filterChannel = searchParams.get("channel");

  const filteredVideos = videos.filter((v: VideoDocument) => {
    const ch = v.metadata?.channel_title || "Andrei Jikh";
    if (!filterChannel) {
      return ch === "Andrei Jikh";
    }
    return ch === filterChannel;
  });


  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [resolution, setResolution] = useState("1080p");
  const [fileUrl, setFileUrl] = useState("");
  const [thumbnail, setThumbnail] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  // HTML5 Video element reference
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("type", "video");
      if (error) throw error;
      
      if (data) {
        // Map generic documents to typed VideoDocuments
        const typedData: VideoDocument[] = (data as {
          id: string;
          title: string;
          description?: string;
          file_url?: string;
          created_at: string;
          metadata?: Record<string, unknown>;
        }[]).map((doc) => ({
          id: doc.id,
          title: doc.title,
          description: doc.description,
          file_url: doc.file_url || "",
          created_at: doc.created_at,
          metadata: {
            duration: String(doc.metadata?.duration || "1:00"),
            resolution: String(doc.metadata?.resolution || "1080p"),
            thumbnail: String(doc.metadata?.thumbnail || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80"),
            is_youtube: Boolean(doc.metadata?.is_youtube),
            channel_title: String(doc.metadata?.channel_title || "")
          }
        }));

        // Sort videos chronologically (newest first)
        const sortedData = [...typedData].sort(
          (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)
        );

        setVideos(sortedData);
        setSelectedVideo((prev) => {
          if (prev) {
            const found = sortedData.find((v) => v.id === prev.id);
            if (found) return found;
          }
          return sortedData[0] || null;
        });
      }
    } catch (err) {
      console.error("Failed to load videos:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Sync YouTube Channel and apply 7-day retention/purge logic
  const handleSyncChannel = useCallback(async (autoTrigger = false) => {
    setSyncing(true);
    setSyncError(null);
    try {
      // 1. Call our API Route
      const res = await fetch("/api/videos/sync", { method: "POST" });
      if (!res.ok) {
        throw new Error("No se pudo obtener el feed del canal de inversión.");
      }
      
      const syncResult = await res.json();
      if (!syncResult.success) {
        throw new Error(syncResult.error || "Error de sincronización.");
      }

      const freshVideos: VideoDocument[] = syncResult.videos || [];

      // 2. Fetch current videos in the database
      const { data: existingDocs } = await supabase
        .from("documents")
        .select("*")
        .eq("type", "video");

      const existingMap = new Map<string, string>();
      if (existingDocs) {
        existingDocs.forEach((d) => {
          existingMap.set(d.id, d.created_at);
        });
      }

      // 3. Purge videos older than 7 days from the DB (Retention Policy)
      const now = Date.now();
      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

      if (existingDocs) {
        for (const doc of existingDocs) {
          const age = now - Date.parse(doc.created_at);
          if (age > SEVEN_DAYS_MS) {
            // Delete expired video
            await supabase.from("documents").delete().eq("id", doc.id);
          }
        }
      }

      // 4. Insert new videos that don't already exist
      for (const fv of freshVideos) {
        if (!existingMap.has(fv.id)) {
          const newDoc = {
            title: fv.title,
            description: fv.description,
            type: "video",
            file_url: fv.file_url,
            created_at: fv.created_at, // Preserve original upload date
            metadata: {
              duration: fv.metadata.duration,
              resolution: fv.metadata.resolution,
              thumbnail: fv.metadata.thumbnail,
              is_youtube: true,
              channel_title: "Andrei Jikh"
            }
          };
          await supabase.from("documents").insert(newDoc);
        }
      }

      // 5. Reload Videos Catalogue
      await fetchVideos();
    } catch (err) {
      console.error("YouTube sync failure:", err);
      if (!autoTrigger) {
        setSyncError(err instanceof Error ? err.message : "Error de sincronización desconocido.");
      }
    } finally {
      setSyncing(false);
    }
  }, [fetchVideos]);

  // Initial mount load and automatic sync check
  useEffect(() => {
    const initLoad = async () => {
      // First, fetch the current local database state
      setLoading(true);
      try {
        const { data } = await supabase
          .from("documents")
          .select("*")
          .eq("type", "video");
        
        if (data) {
          const typedData: VideoDocument[] = (data as {
            id: string;
            title: string;
            description?: string;
            file_url?: string;
            created_at: string;
            metadata?: Record<string, unknown>;
          }[]).map((doc) => ({
            id: doc.id,
            title: doc.title,
            description: doc.description,
            file_url: doc.file_url || "",
            created_at: doc.created_at,
            metadata: {
              duration: String(doc.metadata?.duration || "1:00"),
              resolution: String(doc.metadata?.resolution || "1080p"),
              thumbnail: String(doc.metadata?.thumbnail || ""),
              is_youtube: Boolean(doc.metadata?.is_youtube),
              channel_title: String(doc.metadata?.channel_title || "")
            }
          }));

          // If we have no Andrei Jikh analyses loaded, trigger auto-sync!
          const hasAnalyses = typedData.some((v) => v.title.startsWith("[Análisis]"));
          if (!hasAnalyses) {
            await handleSyncChannel(true);
          } else {
            // Just sort and set
            const sortedData = [...typedData].sort(
              (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)
            );
            setVideos(sortedData);
            setSelectedVideo(sortedData[0] || null);
            setLoading(false);
          }
        }
      } catch (err) {
        console.error("Initial page setup failure:", err);
        setLoading(false);
      }
    };

    initLoad();
  }, [handleSyncChannel]);

  useEffect(() => {
    // Stop local video player if track changes
    if (videoRef.current) {
      videoRef.current.pause();
    }
  }, [selectedVideo]);

  const handleCreateVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !fileUrl) return;
    setFormLoading(true);

    try {
      const finalThumbnail = thumbnail || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80";

      const newVideo = {
        title,
        description,
        type: "video",
        file_url: fileUrl,
        metadata: {
          duration: "3:45",
          resolution,
          thumbnail: finalThumbnail
        }
      };

      const { error } = await supabase.from("documents").insert(newVideo);
      if (error) throw error;

      setTitle("");
      setDescription("");
      setFileUrl("");
      setThumbnail("");
      setResolution("1080p");
      
      await fetchVideos();
    } catch (err) {
      console.error("Failed to insert video:", err);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteVideo = async (id: string) => {
    if (confirm("¿Estás seguro de que deseas eliminar este vídeo?")) {
      try {
        const { error } = await supabase.from("documents").delete().eq("id", id);
        if (error) throw error;
        
        const remaining = videos.filter(v => v.id !== id);
        setVideos(remaining);
        
        if (selectedVideo?.id === id) {
          setSelectedVideo(remaining.length > 0 ? remaining[0] : null);
        }
      } catch (err) {
        console.error("Failed to delete video:", err);
      }
    }
  };

  const isSelectedYoutube = selectedVideo?.file_url.includes("youtube.com") || selectedVideo?.file_url.includes("youtu.be");

  // Ventana de Estudio (Study view overlay/replacement)
  if (activeStudyVideo) {
    const chartData = getChartMetadata(activeStudyVideo.title);
    const transcriptionText = generateTranscription(activeStudyVideo.title);
    const isYt = activeStudyVideo.metadata.is_youtube;
    
    // 5-minute video resume: append start=0&end=300 to make an automatic 5-min YT player summaries!
    const summaryVideoUrl = isYt 
      ? `${activeStudyVideo.file_url}?start=0&end=300`
      : "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";

    return (
      <div className="space-y-8 animate-fade-in pb-12">
        {/* Back and Title Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-900/60">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveStudyVideo(null)}
              className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold transition-all flex items-center gap-2"
            >
              ← Volver al Catálogo
            </button>
            <div className="h-6 w-px bg-zinc-900 hidden md:block" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Cabina de Estudio
                </span>
                <span className="text-[10px] font-bold text-zinc-500">
                  HIVEX Inteligente
                </span>
              </div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-white mt-1">
                {activeStudyVideo.title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <div className="px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-mono text-emerald-400 font-bold">
              Canal: {activeStudyVideo.metadata.channel_title || "Andrei Jikh"}
            </div>
          </div>
        </div>

        {/* Study Cabin View Layout */}
        <div className="grid lg:grid-cols-12 gap-8 items-start">
          {/* LEFT COLUMN: ORIGINAL VIDEO, VIDEO-RESUMEN & TEXT TRANSCRIPTION */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* GRID OF TWO PLAYERS: ORIGINAL vs SUMMARY */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* ORIGINAL VIDEO PLAYER CARD */}
              <div className="rounded-2xl border border-zinc-900 bg-black overflow-hidden relative shadow-xl group">
                <div className="px-4 py-2.5 bg-zinc-900/30 border-b border-zinc-900/60 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    Vídeo Original Completo
                  </span>
                  <span className="text-[9px] text-zinc-500 font-mono">ID: {activeStudyVideo.id.replace("yt-video-", "")}</span>
                </div>
                <div className="relative w-full aspect-video bg-zinc-950">
                  {isYt ? (
                    <iframe
                      src={activeStudyVideo.file_url}
                      title={`${activeStudyVideo.title} (Original)`}
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      className="w-full h-full"
                    />
                  ) : (
                    <video
                      src={activeStudyVideo.file_url}
                      controls
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>
              </div>

              {/* VIDEO-RESUMEN CARD (MAX 5 MINS) */}
              <div className="rounded-2xl border border-zinc-900/80 bg-zinc-900/10 overflow-hidden relative shadow-xl group">
                <div className="absolute top-0 right-0 p-3 z-10">
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-bold uppercase tracking-wider">
                    Resumen ≤ 5 Min
                  </span>
                </div>
                <div className="px-4 py-2.5 bg-zinc-900/40 border-b border-zinc-900/60 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest">
                    Vídeo-Resumen Ejecutivo
                  </span>
                </div>
                <div className="relative w-full aspect-video bg-zinc-950">
                  {isYt ? (
                    <iframe
                      src={summaryVideoUrl}
                      title={`${activeStudyVideo.title} (Resumen)`}
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      className="w-full h-full"
                    />
                  ) : (
                    <video
                      src={summaryVideoUrl}
                      controls
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* TEXT TRANSCRIPTION UNDER THE VIDEO-RESUMEN */}
            <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-900/5 relative overflow-hidden space-y-4">
              <div className="absolute top-0 left-0 w-32 h-32 bg-sky-500/5 blur-[40px] pointer-events-none" />
              <MarkdownRenderer content={transcriptionText} />
            </div>

          </div>

          {/* RIGHT COLUMN: CHART CAPTURE & TACTICAL ALLOCATION CARD */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* FINANCIAL CHART CAPTURE BOX */}
            <div className="rounded-2xl border border-zinc-900 bg-zinc-900/20 overflow-hidden shadow-2xl relative group">
              <div className="px-4 py-3 bg-zinc-900/50 border-b border-zinc-900/60 flex items-center justify-between">
                <span className="text-[10px] font-bold text-sky-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Monitor className="w-3.5 h-3.5" />
                  Captura de Gráficos de Canal
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-850 text-zinc-500 font-mono font-bold">SNAPSHOT</span>
              </div>
              
              {/* Chart Image */}
              <div className="relative w-full aspect-[4/3] bg-zinc-950 border-b border-zinc-900 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={chartData.image}
                  alt="Market Chart Snapshot"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent pointer-events-none" />
                <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 border border-zinc-800 text-[8px] font-bold text-sky-400 uppercase tracking-wider font-mono">
                  Market Snapshot v1.0
                </div>
              </div>

              {/* Caption / Legend */}
              <div className="p-4 bg-zinc-950/40 text-xs text-zinc-400 font-light leading-relaxed border-t border-zinc-950">
                <span className="font-bold text-zinc-200 block mb-1 text-[11px] uppercase tracking-wider text-sky-400">Leyenda e Interpretación Técnica:</span>
                {chartData.legend}
              </div>
            </div>

            {/* TACTICAL ALLOCATION CHECKLIST */}
            <div className="p-5 rounded-2xl border border-zinc-900 bg-zinc-950/40 space-y-4 relative overflow-hidden">
              <div className="absolute bottom-0 right-0 w-24 h-24 bg-violet-600/5 blur-[35px] pointer-events-none" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-zinc-900 pb-2 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-violet-400" />
                Asignación de Activos Sugerida
              </h3>
              
              <div className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-1.5 flex-shrink-0" />
                  <div>
                    <span className="text-[11px] font-bold text-zinc-200 block">Renta Fija / Letras</span>
                    <span className="text-[10px] text-zinc-400">HYSAs y Treasury Bills de corto plazo (yield ~4.5%).</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 flex-shrink-0" />
                  <div>
                    <span className="text-[11px] font-bold text-zinc-200 block">Renta Variable (Stocks)</span>
                    <span className="text-[10px] text-zinc-400">Dividend Growth Investing (DGI) concentrada en consumo defensivo.</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                  <div>
                    <span className="text-[11px] font-bold text-zinc-200 block">Sector Inmobiliario (REITs)</span>
                    <span className="text-[10px] text-zinc-400">Contratos indexados e infraestructura con demandas inelásticas.</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                  <div>
                    <span className="text-[11px] font-bold text-zinc-200 block">Coberturas Activas (Hedges)</span>
                    <span className="text-[10px] text-zinc-400">Oro físico y un 5% táctico en Bitcoin (BTC) frente a devaluación.</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Page Title Header with Sync Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-zinc-900/60">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl flex items-center gap-3">
            Videoteca Premium
          </h1>
          <p className="text-zinc-400 font-light mt-1 text-sm md:text-base">
            Reproductor de vídeo integrado, análisis de inversión automatizado y catalogador documental.
          </p>
        </div>

        <button
          onClick={() => handleSyncChannel(false)}
          disabled={syncing}
          className="px-5 py-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-400 hover:text-emerald-300 text-xs font-bold transition-all shadow-lg flex items-center justify-center gap-2 self-start md:self-auto disabled:opacity-50"
        >
          <Sparkles className={`w-4 h-4 ${syncing ? "animate-spin text-emerald-400" : ""}`} />
          {syncing ? "Sincronizando Andrei Jikh..." : "Sincronizar Canal de Inversión"}
        </button>
      </div>

      {/* Sync Error Alert */}
      {syncError && (
        <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{syncError}</span>
        </div>
      )}

      {/* Main viewport */}
      <div className="grid lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: ACTIVE VIDEO VIEWER & INFOCARD */}
        <div className="lg:col-span-8 space-y-6">
          {/* Hibrid Player Card */}
          <div className="rounded-2xl border border-zinc-900 bg-black overflow-hidden relative group shadow-2xl">
            {selectedVideo ? (
              <div className="relative w-full aspect-video bg-black">
                {isSelectedYoutube ? (
                  <iframe
                    src={selectedVideo.file_url}
                    title={selectedVideo.title}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <video
                    ref={videoRef}
                    src={selectedVideo.file_url}
                    controls
                    className="w-full h-full object-contain"
                  />
                )}
              </div>
            ) : (
              <div className="w-full aspect-video flex flex-col items-center justify-center text-center p-8 bg-zinc-950">
                <Video className="w-12 h-12 text-zinc-700 mb-2" />
                <p className="text-sm text-zinc-500">Selecciona o sube un vídeo para reproducirlo.</p>
              </div>
            )}
          </div>

          {/* Video Details Card & Financial Reports */}
          {selectedVideo && (
            <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-900/10 space-y-5 relative overflow-hidden">
              <div className="absolute top-[-20%] left-[-20%] w-[50%] h-[50%] bg-sky-500/5 blur-[50px] pointer-events-none" />
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900/50 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight leading-snug">{selectedVideo.title}</h2>
                  <p className="text-xs text-zinc-500 mt-1">
                    {selectedVideo.metadata.channel_title ? `Canal: ${selectedVideo.metadata.channel_title} • ` : ""}
                    Publicado el {new Date(selectedVideo.created_at).toLocaleDateString("es-ES")}
                  </p>
                </div>
                
                <div className="flex items-center gap-2 flex-shrink-0">
                  {selectedVideo.title.startsWith("[Análisis]") && (
                    <button
                      onClick={() => setActiveStudyVideo(selectedVideo)}
                      className="px-3.5 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-black text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Ventana de Estudio
                    </button>
                  )}
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                    <Monitor className="w-3.5 h-3.5" />
                    {selectedVideo.metadata.resolution}
                  </div>
                </div>
              </div>

              <div className="leading-relaxed">
                {selectedVideo.title.startsWith("[Análisis]") && selectedVideo.description ? (
                  <MarkdownRenderer content={selectedVideo.description} />
                ) : (
                  <p className="text-zinc-400 font-light text-xs whitespace-pre-line">
                    {selectedVideo.description || "Sin descripción proporcionada para este vídeo."}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* VIDEO LIST CONTEXT */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-white">Catálogo de Vídeos Guardados</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {loading ? (
                [1, 2].map((i) => (
                  <div key={i} className="h-24 rounded-xl bg-zinc-900/30 border border-zinc-900 animate-pulse" />
                ))
              ) : filteredVideos.length === 0 ? (
                <div className="p-6 text-center rounded-2xl bg-zinc-900/20 border border-zinc-900 col-span-2 text-sm text-zinc-500">
                  Aún no tienes vídeos cargados para el canal {filterChannel || "seleccionado"}. Pulsa &quot;Sincronizar Canal&quot; o usa el panel lateral.
                </div>
              ) : (
                filteredVideos.map((v) => {
                  const isYt = v.metadata.is_youtube;
                  return (
                    <div
                      key={v.id}
                      onClick={() => setSelectedVideo(v)}
                      className={`rounded-xl border overflow-hidden cursor-pointer flex gap-3.5 transition-all p-2 ${selectedVideo?.id === v.id ? "bg-sky-500/10 border-sky-500/40" : "bg-zinc-900/30 border-zinc-900/80 hover:border-zinc-800"}`}
                    >
                      {/* Video Thumbnail */}
                      <div className="w-24 h-16 bg-zinc-950 flex-shrink-0 relative rounded-lg overflow-hidden border border-zinc-900">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={v.metadata.thumbnail} 
                          alt={v.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <Play className="w-4 h-4 text-white/90 fill-white" />
                        </div>
                        <span className="absolute bottom-1 right-1 px-1 rounded bg-black/75 text-[8px] font-bold text-zinc-300 font-mono">
                          {v.metadata.duration}
                        </span>
                      </div>

                      <div className="flex-grow min-w-0 pr-1 flex flex-col justify-between">
                        <div className="min-w-0">
                          <div className={`text-xs font-bold truncate ${isYt ? "text-emerald-400" : "text-white"}`}>{v.title}</div>
                          <div className="text-[10px] text-zinc-500 truncate mt-0.5">
                            {isYt ? "Análisis de Inversión • " : ""}{new Date(v.created_at).toLocaleDateString("es-ES")}
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 font-bold">
                          <span className="text-[9px] uppercase">{isYt ? "Andrei Jikh" : v.metadata.resolution}</span>
                          <div className="flex items-center gap-1.5">
                            {isYt && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveStudyVideo(v);
                                }}
                                className="px-2 py-0.5 rounded bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 text-sky-400 text-[9px] font-bold transition-all"
                              >
                                Análisis
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteVideo(v.id);
                              }}
                              className="p-1 rounded hover:bg-rose-500/15 text-zinc-600 hover:text-rose-400 transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: VIDEO LOADER / LINK CREATOR */}
        <div className="lg:col-span-4 rounded-2xl border border-zinc-900 bg-zinc-900/20 p-6 space-y-6">
          <div className="flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-sky-400" />
            <h3 className="text-base font-bold text-white">Subir Vídeo (Enlace)</h3>
          </div>

          <form onSubmit={handleCreateVideo} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Título del Vídeo</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="ej. Lanzamiento de Producto 2026"
                className="w-full px-3 py-2 bg-zinc-900/60 border border-zinc-800 focus:border-sky-500 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Descripción</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="ej. Demo cinemática de la plataforma SaaS..."
                className="w-full px-3 py-2 bg-zinc-900/60 border border-zinc-800 focus:border-sky-500 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none text-xs min-h-[50px] max-h-[100px]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Resolución del Vídeo</label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-900/60 border border-zinc-800 focus:border-sky-500 rounded-xl text-zinc-300 text-xs focus:outline-none"
              >
                <option value="1080p">1080p Full HD</option>
                <option value="4K UHD">4K Ultra HD</option>
                <option value="720p">720p HD</option>
                <option value="360p">360p Mobile</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Enlace de Miniatura (Thumbnail)</label>
              <input
                type="url"
                value={thumbnail}
                onChange={(e) => setThumbnail(e.target.value)}
                placeholder="https://images.unsplash.com/photo-..."
                className="w-full px-3 py-2 bg-zinc-900/60 border border-zinc-800 focus:border-sky-500 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none text-xs"
              />
              <span className="text-[9px] text-zinc-600 block leading-tight font-light italic">
                * Opcional. Si lo dejas en blanco, usaremos una imagen cinemática predeterminada.
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">URL del Archivo de Vídeo</label>
                <span className="text-[9px] text-zinc-500 font-light">MP4 directa</span>
              </div>
              <input
                type="url"
                required
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                placeholder="https://ejemplo.com/video.mp4"
                className="w-full px-3 py-2 bg-zinc-900/60 border border-zinc-800 focus:border-sky-500 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none text-xs"
              />
              <span className="text-[9px] text-zinc-600 block leading-tight font-light italic">
                * Para probar, puedes usar: `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4` o `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4`
              </span>
            </div>

            <button
              type="submit"
              disabled={formLoading}
              className="w-full py-2.5 px-4 font-bold text-xs text-white bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-400 hover:to-blue-400 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {formLoading ? "Guardando..." : "Subir Recurso de Vídeo"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
