"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { translations } from "@/lib/translations";
import Link from "next/link";
import { 
  Heart, Loader2, Play, EyeOff, Calendar, Video, BarChart2, MessageSquare, ArrowRight, Trash2, ArrowUpRight
} from "lucide-react";

interface FavoriteChartDocument {
  id: string;
  user_id: string;
  type: "favorite_chart";
  title: string;
  description?: string;
  file_url: string;
  created_at: string;
  metadata: {
    video_id: string;
    video_title: string;
    channel_title: string;
    seconds: number;
    endSeconds: number | null;
    bullets: string[];
    legend: string;
    timestamp: string;
  };
}

function getYoutubeId(url?: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

export default function FavoriteChartsPage() {
  const [favoriteCharts, setFavoriteCharts] = useState<FavoriteChartDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("en");

  // Load language settings on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("hivex_selected_language") || "en";
      setSelectedLanguage(saved);
    }
  }, []);

  // Listen for global language changes
  useEffect(() => {
    const handleLangChangedEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && typeof customEvent.detail === "string") {
        setSelectedLanguage(customEvent.detail);
      }
    };
    window.addEventListener("languageChanged", handleLangChangedEvent);
    return () => {
      window.removeEventListener("languageChanged", handleLangChangedEvent);
    };
  }, []);

  const lang = selectedLanguage || "en";
  const t = translations[lang] || translations["en"];

  // Fetch favorite charts from Supabase
  const fetchFavoriteCharts = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("type", "favorite_chart")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFavoriteCharts((data || []) as FavoriteChartDocument[]);
    } catch (err) {
      console.error("Failed to fetch favorite charts:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFavoriteCharts();
  }, [fetchFavoriteCharts]);

  // Toggle/remove favorite chart
  const handleRemoveFavorite = async (chart: FavoriteChartDocument, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Optimistic UI state update
    setFavoriteCharts(prev => prev.filter(c => c.id !== chart.id));

    try {
      const { error } = await supabase
        .from("documents")
        .delete()
        .eq("id", chart.id);

      if (error) throw error;
      console.log(`Unfavorited chart successfully: ${chart.title}`);
    } catch (err) {
      console.error("Failed to remove favorite chart:", err);
      // Re-fetch to sync state in case of error
      fetchFavoriteCharts();
    }
  };

  // Render i18n text helper
  const getText = (key: string, fallback: string) => {
    if (lang === "es") {
      if (key === "title") return "Charts Favoritos";
      if (key === "subtitle") return "Análisis bursátiles y gráficos clave guardados de tus sesiones de estudio.";
      if (key === "noFavorites") return "No tienes gráficos favoritos guardados.";
      if (key === "exploreCall") return "Explora la cabina de estudio dentro de cualquier vídeo y pulsa el icono de corazón para guardarlo aquí.";
      if (key === "playButton") return "Ir a Estudio";
      if (key === "keyTakeaway") return "Conclusión Clave:";
      if (key === "videoSource") return "Vídeo de origen:";
    }
    if (lang === "de") {
      if (key === "title") return "Favoriten-Charts";
      if (key === "subtitle") return "Gespeicherte Börsenanalysen und wichtige Grafiken aus Ihren Studiensitzungen.";
      if (key === "noFavorites") return "Sie haben keine gespeicherten Favoriten-Charts.";
      if (key === "exploreCall") return "Erkunden Sie die Studiokabine eines beliebigen Videos und klicken Sie auf das Herz-Symbol, um es hier zu speichern.";
      if (key === "playButton") return "Zum Studio";
      if (key === "keyTakeaway") return "Fazit:";
      if (key === "videoSource") return "Quellvideo:";
    }
    if (lang === "tr") {
      if (key === "title") return "Favori Grafikler";
      if (key === "subtitle") return "Çalışma odası oturumlarınızdan kaydedilen borsa analizleri ve temel grafikler.";
      if (key === "noFavorites") return "Kaydedilmiş favori grafiğiniz bulunmuyor.";
      if (key === "exploreCall") return "Herhangi bir videonun içindeki çalışma odasını keşfedin ve buraya kaydetmek için kalp simgesine tıklayın.";
      if (key === "playButton") return "Çalışmaya Git";
      if (key === "keyTakeaway") return "Ana Sonuç:";
      if (key === "videoSource") return "Kaynak Video:";
    }
    return fallback;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 lg:p-10 space-y-10">
      {/* Premium Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-zinc-900/60">
        <div>
          <div className="flex items-center gap-3 mb-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-rose-500/20 to-violet-500/20 border border-rose-500/30 text-rose-400 shadow-md">
              <Heart className="w-5 h-5 fill-current animate-pulse-subtle" />
            </div>
            <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-white uppercase bg-clip-text bg-gradient-to-r from-white via-zinc-200 to-zinc-400">
              {getText("title", "Favorite Charts")}
            </h1>
          </div>
          <p className="text-zinc-500 text-sm max-w-2xl font-medium">
            {getText("subtitle", "Key stock charts and market analysis saved from your interactive study sessions.")}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-10 h-10 text-rose-500 animate-spin" />
          <p className="text-xs font-black tracking-widest text-zinc-500 uppercase">
            {lang === "es" ? "Cargando biblioteca de gráficos..." : "Loading charts library..."}
          </p>
        </div>
      ) : favoriteCharts.length === 0 ? (
        /* Empty State */
        <div className="max-w-xl mx-auto py-20 text-center space-y-6">
          <div className="relative inline-flex items-center justify-center">
            <div className="absolute inset-0 bg-rose-500/10 rounded-full blur-2xl w-24 h-24 mx-auto" />
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600 relative">
              <Heart className="w-8 h-8" />
              <EyeOff className="w-4 h-4 absolute -bottom-1 -right-1 text-zinc-500 bg-zinc-950 rounded-full p-0.5 border border-zinc-800" />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-extrabold text-zinc-300">
              {getText("noFavorites", "No saved favorite charts.")}
            </h3>
            <p className="text-zinc-500 text-xs leading-relaxed max-w-md mx-auto">
              {getText("exploreCall", "Explore the Study Cabin on any video page and click the heart icon next to any chart to save it here for instant premium access.")}
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/dashboard/videos"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-xs font-bold text-zinc-300 hover:text-white border border-zinc-800 transition-all duration-200"
            >
              <span>{lang === "es" ? "Ver Catálogo de Vídeos" : "Browse Video Catalog"}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      ) : (
        /* Grid of Favorite Charts */
        <div className="grid grid-cols-1 gap-8">
          {favoriteCharts.map((chart) => {
            const videoId = chart.metadata.video_id;
            const targetTime = chart.metadata.seconds;
            const endSeconds = chart.metadata.endSeconds;
            const fileUrl = chart.file_url;
            const isYt = fileUrl.includes("youtube.com") || fileUrl.includes("youtu.be");
            const ytId = getYoutubeId(fileUrl);
            
            // Build the exact deep linked video URL to play starting at specific chart
            const deepLinkUrl = `/dashboard/videos?id=${videoId}&start=${targetTime}${endSeconds ? `&end=${endSeconds}` : ""}`;

            // Build snapshot image path
            const snapshotPath = `/snapshots/${videoId}/${targetTime}.jpg`;
            // Standard fallback is YouTube high quality thumbnail
            const fallbackThumbnail = ytId 
              ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
              : "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80";

            return (
              <div 
                key={chart.id} 
                className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center p-6 rounded-2xl border border-zinc-900 bg-zinc-950/40 backdrop-blur-md hover:border-zinc-800/80 hover:bg-zinc-950/60 transition-all duration-300 relative group"
              >
                {/* Left Column: Visual Snapshot (4 cols) */}
                <div className="lg:col-span-4 w-full h-full relative">
                  <Link href={deepLinkUrl}>
                    <div className="relative aspect-[16/9] w-full rounded-xl overflow-hidden border border-zinc-900 group-hover:border-zinc-800 shadow-md bg-zinc-950 cursor-pointer group/thumb">
                      <img
                        src={snapshotPath}
                        alt={chart.title}
                        onError={(e) => {
                          // Fallback to youtube thumbnail if local snapshot fails
                          (e.currentTarget as HTMLImageElement).src = fallbackThumbnail;
                        }}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover/thumb:scale-102"
                      />
                      {/* Premium Hover Play overlay */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                        <div className="p-3 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-400 backdrop-blur-md transform scale-90 group-hover/thumb:scale-100 transition-all duration-300 shadow-lg">
                          <Play className="w-5 h-5 fill-current" />
                        </div>
                      </div>
                      
                      {/* Video Channel Info Tag */}
                      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2 py-1 rounded bg-black/85 border border-zinc-800 backdrop-blur-sm text-[9px] font-bold text-zinc-400">
                        <Video className="w-3 h-3 text-rose-400" />
                        <span className="truncate max-w-[100px]">{chart.metadata.channel_title}</span>
                      </div>

                      {/* Timestamp Tag */}
                      <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 px-2 py-0.5 rounded bg-black/85 border border-zinc-800 backdrop-blur-sm text-[9px] font-bold text-emerald-400">
                        <span>{chart.metadata.timestamp}</span>
                      </div>
                    </div>
                  </Link>
                </div>

                {/* Right Column: Metadata (8 cols) */}
                <div className="lg:col-span-8 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-[10px] font-black tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full uppercase">
                          {chart.metadata.timestamp}
                        </span>
                        <span className="text-[9px] font-black tracking-widest text-zinc-500 bg-zinc-900/80 px-2 py-0.5 rounded-full uppercase">
                          {lang === "es" ? "Gráfico Detectado" : lang === "de" ? "Grafik Erkannt" : lang === "tr" ? "Grafik Tespit Edildi" : "Chart Detected"}
                        </span>
                      </div>
                      <h4 className="text-base font-black text-white tracking-tight leading-snug">
                        {chart.title}
                      </h4>
                    </div>

                    {/* Actions Panel */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Play / Redirect Button */}
                      <Link
                        href={deepLinkUrl}
                        className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/40 text-rose-400 hover:text-rose-300 text-xs font-black uppercase tracking-wider px-3.5 flex items-center gap-1 transition-all shadow-md"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>{getText("playButton", "Study")}</span>
                      </Link>

                      {/* Remove Favorite Button */}
                      <button
                        onClick={(e) => handleRemoveFavorite(chart, e)}
                        className="p-2 rounded-xl bg-rose-500/5 hover:bg-rose-500/20 border border-rose-500/10 hover:border-rose-500/30 text-rose-500 transition-all shadow-md flex items-center justify-center"
                        title={lang === "es" ? "Quitar de preferidos" : "Remove from favorites"}
                      >
                        <Heart className="w-3.5 h-3.5 fill-current" />
                      </button>
                    </div>
                  </div>

                  {/* Bullet points listing key observations */}
                  {chart.metadata.bullets && chart.metadata.bullets.length > 0 && (
                    <ul className="space-y-2 text-xs text-zinc-400 leading-relaxed font-medium">
                      {chart.metadata.bullets.map((bullet, bIdx) => {
                        const parts = bullet.split(/\*\*([^*]+)\*\*/);
                        return (
                          <li key={bIdx} className="flex items-start gap-2">
                            <span className="text-emerald-500 font-extrabold select-none mt-0.5">•</span>
                            <span>
                              {parts.map((part, pIdx) => 
                                pIdx % 2 === 1 ? <strong key={pIdx} className="text-zinc-100 font-extrabold">{part}</strong> : part
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {/* Conclusion / Key Takeaway */}
                  {chart.metadata.legend && (
                    <p className="text-[11px] text-zinc-500 font-medium italic border-t border-zinc-900/60 pt-3 leading-relaxed text-justify">
                      <span className="text-[10px] not-italic font-black tracking-wider uppercase text-zinc-400 mr-1.5">
                        {getText("keyTakeaway", "Key Takeaway:")}
                      </span>
                      {chart.metadata.legend.replace(/^(leyenda|legend):\s*/i, "")}
                    </p>
                  )}

                  {/* Quellvideo source link */}
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-600 font-bold border-t border-zinc-900/40 pt-2.5">
                    <span>{getText("videoSource", "Source Video:")}</span>
                    <Link 
                      href={`/dashboard/videos?id=${videoId}`}
                      className="text-zinc-500 hover:text-rose-400 transition-colors flex items-center gap-0.5 group/link"
                    >
                      <span className="underline">{chart.metadata.video_title}</span>
                      <ArrowUpRight className="w-3 h-3 opacity-60 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
