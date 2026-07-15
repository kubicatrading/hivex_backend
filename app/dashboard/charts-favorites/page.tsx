"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { translations } from "@/lib/translations";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Heart, Loader2, Play, EyeOff, Video, Trash2, ArrowUpRight, UploadCloud
} from "lucide-react";

interface FavoriteChartDocument {
  id: string;
  user_id: string;
  type: string;
  title: string;
  description?: string;
  file_url: string;
  created_at: string;
  metadata: {
    is_favorite_chart?: boolean;
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

function parseDurationToSeconds(durationStr: string): number {
  if (!durationStr) return 0;
  const parts = durationStr.split(":");
  if (parts.length === 2) {
    const mins = parseInt(parts[0], 10) || 0;
    const secs = parseInt(parts[1], 10) || 0;
    return mins * 60 + secs;
  }
  if (parts.length === 3) {
    const hrs = parseInt(parts[0], 10) || 0;
    const mins = parseInt(parts[1], 10) || 0;
    const secs = parseInt(parts[2], 10) || 0;
    return hrs * 3600 + mins * 60 + secs;
  }
  const val = parseInt(durationStr, 10);
  return isNaN(val) ? 0 : val;
}

export default function FavoriteChartsPage() {
  const router = useRouter();
  const [favoriteCharts, setFavoriteCharts] = useState<FavoriteChartDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("en");

  // Video Creation Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [resolution, setResolution] = useState("1080p");
  const [duration, setDuration] = useState("12:00");
  const [thumbnail, setThumbnail] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [formLoading, setFormLoading] = useState(false);

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
  const vt = t.videos || {};

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
        .eq("type", "chart")
        .eq("user_id", user.id);

      if (error) throw error;

      // Filter and sort manually from most recent to least recent
      const favorited = ((data || []) as FavoriteChartDocument[]).filter(
        (doc) => doc.metadata?.is_favorite_chart === true
      );

      favorited.sort((a, b) => {
        const timeA = Date.parse(a.created_at) || 0;
        const timeB = Date.parse(b.created_at) || 0;
        return timeB - timeA;
      });

      setFavoriteCharts(favorited);
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
      fetchFavoriteCharts();
    }
  };

  // Video Upload Handler
  const handleCreateVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !fileUrl) return;

    const durationSeconds = parseDurationToSeconds(duration);
    if (durationSeconds < 300) {
      alert(
        selectedLanguage === "es"
          ? "⚠️ No cumple las reglas de la cabina de estudio. Los vídeos deben tener una duración mínima de 5 minutos (300 segundos)."
          : selectedLanguage === "de"
          ? "⚠️ Erfüllt nicht die Regeln der Studienkabine. Videos müssen eine Mindestdauer von 5 Minuten (300 Sekunden) haben."
          : selectedLanguage === "tr"
          ? "⚠️ Çalışma kabini kurallarına uymuyor. Videoların en az 5 dakika (300 saniye) uzunluğunda olması gerekir."
          : "⚠️ Does not meet the study cabin rules. Videos must have a minimum duration of 5 minutes (300 seconds)."
      );
      return;
    }

    setFormLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No active user session.");

      const finalThumbnail = thumbnail || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80";

      const newVideo = {
        user_id: user.id,
        title,
        description,
        type: "video",
        file_url: fileUrl,
        metadata: {
          duration,
          resolution,
          thumbnail: finalThumbnail,
          is_youtube: fileUrl.includes("youtube.com") || fileUrl.includes("youtu.be"),
          channel_title: "Manual Upload"
        }
      };

      const { error } = await supabase.from("documents").insert(newVideo);
      if (error) throw error;

      // Clear fields
      setTitle("");
      setDescription("");
      setThumbnail("");
      setFileUrl("");

      // Redirect to catalog page to view it
      router.push("/dashboard/videos");
    } catch (err: any) {
      console.error("Failed to save manual video:", err);
      alert(err.message || "Failed to save video resource.");
    } finally {
      setFormLoading(false);
    }
  };

  // Render i18n text helper
  const getText = (key: string, fallback: string) => {
    if (lang === "es") {
      if (key === "title") return "Charts Favoritos";
      if (key === "subtitle") return "Análisis bursátiles y gráficos clave guardados de tus sesiones de estudio en vídeo.";
      if (key === "noFavorites") return "No tienes gráficos favoritos guardados.";
      if (key === "exploreCall") return "Explora la cabina de estudio dentro de cualquier vídeo y pulsa el icono de corazón para guardarlo aquí.";
      if (key === "playButton") return "Ir a Estudio";
      if (key === "keyTakeaway") return "Conclusión Clave:";
      if (key === "videoSource") return "Vídeo de origen:";
    }
    if (lang === "de") {
      if (key === "title") return "Favoriten-Charts";
      if (key === "subtitle") return "Gespeicherte Börsenanalysen und wichtige Grafiken aus Ihren Studiensitzungen in Video.";
      if (key === "noFavorites") return "Sie haben keine gespeicherten Favoriten-Charts.";
      if (key === "exploreCall") return "Erkunden Sie die Studiokabine eines beliebigen Videos und klicken Sie auf das Herz-Symbol, um es hier zu speichern.";
      if (key === "playButton") return "Zum Studio";
      if (key === "keyTakeaway") return "Fazit:";
      if (key === "videoSource") return "Quellvideo:";
    }
    if (lang === "tr") {
      if (key === "title") return "Favori Grafikler";
      if (key === "subtitle") return "Video çalışma odası oturumlarınızdan kaydedilen borsa analizleri ve temel grafikler.";
      if (key === "noFavorites") return "Kaydedilmiş favori grafiğiniz bulunmuyor.";
      if (key === "exploreCall") return "Herhangi bir videonun içindeki çalışma odasını keşfedin ve buraya kaydetmek için kalp simgesine tıklayın.";
      if (key === "playButton") return "Çalışmaya Git";
      if (key === "keyTakeaway") return "Ana Sonuç:";
      if (key === "videoSource") return "Kaynak Video:";
    }
    return fallback;
  };

  return (
    <div className="space-y-10">
      {/* Page Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-zinc-900/60">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl flex items-center gap-3">
            {getText("title", "Favorite Charts")}
          </h1>
          <p className="text-zinc-400 font-light mt-1 text-sm md:text-base">
            {getText("subtitle", "Key stock charts and market analysis saved from your interactive study sessions.")}
          </p>
        </div>
      </div>

      {/* Main Grid: Left cols 8 for list, Right cols 4 for upload videos matching layout */}
      <div className="grid lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: FAVORITE CHARTS LIST (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center space-y-4 rounded-2xl border border-zinc-900 bg-zinc-950/20">
              <Loader2 className="w-10 h-10 text-rose-500 animate-spin" />
              <p className="text-xs font-black tracking-widest text-zinc-500 uppercase">
                {lang === "es" ? "Cargando biblioteca de gráficos..." : "Loading charts library..."}
              </p>
            </div>
          ) : favoriteCharts.length === 0 ? (
            /* Empty State */
            <div className="py-24 text-center space-y-6 rounded-2xl border border-zinc-900 bg-zinc-950/20">
              <div className="relative inline-flex items-center justify-center">
                <div className="absolute inset-0 bg-rose-500/10 rounded-full blur-2xl w-24 h-24 mx-auto" />
                <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600 relative">
                  <Heart className="w-8 h-8" />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-extrabold text-zinc-300">
                  {getText("noFavorites", "No saved favorite charts.")}
                </h3>
                <p className="text-zinc-500 text-xs leading-relaxed max-w-md mx-auto px-4">
                  {getText("exploreCall", "Explore the Study Cabin on any video page and click the heart icon next to any chart to save it here for instant premium access.")}
                </p>
              </div>
            </div>
          ) : (
            /* List of Favorite Charts */
            <div className="space-y-6">
              {favoriteCharts.map((chart) => {
                const videoId = chart.metadata.video_id;
                const targetTime = chart.metadata.seconds;
                const endSeconds = chart.metadata.endSeconds;
                const fileUrl = chart.file_url;
                const ytId = getYoutubeId(fileUrl);
                
                // Build the exact deep linked video URL to play starting at specific chart
                const deepLinkUrl = `/dashboard/videos?id=${videoId}&start=${targetTime}${endSeconds ? `&end=${endSeconds}` : ""}`;

                // Resolve the folder name in Supabase: YouTube ID if it is a YT video, else DB UUID
                const resolvedFolder = ytId || videoId;
                const snapshotPath = `https://lhtlrztsmkllcqiziftn.supabase.co/storage/v1/object/public/snapshots/${resolvedFolder}/${targetTime}.jpg`;

                // Fallback thumbnail is YouTube high quality, else cinematic stock photo
                const fallbackThumbnail = ytId 
                  ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
                  : "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80";

                return (
                  <div 
                    key={chart.id} 
                    className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center p-6 rounded-2xl border border-zinc-900/60 bg-zinc-950/20 backdrop-blur-md hover:border-zinc-800/80 hover:bg-zinc-950/40 transition-all duration-300 relative group"
                  >
                    {/* Left Snapshot Thumbnail (4 cols) */}
                    <div className="md:col-span-4 w-full h-full relative">
                      <Link href={deepLinkUrl}>
                        <div className="relative aspect-[16/9] w-full rounded-xl overflow-hidden border border-zinc-900 group-hover:border-zinc-850 shadow-md bg-zinc-950 cursor-pointer group/thumb">
                          <img
                            src={snapshotPath}
                            alt={chart.title}
                            onError={(e) => {
                              const img = e.currentTarget as HTMLImageElement;
                              if (!img.dataset.triedProxy) {
                                img.dataset.triedProxy = "true";
                                img.src = `/snapshots/${videoId}/${targetTime}.jpg`;
                              } else {
                                img.src = fallbackThumbnail;
                              }
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
                          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2 py-1 rounded bg-black/85 border border-zinc-850 backdrop-blur-sm text-[9px] font-bold text-zinc-400">
                            <Video className="w-3 h-3 text-rose-400" />
                            <span className="truncate max-w-[100px]">{chart.metadata.channel_title || "Manual Upload"}</span>
                          </div>

                          {/* Timestamp Tag */}
                          <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 px-2 py-0.5 rounded bg-black/85 border border-zinc-850 backdrop-blur-sm text-[9px] font-bold text-emerald-400">
                            <span>{chart.metadata.timestamp}</span>
                          </div>
                        </div>
                      </Link>
                    </div>

                    {/* Right Metadata Information (8 cols) */}
                    <div className="md:col-span-8 space-y-4">
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

                      {/* Video Source details */}
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

        {/* RIGHT COLUMN: VIDEO LOADER / LINK CREATOR (4 cols) */}
        <div className="lg:col-span-4 rounded-2xl border border-zinc-900 bg-zinc-900/20 p-6 space-y-6">
          <div className="flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-sky-400" />
            <h3 className="text-base font-bold text-white">
              {vt.uploadTitle || "Subir Vídeo (Enlace)"}
            </h3>
          </div>

          <form onSubmit={handleCreateVideo} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                {vt.videoTitleLabel || "Título del Vídeo"}
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  selectedLanguage === "es"
                    ? "ej. Lanzamiento de Producto 2026"
                    : selectedLanguage === "de"
                    ? "z.B. Produktvorstellung 2026"
                    : selectedLanguage === "tr"
                    ? "örn. Ürün Tanıtımı 2026"
                    : "e.g., Product Launch 2026"
                }
                className="w-full px-3 py-2 bg-zinc-900/60 border border-zinc-800 focus:border-sky-500 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                {vt.descriptionLabel || "Descripción"}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  selectedLanguage === "es"
                    ? "ej. Demo cinemática de la plataforma SaaS..."
                    : selectedLanguage === "de"
                    ? "z.B. Kinoreife Demo der SaaS-Plattform..."
                    : selectedLanguage === "tr"
                    ? "örn. SaaS platformu sinematik demosu..."
                    : "e.g., Cinematic SaaS platform demo..."
                }
                className="w-full px-3 py-2 bg-zinc-900/60 border border-zinc-800 focus:border-sky-500 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none text-xs min-h-[50px] max-h-[100px]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                {vt.resolutionLabel || "Resolución del Vídeo"}
              </label>
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
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                {vt.durationLabel || "Duración del Vídeo"}
              </label>
              <input
                type="text"
                required
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder={
                  selectedLanguage === "es"
                    ? "ej. 12:00 (Mínimo 5:00)"
                    : selectedLanguage === "de"
                    ? "z.B. 12:00 (Mindestens 5:00)"
                    : selectedLanguage === "tr"
                    ? "örn. 12:00 (En az 5:00)"
                    : "e.g., 12:00 (Minimum 5:00)"
                }
                className="w-full px-3 py-2 bg-zinc-900/60 border border-zinc-800 focus:border-sky-500 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none text-xs"
              />
              <span className="text-[9px] text-zinc-600 block leading-tight font-light italic">
                {selectedLanguage === "es"
                  ? "* Debe ser de al menos 5 minutos (5:00) para poder sincronizarse."
                  : selectedLanguage === "de"
                  ? "* Muss mindestens 5 Minuten (5:00) lang sein, um synchronisiert zu werden."
                  : selectedLanguage === "tr"
                  ? "* Senkronize edilebilmesi için en az 5 dakika (5:00) olmalıdır."
                  : "* Must be at least 5 minutes (5:00) to synchronize."}
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                {vt.thumbnailLabel || "Enlace de Miniatura (Thumbnail)"}
              </label>
              <input
                type="url"
                value={thumbnail}
                onChange={(e) => setThumbnail(e.target.value)}
                placeholder="https://images.unsplash.com/photo-..."
                className="w-full px-3 py-2 bg-zinc-900/60 border border-zinc-800 focus:border-sky-500 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none text-xs"
              />
              <span className="text-[9px] text-zinc-600 block leading-tight font-light italic">
                {selectedLanguage === "es"
                  ? "* Opcional. Si lo dejas en blanco, usaremos una imagen cinemática predeterminada."
                  : selectedLanguage === "de"
                  ? "* Optional. Wenn Sie es leer lassen, verwenden wir ein standardmäßiges kinoreifes Bild."
                  : selectedLanguage === "tr"
                  ? "* İsteğe bağlı. Boş bırakırsanız, varsayılan bir sinematik görsel kullanırız."
                  : "* Optional. If left blank, we will use a default cinematic image."}
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  {selectedLanguage === "es"
                    ? "URL del Archivo de Vídeo"
                    : selectedLanguage === "de"
                    ? "URL der Videodatei"
                    : selectedLanguage === "tr"
                    ? "Video Dosyası URL'si"
                    : "Video File URL"}
                </label>
                <span className="text-[9px] text-zinc-500 font-light">
                  {selectedLanguage === "es"
                    ? "MP4 directa"
                    : selectedLanguage === "de"
                    ? "Direkte MP4"
                    : selectedLanguage === "tr"
                    ? "Doğrudan MP4"
                    : "Direct MP4"}
                </span>
              </div>
              <input
                type="url"
                required
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                placeholder={
                  selectedLanguage === "es"
                    ? "https://ejemplo.com/video.mp4"
                    : selectedLanguage === "de"
                    ? "https://beispiel.de/video.mp4"
                    : selectedLanguage === "tr"
                    ? "https://ornek.com/video.mp4"
                    : "https://example.com/video.mp4"
                }
                className="w-full px-3 py-2 bg-zinc-900/60 border border-zinc-800 focus:border-sky-500 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none text-xs"
              />
              <span className="text-[9px] text-zinc-600 block leading-tight font-light italic">
                {selectedLanguage === "es"
                  ? "* Para probar, puedes usar: `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4` o `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4`"
                  : selectedLanguage === "de"
                  ? "* Zum Testen können Sie verwenden: `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4` oder `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4`"
                  : selectedLanguage === "tr"
                  ? "* Test etmek için şunları kullanabilirsiniz: `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4` veya `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4`"
                  : "* For testing, you can use: `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4` or `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4`"}
              </span>
            </div>

            <button
              type="submit"
              disabled={formLoading}
              className="w-full py-2.5 px-4 font-bold text-xs text-white bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-400 hover:to-blue-400 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {formLoading
                ? (selectedLanguage === "es"
                  ? "Guardando..."
                  : selectedLanguage === "de"
                  ? "Speichern..."
                  : selectedLanguage === "tr"
                  ? "Kaydediliyor..."
                  : "Saving...")
                : (vt.submitBtn || "Subir Recurso de Vídeo")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
