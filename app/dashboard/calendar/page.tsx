"use client";

import { useState, useEffect } from "react";
import { Calendar, ExternalLink, Globe, Loader2, Info } from "lucide-react";

// Local translation dictionary for the Economic Calendar page
const localTranslations: Record<string, {
  title: string;
  subtitle: string;
  openButton: string;
  sourceText: string;
  loadingText: string;
  disclaimer: string;
}> = {
  en: {
    title: "Economic Calendar",
    subtitle: "Real-time global macroeconomic events, key indicators, and central bank announcements.",
    openButton: "Open Investing.com",
    sourceText: "Macroeconomic calendar feed powered by Investing.com",
    loadingText: "Loading economic feed...",
    disclaimer: "This calendar is displayed in read-only mode for strategic monitoring."
  },
  es: {
    title: "Calendario Económico",
    subtitle: "Eventos macroeconómicos globales en tiempo real, indicadores clave y anuncios de bancos centrales.",
    openButton: "Abrir Investing.com",
    sourceText: "Calendario macroeconómico proporcionado por Investing.com",
    loadingText: "Cargando calendario económico...",
    disclaimer: "Este calendario se muestra en modo de solo lectura para el seguimiento estratégico."
  },
  de: {
    title: "Wirtschaftskalender",
    subtitle: "Globale makroökonomische Ereignisse in Echtzeit, Schlüsselindikatoren und Ankündigungen der Zentralbanken.",
    openButton: "Investing.com öffnen",
    sourceText: "Makroökonomischer Kalender von Investing.com",
    loadingText: "Lade Wirtschaftskalender...",
    disclaimer: "Dieser Kalender wird im schreibgeschützten Modus zur strategischen Überwachung angezeigt."
  },
  tr: {
    title: "Ekonomik Takvim",
    subtitle: "Gerçek zamanlı küresel makroekonomik olaylar, temel göstergeler ve merkez bankası duyuruları.",
    openButton: "Investing.com'u Aç",
    sourceText: "Investing.com tarafından sağlanan makroekonomik takvim akışı",
    loadingText: "Ekonomik takvim yükleniyor...",
    disclaimer: "Bu takvim, stratejik izleme amacıyla yalnızca okunabilir modda görüntülenir."
  }
};

export default function EconomicCalendarPage() {
  const [selectedLanguage, setSelectedLanguage] = useState<string>("en");
  const [iframeLoaded, setIframeLoaded] = useState<boolean>(false);
  const [deviceType, setDeviceType] = useState<"mobile" | "tablet" | "desktop">("desktop");

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

  const t = localTranslations[selectedLanguage] || localTranslations["en"];

  // Mapping to Investing.com language parameters
  // lang=1: English, lang=5: Spanish, lang=4: German, lang=10: Turkish
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
      // 4 essential columns: Currency, Importance, Actual, Previous (fits perfectly in 320px-360px with zoom)
      return "exc_currency,exc_importance,exc_actual,exc_previous";
    }
    if (device === "tablet") {
      // 5 columns: Currency, Importance, Actual, Forecast, Previous (fits perfectly in 450px-600px)
      return "exc_currency,exc_importance,exc_actual,exc_forecast,exc_previous";
    }
    // All 6 columns for desktop (fits perfectly in 650px)
    return "exc_flags,exc_currency,exc_importance,exc_actual,exc_forecast,exc_previous";
  };

  // Dynamic zoom styles via CSS scale to completely fit all columns on smaller devices
  const getIframeStyle = () => {
    if (deviceType === "mobile") {
      // 88% scale down gives ~13.6% extra horizontal workspace for the table layout to render perfectly without wrapping
      return {
        transform: "scale(0.88)",
        transformOrigin: "top left",
        width: "113.6%",
        height: "113.6%",
      };
    }
    if (deviceType === "tablet") {
      // 95% scale down for medium tablet devices
      return {
        transform: "scale(0.95)",
        transformOrigin: "top left",
        width: "105.2%",
        height: "105.2%",
      };
    }
    // 100% full size for desktop
    return {
      width: "100%",
      height: "100%",
    };
  };

  // Configure high-fidelity iframe URL matching our premium dark theme
  const iframeUrl = `https://sslecal2.investing.com/?columns=${getColumnsParam(deviceType)}&importance=1,2,3&calType=week&timeZone=58&lang=${getLangParam(selectedLanguage)}`;

  return (
    <div className="-mx-4 sm:mx-auto max-w-[650px] space-y-3 sm:space-y-4 animate-fade-in px-0 sm:px-0">
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
  );
}
