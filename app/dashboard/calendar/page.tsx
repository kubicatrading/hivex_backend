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

  // Initialize language from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("hivex_selected_language") || "en";
      setSelectedLanguage(saved);
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

  // Configure high-fidelity iframe URL matching our premium dark theme
  // Columns: Flags, Currency, Importance, Actual, Forecast, Previous
  // Importance: 1, 2, 3 (Low, Medium, High)
  const iframeUrl = `https://sslecal2.investing.com/?columns=exc_flags,exc_currency,exc_importance,exc_actual,exc_forecast,exc_previous&importance=1,2,3&calType=week&timeZone=58&lang=${getLangParam(selectedLanguage)}`;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* HEADER BANNER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-zinc-900/60">
        <div>
          <div className="flex items-center gap-2 mb-2 text-violet-400 font-mono text-xs tracking-wider uppercase">
            <Globe className="w-3.5 h-3.5" />
            <span>Macroeconomic Station</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl flex items-center gap-3">
            <Calendar className="w-8 h-8 text-violet-400" />
            {t.title}
          </h1>
          <p className="text-sm text-zinc-400 max-w-2xl mt-2 font-medium leading-relaxed">
            {t.subtitle}
          </p>
        </div>

        {/* ACTION BUTTON */}
        <div className="flex items-center gap-3">
          <a
            href={getExternalUrl(selectedLanguage)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-all duration-300 text-sm font-bold shadow-md shadow-black/30 group"
          >
            <span>{t.openButton}</span>
            <ExternalLink className="w-4 h-4 text-zinc-500 group-hover:text-violet-400 group-hover:translate-y-[-1px] group-hover:translate-x-[1px] transition-all" />
          </a>
        </div>
      </div>

      {/* COMPANION INFO BANNER */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-violet-950/10 border border-violet-900/20 text-violet-300/80 text-xs font-medium">
        <Info className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p>{t.disclaimer}</p>
          <p className="text-zinc-500 font-mono">{t.sourceText}</p>
        </div>
      </div>

      {/* FULLSCREEN IFRAME CONTAINER */}
      <div className="relative w-full rounded-2xl border border-zinc-900/80 bg-zinc-950/50 backdrop-blur-md overflow-hidden shadow-2xl shadow-black/80 flex flex-col">
        {/* Iframe header mimic */}
        <div className="w-full h-11 bg-zinc-900/30 border-b border-zinc-900/60 px-5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/40" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/40" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/40" />
          </div>
          <span className="text-[10px] font-mono tracking-widest text-zinc-500">SECURE CONSOLE</span>
          <span className="text-[10px] font-mono text-zinc-600 bg-zinc-900/50 px-2 py-0.5 rounded border border-zinc-800/40 uppercase">GMT+1 Timezone</span>
        </div>

        {/* Dynamic skeleton loader */}
        {!iframeLoaded && (
          <div className="absolute inset-0 top-11 bg-zinc-950/90 z-20 flex flex-col items-center justify-center space-y-4">
            <div className="relative flex items-center justify-center">
              <div className="absolute w-12 h-12 rounded-full border border-violet-500/10 animate-ping" />
              <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
            </div>
            <p className="text-zinc-400 text-xs font-mono tracking-wide animate-pulse">{t.loadingText}</p>
          </div>
        )}

        {/* Embed Frame */}
        <div className="w-full h-[750px] overflow-auto scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
          <iframe
            src={iframeUrl}
            onLoad={() => setIframeLoaded(true)}
            className="w-full h-full border-0 rounded-b-2xl bg-zinc-950"
            scrolling="yes"
            title="Economic Calendar Feed"
          />
        </div>
      </div>
    </div>
  );
}
