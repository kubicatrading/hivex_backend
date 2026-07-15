"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Calendar, ExternalLink, Globe, Loader2, Info, UploadCloud, CheckCircle2 
} from "lucide-react";

// Local translation dictionary for the Economic Calendar and right panel upload widget
const localTranslations: Record<string, {
  title: string;
  subtitle: string;
  openButton: string;
  sourceText: string;
  loadingText: string;
  disclaimer: string;
  uploadTitle: string;
  videoTitleLabel: string;
  videoTitlePlaceholder: string;
  descriptionLabel: string;
  descriptionPlaceholder: string;
  resolutionLabel: string;
  durationLabel: string;
  durationPlaceholder: string;
  durationDisclaimer: string;
  thumbnailLabel: string;
  thumbnailDisclaimer: string;
  videoUrlLabel: string;
  videoUrlPlaceholder: string;
  videoUrlDisclaimer: string;
  submitBtn: string;
  submitBtnLoading: string;
  successToast: string;
}> = {
  en: {
    title: "Economic Calendar",
    subtitle: "Real-time global macroeconomic events, key indicators, and central bank announcements.",
    openButton: "Open Investing.com",
    sourceText: "Macroeconomic calendar feed powered by Investing.com",
    loadingText: "Loading economic feed...",
    disclaimer: "This calendar is displayed in read-only mode for strategic monitoring.",
    uploadTitle: "Upload Video (Link)",
    videoTitleLabel: "Video Title",
    videoTitlePlaceholder: "e.g., Product Launch 2026",
    descriptionLabel: "Description",
    descriptionPlaceholder: "e.g., Cinematic SaaS platform demo...",
    resolutionLabel: "Video Resolution",
    durationLabel: "Video Duration",
    durationPlaceholder: "e.g., 12:00 (Minimum 5:00)",
    durationDisclaimer: "* Must be at least 5 minutes (5:00) to synchronize.",
    thumbnailLabel: "Thumbnail URL",
    thumbnailDisclaimer: "* Optional. If left blank, we will use a default cinematic image.",
    videoUrlLabel: "Video File URL",
    videoUrlPlaceholder: "https://example.com/video.mp4",
    videoUrlDisclaimer: "* For testing, you can use direct MP4 link.",
    submitBtn: "Upload Video Resource",
    submitBtnLoading: "Saving...",
    successToast: "Video uploaded successfully!"
  },
  es: {
    title: "Calendario Económico",
    subtitle: "Eventos macroeconómicos globales en tiempo real, indicadores clave y anuncios de bancos centrales.",
    openButton: "Abrir Investing.com",
    sourceText: "Calendario macroeconómico proporcionado por Investing.com",
    loadingText: "Cargando calendario económico...",
    disclaimer: "Este calendario se muestra en modo de solo lectura para el seguimiento estratégico.",
    uploadTitle: "Subir Vídeo (Enlace)",
    videoTitleLabel: "Título del Vídeo",
    videoTitlePlaceholder: "ej. Lanzamiento de Producto 2026",
    descriptionLabel: "Descripción",
    descriptionPlaceholder: "ej. Demo cinemática de la plataforma SaaS...",
    resolutionLabel: "Resolución del Vídeo",
    durationLabel: "Duración del Vídeo",
    durationPlaceholder: "ej. 12:00 (Mínimo 5:00)",
    durationDisclaimer: "* Debe ser de al menos 5 minutos (5:00) para poder sincronizarse.",
    thumbnailLabel: "Enlace de Miniatura (Thumbnail)",
    thumbnailDisclaimer: "* Opcional. Si lo dejas en blanco, usaremos una imagen cinemática predeterminada.",
    videoUrlLabel: "URL del Archivo de Vídeo",
    videoUrlPlaceholder: "https://ejemplo.com/video.mp4",
    videoUrlDisclaimer: "* Para probar, puedes usar un enlace MP4 directo.",
    submitBtn: "Subir Recurso de Vídeo",
    submitBtnLoading: "Guardando...",
    successToast: "¡Vídeo subido con éxito!"
  },
  de: {
    title: "Wirtschaftskalender",
    subtitle: "Globale makroökonomische Ereignisse in Echtzeit, Schlüsselindikatoren und Ankündigungen der Zentralbanken.",
    openButton: "Investing.com öffnen",
    sourceText: "Makroökonomischer Kalender von Investing.com",
    loadingText: "Lade Wirtschaftskalender...",
    disclaimer: "Dieser Kalender wird im schreibgeschützten Modus zur strategischen Überwachung angezeigt.",
    uploadTitle: "Video hochladen (Link)",
    videoTitleLabel: "Videotitel",
    videoTitlePlaceholder: "z.B. Produktvorstellung 2026",
    descriptionLabel: "Beschreibung",
    descriptionPlaceholder: "z.B. Kinoreife Demo der SaaS-Plattform...",
    resolutionLabel: "Videoauflösung",
    durationLabel: "Videodauer",
    durationPlaceholder: "z.B. 12:00 (Mindestens 5:00)",
    durationDisclaimer: "* Muss mindestens 5 Minuten (5:00) lang sein, um synchronisiert zu werden.",
    thumbnailLabel: "Vorschubild-Link",
    thumbnailDisclaimer: "* Optional. Wenn Sie es leer lassen, verwenden wir ein standardmäßiges kinoreifes Bild.",
    videoUrlLabel: "Videodatei-URL",
    videoUrlPlaceholder: "https://beispiel.de/video.mp4",
    videoUrlDisclaimer: "* Zum Testen können Sie eine direkte MP4-Verbindung verwenden.",
    submitBtn: "Video-Ressource hochladen",
    submitBtnLoading: "Speichern...",
    successToast: "Video erfolgreich hochgeladen!"
  },
  tr: {
    title: "Ekonomik Takvim",
    subtitle: "Gerçek zamanlı küresel makroekonomik olaylar, temel göstergeler ve merkez bankası duyuruları.",
    openButton: "Investing.com'u Aç",
    sourceText: "Investing.com tarafından sağlanan makroekonomik takvim akışı",
    loadingText: "Ekonomik takvim yükleniyor...",
    disclaimer: "Bu takvim, stratejik izleme amacıyla yalnızca okunabilir modda görüntülenir.",
    uploadTitle: "Video Yükle (Bağlantı)",
    videoTitleLabel: "Video Başlığı",
    videoTitlePlaceholder: "örn. Ürün Tanıtımı 2026",
    descriptionLabel: "Açıklama",
    descriptionPlaceholder: "örn. SaaS platformu sinematik demosu...",
    resolutionLabel: "Video Çözünürlüğü",
    durationLabel: "Video Süresi",
    durationPlaceholder: "örn. 12:00 (En az 5:00)",
    durationDisclaimer: "* Senkronize edilebilmesi için en az 5 dakika (5:00) olmalıdır.",
    thumbnailLabel: "Küçük Resim Bağlantısı",
    thumbnailDisclaimer: "* İsteğe bağlı. Boş bırakırsanız, varsayılan bir sinematik görsel kullanırız.",
    videoUrlLabel: "Video Dosyası URL'si",
    videoUrlPlaceholder: "https://ornek.com/video.mp4",
    videoUrlDisclaimer: "* Test etmek için doğrudan MP4 linki kullanabilirsiniz.",
    submitBtn: "Video Kaynağı Yükle",
    submitBtnLoading: "Kaydediliyor...",
    successToast: "Video başarıyla yüklendi!"
  }
};

// Comprehensive Spanish transcription helper for duration parsing
function parseDurationToSeconds(durationStr?: string): number {
  if (!durationStr) return 720;
  const parts = durationStr.split(":").map(p => parseInt(p, 10));
  if (parts.some(isNaN)) return 720;
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 1) {
    return parts[0];
  }
  return 720;
}

export default function EconomicCalendarPage() {
  const [selectedLanguage, setSelectedLanguage] = useState<string>("en");
  const [iframeLoaded, setIframeLoaded] = useState<boolean>(false);
  const [deviceType, setDeviceType] = useState<"mobile" | "tablet" | "desktop">("desktop");

  // Video Upload States (matching videos page layout)
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [thumbnail, setThumbnail] = useState("");
  const [resolution, setResolution] = useState("1080p");
  const [duration, setDuration] = useState("12:00");
  const [formLoading, setFormLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Initialize language from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("hivex_selected_language") || "en";
      setSelectedLanguage(saved);
    }
  }, []);

  // Dynamically detect screen width to configure optimal table columns for mobile/tablet/desktop
  useEffect(() => {
    if (typeof window !== "undefined") {
      const handleResize = () => {
        const width = window.innerWidth;
        if (width < 480) {
          setDeviceType("mobile");
        } else if (width < 768) {
          setDeviceType("tablet");
        } else {
          setDeviceType("desktop");
        }
      };
      handleResize();
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);

  // Listen to global language changed event
  useEffect(() => {
    const handleLangChangedEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && typeof customEvent.detail === "string") {
        setSelectedLanguage(customEvent.detail);
        setIframeLoaded(false); // Reload iframe with new language
      }
    };
    window.addEventListener("languageChanged", handleLangChangedEvent);
    return () => {
      window.removeEventListener("languageChanged", handleLangChangedEvent);
    };
  }, []);

  // Force re-skeleton transition when device columns layout changes
  useEffect(() => {
    setIframeLoaded(false);
  }, [deviceType]);

  // Toast self-dismiss timer
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const t = localTranslations[selectedLanguage] || localTranslations["en"];

  // Mapping to Investing.com language parameters
  const getLangParam = (lang: string) => {
    switch (lang) {
      case "es": return "5";
      case "de": return "4";
      case "tr": return "10";
      default: return "1";
    }
  };

  // Mapping to appropriate Investing.com full URLs
  const getExternalUrl = (lang: string) => {
    return lang === "es" 
      ? "https://es.investing.com/economic-calendar" 
      : `https://www.investing.com/economic-calendar/`;
  };

  // Custom columns parameter to keep the iframe 100% responsive and scroll-free
  const getColumnsParam = (device: "mobile" | "tablet" | "desktop") => {
    if (device === "mobile") {
      return "exc_currency,exc_importance,exc_actual,exc_previous";
    }
    if (device === "tablet") {
      return "exc_currency,exc_importance,exc_actual,exc_forecast,exc_previous";
    }
    return "exc_flags,exc_currency,exc_importance,exc_actual,exc_forecast,exc_previous";
  };

  // Dynamic zoom styles via CSS scale to completely fit all columns on smaller devices
  const getIframeStyle = () => {
    if (deviceType === "mobile") {
      return {
        transform: "scale(0.88)",
        transformOrigin: "top left",
        width: "113.6%",
        height: "113.6%",
      };
    }
    if (deviceType === "tablet") {
      return {
        transform: "scale(0.95)",
        transformOrigin: "top left",
        width: "105.2%",
        height: "105.2%",
      };
    }
    return {
      width: "100%",
      height: "100%",
    };
  };

  // Handle video submission (inserts into documents, just like the study cabin form)
  const handleCreateVideoOnCalendar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !fileUrl) return;

    // Enforce strict duration limit (>= 5 minutes = 300 seconds)
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
          is_youtube: false,
          channel_title: "Manual Upload"
        }
      };

      const { error } = await supabase.from("documents").insert(newVideo);
      if (error) throw error;

      // Reset form fields
      setTitle("");
      setDescription("");
      setFileUrl("");
      setThumbnail("");
      setResolution("1080p");
      setDuration("12:00");
      
      // Trigger success feedback
      setToastMessage(t.successToast);
    } catch (err) {
      console.error("Failed to insert video on calendar page:", err);
    } finally {
      setFormLoading(false);
    }
  };

  const iframeUrl = `https://sslecal2.forexprostools.com/?columns=${getColumnsParam(deviceType)}&importance=1,2,3&features=datepicker,timezone&calType=week&timeZone=58&lang=${getLangParam(selectedLanguage)}`;

  return (
    <div className="animate-fade-in relative">
      {/* Toast Notification for premium feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-950 border border-emerald-500/30 text-emerald-300 text-xs font-bold shadow-2xl shadow-emerald-950/50 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Responsive Grid Layout to match Videos & Favorites dashboard layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: THE COMPACT CALENDAR TABLE (lg:col-span-8) */}
        <div className="-mx-4 sm:mx-0 lg:col-span-8 space-y-3 sm:space-y-4">
          
          {/* COMPACT MINIMALIST HEADER */}
          <div className="flex items-center justify-between gap-4 pb-3 border-b border-zinc-900/60 px-4 sm:px-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-violet-950/40 border border-violet-900/20">
                <Calendar className="w-4 h-4 text-violet-400" />
              </div>
              <div>
                <h1 className="text-base font-black tracking-tight text-white flex items-center gap-2">
                  {t.title}
                  <span className="text-[9px] font-mono tracking-widest text-violet-400/80 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full uppercase">Macro</span>
                </h1>
              </div>
            </div>

            {/* COMPACT ACTION BUTTON */}
            <a
              href={getExternalUrl(selectedLanguage)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-all duration-300 text-xs font-bold shadow-md shadow-black/30 group"
            >
              <span>{t.openButton}</span>
              <ExternalLink className="w-3 h-3 text-zinc-500 group-hover:text-violet-400 transition-all" />
            </a>
          </div>

          {/* FULLSCREEN IFRAME CONTAINER - STRIPPED TO BORDERLESS EDGE-TO-EDGE ON MOBILE */}
          <div className="relative w-full rounded-none sm:rounded-2xl border-x-0 border-y sm:border border-zinc-900/80 bg-zinc-950 sm:bg-zinc-950/50 backdrop-blur-md overflow-hidden shadow-none sm:shadow-2xl sm:shadow-black/80 flex flex-col">
            {/* Iframe header mimic - Desktop only */}
            <div className="hidden sm:flex w-full h-9 bg-zinc-900/30 border-b border-zinc-900/60 px-4 items-center justify-between">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500/40" />
                <span className="w-2 h-2 rounded-full bg-amber-500/40" />
                <span className="w-2 h-2 rounded-full bg-emerald-500/40" />
              </div>
              <span className="text-[9px] font-mono tracking-widest text-zinc-500">SECURE CONSOLE</span>
              <span className="text-[9px] font-mono text-zinc-600 bg-zinc-900/50 px-2 py-0.5 rounded border border-zinc-800/40 uppercase">GMT+1 Timezone</span>
            </div>

            {/* Dynamic skeleton loader */}
            {!iframeLoaded && (
              <div className="absolute inset-0 top-0 sm:top-9 bg-zinc-950 z-20 flex flex-col items-center justify-center space-y-3">
                <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
                <p className="text-zinc-500 text-[10px] font-mono tracking-wide animate-pulse">{t.loadingText}</p>
              </div>
            )}

            {/* Embed Frame - Full-screen height on mobile to fill viewport */}
            <div className="w-full h-[calc(100vh-195px)] sm:h-[700px] overflow-x-hidden overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
              <iframe
                src={iframeUrl}
                onLoad={() => setIframeLoaded(true)}
                style={getIframeStyle()}
                className="border-0 sm:rounded-b-2xl bg-zinc-950"
                scrolling="yes"
                title="Economic Calendar Feed"
              />
            </div>
          </div>

          {/* COMPANION INFO BANNER - PLACE AT THE BOTTOM AS FOOTER WITH MOBILE MARGINS */}
          <div className="flex items-start gap-2.5 p-3 mx-4 sm:mx-0 rounded-xl bg-violet-950/5 border border-violet-900/10 text-violet-300/60 text-[10px] font-medium leading-normal">
            <Info className="w-3.5 h-3.5 text-violet-400/80 flex-shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p>{t.disclaimer}</p>
              <p className="text-zinc-600 font-mono text-[9px]">{t.sourceText}</p>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: VIDEO LOADER / LINK CREATOR - MATCHES VIDEOS PAGE DESIGN (lg:col-span-4, hidden on mobile) */}
        <div className="hidden lg:block lg:col-span-4 rounded-2xl border border-zinc-900 bg-zinc-900/20 p-6 space-y-6 h-fit sticky top-[100px] shadow-lg shadow-black/40">
          <div className="flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-sky-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              {t.uploadTitle}
            </h3>
          </div>

          <form onSubmit={handleCreateVideoOnCalendar} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                {t.videoTitleLabel}
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t.videoTitlePlaceholder}
                className="w-full px-3 py-2 bg-zinc-900/60 border border-zinc-800 focus:border-sky-500 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none text-xs transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                {t.descriptionLabel}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t.descriptionPlaceholder}
                className="w-full px-3 py-2 bg-zinc-900/60 border border-zinc-800 focus:border-sky-500 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none text-xs min-h-[50px] max-h-[100px] transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                {t.resolutionLabel}
              </label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-900/60 border border-zinc-800 focus:border-sky-500 rounded-xl text-zinc-300 text-xs focus:outline-none cursor-pointer transition-all"
              >
                <option value="1080p">1080p Full HD</option>
                <option value="4K UHD">4K Ultra HD</option>
                <option value="720p">720p HD</option>
                <option value="360p">360p Mobile</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                {t.durationLabel}
              </label>
              <input
                type="text"
                required
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder={t.durationPlaceholder}
                className="w-full px-3 py-2 bg-zinc-900/60 border border-zinc-800 focus:border-sky-500 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none text-xs transition-all"
              />
              <span className="text-[9px] text-zinc-600 block leading-tight font-light italic">
                {t.durationDisclaimer}
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                {t.thumbnailLabel}
              </label>
              <input
                type="url"
                value={thumbnail}
                onChange={(e) => setThumbnail(e.target.value)}
                placeholder="https://images.unsplash.com/photo-..."
                className="w-full px-3 py-2 bg-zinc-900/60 border border-zinc-800 focus:border-sky-500 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none text-xs transition-all"
              />
              <span className="text-[9px] text-zinc-600 block leading-tight font-light italic">
                {t.thumbnailDisclaimer}
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                {t.videoUrlLabel}
              </label>
              <input
                type="url"
                required
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                placeholder={t.videoUrlPlaceholder}
                className="w-full px-3 py-2 bg-zinc-900/60 border border-zinc-800 focus:border-sky-500 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none text-xs transition-all"
              />
              <span className="text-[9px] text-zinc-600 block leading-tight font-light italic">
                {t.videoUrlDisclaimer}
              </span>
            </div>

            <button
              type="submit"
              disabled={formLoading}
              className="w-full py-2.5 px-4 font-bold text-xs text-white bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-400 hover:to-blue-400 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {formLoading ? t.submitBtnLoading : t.submitBtn}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
