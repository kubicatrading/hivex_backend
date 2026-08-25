"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  Newspaper, RefreshCw, Calendar, BookOpen, Clock, Heart, Trash2, Search,
  ArrowLeft, FileText, ChevronRight, ChevronLeft, Sparkles, BookOpenCheck, UploadCloud,
  Plus, Eye, Monitor, AlertCircle, Play, CheckCircle2, ExternalLink,
  Pause, Volume2, ChevronDown, ChevronUp, Loader2, SkipBack, SkipForward,
  RotateCcw, Headphones, AlertTriangle, Maximize2, Minimize2
} from "lucide-react";
import { translations } from "@/lib/translations";
import { cleanSummaryForSpeech, splitParagraphIntoSentences } from "@/lib/magazineSentences";

interface MagazineIssue {
  id: string;
  title: string;
  description: string;
  file_url: string;
  created_at: string;
  metadata: {
    is_magazine_issue: boolean;
    slug: string;
    cover_url: string;
    published_at: string;
    summary: string;
    is_favorite?: boolean;
    page_count?: number;
    author?: string;
    transcription_model?: string;
    summary_model?: string;
    audio_status?: string;
    audio_progress_percent?: number;
    audio_url?: string;
    audio_voice?: string;
    audio_language?: string;
    sentence_timestamps?: any[];
    audios?: Record<string, any>;
  };
}

const newsTranslations: Record<string, any> = {
  en: {
    title: "Intelligence Magazine Feed",
    subtitle: "Weekly financial bulletins and reports extracted directly from the global analysis cabin.",
    all: "All",
    favorites: "Favorites",
    syncBtn: "Synchronized",
    syncing: "Syncing...",
    syncSuccess: "Synchronized! The latest editions were processed successfully.",
    studyCabin: "Study Cabin",
    pages: "pages",
    pagesShort: "p.",
    author: "Author",
    publishedOn: "Published on",
    catalogTitle: "Saved Magazines Catalog",
    emptyCatalog: "No saved magazines found. Use the upload panel on the right or re-sync.",
    emptyFavs: "No favorite magazines saved.",
    uploadTitle: "Upload Magazine (PDF)",
    formTitleLabel: "Magazine Title",
    formAuthorLabel: "Author / Editor",
    formDateLabel: "Published Date",
    formPagesLabel: "Number of Pages",
    formPdfLabel: "PDF Document URL",
    formCoverLabel: "Cover Image URL",
    formDescLabel: "Description / Synopsis",
    formSubmit: "Save Magazine",
    formSubmitting: "Registering and counting pages...",
    scraperStatus: "Scraper Status",
    engineActive: "Active",
    lastSync: "Last successful sync",
    totalIssues: "Total records",
    confirmDelete: "Are you sure you want to delete this magazine?",
    analysis: "Analysis",
    openNewTab: "Open in New Tab",
    studyEdition: "Study Edition",
    viewFullPublication: "View Full Publication"
  },
  es: {
    title: "Intelligence Magazine Feed",
    subtitle: "Boletines e informes bursátiles semanales extraídos de forma directa desde la cabina de análisis financiero global.",
    all: "Todos",
    favorites: "Favoritos",
    syncBtn: "Sincronizado",
    syncing: "Sincronizando...",
    syncSuccess: "¡Sincronizado! Se procesaron las últimas ediciones de forma correcta.",
    studyCabin: "Cabina de Estudio",
    pages: "páginas",
    pagesShort: "pág.",
    author: "Autor",
    publishedOn: "Publicado el",
    catalogTitle: "Catálogo de Magazines Guardados",
    emptyCatalog: "Aún no tienes magazines descargados. Usa el panel de subida de la derecha o re-sincroniza.",
    emptyFavs: "No hay magazines favoritos guardados.",
    uploadTitle: "Subir Magazine (PDF)",
    formTitleLabel: "Título del Magazine",
    formAuthorLabel: "Autor / Editor",
    formDateLabel: "Fecha Publicación",
    formPagesLabel: "Número de Páginas",
    formPdfLabel: "URL del Documento PDF",
    formCoverLabel: "URL de la Portada (Imagen)",
    formDescLabel: "Descripción / Sinopsis",
    formSubmit: "Guardar Magazine",
    formSubmitting: "Registrando y contando páginas...",
    scraperStatus: "Estado del Scraper",
    engineActive: "Activo",
    lastSync: "Último sync exitoso",
    totalIssues: "Registros totales",
    confirmDelete: "¿Estás seguro de que deseas eliminar este magazine?",
    analysis: "Análisis",
    openNewTab: "Abrir en nueva pestaña",
    studyEdition: "Estudiar Edición",
    viewFullPublication: "Ver publicación completa"
  },
  de: {
    title: "Intelligence Magazine Feed",
    subtitle: "Wöchentliche Finanzberichte und Bulletins, die direkt aus der globalen Analysekabine extrahiert wurden.",
    all: "Alle",
    favorites: "Favoriten",
    syncBtn: "Synchronisiert",
    syncing: "Synchronisierung...",
    syncSuccess: "Synchronisiert! Die neuesten Ausgaben wurden erfolgreich verarbeitet.",
    studyCabin: "Studienkabine",
    pages: "Seiten",
    pagesShort: "S.",
    author: "Autor",
    publishedOn: "Veröffentlicht am",
    catalogTitle: "Katalog der gespeicherten Magazine",
    emptyCatalog: "Keine gespeicherten Magazine gefunden. Verwenden Sie das Upload-Panel auf der rechten Seite oder synchronisieren Sie erneut.",
    emptyFavs: "Keine Favoriten-Magazine gespeichert.",
    uploadTitle: "Magazin hochladen (PDF)",
    formTitleLabel: "Magazintitel",
    formAuthorLabel: "Autor / Herausgeber",
    formDateLabel: "Veröffentlichungsdatum",
    formPagesLabel: "Seitenanzahl",
    formPdfLabel: "PDF-Dokument-URL",
    formCoverLabel: "Cover-Bild-URL",
    formDescLabel: "Beschreibung / Zusammenfassung",
    formSubmit: "Magazin speichern",
    formSubmitting: "Registrieren und Seiten zählen...",
    scraperStatus: "Scraper-Status",
    engineActive: "Aktiv",
    lastSync: "Letzte erfolgreiche Sync",
    totalIssues: "Gesamte Datensätze",
    confirmDelete: "Sind Sie sicher, dass Sie dieses Magazin löschen möchten?",
    analysis: "Analyse",
    openNewTab: "In neuem Tab öffnen",
    studyEdition: "Ausgabe studieren",
    viewFullPublication: "Vollständige Publikation anzeigen"
  },
  tr: {
    title: "Intelligence Magazine Feed",
    subtitle: "Doğrudan küresel analiz kabininden çıkarılan haftalık bültenler ve finansal raporlar.",
    all: "Hepsi",
    favorites: "Favoriler",
    syncBtn: "Senkronize Edildi",
    syncing: "Senkronize ediliyor...",
    syncSuccess: "Senkronize edildi! Son sayılar başarıyla işlendi.",
    studyCabin: "Çalışma Kabini",
    pages: "sayfa",
    pagesShort: "S.",
    author: "Yazar",
    publishedOn: "Yayınlanma tarihi",
    catalogTitle: "Kaydedilen Dergiler Kataloğu",
    emptyCatalog: "Kayıtlı dergi bulunamadı. Sağdaki yükleme panelini kullanın veya tekrar senkronize edin.",
    emptyFavs: "Favori dergi kaydedilmedi.",
    uploadTitle: "Dergi Yükle (PDF)",
    formTitleLabel: "Dergi Başlığı",
    formAuthorLabel: "Yazar / Editör",
    formDateLabel: "Yayın Tarihi",
    formPagesLabel: "Sayfa Sayısı",
    formPdfLabel: "PDF Belgesi URL'si",
    formCoverLabel: "Kapak Resmi URL'si",
    formDescLabel: "Açıklama / Özet",
    formSubmit: "Dergi Kaydet",
    formSubmitting: "Kaydediliyor ve sayfalar sayılıyor...",
    scraperStatus: "Kazıyıcı Durumu",
    engineActive: "Aktif",
    lastSync: "Son başarılı senkronizasyon",
    totalIssues: "Toplam kayıt",
    confirmDelete: "Bu dergiyi silmek istediğinizden emin misiniz?",
    analysis: "Analiz",
    openNewTab: "Yeni sekmede aç",
    studyEdition: "Sayıyı Çalış",
    viewFullPublication: "Tüm Yayını Görüntüle"
  }
};

function getValidCoverUrl(coverUrl?: string, slug?: string): string {
  if (coverUrl && coverUrl.startsWith("http")) {
    return coverUrl;
  }
  if (coverUrl && coverUrl.startsWith("/")) {
    return coverUrl;
  }
  const s = slug || "4-august-2026";
  return `https://lhtlrztsmkllcqiziftn.supabase.co/storage/v1/object/public/documents/covers/${s}.jpg`;
}

const getLocalizedTitle = (title: string, lang: string) => {
  if (!title) return "";
  let res = title;

  if (lang === "en") {
    return res
      .replace(/Revista Semanal/gi, "Weekly Magazine")
      .replace(/Boletín Semanal/gi, "Weekly Bulletin")
      .replace(/Revista/gi, "Magazine")
      .replace(/Edición del/gi, "Edition of")
      .replace(/\s+de\s+/gi, " ")
      .replace(/enero/gi, "January")
      .replace(/febrero/gi, "February")
      .replace(/marzo/gi, "March")
      .replace(/abril/gi, "April")
      .replace(/mayo/gi, "May")
      .replace(/junio/gi, "June")
      .replace(/julio/gi, "July")
      .replace(/agosto/gi, "August")
      .replace(/septiembre/gi, "September")
      .replace(/octubre/gi, "October")
      .replace(/noviembre/gi, "November")
      .replace(/diciembre/gi, "December");
  }
  if (lang === "de") {
    return res
      .replace(/Revista Semanal/gi, "Wöchentliches Magazin")
      .replace(/Boletín Semanal/gi, "Wöchentliches Bulletin")
      .replace(/Revista/gi, "Magazin")
      .replace(/Edición del/gi, "Ausgabe vom")
      .replace(/\s+de\s+/gi, " ")
      .replace(/enero/gi, "Januar")
      .replace(/febrero/gi, "Februar")
      .replace(/marzo/gi, "März")
      .replace(/abril/gi, "April")
      .replace(/mayo/gi, "Mai")
      .replace(/junio/gi, "Juni")
      .replace(/julio/gi, "Juli")
      .replace(/agosto/gi, "August")
      .replace(/septiembre/gi, "September")
      .replace(/octubre/gi, "Oktober")
      .replace(/noviembre/gi, "November")
      .replace(/diciembre/gi, "Dezember");
  }
  if (lang === "tr") {
    return res
      .replace(/Revista Semanal/gi, "Haftalık Dergi")
      .replace(/Boletín Semanal/gi, "Haftalık Bülten")
      .replace(/Revista/gi, "Dergi")
      .replace(/Edición del/gi, "Sayı:")
      .replace(/\s+de\s+/gi, " ")
      .replace(/enero/gi, "Ocak")
      .replace(/febrero/gi, "Şubat")
      .replace(/marzo/gi, "Mart")
      .replace(/abril/gi, "Nisan")
      .replace(/mayo/gi, "Mayıs")
      .replace(/junio/gi, "Haziran")
      .replace(/julio/gi, "Temmuz")
      .replace(/agosto/gi, "Ağustos")
      .replace(/septiembre/gi, "Eylül")
      .replace(/octubre/gi, "Ekim")
      .replace(/noviembre/gi, "Kasım")
      .replace(/diciembre/gi, "Aralık");
  }
  if (lang === "es") {
    return res
      .replace(/Weekly Magazine/gi, "Revista Semanal")
      .replace(/Weekly Bulletin/gi, "Boletín Semanal")
      .replace(/Magazine/gi, "Revista")
      .replace(/Edition of/gi, "Edición del")
      .replace(/January/gi, "Enero")
      .replace(/February/gi, "Febrero")
      .replace(/March/gi, "Marzo")
      .replace(/April/gi, "Abril")
      .replace(/May/gi, "Mayo")
      .replace(/June/gi, "Junio")
      .replace(/July/gi, "Julio")
      .replace(/August/gi, "Agosto")
      .replace(/September/gi, "Septiembre")
      .replace(/October/gi, "Octubre")
      .replace(/November/gi, "Noviembre")
      .replace(/December/gi, "Diciembre");
  }
  return res;
};

const getLocalizedDescription = (desc: string, lang: string) => {
  if (!desc) return "";
  if (lang === "en") {
    if (desc.startsWith("Revista Semanal del")) {
      return desc.replace("Revista Semanal del", "Weekly Magazine of");
    }
    if (desc.includes("Boletines e informes bursátiles")) {
      return "Weekly financial bulletins and reports extracted directly from the global analysis cabin.";
    }
  }
  if (lang === "de") {
    if (desc.startsWith("Revista Semanal del")) {
      return desc.replace("Revista Semanal del", "Wöchentliches Magazin von");
    }
    if (desc.includes("Boletines e informes bursátiles")) {
      return "Wöchentliche Finanzberichte und Bulletins, die direkt aus der globalen Analysekabine extrahiert wurden.";
    }
  }
  if (lang === "tr") {
    if (desc.startsWith("Revista Semanal del")) {
      return desc.replace("Revista Semanal del", "Haftalık Dergisi:");
    }
    if (desc.includes("Boletines e informes bursátiles")) {
      return "Doğrudan küresel analiz kabininden çıkarılan haftalık bültenler ve finansal raporlar.";
    }
  }
  return desc;
};

function LanguageFlagSwitcher({
  selectedLanguage,
  onLanguageChange
}: {
  selectedLanguage: string;
  onLanguageChange: (lang: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 bg-zinc-900/80 border border-zinc-800 px-2.5 py-1 rounded-xl shadow-inner select-none flex-shrink-0">
      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest hidden sm:inline">
        {selectedLanguage === "es" ? "Idioma:" : "Language:"}
      </span>
      <div className="flex items-center gap-1">
        {[
          { code: "en", flag: "🇺🇸", label: "English" },
          { code: "de", flag: "🇩🇪", label: "Deutsch" },
          { code: "tr", flag: "🇹🇷", label: "Türkçe" },
          { code: "es", flag: "🇪🇸", label: "Español" }
        ].map((lang) => (
          <button
            key={lang.code}
            onClick={() => onLanguageChange(lang.code)}
            title={lang.label}
            className={`text-xs p-1 rounded-lg border transition-all duration-200 hover:scale-110 flex items-center justify-center relative group ${
              selectedLanguage === lang.code
                ? "bg-violet-600/20 border-violet-500/50 text-white scale-105 shadow-sm shadow-violet-500/10"
                : "bg-transparent border-transparent text-zinc-400 hover:text-white"
            }`}
          >
            <span className="text-sm leading-none">{lang.flag}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const toHungarianTitleCase = (str: string): string => {
  if (!str) return "";
  const acronyms = new Set(["U.S.", "US", "AI", "IDF", "EV", "BTC", "GDP", "EU", "UK", "UN", "NASDAQ", "S&P", "DOW", "STOXX", "FTSE", "COVID"]);
  return str
    .split(/\s+/)
    .map((word) => {
      const cleanWord = word.replace(/[^a-zA-Z0-9.&]/g, "");
      if (acronyms.has(cleanWord.toUpperCase())) {
        return word;
      }
      if (word.length <= 2 && word === word.toUpperCase()) {
        if (word === "A" || word === "I") return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
};

interface PdfViewerProps {
  url: string;
  page: number;
  onPageChange?: (pageNum: number) => void;
  onPageClick?: (pageNum: number) => void;
}

function PdfViewer({ url, page, onPageChange, onPageClick }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pdfDocRef = useRef<any>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Zoom state
  const [zoomScale, setZoomScale] = useState<number>(1.0);

  // Scroll / Swipe page flipping cooldown
  const scrollCooldownRef = useRef<boolean>(false);
  const touchStartYRef = useRef<number | null>(null);

  // Load PDF document using PDF.js
  useEffect(() => {
    if (!url) return;
    let isCancelled = false;

    async function loadPdf() {
      setLoading(true);
      setError(null);
      try {
        if (!(window as any).pdfjsLib) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
            script.onload = () => {
              if ((window as any).pdfjsLib) {
                (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
                  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
              }
              resolve();
            };
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }

        const pdfjsLib = (window as any).pdfjsLib;
        if (!pdfjsLib) return;

        const loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;
        if (isCancelled) return;

        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
      } catch (err: any) {
        console.error("PDF.js doc load error:", err);
        if (!isCancelled) setError(err?.message || "Error al cargar la publicación");
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    loadPdf();

    return () => {
      isCancelled = true;
    };
  }, [url]);

  // Render current single PDF page
  useEffect(() => {
    if (!pdfDocRef.current || numPages === 0 || !containerRef.current) return;

    let isCancelled = false;
    const pdf = pdfDocRef.current;

    async function renderPage() {
      const container = containerRef.current;
      if (!container) return;

      const containerWidth = Math.max(container.clientWidth - 32, 320);
      const containerHeight = Math.max(container.clientHeight - 48, 400);

      const pageNum = Math.min(Math.max(1, page), numPages);
      const pageCanvas = container.querySelector<HTMLCanvasElement>(`#canvas-pdf-page-${pageNum}`);
      if (!pageCanvas) return;

      try {
        const pdfPage = await pdf.getPage(pageNum);
        if (isCancelled) return;

        const unscaledViewport = pdfPage.getViewport({ scale: 1 });
        const scaleW = containerWidth / unscaledViewport.width;
        const scaleH = containerHeight / unscaledViewport.height;
        const baseScale = Math.min(scaleW, scaleH);
        const finalScale = Math.max(baseScale * zoomScale, 0.6);

        const viewport = pdfPage.getViewport({ scale: finalScale * 1.5 }); // High-DPI rendering

        pageCanvas.width = viewport.width;
        pageCanvas.height = viewport.height;
        pageCanvas.style.width = `${unscaledViewport.width * finalScale}px`;
        pageCanvas.style.height = `${unscaledViewport.height * finalScale}px`;

        const ctx = pageCanvas.getContext("2d");
        if (ctx) {
          await pdfPage.render({ canvasContext: ctx, viewport }).promise;
        }
      } catch (e) {
        console.error(`Error rendering PDF page ${pageNum}:`, e);
      }
    }

    renderPage();

    return () => {
      isCancelled = true;
    };
  }, [numPages, url, page, zoomScale]);

  // Handle Mouse Wheel Scroll -> Page Flip with non-passive preventDefault
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheelListener = (e: WheelEvent) => {
      // Prevent main webpage from scrolling when mouse wheel is used over the PDF viewer
      e.preventDefault();
      e.stopPropagation();

      if (scrollCooldownRef.current || numPages <= 1) return;
      if (Math.abs(e.deltaY) < 10) return;

      if (e.deltaY > 0) {
        if (page < numPages) {
          scrollCooldownRef.current = true;
          onPageChange?.(page + 1);
          setTimeout(() => {
            scrollCooldownRef.current = false;
          }, 350);
        }
      } else if (e.deltaY < 0) {
        if (page > 1) {
          scrollCooldownRef.current = true;
          onPageChange?.(page - 1);
          setTimeout(() => {
            scrollCooldownRef.current = false;
          }, 350);
        }
      }
    };

    container.addEventListener("wheel", onWheelListener, { passive: false });

    return () => {
      container.removeEventListener("wheel", onWheelListener);
    };
  }, [numPages, page, onPageChange]);

  // Touch Swipe -> Page Flip
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartYRef.current === null || scrollCooldownRef.current || numPages <= 1) return;
    const deltaY = touchStartYRef.current - e.changedTouches[0].clientY;
    touchStartYRef.current = null;

    if (Math.abs(deltaY) < 25) return;

    if (deltaY > 0) {
      if (page < numPages) {
        scrollCooldownRef.current = true;
        onPageChange?.(page + 1);
        setTimeout(() => {
          scrollCooldownRef.current = false;
        }, 350);
      }
    } else if (deltaY < 0) {
      if (page > 1) {
        scrollCooldownRef.current = true;
        onPageChange?.(page - 1);
        setTimeout(() => {
          scrollCooldownRef.current = false;
        }, 350);
      }
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-zinc-950 select-none overflow-hidden">
      {/* Viewer Header Toolbar: Zoom Controls */}
      <div className="px-3 py-1.5 bg-zinc-950/95 border-b border-zinc-900 flex items-center justify-between text-[11px] font-mono text-zinc-400 z-10 shadow-sm shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider hidden xs:inline mr-1">Zoom:</span>
          <button
            onClick={() => setZoomScale((prev) => Math.max(0.6, Number((prev - 0.15).toFixed(2))))}
            className="w-6 h-6 rounded hover:bg-zinc-800 text-zinc-300 font-bold transition-colors flex items-center justify-center cursor-pointer border border-zinc-800"
            title="Alejar Zoom (-)"
          >
            -
          </button>
          <button
            onClick={() => setZoomScale(1.0)}
            className="px-2 py-0.5 rounded hover:bg-zinc-800 text-amber-400 font-bold transition-colors cursor-pointer border border-zinc-800 text-[10px]"
            title="Restablecer Zoom (100%)"
          >
            {Math.round(zoomScale * 100)}%
          </button>
          <button
            onClick={() => setZoomScale((prev) => Math.min(2.5, Number((prev + 0.15).toFixed(2))))}
            className="w-6 h-6 rounded hover:bg-zinc-800 text-zinc-300 font-bold transition-colors flex items-center justify-center cursor-pointer border border-zinc-800"
            title="Acercar Zoom (+)"
          >
            +
          </button>
        </div>

        {numPages > 0 && (
          <span className="text-[10px] font-mono text-amber-400 font-bold">
            Pág. {page} / {numPages}
          </span>
        )}
      </div>

      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="relative w-full flex-1 bg-zinc-950 p-3 flex flex-col items-center justify-center overflow-hidden"
      >
        {loading && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-indigo-400 font-mono text-xs py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
            <span>Cargando publicación y preparando página...</span>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-rose-400 text-xs py-12">
            <AlertCircle className="w-8 h-8 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && numPages > 0 && (
          <div
            key={`pdf-single-wrapper-${page}`}
            onClick={() => onPageClick?.(page)}
            className="relative flex flex-col items-center justify-center bg-zinc-900/60 rounded-xl border border-amber-500/80 p-2 shadow-[0_0_25px_rgba(245,158,11,0.2)] transition-all cursor-pointer group/page max-h-full"
            title={`Página ${page} - Clic para escuchar`}
          >
            <canvas
              id={`canvas-pdf-page-${page}`}
              className="max-w-full h-auto rounded shadow-2xl group-hover/page:ring-2 group-hover/page:ring-amber-500/40 transition-all object-contain"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function NewsPage() {
  const [selectedLanguage, setSelectedLanguage] = useState<string>("en");
  const [issues, setIssues] = useState<MagazineIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Filter & Search states
  const [filterFavorite, setFilterFavorite] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Active / Selected Magazine Preview states
  const [selectedIssue, setSelectedIssue] = useState<MagazineIssue | null>(null);
  const [activeReaderIssue, setActiveReaderIssue] = useState<MagazineIssue | null>(null);
  const [readerStartPage, setReaderStartPage] = useState<number | null>(null);

  // Active Study Cabin states
  const [activeCabinIssue, setActiveCabinIssue] = useState<MagazineIssue | null>(null);

  // Re-fetch fresh activeCabinIssue metadata from Supabase when entering or switching study cabin issue
  useEffect(() => {
    if (!activeCabinIssue?.id) return;
    let isSubscribed = true;
    (async () => {
      try {
        const { data: freshDoc } = await supabase
          .from("documents")
          .select("*")
          .eq("id", activeCabinIssue.id)
          .single();
        if (isSubscribed && freshDoc && freshDoc.metadata) {
          setActiveCabinIssue((prev) => {
            if (!prev || prev.id !== freshDoc.id) return prev;
            return {
              ...prev,
              metadata: {
                ...(prev.metadata || {}),
                ...freshDoc.metadata
              }
            };
          });
        }
      } catch (err) {
        console.warn("[Study Cabin] Error fetching fresh issue doc:", err);
      }
    })();
    return () => {
      isSubscribed = false;
    };
  }, [activeCabinIssue?.id]);

  const [cabinArticles, setCabinArticles] = useState<any[]>([]);
  const [cabinSelectedPage, setCabinSelectedPage] = useState<number>(1);
  const topFrameRef = useRef<HTMLDivElement>(null);
  const [loadingArticles, setLoadingArticles] = useState(false);
  const [transcriptionCollapsed, setTranscriptionCollapsed] = useState(false);
  const [pdfTranscriptionModel, setPdfTranscriptionModel] = useState<string>("Google AI Studio Gemini Flash");
  const [pdfTranscriptionError, setPdfTranscriptionError] = useState<string | null>(null);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [reanalysisProgress, setReanalysisProgress] = useState(0);

  // Audio TTS engine states
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isPausedAudio, setIsPausedAudio] = useState(false);
  const [activeSentenceIdx, setActiveSentenceIdx] = useState(-1);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState("Aoede"); // Locked to Aoede Premium Female Voice
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [transcribingPDF, setTranscribingPDF] = useState(false);
  const [isTranslatingArticles, setIsTranslatingArticles] = useState(false);
  const [translationProgress, setTranslationProgress] = useState(0);

  const selectedLanguageRef = useRef(selectedLanguage);
  useEffect(() => {
    selectedLanguageRef.current = selectedLanguage;
    if (selectedLanguage === "en") {
      setIsTranslatingArticles(false);
      setTranslationProgress(0);
    }
  }, [selectedLanguage]);

  // Helper to retrieve localized article content based on selected top language
  const getLocalizedArticle = (art: any, lang: string) => {
    if (lang === "en" || !art?.metadata?.translations?.[lang]) {
      return {
        title: art?.title || "",
        category: art?.metadata?.category || "TENDENCIAS",
        subcategory: art?.metadata?.subcategory || art?.metadata?.category || "SECCIÓN",
        paragraphs: art?.metadata?.paragraphs || (art?.description ? [art.description] : [])
      };
    }
    const trans = art.metadata.translations[lang];
    return {
      title: trans.title || art?.title || "",
      category: trans.category || art?.metadata?.category || "TENDENCIAS",
      subcategory: trans.subcategory || art?.metadata?.subcategory || "SECCIÓN",
      paragraphs: trans.paragraphs || art?.metadata?.paragraphs || (art?.description ? [art.description] : [])
    };
  };

  // Single Audio Engine State & Refs (Magazine MP3 + Timestamps)
  const singleAudioRef = useRef<HTMLAudioElement | null>(null);
  const sentenceChunksRef = useRef<string[]>([]);
  const chunkTargetElementIdsRef = useRef<string[]>([]);
  const activeSentenceIndexRef = useRef(-1);
  const isPlayingAudioRef = useRef(false);
  const playbackRateRef = useRef(1.0);

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [sentenceTimestamps, setSentenceTimestamps] = useState<Array<{ sentenceIdx: number, text: string, startTime: number, endTime: number }>>([]);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioProgressPercent, setAudioProgressPercent] = useState<number>(0);
  const [audioCurrentTime, setAudioTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);

  // 1. Handle activeCabinIssue changes and fetch articles for this issue
  useEffect(() => {
    if (activeCabinIssue) {
      setCabinSelectedPage(1);
      const fetchArticlesOfIssue = async () => {
        setLoadingArticles(true);
        setCabinArticles([]);
        try {
          const { data, error } = await supabase
            .from("documents")
            .select("*")
            .in("type", ["knowledge_transcription", "knowledge_article_transcription", "knowledge_article_analysis", "knowledge_analysis"])
            .eq("metadata->>is_magazine_article", "true")
            .eq("metadata->>issue_slug", activeCabinIssue.metadata?.slug || "");
          if (error) throw error;
          if (data) {
            // Sort by order_index to preserve exact magazine reading flow (or category/title fallback)
            const sorted = [...data].sort((a, b) => {
              const orderA = Number(a.metadata?.order_index ?? 9999);
              const orderB = Number(b.metadata?.order_index ?? 9999);
              if (orderA !== orderB) return orderA - orderB;
              const catA = a.metadata?.category || "";
              const catB = b.metadata?.category || "";
              return catA.localeCompare(catB);
            });
            setCabinArticles(sorted);
            if (sorted.length > 0 && sorted[0].metadata?.start_page) {
              setCabinSelectedPage(Number(sorted[0].metadata.start_page));
            }
          }
        } catch (err) {
          console.error("[Study Cabin] Error loading issue articles:", err);
        } finally {
          setLoadingArticles(false);
        }
      };

      fetchArticlesOfIssue();
    } else {
      setCabinArticles([]);
    }
  }, [activeCabinIssue]);

  // Auto-translate cabin articles when language changes
  useEffect(() => {
    if (activeCabinIssue && cabinArticles.length > 0 && selectedLanguage !== "en") {
      const targetLang = selectedLanguage;
      const articlesNeedingTranslation = cabinArticles.filter(
        (art) => !art.metadata?.translations?.[targetLang]
      );

      if (articlesNeedingTranslation.length > 0 && !isTranslatingArticles) {
        const translateAll = async () => {
          setIsTranslatingArticles(true);
          setTranslationProgress(15);
          try {
            const updatedArticles = [...cabinArticles];
            const totalToTranslate = articlesNeedingTranslation.length;
            let completedCount = 0;

            // Process in parallel batches of 3 for fast execution without hitting rate limits
            const BATCH_SIZE = 3;
            for (let i = 0; i < articlesNeedingTranslation.length; i += BATCH_SIZE) {
              if (selectedLanguageRef.current !== targetLang || selectedLanguageRef.current === "en") {
                console.log("[Study Cabin] Language changed during translation, aborting loop.");
                break;
              }

              const batch = articlesNeedingTranslation.slice(i, i + BATCH_SIZE);
              await Promise.all(
                batch.map(async (art) => {
                  try {
                    const title = art.title || "";
                    const category = art.metadata?.category || "";
                    const subcategory = art.metadata?.subcategory || "";
                    const paragraphs = art.metadata?.paragraphs || (art.description ? [art.description] : []);

                    const res = await fetch("/api/news/translate", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        articleId: art.id,
                        title,
                        category,
                        subcategory,
                        paragraphs,
                        targetLanguage: targetLang
                      })
                    });

                    const data = await res.json();
                    if (data.success && data.translation) {
                      const transObj = data.translation;
                      const idxInFull = updatedArticles.findIndex((a) => a.id === art.id);
                      if (idxInFull >= 0) {
                        const updatedMeta = {
                          ...(art.metadata || {}),
                          translations: {
                            ...(art.metadata?.translations || {}),
                            [targetLang]: transObj
                          }
                        };
                        updatedArticles[idxInFull] = {
                          ...art,
                          metadata: updatedMeta
                        };
                      }
                    }
                  } catch (err) {
                    console.error("[Study Cabin] Error translating article item:", art.id, err);
                  } finally {
                    completedCount++;
                    const currPct = Math.min(95, Math.round(15 + (completedCount / totalToTranslate) * 80));
                    setTranslationProgress(currPct);
                  }
                })
              );
            }

            if (selectedLanguageRef.current === targetLang) {
              setTranslationProgress(100);
              setCabinArticles(updatedArticles);
            }
          } catch (err) {
            console.error("[Study Cabin] Translation error:", err);
          } finally {
            if (selectedLanguageRef.current === targetLang || selectedLanguageRef.current === "en") {
              setIsTranslatingArticles(false);
            }
          }
        };
        translateAll();
      }
    }
  }, [activeCabinIssue, selectedLanguage, cabinArticles.length]);



  // Single Audio Time Update Sync Handler
  const handleAudioTimeUpdate = () => {
    if (!singleAudioRef.current) return;
    const curr = singleAudioRef.current.currentTime;
    setAudioTime(curr);
    setAudioDuration(singleAudioRef.current.duration || 0);

    if (sentenceTimestamps.length > 0) {
      const match = sentenceTimestamps.find((ts, idx) => {
        const nextTs = sentenceTimestamps[idx + 1];
        const upperBound = nextTs ? nextTs.startTime : ts.endTime + 0.5;
        return curr >= ts.startTime && curr < upperBound;
      });
      if (match && match.sentenceIdx !== activeSentenceIndexRef.current) {
        activeSentenceIndexRef.current = match.sentenceIdx;
        setActiveSentenceIdx(match.sentenceIdx);

        const targetId = chunkTargetElementIdsRef.current[match.sentenceIdx];
        if (targetId) {
          const el = document.getElementById(targetId);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }
      }
    }
  };

  // Jump to specific sentence index in the single audio file
  const handleSentenceClick = (index: number) => {
    const ts = sentenceTimestamps[index];
    if (ts && singleAudioRef.current) {
      singleAudioRef.current.currentTime = ts.startTime;
      singleAudioRef.current.play().catch(console.error);
      setIsPlayingAudio(true);
      setIsPausedAudio(false);
      setActiveSentenceIdx(index);
      activeSentenceIndexRef.current = index;
    } else if (sentenceChunksRef.current[index] && singleAudioRef.current) {
      const total = sentenceChunksRef.current.length;
      if (total > 0 && singleAudioRef.current.duration) {
        const ratio = index / total;
        singleAudioRef.current.currentTime = ratio * singleAudioRef.current.duration;
        singleAudioRef.current.play().catch(console.error);
        setIsPlayingAudio(true);
        setIsPausedAudio(false);
        setActiveSentenceIdx(index);
        activeSentenceIndexRef.current = index;
      }
    }
  };

  // Play, Pause and Rate controls for Single Audio
  const startCabinAudio = () => {
    if (!singleAudioRef.current) return;
    singleAudioRef.current.play().then(() => {
      setIsPlayingAudio(true);
      setIsPausedAudio(false);
    }).catch(console.error);
  };

  const pauseCabinAudio = () => {
    if (!singleAudioRef.current) return;
    singleAudioRef.current.pause();
    setIsPlayingAudio(false);
    setIsPausedAudio(true);
  };

  const stopCabinAudio = () => {
    if (!singleAudioRef.current) return;
    singleAudioRef.current.pause();
    singleAudioRef.current.currentTime = 0;
    setIsPlayingAudio(false);
    setIsPausedAudio(false);
    setActiveSentenceIdx(-1);
    activeSentenceIndexRef.current = -1;
  };

  const handleRateChange = (newRate: number) => {
    setPlaybackRate(newRate);
    playbackRateRef.current = newRate;
    if (singleAudioRef.current) {
      singleAudioRef.current.playbackRate = newRate;
    }
  };

  // Build verbatim paragraph chunk mappings & trigger asynchronous audio fetch/generation
  useEffect(() => {
    if (activeCabinIssue) {
      if (loadingArticles) return; // Wait for articles to finish loading from DB before computing chunks

      const chunks: string[] = [];
      const targetElementIds: string[] = [];

      if (cabinArticles.length > 0) {
        cabinArticles.forEach((art) => {
          const locArt = getLocalizedArticle(art, selectedLanguage);

          const subcat = locArt.subcategory;
          const titleText = `${subcat}: ${locArt.title}.`;
          chunks.push(titleText);
          targetElementIds.push(`article-title-${art.id}`);

          if (locArt.paragraphs && locArt.paragraphs.length > 0) {
            locArt.paragraphs.forEach((para: string, pIdx: number) => {
              const sentences = splitParagraphIntoSentences(para);
              if (sentences.length > 0) {
                sentences.forEach((sentence: string, sIdx: number) => {
                  const speechSentence = cleanSummaryForSpeech(sentence);
                  if (speechSentence.length > 0) {
                    chunks.push(speechSentence);
                    targetElementIds.push(`sentence-${art.id}-${pIdx}-${sIdx}`);
                  }
                });
              } else {
                const cleanP = cleanSummaryForSpeech(para);
                if (cleanP.length > 0) {
                  chunks.push(cleanP);
                  targetElementIds.push(`sentence-${art.id}-${pIdx}-0`);
                }
              }
            });
          }
        });
      } else {
        const summaryText = activeCabinIssue.metadata?.summary || activeCabinIssue.description || "";
        const cleanSummary = cleanSummaryForSpeech(summaryText);
        if (cleanSummary.length > 0) {
          const sentences = splitParagraphIntoSentences(cleanSummary);
          if (sentences.length > 0) {
            sentences.forEach((sentence: string) => {
              chunks.push(sentence);
              targetElementIds.push("");
            });
          } else {
            chunks.push(cleanSummary);
            targetElementIds.push("");
          }
        }
      }

      sentenceChunksRef.current = chunks;
      chunkTargetElementIdsRef.current = targetElementIds;

      const meta = (activeCabinIssue.metadata || {}) as Record<string, any>;
      const audioKey = `${selectedVoice}_${selectedLanguage}`;
      const cachedAudio = meta.audios?.[audioKey];

      const readyStamps = cachedAudio?.sentence_timestamps || meta.sentence_timestamps || [];
      const rawUrl = cachedAudio?.audio_url || meta.audio_url;

      const isAudioAvailable = Boolean(
        rawUrl &&
        (cachedAudio?.status === "ready" || meta.audio_status === "ready" || Boolean(rawUrl && rawUrl.length > 10))
      );

      if (isAudioAvailable) {
        const readyUrl = rawUrl && !rawUrl.includes("?t=") && !rawUrl.includes("&t=")
          ? `${rawUrl}${rawUrl.includes("?") ? "&" : "?"}t=${Date.now()}`
          : rawUrl;
        setAudioUrl(readyUrl);
        setSentenceTimestamps(readyStamps);
        setAudioError(null);
        setIsGeneratingAudio(false);
        setAudioProgressPercent(100);
      } else {
        if (meta.audio_status === "processing") {
          setIsGeneratingAudio(true);
          const curProgress = typeof meta.audio_progress_percent === "number" ? meta.audio_progress_percent : 10;
          setAudioProgressPercent(curProgress);
        } else {
          setIsGeneratingAudio(false);
          setAudioProgressPercent(100);
        }
        setAudioError(null);

        let isCancelled = false;
        let pollTimer: NodeJS.Timeout | null = null;

        const pollProgress = async () => {
          try {
            const { data: currentDoc } = await supabase
              .from("documents")
              .select("metadata")
              .eq("id", activeCabinIssue.id)
              .single();

            if (isCancelled || !currentDoc) return;

            const updatedMeta = currentDoc.metadata || {};
            const curAudioKey = `${selectedVoice}_${selectedLanguage}`;
            const curCachedAudio = updatedMeta.audios?.[curAudioKey];

            const syncMetaToState = (newMeta: any) => {
              setIssues((prevList: MagazineIssue[]) =>
                prevList.map((iss) => (iss.id === activeCabinIssue.id ? { ...iss, metadata: newMeta } : iss))
              );
            };

            if (curCachedAudio && curCachedAudio.status === "ready" && curCachedAudio.audio_url) {
              setAudioUrl(curCachedAudio.audio_url);
              setSentenceTimestamps(curCachedAudio.sentence_timestamps || []);
              setIsGeneratingAudio(false);
              setAudioProgressPercent(100);
              syncMetaToState(updatedMeta);
              return;
            }

            if (
              updatedMeta.audio_url &&
              updatedMeta.audio_status === "ready"
            ) {
              setAudioUrl(updatedMeta.audio_url);
              setSentenceTimestamps(updatedMeta.sentence_timestamps || []);
              setIsGeneratingAudio(false);
              setAudioProgressPercent(100);
              syncMetaToState(updatedMeta);
              return;
            }

            if (updatedMeta.audio_status === "error") {
              setIsGeneratingAudio(false);
              setAudioError(updatedMeta.audio_error || "Error al generar el audio de la revista.");
              syncMetaToState(updatedMeta);
              return;
            }

            if (typeof updatedMeta.audio_progress_percent === "number") {
              setAudioProgressPercent((prev) => Math.max(prev, updatedMeta.audio_progress_percent));
            }
            syncMetaToState(updatedMeta);

            // Schedule next poll
            pollTimer = setTimeout(pollProgress, 3000);
          } catch (pollErr) {
            console.warn("[Audio Poll Error]", pollErr);
            pollTimer = setTimeout(pollProgress, 4000);
          }
        };

        // Start polling for background progress updates if processing
        if (meta.audio_status === "processing") {
          pollProgress();
        }

        return () => {
          isCancelled = true;
          if (pollTimer) clearTimeout(pollTimer);
        };
      }
    } else {
      setAudioUrl(null);
      setSentenceTimestamps([]);
      setIsGeneratingAudio(false);
      setIsPlayingAudio(false);
      setIsPausedAudio(false);
      setActiveSentenceIdx(-1);
      activeSentenceIndexRef.current = -1;
      setAudioError(null);
    }
  }, [activeCabinIssue?.id, cabinArticles, loadingArticles, selectedVoice, selectedLanguage]);

  const playFirstArticleForPage = (pageNumber: number) => {
    if (!cabinArticles || cabinArticles.length === 0) return;

    let targetArticle = cabinArticles.find(
      (art) => Number(art.metadata?.start_page) === pageNumber
    );

    if (!targetArticle) {
      targetArticle = cabinArticles.find((art) => {
        const start = Number(art.metadata?.start_page || 0);
        const end = Number(art.metadata?.end_page || start);
        return start > 0 && pageNumber >= start && pageNumber <= end;
      });
    }

    if (!targetArticle) {
      targetArticle = cabinArticles.find(
        (art) => Number(art.metadata?.start_page || 0) > pageNumber
      );
    }

    if (!targetArticle) {
      targetArticle = cabinArticles[0];
    }

    if (targetArticle) {
      const headerTargetId = `article-title-${targetArticle.id}`;
      let chunkIdx = chunkTargetElementIdsRef.current.indexOf(headerTargetId);
      if (chunkIdx < 0) {
        chunkIdx = chunkTargetElementIdsRef.current.indexOf(`sentence-${targetArticle.id}-0-0`);
      }
      if (chunkIdx < 0) {
        chunkIdx = chunkTargetElementIdsRef.current.findIndex((id) => id.startsWith(`sentence-${targetArticle.id}-`));
      }
      if (chunkIdx >= 0) {
        handleSentenceClick(chunkIdx);
      } else if (sentenceChunksRef.current.length > 0) {
        handleSentenceClick(0);
      }
    }
  };

  const handleTriggerSummarize = async () => {
    if (!activeCabinIssue) return;
    setGeneratingSummary(true);
    setAudioError(null);
    try {
      const issueSlug = activeCabinIssue.metadata?.slug || "";
      const res = await fetch("/api/news/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issueSlug,
          docId: activeCabinIssue.id,
          title: activeCabinIssue.title
        })
      });
      const data = await res.json();
      if (data.success && data.summary) {
        // Update activeCabinIssue summary metadata locally
        const updatedIssue = {
          ...activeCabinIssue,
          metadata: {
            ...(activeCabinIssue.metadata || {}),
            summary: data.summary
          }
        };
        setActiveCabinIssue(updatedIssue);
      } else {
        throw new Error(data.error || "No se pudo generar el resumen Markdown.");
      }
    } catch (err: any) {
      console.error("[Study Cabin] Error generating markdown summary:", err);
      setAudioError(err.message || "Error al procesar el resumen con IA.");
    } finally {
      setGeneratingSummary(false);
    }
  };

  const handleTriggerTranscribe = async () => {
    if (!activeCabinIssue) return;
    setTranscribingPDF(true);
    setAudioError(null);
    setPdfTranscriptionError(null);
    try {
      const issueSlug = activeCabinIssue.metadata?.slug || "";
      const res = await fetch("/api/news/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issueSlug,
          pdfUrl: activeCabinIssue.file_url,
          title: activeCabinIssue.title
        })
      });
      const data = await res.json();
      if (data.success && data.transcription) {
        if (data.modelUsed) {
          setPdfTranscriptionModel(`Google AI Studio ${data.modelUsed}`);
        } else {
          setPdfTranscriptionModel("Google AI Studio Gemini Flash");
        }
        // Re-fetch cabin articles from Supabase
        const { data: articles } = await supabase
          .from("documents")
          .select("*")
          .in("type", ["knowledge_transcription", "knowledge_article_transcription", "knowledge_article_analysis", "knowledge_analysis"])
          .eq("metadata->>is_magazine_article", "true")
          .eq("metadata->>issue_slug", issueSlug);
        if (articles && articles.length > 0) {
          setCabinArticles(articles);
        }
      } else {
        throw new Error(data.error || "No se pudo transcribir el PDF.");
      }
    } catch (err: any) {
      console.error("[Study Cabin] Error transcribing PDF:", err);
      setPdfTranscriptionError(err.message || "Error al transcribir el PDF con IA.");
    } finally {
      setTranscribingPDF(false);
    }
  };

  const handleReanalyzeIssue = async (issue: MagazineIssue) => {
    if (!issue || isReanalyzing) return;
    setIsReanalyzing(true);
    setReanalysisProgress(5);
    setAudioError(null);
    setPdfTranscriptionError(null);

    const progressInterval = setInterval(() => {
      setReanalysisProgress((prev) => {
        if (prev >= 92) return prev;
        const diff = 95 - prev;
        return Math.min(95, prev + Math.max(1, Math.floor(diff * 0.15)));
      });
    }, 600);

    try {
      const issueSlug = issue.metadata?.slug || "";

      // 1. Trigger Full Verbatim PDF Transcription
      const transcribeRes = await fetch("/api/news/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issueSlug,
          pdfUrl: issue.file_url,
          title: issue.title
        })
      });
      const transcribeData = await transcribeRes.json();
      if (!transcribeData.success) {
        throw new Error(transcribeData.error || "Error al re-analizar transcripción.");
      }
      if (transcribeData.modelUsed) {
        setPdfTranscriptionModel(`Google AI Studio ${transcribeData.modelUsed}`);
      }

      // 2. Trigger Executive Markdown Summary Generation
      const summaryRes = await fetch("/api/news/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issueSlug,
          title: issue.title
        })
      });
      const summaryData = await summaryRes.json();

      // 3. Re-fetch articles from Supabase
      const { data: articles } = await supabase
        .from("documents")
        .select("*")
        .in("type", ["knowledge_transcription", "knowledge_article_transcription", "knowledge_article_analysis", "knowledge_analysis"])
        .eq("metadata->>is_magazine_article", "true")
        .eq("metadata->>issue_slug", issueSlug)
        .order("created_at", { ascending: true });

      if (articles && articles.length > 0) {
        setCabinArticles(articles);
      }

      // 4. Update magazine issues in state
      if (summaryData.success && summaryData.summary) {
        setIssues((prev) =>
          prev.map((i) =>
            i.id === issue.id
              ? { ...i, description: summaryData.summary }
              : i
          )
        );
        setActiveCabinIssue((prev) =>
          prev && prev.id === issue.id
            ? { ...prev, description: summaryData.summary }
            : prev
        );
      }

      setReanalysisProgress(100);
    } catch (err: any) {
      console.error("[Study Cabin] Error re-analyzing magazine issue:", err);
      setPdfTranscriptionError(err.message || "Error al re-analizar la publicación con IA.");
    } finally {
      clearInterval(progressInterval);
      setTimeout(() => {
        setIsReanalyzing(false);
        setReanalysisProgress(0);
      }, 800);
    }
  };

  // Advanced index engine - binds summary words or direct paragraph IDs to literal paragraphs in the magazine
  const scrollToBestMatchingParagraph = (sentence: string, chunkIdx?: number) => {
    if (!cabinArticles || cabinArticles.length === 0) return;
    
    if (chunkIdx !== undefined && chunkIdx >= 0) {
      const targetId = chunkTargetElementIdsRef.current[chunkIdx];
      if (targetId) {
        // Bidirectional sync: keep PDF viewer steady during reading unless user clicks article header
        const matchedArt = cabinArticles.find((art) =>
          targetId.includes(art.id)
        );

        const element = document.getElementById(targetId);
        if (element) {
          setTranscriptionCollapsed(false);
          setTimeout(() => {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 150);
          return;
        }
      }
    }

    // Fallback: Clean and split sentence into keyword terms of length > 4
    const words = sentence
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
      .split(/\s+/)
      .filter(w => w.length > 4);

    if (words.length === 0) return;

    let bestMatch = { articleId: "", pIdx: -1, score: -1 };

    cabinArticles.forEach(art => {
      const paragraphs = art.metadata?.paragraphs || [];
      paragraphs.forEach((p: string, pIdx: number) => {
        const cleanP = p.toLowerCase();
        let score = 0;
        words.forEach(word => {
          if (cleanP.includes(word)) {
            score++;
          }
        });

        if (score > bestMatch.score) {
          bestMatch = { articleId: art.id, pIdx, score };
        }
      });
    });

    // Score > 1 ensures we matches at least 2 relevant words to avoid false positive jumps
    if (bestMatch.score > 1) {
      const elementId = `sentence-${bestMatch.articleId}-${bestMatch.pIdx}-0`;
      const element = document.getElementById(elementId);
      if (element) {
        setTranscriptionCollapsed(false);
        setTimeout(() => {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 150);
      }
    }
  };

  // Form State for Manual Upload
  const [formTitle, setFormTitle] = useState("");
  const [formAuthor, setFormAuthor] = useState("Gerald Celente / Trends Journal");
  const [formPageCount, setFormPageCount] = useState("");
  const [formCoverUrl, setFormCoverUrl] = useState("");
  const [formFileUrl, setFormFileUrl] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPublishedAt, setFormPublishedAt] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("hivex_selected_language") || "en";
      setSelectedLanguage(saved);
    }
  }, []);

  useEffect(() => {
    const handleLangChanged = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && typeof customEvent.detail === "string") {
        setSelectedLanguage(customEvent.detail);
      }
    };
    window.addEventListener("languageChanged", handleLangChanged);
    return () => {
      window.removeEventListener("languageChanged", handleLangChanged);
    };
  }, []);

  const lang = selectedLanguage || "en";
  const currTrans = newsTranslations[lang] || newsTranslations["en"];

  // 1. Fetch magazine content from DB
  const fetchContent = async () => {
    try {
      setLoading(true);
      const { data: issuesData, error: issuesErr } = await supabase
        .from("documents")
        .select("*")
        .in("type", ["knowledge_transcription", "knowledge_summary"])
        .eq("metadata->>is_magazine_issue", "true")
        .order("created_at", { ascending: false });

      if (issuesErr) throw issuesErr;

      const items = (issuesData || []) as MagazineIssue[];
      setIssues(items);
      
      // Auto-select first issue if none is selected
      if (items.length > 0 && !selectedIssue) {
        setSelectedIssue(items[0]);
      }
    } catch (err) {
      console.error("Failed to load News content:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContent();
  }, []);

  // 2. Trigger Manual Re-sync from Trends Journal
  const triggerSync = async () => {
    try {
      setSyncing(true);
      setSyncStatus("Autenticando contra Trends Journal...");
      
      let authHeader = "";
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          authHeader = session.access_token;
        }
      } catch (e) {
        console.warn("Could not retrieve session token:", e);
      }

      if (!authHeader) {
        authHeader = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "mock-token-local-dev";
      }

      const res = await fetch("/api/news/sync", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${authHeader}`,
          "Content-Type": "application/json"
        }
      });

      const data = await res.json();
      if (data.success) {
        setSyncStatus(currTrans.syncSuccess);
        fetchContent();
        setTimeout(() => setSyncStatus(null), 8000);
      } else {
        setSyncStatus(`Error: ${data.error || "Could not complete sync."}`);
        setTimeout(() => setSyncStatus(null), 6000);
      }
    } catch (err: any) {
      setSyncStatus(`Error: ${err.message || "Network error connected to server."}`);
      setTimeout(() => setSyncStatus(null), 6000);
    } finally {
      setSyncing(false);
    }
  };

  // 3. Toggle favorite status directly in documents metadata
  const toggleFavoriteIssue = async (issue: MagazineIssue) => {
    const isFav = !issue.metadata?.is_favorite;

    // Optimistic UI update
    setIssues(prev => prev.map(item => {
      if (item.id === issue.id) {
        return {
          ...item,
          metadata: {
            ...item.metadata,
            is_favorite: isFav
          }
        };
      }
      return item;
    }));

    if (selectedIssue?.id === issue.id) {
      setSelectedIssue(prev => prev ? {
        ...prev,
        metadata: {
          ...prev.metadata,
          is_favorite: isFav
        }
      } : null);
    }

    try {
      const { error } = await supabase
        .from("documents")
        .update({
          metadata: {
            ...issue.metadata,
            is_favorite: isFav
          }
        })
        .eq("id", issue.id);

      if (error) throw error;
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
    }
  };

  // 4. Delete magazine issue
  const handleDeleteIssue = async (id: string) => {
    if (confirm(currTrans.confirmDelete)) {
      try {
        const { error } = await supabase.from("documents").delete().eq("id", id);
        if (error) throw error;

        const remaining = issues.filter(item => item.id !== id);
        setIssues(remaining);

        if (selectedIssue?.id === id) {
          setSelectedIssue(remaining.length > 0 ? remaining[0] : null);
        }
      } catch (err) {
        console.error("Failed to delete magazine issue:", err);
      }
    }
  };

  // 5. Handle manual magazine insertion with dynamic PDF page counting
  const handleCreateMagazine = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      if (!formTitle || !formFileUrl) {
        throw new Error("El título y la URL del archivo PDF son obligatorios.");
      }

      // Calculate page count using pdf-lib on the client side if empty
      let pageCount = parseInt(formPageCount);
      if (isNaN(pageCount) || pageCount <= 0) {
        try {
          console.log("Reading PDF from URL to count pages dynamically...");
          const res = await fetch(formFileUrl);
          const arrayBuffer = await res.arrayBuffer();
          const { PDFDocument } = await import("pdf-lib");
          const pdfDoc = await PDFDocument.load(arrayBuffer, { 
            updateMetadata: false, 
            ignoreEncryption: true 
          });
          pageCount = pdfDoc.getPageCount();
          console.log("Counted exact PDF pages:", pageCount);
        } catch (pdfErr) {
          console.warn("Could not calculate page count dynamically from URL, using default fallback (48):", pdfErr);
          pageCount = 48; // Standard fallback
        }
      }

      const payload = {
        title: formTitle,
        description: formDescription,
        file_url: formFileUrl,
        type: "knowledge_transcription",
        metadata: {
          is_magazine_issue: true,
          slug: formTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          cover_url: formCoverUrl || "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80",
          published_at: formPublishedAt ? new Date(formPublishedAt).toISOString() : new Date().toISOString(),
          summary: formDescription,
          author: formAuthor || "Gerald Celente / Trends Journal",
          page_count: pageCount,
          is_favorite: false
        }
      };

      const { data, error } = await supabase
        .from("documents")
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      setFormSuccess("¡Edición de magazine subida y registrada correctamente!");
      
      // Reset form states
      setFormTitle("");
      setFormAuthor("Gerald Celente / Trends Journal");
      setFormPageCount("");
      setFormCoverUrl("");
      setFormFileUrl("");
      setFormDescription("");
      setFormPublishedAt("");

      // Re-fetch list
      await fetchContent();

      // Auto-select the newly added item
      if (data) {
        setSelectedIssue(data as MagazineIssue);
      }

      setTimeout(() => setFormSuccess(null), 6000);
    } catch (err: any) {
      setFormError(err.message || "Fallo al registrar la nueva edición del magazine.");
    } finally {
      setFormLoading(false);
    }
  };

  // Filter issues based on favorite status and search query
  const filteredIssues = issues.filter(issue => {
    const matchesFavorite = filterFavorite ? !!issue.metadata?.is_favorite : true;
    const matchesSearch = issue.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (issue.description || "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFavorite && matchesSearch;
  });

  /* MAGNIFICENT PREMIUM STUDY CABIN FOR MAGAZINES - RENDERED IN PAGE FLOW MATCHING VIDEO STUDY CABIN PARITY */
  if (activeCabinIssue) {
    const rawLocalizedTitle = getLocalizedTitle(activeCabinIssue.title, selectedLanguage);
    const titleParts = rawLocalizedTitle.split(/\s*[-–—|]\s*/);
    const mainTitle = titleParts[0]?.trim() || rawLocalizedTitle;
    const dateSubtitle = titleParts.length > 1 ? titleParts.slice(1).join(" - ").trim() : "";

    return (
      <div className="min-h-screen text-slate-100 p-6 md:p-8 space-y-8 animate-fade-in relative pb-12">

        {/* Back and Title Header Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-zinc-900/60">
          <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
            <button
              onClick={() => {
                stopCabinAudio();
                setActiveCabinIssue(null);
              }}
              className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer flex-shrink-0 mt-1 sm:mt-0"
            >
              {selectedLanguage === "es" ? "← Volver al Catálogo" : selectedLanguage === "de" ? "← Zurück zum Katalog" : selectedLanguage === "tr" ? "← Kataloğa Dön" : "← Back to Catalog"}
            </button>
            <div className="h-10 w-px bg-zinc-900 hidden md:block flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  {selectedLanguage === "es" ? "CABINA DE ESTUDIO" : selectedLanguage === "de" ? "STUDIENKABINE" : selectedLanguage === "tr" ? "ÇALIŞMA KABİNİ" : "STUDY CABIN"}
                </span>
                <span className="text-[10px] font-bold text-zinc-500">
                  {selectedLanguage === "es" ? "HIVEX Inteligente" : selectedLanguage === "de" ? "HIVEX Intelligent" : selectedLanguage === "tr" ? "HIVEX Akıllı" : "HIVEX Intelligent"}
                </span>
              </div>
              <h1 className="text-xl md:text-2xl lg:text-3xl font-black tracking-tight text-white mt-1 leading-tight break-words">
                {mainTitle}
              </h1>
              {dateSubtitle ? (
                <p className="text-xs sm:text-sm font-semibold text-cyan-400/90 mt-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                  <span>{getLocalizedTitle(dateSubtitle, selectedLanguage)}</span>
                </p>
              ) : (activeCabinIssue.metadata?.published_at || activeCabinIssue.created_at) ? (
                <p className="text-xs sm:text-sm font-semibold text-cyan-400/90 mt-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                  <span>{new Date(activeCabinIssue.metadata?.published_at || activeCabinIssue.created_at).toLocaleDateString(selectedLanguage === "es" ? "es-ES" : selectedLanguage === "de" ? "de-DE" : selectedLanguage === "tr" ? "tr-TR" : "en-US", { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-end lg:items-center justify-end gap-2.5 ml-auto flex-shrink-0 select-none">
            {isGeneratingAudio ? (
              <div className="px-3.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-[11px] font-mono text-amber-300 font-bold flex items-center gap-2 shadow-sm animate-pulse">
                <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
                <span>{selectedLanguage === "es" ? `Audio en 2º Plano: ${audioProgressPercent}%` : `Background Audio: ${audioProgressPercent}%`}</span>
              </div>
            ) : null}
            <div className="px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-mono text-emerald-400 font-bold max-w-[280px] sm:max-w-xs truncate">
              {selectedLanguage === "es" ? "Revista" : selectedLanguage === "de" ? "Magazin" : selectedLanguage === "tr" ? "Dergi" : "Magazine"}: {mainTitle}
            </div>
            <button
              onClick={() => handleReanalyzeIssue(activeCabinIssue)}
              disabled={isReanalyzing || transcribingPDF}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 hover:border-amber-500/50 text-[11px] font-mono text-amber-400 font-bold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isReanalyzing || transcribingPDF ? 'animate-spin' : ''}`} />
              {isReanalyzing || transcribingPDF
                ? (selectedLanguage === "es" ? "Re-analizando..." : selectedLanguage === "de" ? "Wird neu analysiert..." : selectedLanguage === "tr" ? "Yeniden Analiz Ediliyor..." : "Re-analyzing...")
                : (selectedLanguage === "es" ? "Re-analizar Inteligencia" : selectedLanguage === "de" ? "Intelligenz neu analysieren" : selectedLanguage === "tr" ? "Zekayı Yeniden Analiz Et" : "Re-analyze Intelligence")}
            </button>
          </div>
        </div>

        {/* Cabin Work Area */}
        <div className="space-y-6 sm:space-y-8">
            
            {/* SECTION 2.1: MAIN COVER WINDOW FRAME - MATCHING VIDEO STUDY CABIN STRUCTURE & SIZING */}
            <div ref={topFrameRef} className="space-y-3">
              <div className="flex items-center justify-between pb-2.5 border-b border-zinc-900">
                <div className="flex items-center gap-2 flex-wrap">
                  <Monitor className="w-4 h-4 text-cyan-400 animate-pulse" />
                  <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                    {selectedLanguage === "es" ? "Publicación Original Completa de Estudio" : "Original Full Study Publication"}
                  </h3>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-900 bg-zinc-900/20 overflow-hidden relative shadow-2xl">
                <div className="px-4 py-2.5 bg-zinc-900/40 border-b border-zinc-900/80 flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                    {selectedLanguage === "es" ? "Visualización de Publicación Real en Vivo" : "Live Full Publication View"}
                  </span>
                  <div className="flex items-center gap-2">
                    {activeCabinIssue.file_url && (
                      <div className="flex items-center gap-1.5 bg-zinc-950/80 border border-zinc-800 rounded-lg px-2 py-1">
                        <button
                          onClick={() => setCabinSelectedPage(prev => Math.max(1, prev - 1))}
                          disabled={cabinSelectedPage <= 1}
                          className="p-1 rounded hover:bg-zinc-800 text-zinc-300 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                          title={selectedLanguage === "es" ? "Página Anterior" : "Previous Page"}
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[11px] font-mono font-bold text-indigo-300 min-w-[50px] text-center">
                          {selectedLanguage === "es" ? `Pág. ${cabinSelectedPage}` : `Pg. ${cabinSelectedPage}`}
                        </span>
                        <button
                          onClick={() => setCabinSelectedPage(prev => prev + 1)}
                          className="p-1 rounded hover:bg-zinc-800 text-zinc-300 transition-colors cursor-pointer"
                          title={selectedLanguage === "es" ? "Página Siguiente" : "Next Page"}
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    <span className="text-[9px] text-zinc-500 font-mono hidden sm:inline">
                      ID: {activeCabinIssue.metadata?.slug || activeCabinIssue.id || "magazine"}
                    </span>
                  </div>
                </div>

                <div className="relative w-full h-[380px] xs:h-[460px] sm:h-[580px] md:h-[680px] bg-zinc-950 flex items-center justify-center overflow-hidden">
                  {/* AI Circular Percentage Progress Overlay during re-analysis, transcription, or translation */}
                  {(isReanalyzing || transcribingPDF || isTranslatingArticles) && (
                    <div className="absolute inset-0 z-30 bg-zinc-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 space-y-6 text-center animate-fadeIn">
                      <div className="relative w-28 h-28 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 112 116">
                          <defs>
                            <linearGradient id="gradientProgress" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#6366f1" />
                              <stop offset="50%" stopColor="#a855f7" />
                              <stop offset="100%" stopColor="#f59e0b" />
                            </linearGradient>
                          </defs>
                          <circle cx="56" cy="58" r="48" stroke="#18181b" strokeWidth="6" fill="transparent" />
                          <circle
                            cx="56"
                            cy="58"
                            r="48"
                            stroke="url(#gradientProgress)"
                            strokeWidth="6"
                            fill="transparent"
                            strokeDasharray={2 * Math.PI * 48}
                            strokeDashoffset={2 * Math.PI * 48 * (1 - ((isTranslatingArticles ? translationProgress : reanalysisProgress) || 0) / 100)}
                            strokeLinecap="round"
                            className="transition-all duration-300 ease-out"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center space-y-0.5">
                          <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-amber-400 font-mono tracking-tighter">
                            {isTranslatingArticles ? translationProgress : reanalysisProgress}%
                          </span>
                          <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest animate-pulse">
                            {selectedLanguage === "es" ? "Procesando" : selectedLanguage === "de" ? "Bearbeitung" : selectedLanguage === "tr" ? "İşleniyor" : "Processing"}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5 max-w-sm">
                        <div className="text-xs font-bold text-zinc-200 flex items-center justify-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                          <span>
                            {isTranslatingArticles
                              ? selectedLanguage === "es"
                                ? "Traduciendo Transcripción Jurídica al Español"
                                : selectedLanguage === "de"
                                ? "Übersetzung der rechtlichen Transkription"
                                : selectedLanguage === "tr"
                                ? "Hukuki Çeviri İşlemi Devam Ediyor"
                                : "Translating Verbatim Legal Transcription"
                              : selectedLanguage === "es"
                              ? "Re-análisis de Inteligencia con IA en Curso"
                              : "AI Intelligence Re-analysis in Progress"}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-500 leading-relaxed">
                          {isTranslatingArticles
                            ? selectedLanguage === "es"
                              ? "El contenido completo de los artículos de la revista se está traduciendo e indexando en tiempo real con Google AI Studio Gemini. Las tarjetas y el audio se actualizarán automáticamente al finalizar."
                              : selectedLanguage === "de"
                              ? "Der Inhalt der Magazinartikel wird in Echtzeit mit Google AI Studio Gemini übersetzt und indiziert. Karten und Audio werden nach Abschluss automatisch aktualisiert."
                              : selectedLanguage === "tr"
                              ? "Dergi makalelerinin tüm içeriği Google AI Studio Gemini ile gerçek zamanlı olarak çevriliyor ve indeksleniyor. Kartlar ve ses otomatik olarak güncellenecektir."
                              : "The full content of magazine articles is being translated and indexed in real time with Google AI Studio Gemini. The cards and audio will update automatically once completed."
                            : selectedLanguage === "es"
                            ? "El PDF completo de la publicación está siendo digerido e indexado palabra por palabra con el modelo de élite Google AI Studio Gemini. Las tarjetas y el audio se actualizarán automáticamente al finalizar."
                            : "The full publication PDF is being digested and indexed word-for-word with Google AI Studio Gemini. The cards and audio will update automatically once completed."}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Interactive Live PDF Viewer displaying real publication at exact page */}
                  {activeCabinIssue.file_url ? (
                    <PdfViewer
                      url={activeCabinIssue.file_url}
                      page={cabinSelectedPage}
                      onPageChange={(pageNum) => setCabinSelectedPage(pageNum)}
                      onPageClick={(pageNum) => playFirstArticleForPage(pageNum)}
                    />
                  ) : (
                    <div className="relative z-10 w-full h-full flex items-center justify-center bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-xl">
                      <BookOpen className="w-16 h-16 text-zinc-700" />
                    </div>
                  )}

                  {/* Left Side: Prev Page Floating Control */}
                  {activeCabinIssue.file_url && (
                    <button
                      onClick={() => setCabinSelectedPage(prev => Math.max(1, prev - 1))}
                      disabled={cabinSelectedPage <= 1}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-zinc-950/70 hover:bg-zinc-900 border border-zinc-800 hover:border-indigo-500/80 text-zinc-300 hover:text-white shadow-xl backdrop-blur-sm flex items-center justify-center transition-all opacity-40 hover:opacity-100 disabled:opacity-10 disabled:pointer-events-none cursor-pointer group/prev select-none"
                      title={selectedLanguage === "es" ? "Página Anterior" : "Previous Page"}
                    >
                      <ChevronLeft className="w-5 h-5 text-indigo-400 group-hover/prev:-translate-x-0.5 transition-transform shrink-0" />
                    </button>
                  )}

                  {/* Right Side: Next Page Floating Control */}
                  {activeCabinIssue.file_url && (
                    <button
                      onClick={() => setCabinSelectedPage(prev => prev + 1)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-zinc-950/70 hover:bg-zinc-900 border border-zinc-800 hover:border-indigo-500/80 text-zinc-300 hover:text-white shadow-xl backdrop-blur-sm flex items-center justify-center transition-all opacity-40 hover:opacity-100 cursor-pointer group/next select-none"
                      title={selectedLanguage === "es" ? "Página Siguiente" : "Next Page"}
                    >
                      <ChevronRight className="w-5 h-5 text-indigo-400 group-hover/next:translate-x-0.5 transition-transform shrink-0" />
                    </button>
                  )}

                  {/* Bottom Control Bar: Audio for Current Page & Page Badge */}
                  <div className="absolute bottom-4 right-4 flex items-center gap-2 z-20 select-none">
                    {activeCabinIssue.file_url && (
                      <button
                        onClick={() => playFirstArticleForPage(cabinSelectedPage)}
                        className="px-3 py-1.5 rounded-xl bg-amber-500/90 hover:bg-amber-500 border border-amber-400/80 text-xs font-bold text-zinc-950 shadow-xl backdrop-blur-md flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                        title={selectedLanguage === "es" ? "Escuchar audio de esta página" : "Play audio for this page"}
                      >
                        <Volume2 className="w-3.5 h-3.5 text-zinc-950" />
                        <span>{selectedLanguage === "es" ? "Escuchar Pág." : "Play Page Audio"}</span>
                      </button>
                    )}
                    <span className="px-3 py-1.5 rounded-xl bg-zinc-950/90 border border-indigo-500/40 text-xs font-mono font-bold text-indigo-300 shadow-xl backdrop-blur-md">
                      {selectedLanguage === "es" ? `Página ${cabinSelectedPage}` : selectedLanguage === "de" ? `Seite ${cabinSelectedPage}` : selectedLanguage === "tr" ? `Sayfa ${cabinSelectedPage}` : `Page ${cabinSelectedPage}`}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ITEM 1: CARD 1 - AUDIO CONTROL PLAYER (POSITIONED DIRECTLY ABOVE VERBATIM TRANSCRIPTION CARD) */}
            <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-900/10 backdrop-blur relative overflow-hidden flex flex-col gap-6 shadow-xl">
              <div className="absolute top-0 left-0 w-32 h-32 bg-amber-500/5 blur-[40px] pointer-events-none" />

              {/* Header Row */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-900/60 pb-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                    <Headphones className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-sm font-extrabold text-white tracking-wide uppercase flex items-center gap-1.5">
                      {selectedLanguage === "es" ? "Reproductor Audio Verbatim Judicial" : "Verbatim Legal Audio Player"}
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20 uppercase">
                        PREMIUM IA
                      </span>
                    </h3>
                    <p className="text-[10px] text-zinc-500 font-medium">
                      {selectedLanguage === "es" ? "Navegación Interactiva de Locución de Transcripción Completa" : "Interactive Audio Narration of Verbatim Transcription"}
                    </p>
                  </div>
                </div>

                {/* Single Master Audio Element */}
                <audio
                  ref={singleAudioRef}
                  src={audioUrl || undefined}
                  className="hidden"
                  playsInline
                  preload="auto"
                  onTimeUpdate={handleAudioTimeUpdate}
                  onEnded={() => {
                    setIsPlayingAudio(false);
                    setIsPausedAudio(false);
                    setActiveSentenceIdx(-1);
                    activeSentenceIndexRef.current = -1;
                  }}
                  onError={(e) => {
                    console.error("[Single Audio] Error playing audio:", e);
                    setAudioError("Error al reproducir el archivo de audio.");
                    setIsPlayingAudio(false);
                    setIsPausedAudio(false);
                  }}
                />

                {/* Speed & Voice Selection Options */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Voice Selector */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                      VOICE:
                    </span>
                    <select
                      disabled
                      value="Aoede"
                      className="bg-zinc-950/40 border border-zinc-900 text-zinc-500 px-2.5 py-1 rounded-lg text-xs font-semibold outline-none transition-all select-none cursor-not-allowed opacity-70"
                    >
                      <option value="Aoede">Aoede (Female Narrator)</option>
                    </select>
                  </div>

                  {/* Speed Slider Control */}
                  <div className="flex items-center gap-3 bg-zinc-950/40 border border-zinc-800/30 px-3 py-1.5 rounded-xl select-none">
                    <span className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-wider">
                      SPEED:
                    </span>
                    <input
                      type="range"
                      min="1.0"
                      max="2.0"
                      step="0.1"
                      value={playbackRate}
                      onChange={(e) => handleRateChange(parseFloat(e.target.value))}
                      className="w-24 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500 outline-none transition-all hover:accent-amber-400"
                      style={{
                        background: `linear-gradient(to right, #f59e0b 0%, #f59e0b ${(playbackRate - 1.0) * 100}%, #27272a ${(playbackRate - 1.0) * 100}%, #27272a 100%)`
                      }}
                    />
                    <span className="text-xs font-mono font-bold text-amber-400 w-8 text-right shrink-0">
                      {playbackRate.toFixed(1)}x
                    </span>
                  </div>
                </div>
              </div>

              {/* Inner Track Control Box */}
              <div className="flex flex-col gap-5 w-full bg-zinc-950/40 border border-zinc-900/60 p-4 md:p-5 rounded-xl md:rounded-2xl select-none">
                <div className="w-full flex flex-col gap-4.5">
                  <div className="flex flex-col gap-2 w-full">
                    {isGeneratingAudio && (
                      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold flex flex-col gap-3 my-2 shadow-xl backdrop-blur-md">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <div className="p-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 shrink-0">
                              <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-extrabold text-amber-300 text-xs uppercase tracking-wider">
                                {selectedLanguage === "es"
                                  ? "Síntesis de Audio Asíncrona en Segundo Plano"
                                  : "Asynchronous Background Audio Synthesis"}
                              </span>
                              <span className="text-[11px] text-amber-200/80 font-normal">
                                {selectedLanguage === "es"
                                  ? "Generando locución desatendida en el servidor Vercel / Supabase..."
                                  : "Generating unattended voiceover on Vercel / Supabase server..."}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => {
                                if (!activeCabinIssue?.id) return;
                                fetch("/api/magazines/generate-audio", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    documentId: activeCabinIssue.id,
                                    voice: selectedVoice,
                                    language: selectedLanguage,
                                    sentences: sentenceChunksRef.current,
                                    forceRegenerate: true
                                  })
                                }).catch((err) => console.warn("[Force Regenerate Error]", err));
                              }}
                              title={selectedLanguage === "es" ? "Reiniciar síntesis de audio" : "Restart audio synthesis"}
                              className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3 text-amber-400" />
                              <span>{selectedLanguage === "es" ? "Forzar Reintento" : "Force Retry"}</span>
                            </button>
                            <span className="font-mono font-black text-amber-400 text-sm shrink-0 bg-amber-500/20 px-2.5 py-1 rounded-lg border border-amber-500/40 shadow-inner">
                              {audioProgressPercent}%
                            </span>
                          </div>
                        </div>

                        <div className="w-full bg-zinc-950/90 h-2.5 rounded-full overflow-hidden border border-amber-500/20 p-0.5">
                          <div
                            className="bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 h-full rounded-full transition-all duration-500 shadow-md shadow-amber-500/50"
                            style={{ width: `${Math.max(4, audioProgressPercent)}%` }}
                          />
                        </div>

                        <p className="text-[10px] text-zinc-400 font-medium italic flex items-center gap-1.5">
                          <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                          {selectedLanguage === "es"
                            ? "Puedes salir de esta cabina o cerrar la página. La tarea continúa en el servidor y mantendrá tu progreso."
                            : "You can leave this cabin or close the page. The background server task will preserve your progress."}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${isPlayingAudio && !isPausedAudio ? 'bg-amber-500 animate-pulse' : 'bg-zinc-600'}`} />
                        {selectedLanguage === "es"
                          ? "LOCUCIÓN NARRADA DE LA TRANSCRIPCIÓN LITERAL ORIGINAL"
                          : selectedLanguage === "de"
                          ? "NARRATIVE VORLESUNG DER ORIGINALEN WÖRTLICHEN TRANSKRIPTION"
                          : selectedLanguage === "tr"
                          ? "ORİJİNAL BİREBİR DEŞİFRENİN SESLENDİRMESİ"
                          : "NARRATED VOICEOVER OF THE ORIGINAL VERBATIM TRANSCRIPT"}
                      </span>
                      {isPlayingAudio && !isPausedAudio && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                          {selectedLanguage === "es" ? "En reproducción" : selectedLanguage === "de" ? "Wird abgespielt" : selectedLanguage === "tr" ? "Oynatılıyor" : "Now Playing"}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col md:flex-row items-center gap-2.5 md:gap-4 w-full">
                      {/* Dedicated Inline Buttons Group */}
                      <div className="shrink-0 flex items-center gap-1.5">
                        {/* Previous Sentence Button */}
                        <button
                          onClick={() => {
                            const prevIdx = activeSentenceIdx - 1;
                            if (prevIdx >= 0) handleSentenceClick(prevIdx);
                          }}
                          disabled={sentenceChunksRef.current.length === 0 || activeSentenceIdx <= 0}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                            activeSentenceIdx > 0
                              ? "bg-zinc-900/60 border border-zinc-800/60 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 active:scale-95"
                              : "bg-zinc-950/20 text-zinc-600 cursor-not-allowed border border-transparent"
                          }`}
                          title={selectedLanguage === "es" ? "Frase anterior" : selectedLanguage === "de" ? "Vorheriger Satz" : selectedLanguage === "tr" ? "Önceki cümle" : "Previous sentence"}
                        >
                          <SkipBack className="w-3 h-3 fill-current" />
                        </button>

                        {/* Play/Pause Button */}
                        <button
                          onClick={isPlayingAudio ? pauseCabinAudio : startCabinAudio}
                          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 scale-100 hover:scale-105 active:scale-95 ${
                            isPlayingAudio && !isPausedAudio
                              ? "bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-lg shadow-amber-500/20"
                              : "bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 hover:border-zinc-700"
                          }`}
                          title={
                            isPlayingAudio
                              ? (selectedLanguage === "es" ? "Pausar" : selectedLanguage === "de" ? "Pause" : selectedLanguage === "tr" ? "Duraklat" : "Pause")
                              : (selectedLanguage === "es" ? "Reproducir" : selectedLanguage === "de" ? "Abspielen" : selectedLanguage === "tr" ? "Oynat" : "Play")
                          }
                        >
                          {isPlayingAudio && !isPausedAudio ? (
                            <Pause className="w-3.5 h-3.5 fill-current" />
                          ) : (
                            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                          )}
                        </button>

                        {/* Next Sentence Button */}
                        <button
                          onClick={() => {
                            const nextIdx = activeSentenceIdx + 1;
                            if (nextIdx < sentenceChunksRef.current.length) handleSentenceClick(nextIdx);
                          }}
                          disabled={sentenceChunksRef.current.length === 0 || activeSentenceIdx >= sentenceChunksRef.current.length - 1}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                            sentenceChunksRef.current.length > 0 && activeSentenceIdx < sentenceChunksRef.current.length - 1
                              ? "bg-zinc-900/60 border border-zinc-800/60 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 active:scale-95"
                              : "bg-zinc-950/20 text-zinc-600 cursor-not-allowed border border-transparent"
                          }`}
                          title={selectedLanguage === "es" ? "Frase siguiente" : selectedLanguage === "de" ? "Nächster Satz" : selectedLanguage === "tr" ? "Sonraki cümle" : "Next sentence"}
                        >
                          <SkipForward className="w-3 h-3 fill-current" />
                        </button>

                        {/* Restart Button */}
                        <button
                          onClick={() => {
                            if (sentenceChunksRef.current.length > 0) handleSentenceClick(0);
                          }}
                          disabled={sentenceChunksRef.current.length === 0}
                          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all bg-zinc-900/60 border border-zinc-800/60 text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 active:scale-95"
                          title={selectedLanguage === "es" ? "Reiniciar reproducción" : selectedLanguage === "de" ? "Wiedergabe neustarten" : selectedLanguage === "tr" ? "Yeniden başlat" : "Restart playback"}
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Timer Display Badge: [00]:[00] / [03]:[24] */}
                      <div className="hidden md:flex items-center gap-1 text-[11px] shrink-0 font-mono font-bold text-zinc-400 bg-zinc-900/60 border border-zinc-800/40 px-2.5 py-1 rounded-lg">
                        <span className="text-amber-400 font-mono">[00]:[{activeSentenceIdx >= 0 ? (activeSentenceIdx + 1).toString().padStart(2, '0') : '00'}]</span>
                        <span className="text-zinc-600">/</span>
                        <span className="font-mono">[{sentenceChunksRef.current.length.toString().padStart(2, '0')}]</span>
                      </div>

                      {/* Timeline Scrubber Slider */}
                      <div className="flex-1 w-full flex items-center">
                        <input
                          type="range"
                          min="0"
                          max={Math.max(0, sentenceChunksRef.current.length - 1)}
                          value={activeSentenceIdx >= 0 ? activeSentenceIdx : 0}
                          onChange={(e) => handleSentenceClick(parseInt(e.target.value))}
                          disabled={sentenceChunksRef.current.length === 0}
                          className="w-full h-1.5 bg-zinc-800/80 rounded-lg appearance-none cursor-pointer accent-amber-500 outline-none transition-all hover:h-2"
                          style={{
                            background: (() => {
                              const percent = sentenceChunksRef.current.length > 1 
                                ? ((activeSentenceIdx >= 0 ? activeSentenceIdx : 0) / (sentenceChunksRef.current.length - 1)) * 100 
                                : 0;
                              return `linear-gradient(to right, #f59e0b 0%, #f59e0b ${percent}%, #27272a ${percent}%, #27272a 100%)`;
                            })()
                          }}
                        />
                      </div>

                      {/* Percentage Badge */}
                      <div className="hidden md:block shrink-0">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {(() => {
                            const percent = sentenceChunksRef.current.length > 0 
                              ? Math.round(((activeSentenceIdx >= 0 ? activeSentenceIdx + 1 : 0) / sentenceChunksRef.current.length) * 100)
                              : 0;
                            return `${percent}%`;
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Active Reading Sub-Card / Bubble */}
              <div className="h-12 bg-zinc-950/20 border border-zinc-900/60 rounded-xl px-4 flex items-center justify-between gap-4 overflow-hidden relative">
                {activeSentenceIdx >= 0 && sentenceChunksRef.current[activeSentenceIdx] ? (
                  <>
                    <div className="text-xs text-zinc-300 font-medium truncate flex-1 select-none italic">
                      &ldquo;{sentenceChunksRef.current[activeSentenceIdx]}&rdquo;
                    </div>
                    {isPlayingAudio && !isPausedAudio && (
                      <div className="flex items-center gap-0.5 shrink-0 h-6">
                        {[1, 2, 3, 4, 5, 6, 7].map((bar) => {
                          const heights = ["h-3", "h-5", "h-2", "h-6", "h-4", "h-5", "h-3"];
                          return (
                            <span
                              key={bar}
                              className={`w-0.5 bg-amber-400 rounded-full animate-pulse ${heights[bar % heights.length]}`}
                              style={{ animationDelay: `${bar * 120}ms` }}
                            />
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-xs text-zinc-500 font-medium select-none italic">
                    {selectedLanguage === "es"
                      ? "Locución verbatim preparada. Pulsa reproducir para escuchar."
                      : selectedLanguage === "de"
                      ? "Wörtliche Vorlesung bereit. Drücken Sie Wiedergabe zum Anhören."
                      : selectedLanguage === "tr"
                      ? "Birebir seslendirme hazır. Dinlemek için oynata basın."
                      : "Verbatim voiceover ready. Press play to listen."}
                  </div>
                )}
              </div>
            </div>

            {audioError && (
              <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-xl text-red-400 text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{audioError}</span>
                </div>
                <button
                  onClick={() => {
                    setAudioError(null);
                    if (activeSentenceIdx >= 0) handleSentenceClick(activeSentenceIdx);
                  }}
                  className="px-2.5 py-1 text-[10px] font-bold bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 rounded-lg transition-all"
                >
                  {selectedLanguage === "es" ? "Reintentar" : selectedLanguage === "de" ? "Erneut versuchen" : selectedLanguage === "tr" ? "Yeniden Dene" : "Retry"}
                </button>
              </div>
            )}

            {/* ITEM 2: CARD 2 - FULL LITERAL LEGAL TRANSCRIPTION (DIRECTLY BELOW AUDIO CONTROL PLAYER) */}
            <div id="verbatim-transcription-card" className="rounded-2xl border border-zinc-900 bg-black overflow-hidden relative shadow-xl group">
              <button
                onClick={() => setTranscriptionCollapsed(!transcriptionCollapsed)}
                className="w-full px-6 py-4 bg-zinc-900/10 hover:bg-zinc-900/20 border-b border-zinc-900/40 flex items-center justify-between transition-all group"
              >
                <div className="flex items-center gap-3">
                  <Volume2 className="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform" />
                  <div className="text-left">
                    <h3 className="text-sm font-extrabold text-white tracking-wide uppercase">
                      {selectedLanguage === "es"
                        ? "Transcripción Literal Original"
                        : selectedLanguage === "de"
                        ? "Originale wörtliche Transkription"
                        : selectedLanguage === "tr"
                        ? "Orijinal Deşifre Metni"
                        : "Original Verbatim Transcription"}
                    </h3>
                    <p className="text-[10px] text-zinc-500 font-medium">
                      {selectedLanguage === "es" ? "Soporte Judicial Verbatim Estricto" : "Strict Verbatim Judicial Support"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-zinc-900/50 group-hover:bg-zinc-800/80 border border-zinc-800/30 text-zinc-400 group-hover:text-white transition-all">
                    {transcriptionCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  </div>
                </div>
              </button>

              {!transcriptionCollapsed && (
                <div className="p-6 space-y-4 relative">
                  <div className="absolute top-0 left-0 w-32 h-32 bg-sky-500/5 blur-[40px] pointer-events-none" />

                  {/* Model Consumption & Active Live Connection Status Bar */}
                  <div className="p-4 rounded-xl border border-zinc-900/60 bg-zinc-950/40 backdrop-blur-md flex flex-col gap-3 relative z-10">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <div className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </div>
                        <span className="text-xs font-bold text-zinc-400">
                          {selectedLanguage === "es" ? "Consumo de Modelos:" : "Model Consumption:"}
                        </span>
                        <span className="text-xs font-mono text-zinc-100 bg-zinc-900/80 px-2.5 py-0.5 rounded border border-zinc-800">
                          {transcribingPDF
                            ? (selectedLanguage === "es" ? "Google AI Studio Gemini Flash (Llamando...)" : "Google AI Studio Gemini Flash (Calling...)")
                            : activeCabinIssue?.metadata?.transcription_model
                            ? `Google AI Studio ${activeCabinIssue.metadata.transcription_model}`
                            : pdfTranscriptionModel || "Google AI Studio Gemini Flash"}
                        </span>
                      </div>
                      <div>
                        {pdfTranscriptionError ? (
                          <span className="text-[9px] font-black text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2.5 py-0.5 rounded-full tracking-wider uppercase flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                            {selectedLanguage === "es" ? "ERROR DE CONEXIÓN" : "CONNECTION ERROR"}
                          </span>
                        ) : (
                          <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full tracking-wider uppercase flex items-center gap-1.5">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                            </span>
                            {selectedLanguage === "es" ? "Conexión en Vivo Activa" : "Active Live Connection"}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* RAW ERROR DISPLAY IF ERROR OCCURS */}
                    {pdfTranscriptionError && (
                      <div className="p-3.5 rounded-lg bg-rose-500/5 border border-rose-500/15 flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 text-rose-400 text-[10px] font-extrabold uppercase tracking-wider">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                          <span>{selectedLanguage === "es" ? "Detalle de Alerta en Google Cloud (Live API)" : "Google Cloud Alert Details (Live API)"}</span>
                        </div>
                        <p className="text-[11px] font-mono text-rose-400 break-all leading-normal whitespace-pre-wrap select-text selection:bg-rose-500/20 max-h-40 overflow-y-auto pr-1">
                          {pdfTranscriptionError}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* TRANSCRIPTION ARTICLES BODY */}
                  {loadingArticles || transcribingPDF || isTranslatingArticles ? (
                    <div className="space-y-6 max-w-4xl mx-auto pt-2 animate-pulse">
                      {/* Status Header pill during translation or initial load */}
                      <div className="p-3.5 rounded-xl bg-indigo-950/60 border border-indigo-500/40 text-indigo-200 text-xs font-semibold flex items-center gap-3 shadow-lg mb-4">
                        <Loader2 className="w-4 h-4 text-indigo-400 animate-spin flex-shrink-0" />
                        <span>
                          {isTranslatingArticles
                            ? selectedLanguage === "es"
                              ? "Traduciendo transcripción jurídica al español con Google Gemini..."
                              : selectedLanguage === "de"
                              ? "Übersetzung der rechtlichen Transkription ins Deutsche..."
                              : selectedLanguage === "tr"
                              ? "Hukuki döküm Türkçe diline çevriliyor..."
                              : "Translating verbatim transcription with Google Gemini..."
                            : selectedLanguage === "es"
                            ? "Procesando transcripción jurídica con Gemini Flash..."
                            : "Processing verbatim legal transcription with Gemini Flash..."}
                        </span>
                      </div>

                      {/* Skeleton Article Cards */}
                      {[1, 2, 3].map((skeletonIdx) => (
                        <div key={skeletonIdx} className="p-6 rounded-2xl bg-zinc-950/80 border border-zinc-900/80 space-y-4 shadow-md relative overflow-hidden">
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 to-purple-600 opacity-60" />
                          <div className="flex items-center justify-between border-b border-zinc-900/60 pb-3">
                            <div className="h-4 w-48 bg-zinc-900 rounded-md" />
                            <div className="h-3 w-16 bg-zinc-900 rounded-md" />
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="h-6 w-12 bg-indigo-950/80 rounded-md" />
                            <div className="h-5 w-3/4 bg-zinc-900 rounded-md" />
                          </div>
                          <div className="h-5 w-2/3 bg-zinc-900/80 rounded-md" />
                          <div className="space-y-2 pt-2">
                            <div className="h-4 w-full bg-zinc-900/60 rounded" />
                            <div className="h-4 w-11/12 bg-zinc-900/60 rounded" />
                            <div className="h-4 w-4/5 bg-zinc-900/60 rounded" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : cabinArticles.length > 0 ? (
                    <div className="space-y-6 max-w-4xl mx-auto pt-2">
                      {cabinArticles.map((art, aIdx) => {
                        const locArt = getLocalizedArticle(art, selectedLanguage);
                        return (
                          <div key={art.id} className="p-6 rounded-2xl bg-zinc-950 border border-zinc-900/80 shadow-md relative overflow-hidden group">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-cyan-500 to-sky-600 opacity-60" />
                            
                            {/* TOP ROW: Main Category Red Badge + Article Index */}
                            <div className="flex items-center justify-between pb-3 border-b border-zinc-900/60 mb-3.5">
                              <span className="text-[10px] font-black uppercase bg-red-950/80 border border-red-800/60 text-red-400 px-2.5 py-1 rounded-md tracking-wider shadow-sm">
                                {art.metadata?.main_category || "TRENDS ON THE ECONOMIC AND MARKET FRONT"}
                              </span>
                              <span className="text-[10px] text-zinc-600 font-bold">
                                {selectedLanguage === "es" ? `Artículo ${aIdx + 1}` : selectedLanguage === "de" ? `Artikel ${aIdx + 1}` : selectedLanguage === "tr" ? `Makale ${aIdx + 1}` : `Article ${aIdx + 1}`}
                              </span>
                            </div>

                            {/* SECOND ROW: Page Pill Badge + Subcategory Header */}
                            <div className="flex items-center gap-2.5 mb-2.5 flex-wrap">
                              {art.metadata?.start_page && (
                                <button
                                  onClick={() => {
                                    const p = Number(art.metadata?.start_page || 1);
                                    setCabinSelectedPage(p);
                                    topFrameRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                                  }}
                                  title={selectedLanguage === "es" ? `Ver página ${art.metadata.start_page} en la ventana superior` : selectedLanguage === "de" ? `Seite ${art.metadata.start_page} im oberen Fenster anzeigen` : selectedLanguage === "tr" ? `Üst pencerede sayfa ${art.metadata.start_page} göster` : `View page ${art.metadata.start_page} in top window`}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-indigo-500/50 bg-indigo-950/40 hover:bg-indigo-900/60 text-indigo-300 font-mono text-xs font-bold transition-all duration-200 cursor-pointer shadow-sm shadow-indigo-950/80 hover:scale-105 active:scale-95 flex-shrink-0 group/pill"
                                >
                                  <span className="text-[10px] text-indigo-400 font-bold group-hover/pill:scale-110 transition-transform">▶</span>
                                  <span className="underline decoration-indigo-400/70 underline-offset-2">
                                    {String(art.metadata.start_page).padStart(2, "0")}
                                  </span>
                                </button>
                              )}
                              <h3
                                onClick={() => {
                                  const p = Number(art.metadata?.start_page || 1);
                                  setCabinSelectedPage(p);
                                  topFrameRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                                }}
                                className="text-base sm:text-lg font-extrabold text-white tracking-tight uppercase cursor-pointer hover:text-cyan-300 transition-colors"
                              >
                                {locArt.subcategory}
                              </h3>
                            </div>

                            {/* THIRD ROW: Article Headline in Nomenclatura Hungarizada */}
                            <div className="mb-4">
                              {(() => {
                                const headerTargetId = `article-title-${art.id}`;
                                const activeTargetId = activeSentenceIdx >= 0 ? chunkTargetElementIdsRef.current[activeSentenceIdx] : null;
                                const isHeaderActive = activeTargetId === headerTargetId && isPlayingAudio;
                                return (
                                  <h4
                                    id={headerTargetId}
                                    onClick={() => {
                                      const p = Number(art.metadata?.start_page || 1);
                                      setCabinSelectedPage(p);
                                      topFrameRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

                                      const chunkIdx = chunkTargetElementIdsRef.current.indexOf(headerTargetId);
                                      if (chunkIdx >= 0) handleSentenceClick(chunkIdx);
                                    }}
                                    className={`text-sm sm:text-base font-bold tracking-wide cursor-pointer p-2.5 rounded-xl border transition-all duration-300 ${
                                      isHeaderActive
                                        ? "bg-amber-500/15 border-amber-500/60 text-amber-200 shadow-lg shadow-amber-950/40 ring-1 ring-amber-500/40"
                                        : "bg-transparent border-transparent text-indigo-200/90 hover:text-indigo-100 hover:bg-zinc-900/40"
                                    }`}
                                  >
                                    {toHungarianTitleCase(locArt.title)}
                                  </h4>
                                );
                              })()}
                            </div>

                            {/* FOURTH ROW: Paragraphs */}
                            <div className="space-y-3">
                              {locArt.paragraphs && locArt.paragraphs.length > 0 ? (
                                locArt.paragraphs.map((para: string, pIdx: number) => {
                                  const sentences = splitParagraphIntoSentences(para);
                                  const activeTargetId = activeSentenceIdx >= 0 ? chunkTargetElementIdsRef.current[activeSentenceIdx] : null;
                                  const isAnySentenceInParaActive = sentences.some((_, sIdx) => `sentence-${art.id}-${pIdx}-${sIdx}` === activeTargetId) && isPlayingAudio;

                                  return (
                                    <div
                                      key={pIdx}
                                      className={`p-3.5 rounded-xl border transition-colors duration-200 ${
                                        isAnySentenceInParaActive
                                          ? "bg-zinc-950/80 border-amber-500/30"
                                          : "bg-zinc-950/40 border-zinc-900/60 text-zinc-300 hover:bg-zinc-900/50 hover:border-zinc-800"
                                      }`}
                                    >
                                      <div className="flex items-start gap-3">
                                        {isAnySentenceInParaActive && (
                                          <div className="flex items-center gap-0.5 mt-1 shrink-0 h-4">
                                            <span className="w-1 h-3 bg-amber-400 rounded-full animate-pulse" style={{ animationDelay: "0ms" }} />
                                            <span className="w-1 h-4 bg-amber-400 rounded-full animate-pulse" style={{ animationDelay: "150ms" }} />
                                            <span className="w-1 h-2 bg-amber-400 rounded-full animate-pulse" style={{ animationDelay: "300ms" }} />
                                          </div>
                                        )}
                                        <p className="text-xs leading-relaxed text-justify flex-1">
                                          {sentences.length > 0 ? (
                                            sentences.map((sText: string, sIdx: number) => {
                                              const sentenceTargetId = `sentence-${art.id}-${pIdx}-${sIdx}`;
                                              const isSentenceActive = activeTargetId === sentenceTargetId && isPlayingAudio;
                                              return (
                                                <span
                                                  key={sIdx}
                                                  id={sentenceTargetId}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    const chunkIdx = chunkTargetElementIdsRef.current.indexOf(sentenceTargetId);
                                                    if (chunkIdx >= 0) handleSentenceClick(chunkIdx);
                                                  }}
                                                  className={`inline transition-colors duration-150 cursor-pointer rounded px-1 py-0.5 box-decoration-clone ${
                                                    isSentenceActive
                                                      ? "bg-amber-500/25 text-amber-200 font-normal border border-amber-400/50"
                                                      : "text-zinc-300 hover:text-white hover:bg-zinc-800/50"
                                                  }`}
                                                >
                                                  {sText}{" "}
                                                </span>
                                              );
                                            })
                                          ) : (
                                            <span
                                              id={`sentence-${art.id}-${pIdx}-0`}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                const chunkIdx = chunkTargetElementIdsRef.current.indexOf(`sentence-${art.id}-${pIdx}-0`);
                                                if (chunkIdx >= 0) handleSentenceClick(chunkIdx);
                                              }}
                                              className="cursor-pointer hover:text-white"
                                            >
                                              {para}
                                            </span>
                                          )}
                                        </p>
                                      </div>
                                    </div>
                                  );
                                })
                              ) : (
                                <p className="text-xs text-zinc-400 leading-relaxed text-justify whitespace-pre-wrap p-3.5 bg-zinc-950/40 border border-zinc-900/60 rounded-xl">{art.description}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-zinc-500 border border-dashed border-zinc-900/60 rounded-2xl space-y-3">
                      <p className="text-sm">
                        {selectedLanguage === "es"
                          ? "No hay transcripción jurídica almacenada aún para esta edición."
                          : selectedLanguage === "de"
                          ? "Für diese Ausgabe ist noch keine rechtliche Transkription gespeichert."
                          : selectedLanguage === "tr"
                          ? "Bu sayı için henüz saklanmış bir hukuki döküm yok."
                          : "No verbatim legal transcription stored for this edition yet."}
                      </p>
                      <button
                        onClick={handleTriggerTranscribe}
                        className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs rounded-xl transition-all inline-flex items-center gap-2"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>
                          {selectedLanguage === "es"
                            ? "Transcribir PDF Completo con IA"
                            : selectedLanguage === "de"
                            ? "Vollständiges PDF mit IA transkribieren"
                            : selectedLanguage === "tr"
                            ? "Yapay Zeka ile Tam PDF Deşifre Et"
                            : "Transcribe Full PDF with IA"}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {audioError && (
              <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-xl text-red-400 text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{audioError}</span>
                </div>
                <button
                  onClick={() => {
                    setAudioError(null);
                    if (activeSentenceIdx >= 0) handleSentenceClick(activeSentenceIdx);
                  }}
                  className="px-2.5 py-1 text-[10px] font-bold bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 rounded-lg transition-all"
                >
                  {selectedLanguage === "es" ? "Reintentar" : selectedLanguage === "de" ? "Erneut versuchen" : selectedLanguage === "tr" ? "Yeniden Dene" : "Retry"}
                </button>
              </div>
            )}
            {/* Floating Compact Icon-Only Compress/Expand Toggle Button for Verbatim Transcription Card */}
            <button
              onClick={() => {
                const nextCollapsed = !transcriptionCollapsed;
                setTranscriptionCollapsed(nextCollapsed);
                if (nextCollapsed === false) {
                  setTimeout(() => {
                    document.getElementById("verbatim-transcription-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }, 100);
                }
              }}
              className="fixed bottom-6 left-6 md:left-auto md:right-24 z-50 p-3.5 rounded-full bg-zinc-900/95 hover:bg-zinc-800 border border-sky-500/60 hover:border-sky-400 text-sky-400 hover:text-white shadow-[0_10px_35px_rgba(0,0,0,0.9)] backdrop-blur-xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 cursor-pointer group select-none ring-1 ring-sky-500/30"
              title={
                transcriptionCollapsed
                  ? selectedLanguage === "es"
                    ? "Expandir / Ver Transcripción"
                    : "Expand Transcription"
                  : selectedLanguage === "es"
                  ? "Comprimir Transcripción"
                  : "Compress Transcription"
              }
            >
              <div className="relative flex items-center justify-center">
                <FileText className="w-5 h-5 text-sky-400 group-hover:text-sky-300 transition-colors" />
                <div className="absolute -top-1.5 -right-1.5 bg-zinc-950 border border-sky-500/50 rounded-full p-0.5 text-sky-400">
                  {transcriptionCollapsed ? (
                    <Maximize2 className="w-2.5 h-2.5" />
                  ) : (
                    <Minimize2 className="w-2.5 h-2.5" />
                  )}
                </div>
              </div>
            </button>

          </div>
        </div>
      );
    }

  return (
    <div className="min-h-screen text-slate-100 p-6 md:p-8 space-y-8 animate-fade-in relative">

      {/* HEADER SECTION (SIMILAR TO FEED CHANNEL HEADERS) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-zinc-900/60">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl flex items-center gap-3">
            {currTrans.title}
          </h1>
          <p className="text-zinc-400 font-light mt-1 text-sm md:text-base">
            {currTrans.subtitle}
          </p>
        </div>

        {/* RE-SYNCHRONIZATION BUTTON (MATCHING FEED CHANNELS SPEC) */}
        <div className="flex flex-col gap-2.5 self-start md:self-auto">
          <button
            onClick={triggerSync}
            disabled={syncing}
            className="px-5 py-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-400 hover:text-emerald-300 text-xs font-bold transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Sparkles className={`w-4 h-4 ${syncing ? "animate-spin text-emerald-400" : ""}`} />
            <span>
              {syncing 
                ? currTrans.syncing 
                : currTrans.syncBtn}
            </span>
          </button>

          {syncStatus && (
            <div className="text-[10px] bg-zinc-950/80 border border-zinc-900 text-cyan-400/90 px-3.5 py-1.5 rounded-lg max-w-sm text-center md:text-right">
              {syncStatus}
            </div>
          )}
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: ACTIVE VIEWER & MINI-CARDS FEED */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Large Aspect Widescreen Active Viewer (Matches video player with no side text!) */}
          <div className="rounded-2xl border border-zinc-900 bg-black overflow-hidden relative shadow-2xl w-full aspect-video flex items-center justify-center">
            {selectedIssue ? (
              <div className="absolute inset-0 w-full h-full flex items-center justify-center relative">
                
                {/* Widescreen backdrop blur background utilizing cover url */}
                <div 
                  className="absolute inset-0 bg-cover bg-center blur-3xl opacity-40 select-none pointer-events-none"
                  style={{ backgroundImage: `url(${getValidCoverUrl(selectedIssue.metadata?.cover_url, selectedIssue.metadata?.slug)})` }}
                />

                {/* Sharp vertical centered cover representational display */}
                <div className="h-[96%] aspect-[3/4.2] relative z-10 rounded-lg overflow-hidden border border-zinc-800 shadow-2xl flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getValidCoverUrl(selectedIssue.metadata?.cover_url, selectedIssue.metadata?.slug)}
                    alt={selectedIssue.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const target = e.currentTarget;
                      const s = selectedIssue?.metadata?.slug || "4-august-2026";
                      if (!target.src.includes("supabase.co")) {
                        target.src = `https://lhtlrztsmkllcqiziftn.supabase.co/storage/v1/object/public/documents/covers/${s}.jpg`;
                      }
                    }}
                  />
                </div>

                {/* Absolute View Full Publication Button inside widescreen previewer container */}
                <button
                  onClick={() => setActiveCabinIssue(selectedIssue)}
                  className="absolute bottom-4 right-4 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-extrabold transition-all shadow-[0_4px_20px_rgba(220,38,38,0.4)] flex items-center gap-2 z-20 hover:scale-105 active:scale-95 duration-200"
                >
                  <svg className="w-4 h-4 fill-current flex-shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.108C19.524 3.545 12 3.545 12 3.545s-7.525 0-9.387.51A3.003 3.003 0 0 0 .502 6.163C0 8.07 0 12 0 12s0 3.93.502 5.837a3.003 3.003 0 0 0 2.11 2.108c1.862.51 9.387.51 9.387.51s7.525 0 9.387-.51a3.003 3.003 0 0 0 2.11-2.108c.502-1.907.502-5.837.502-5.837s0-3.93-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                  <span>{currTrans.viewFullPublication}</span>
                </button>

              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 bg-zinc-950">
                <Newspaper className="w-12 h-12 text-zinc-700 mb-2" />
                <p className="text-sm text-zinc-500">
                  Select a magazine issue to review in the widescreen previewer.
                </p>
              </div>
            )}
          </div>

          {/* Details card matching videos feed - Placed underneath the widescreen container */}
          {selectedIssue && (
            <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-900/10 relative overflow-hidden">
              <div className="absolute top-[-20%] left-[-20%] w-[50%] h-[50%] bg-sky-500/5 blur-[50px] pointer-events-none" />
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight leading-snug">
                    {getLocalizedTitle(selectedIssue.title, selectedLanguage)}
                  </h2>
                  <p className="text-xs text-zinc-500 mt-1">
                    {currTrans.author}: {selectedIssue.metadata?.author || "Gerald Celente"} • {currTrans.publishedOn}: {new Date(selectedIssue.metadata?.published_at || selectedIssue.created_at).toLocaleDateString(selectedLanguage === "es" ? "es-ES" : "en-US")}
                  </p>
                  {selectedIssue.description && 
                   !selectedIssue.metadata?.is_magazine_issue && 
                   !selectedIssue.description.toLowerCase().startsWith("revista semanal") && 
                   !selectedIssue.description.toLowerCase().startsWith("weekly magazine") && (
                    <p className="text-xs text-zinc-400 mt-3 leading-relaxed max-w-2xl text-justify line-clamp-3">
                      {getLocalizedDescription(selectedIssue.description, selectedLanguage)}
                    </p>
                  )}
                </div>
                
                <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                  <button
                    onClick={() => setActiveCabinIssue(selectedIssue)}
                    className="px-3.5 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-black text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                  >
                    <BookOpenCheck className="w-3.5 h-3.5" />
                    {currTrans.studyCabin}
                  </button>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                    <FileText className="w-3.5 h-3.5" />
                    {selectedIssue.metadata?.page_count || 158} {currTrans.pagesShort.toUpperCase()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* HISTORIAL / TODAS LAS REVISTAS */}
          <div className="space-y-5 pt-2">
            <h3 className="text-base font-bold text-white">{currTrans.catalogTitle}</h3>

            {/* SEARCH AND FILTERS TOOLBAR */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-zinc-950/10 border border-zinc-900/60 p-4 rounded-xl">
              {/* Search Input */}
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={selectedLanguage === "es" ? "Buscar por título..." : "Search by title..."}
                  className="w-full pl-9 pr-4 py-2 bg-zinc-900/30 border border-zinc-900 hover:border-zinc-800 focus:border-cyan-500/80 rounded-xl text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none transition-all"
                />
              </div>

              {/* Premium Selector for Categories / Favorites */}
              <div className="flex items-center gap-1.5 self-stretch sm:self-auto">
                <button
                  onClick={() => setFilterFavorite(false)}
                  className={`flex-1 sm:flex-initial text-[10px] px-3.5 py-2 rounded-xl border font-bold uppercase tracking-wider transition-all duration-200 ${
                    !filterFavorite
                      ? "bg-zinc-900/80 border-zinc-700/80 text-white shadow-md shadow-black/20"
                      : "bg-transparent border-zinc-900/60 text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {currTrans.all}
                </button>
                <button
                  onClick={() => setFilterFavorite(true)}
                  className={`flex-1 sm:flex-initial text-[10px] px-3.5 py-2 rounded-xl border font-bold uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 ${
                    filterFavorite
                      ? "bg-rose-950/40 border-rose-800/50 text-rose-500 shadow-md shadow-rose-950/10"
                      : "bg-transparent border-zinc-900/60 text-zinc-500 hover:text-zinc-300 hover:border-zinc-800/80"
                  }`}
                >
                  <Heart className={`w-3 h-3 ${filterFavorite ? "fill-rose-500" : ""}`} />
                  {currTrans.favorites}
                </button>
              </div>
            </div>

            {/* GRID OF MINICARDS */}
            {loading ? (
              <div className="grid sm:grid-cols-2 gap-4">
                {[1, 2].map((i) => (
                  <div key={i} className="h-28 rounded-xl bg-zinc-900/30 border border-zinc-900 animate-pulse" />
                ))}
              </div>
            ) : filteredIssues.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-zinc-900/20 border border-zinc-900 text-sm text-zinc-500">
                {filterFavorite ? currTrans.emptyFavs : currTrans.emptyCatalog}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {filteredIssues.map((issue) => {
                  const isSelected = selectedIssue?.id === issue.id;
                  const isFavorite = !!issue.metadata?.is_favorite;

                  return (
                    <div
                      key={issue.id}
                      onClick={() => setSelectedIssue(issue)}
                      onDoubleClick={() => setActiveCabinIssue(issue)}
                      className={`rounded-xl border overflow-hidden cursor-pointer flex gap-3.5 transition-all p-2.5 relative ${
                        isSelected
                          ? "bg-cyan-500/10 border-cyan-500/40 shadow-md shadow-black/25"
                          : "bg-zinc-900/30 border-zinc-900/80 hover:border-zinc-800"
                      }`}
                    >
                      {/* Cover Miniature representation */}
                      <div className="w-18 h-24 bg-zinc-950 flex-shrink-0 relative rounded-lg overflow-hidden border border-zinc-900 shadow-inner">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={getValidCoverUrl(issue.metadata?.cover_url, issue.metadata?.slug)}
                          alt={getLocalizedTitle(issue.title, selectedLanguage)}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            const target = e.currentTarget;
                            const s = issue.metadata?.slug || "4-august-2026";
                            if (!target.src.includes("supabase.co")) {
                              target.src = `https://lhtlrztsmkllcqiziftn.supabase.co/storage/v1/object/public/documents/covers/${s}.jpg`;
                            }
                          }}
                        />

                        <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/80 text-[7.5px] font-bold text-zinc-300 font-mono tracking-wide">
                          {issue.metadata?.page_count || 158} {currTrans.pagesShort}
                        </span>
                      </div>

                      {/* Info on cards */}
                      <div className="flex-1 min-w-0 pr-1 flex flex-col justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-zinc-100 truncate hover:text-cyan-400 transition-colors">
                            {getLocalizedTitle(issue.title, selectedLanguage)}
                          </h4>
                          <div className="text-[10px] text-zinc-500 mt-1 truncate">
                            {new Date(issue.metadata?.published_at || issue.created_at).toLocaleDateString(selectedLanguage === "es" ? "es-ES" : "en-US")}
                          </div>
                          <div className="text-[9.5px] font-semibold text-zinc-400 mt-1 truncate">
                            {issue.metadata?.author || "Gerald Celente / Trends Journal"}
                          </div>
                        </div>

                        {/* Interactive footer action buttons inside card */}
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-1.5">
                            {/* ANALYSIS BUTTON - MATCHES MINI VIDEO CARDS AS REQUESTED */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveCabinIssue(issue);
                              }}
                              className="px-2.5 py-1 rounded bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 text-sky-400 text-[9px] font-bold transition-all uppercase tracking-wider"
                            >
                              {currTrans.analysis}
                            </button>

                            {/* AUDIO STATUS BADGE - MATCHES CABIN SYNC PROGRESS */}
                            {issue.metadata?.audio_status === "processing" || (issue.metadata?.audio_progress_percent && issue.metadata?.audio_progress_percent < 100) ? (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[8.5px] font-mono font-bold flex items-center gap-1 animate-pulse" title="Sintetizando audio en segundo plano">
                                <Loader2 className="w-2.5 h-2.5 animate-spin text-amber-400" />
                                {issue.metadata?.audio_progress_percent || 10}%
                              </span>
                            ) : issue.metadata?.audio_url || issue.metadata?.audio_status === "ready" || (issue.metadata?.audios && Object.values(issue.metadata.audios).some((a: any) => a?.audio_url)) ? (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[8.5px] font-mono font-bold flex items-center gap-1">
                                <Volume2 className="w-2.5 h-2.5 text-emerald-400" />
                                MP3
                              </span>
                            ) : null}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavoriteIssue(issue);
                              }}
                              className={`p-1.5 rounded-lg border transition-all duration-200 ${
                                isFavorite
                                  ? "bg-rose-950/40 border-rose-800/50 text-rose-500"
                                  : "bg-zinc-900/60 border-zinc-800 text-zinc-500 hover:text-rose-400"
                              }`}
                              title={isFavorite ? "Quitar de favoritos" : "Añadir a favoritos"}
                            >
                              <Heart className={`w-3 h-3 ${isFavorite ? "fill-rose-500" : ""}`} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteIssue(issue.id);
                              }}
                              className="p-1.5 rounded-lg border bg-zinc-900/60 border-zinc-800 text-zinc-500 hover:text-red-400 hover:border-red-950/60 hover:bg-red-950/10 transition-all duration-200"
                              title="Eliminar magazine"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}

          </div>

        </div>

        {/* RIGHT COLUMN: PERSISTENT UPLOAD LOADER & SYNC CONTROLLER */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* UPLOAD MAGAZINE PANEL CARD */}
          <div className="rounded-2xl border border-zinc-900 bg-zinc-900/20 p-6 space-y-6">
            <div className="flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-sky-400" />
              <h3 className="text-base font-bold text-white">{currTrans.uploadTitle}</h3>
            </div>

            <form onSubmit={handleCreateMagazine} className="space-y-4">
              {formError && (
                <div className="p-3 bg-red-950/30 border border-red-800/40 rounded-xl flex items-start gap-2.5 text-xs text-red-400">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-xl flex items-start gap-2.5 text-xs text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{formSuccess}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  {currTrans.formTitleLabel}
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="ej. Trends Journal - 11 de Agosto de 2026"
                  className="w-full px-3 py-2 bg-zinc-900/60 border border-zinc-800 focus:border-sky-500 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  {currTrans.formAuthorLabel}
                </label>
                <input
                  type="text"
                  value={formAuthor}
                  onChange={(e) => setFormAuthor(e.target.value)}
                  placeholder="Gerald Celente / Trends Journal"
                  className="w-full px-3 py-2 bg-zinc-900/60 border border-zinc-800 focus:border-sky-500 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                    {currTrans.formDateLabel}
                  </label>
                  <input
                    type="date"
                    value={formPublishedAt}
                    onChange={(e) => setFormPublishedAt(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900/60 border border-zinc-800 focus:border-sky-500 rounded-xl text-zinc-300 focus:outline-none text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                    {currTrans.formPagesLabel}
                  </label>
                  <input
                    type="number"
                    value={formPageCount}
                    onChange={(e) => setFormPageCount(e.target.value)}
                    placeholder="Auto"
                    className="w-full px-3 py-2 bg-zinc-900/60 border border-zinc-800 focus:border-sky-500 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  {currTrans.formPdfLabel}
                </label>
                <input
                  type="url"
                  required
                  value={formFileUrl}
                  onChange={(e) => setFormFileUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 bg-zinc-900/60 border border-zinc-800 focus:border-sky-500 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  {currTrans.formCoverLabel}
                </label>
                <input
                  type="url"
                  value={formCoverUrl}
                  onChange={(e) => setFormCoverUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 bg-zinc-900/60 border border-zinc-800 focus:border-sky-500 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  {currTrans.formDescLabel}
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="..."
                  className="w-full px-3 py-2 bg-zinc-900/60 border border-zinc-800 focus:border-sky-500 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none text-xs min-h-[60px] max-h-[140px]"
                />
              </div>

              <button
                type="submit"
                disabled={formLoading}
                className="w-full mt-2 flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-400 text-black py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg transition-all duration-300 active:scale-98 disabled:opacity-60"
              >
                {formLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{currTrans.formSubmitting}</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>{currTrans.formSubmit}</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* BACKGROUND SYNC STATE AND LOGGER */}
          <div className="rounded-2xl border border-zinc-900 bg-zinc-950/10 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{currTrans.scraperStatus}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <div className="text-[11px] text-zinc-400 leading-relaxed bg-zinc-950/60 border border-zinc-900 p-3.5 rounded-xl space-y-1.5">
              <p className="text-zinc-500 font-mono text-[9px] uppercase tracking-wide border-b border-zinc-900 pb-1.5 mb-1 flex justify-between">
                <span>Trends Journal Engine</span>
                <span className="text-cyan-500 font-sans">{currTrans.engineActive}</span>
              </p>
              <div className="flex justify-between text-zinc-500">
                <span>{currTrans.lastSync}:</span>
                <span className="text-zinc-300">Today, {new Date().toLocaleDateString(selectedLanguage === "es" ? "es-ES" : "en-US")}</span>
              </div>
              <div className="flex justify-between text-zinc-500">
                <span>{currTrans.totalIssues}:</span>
                <span className="text-zinc-300 font-mono font-bold">{issues.length} Issues</span>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
