"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase, isUsingMock } from "@/lib/supabase";
import { 
  Music, Video, LayoutDashboard, LogOut, Menu, X, User, Sparkles, Loader2,
  Radio, ChevronDown, ChevronRight, Heart, Settings, Calendar
} from "lucide-react";
import { translations } from "@/lib/translations";
import { Logo } from "@/components/Logo";
import { AssistantBotWidget } from "@/components/AssistantBotWidget";


interface UserProfile {
  email?: string;
  fullName: string;
}

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Global Language Selection State
  const [selectedLanguage, setSelectedLanguage] = useState<string>("en");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("hivex_selected_language") || "en";
      setSelectedLanguage(saved);
    }
  }, []);

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

  const handleLanguageChange = (langCode: string) => {
    setSelectedLanguage(langCode);
    localStorage.setItem("hivex_selected_language", langCode);
    window.dispatchEvent(new CustomEvent("languageChanged", { detail: langCode }));
  };
  
  // Canales hierarchy state
  const DEFAULT_CHANNELS = [
    "Andrei Jikh",
    "Judging Freedom",
    "Cihat E. Çiçek",
    "Zang International with Lynette Zang",
    "The Rich Dad Channel",
    "Trends Journal",
    "Integral Forextv",
    "Kanal Finans",
    "Norgesbank Investment Management",
    "George Gammon",
    "Clive Thompson",
    "ITM Trading",
    "Spegtacular",
    "Soar Financially",
    "Rebel Capitalist",
    "Okan Yorganci",
    "Prof. Dr. Emre Alkin",
    "Smart Silverstacker"
  ];

  const [canalesOpen, setCanalesOpen] = useState(true);
  const [channels, setChannels] = useState<string[]>(DEFAULT_CHANNELS);
  const [channelMaxDates, setChannelMaxDates] = useState<Record<string, string>>({});
  const [lastVisitedDates, setLastVisitedDates] = useState<Record<string, string>>({});

  // Fetch unique channels dynamically from saved videos
  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const { data } = await supabase
          .from("documents")
          .select("metadata, created_at")
          .eq("type", "video");
        
        if (data) {
          const uniqueChannels = new Set<string>(DEFAULT_CHANNELS);
          const maxDates: Record<string, string> = {};
          
          data.forEach((doc: { created_at: string; metadata?: { channel_title?: string } }) => {
            if (doc.metadata && doc.metadata.channel_title) {
              const ch = doc.metadata.channel_title;
              // Clean up any dynamic (Mock Feed) suffixes so they map to the clean sidebar categories
              const cleanCh = ch.replace(/\s*\(Mock\s+Feed\)/i, "");
              if (cleanCh !== "HIVEX Demo") {
                uniqueChannels.add(cleanCh);
                
                // Track maximum creation date
                const currentMax = maxDates[cleanCh];
                if (!currentMax || new Date(doc.created_at) > new Date(currentMax)) {
                  maxDates[cleanCh] = doc.created_at;
                }
              }
            }
          });
          
          setChannels(Array.from(uniqueChannels));
          setChannelMaxDates(maxDates);
        }
      } catch (err) {
        console.error("Failed to fetch dynamic channels for sidebar:", err);
      }
    };
    
    fetchChannels();
    const interval = setInterval(fetchChannels, 10000);
    return () => clearInterval(interval);
  }, []);

  // Load last visited dates from localStorage on mount or when profile loads
  useEffect(() => {
    if (typeof window !== "undefined" && profile?.email) {
      try {
        const key = `hivex_channels_last_visited_${profile.email}`;
        const saved = localStorage.getItem(key);
        if (saved) {
          setLastVisitedDates(JSON.parse(saved));
        } else {
          // Fallback/Legacy migration: see if there's a non-scoped old key
          const legacySaved = localStorage.getItem("hivex_channels_last_visited");
          if (legacySaved) {
            setLastVisitedDates(JSON.parse(legacySaved));
            localStorage.setItem(key, legacySaved);
          } else {
            // First time login for this user: set all channels to read by default (preventing false-positive red badges on old videos)
            const nowStr = new Date().toISOString();
            const initial: Record<string, string> = {};
            channels.forEach(ch => {
              initial[ch] = nowStr;
            });
            setLastVisitedDates(initial);
            localStorage.setItem(key, JSON.stringify(initial));
          }
        }
      } catch (err) {
        console.error("Failed to load last visited channels:", err);
      }
    }
  }, [profile?.email, channels]);

  // Track and update visited channel
  useEffect(() => {
    if (pathname === "/dashboard/videos" && profile?.email) {
      const channelParam = searchParams.get("channel") || "Andrei Jikh";
      
      // Update last visited date for this channel
      setLastVisitedDates((prev) => {
        const nowStr = new Date().toISOString();
        const updated = { ...prev, [channelParam]: nowStr };
        if (typeof window !== "undefined") {
          const key = `hivex_channels_last_visited_${profile.email}`;
          localStorage.setItem(key, JSON.stringify(updated));
        }
        return updated;
      });
    }
  }, [pathname, searchParams, profile?.email]);

  // Check auth session on load
  useEffect(() => {
    const checkUser = async () => {
      try {
        let { data: { user } } = await supabase.auth.getUser();
        
        // Point 3: Active OAuth callback parameters detection & race condition prevention
        if (!user && typeof window !== "undefined") {
          const hasHashToken = window.location.hash.includes("access_token") || window.location.hash.includes("id_token");
          const hasQueryCode = window.location.search.includes("code=") || window.location.search.includes("error=");
          
          if (hasHashToken || hasQueryCode) {
            console.log("[Auth Session Recovery] OAuth callback parameters detected in URL. Initiating fast session polling...");
            // Poll for session up to 10 times (every 100ms) for ultra-fast session recovery
            for (let i = 0; i < 10; i++) {
              await new Promise((resolve) => setTimeout(resolve, 100));
              const retry = await supabase.auth.getUser();
              if (retry.data.user) {
                user = retry.data.user;
                console.log(`[Auth Session Recovery] Session established successfully in ${(i + 1) * 100}ms!`);
                break;
              }
            }
          }
        }

        if (!user) {
          const currentPath = typeof window !== "undefined"
            ? (window.location.pathname + window.location.search)
            : "/dashboard";
          
          // Save target path to localStorage for bulletproof recovery across domains
          if (typeof window !== "undefined" && !currentPath.includes("/login")) {
            console.log(`[Auth Session Recovery] Unauthenticated hit on secure path "${currentPath}". Preserving target path in localStorage...`);
            localStorage.setItem("hivex_oauth_redirect_to", currentPath);
          }
          
          router.push(`/login?redirectTo=${encodeURIComponent(currentPath)}`);
          return;
        }

        setProfile({
          email: user.email,
          fullName: user.user_metadata?.full_name || "Alex Hivex"
        });

        // Restore preserved deep-link destination after successful login
        if (typeof window !== "undefined") {
          const savedRedirect = localStorage.getItem("hivex_oauth_redirect_to");
          if (savedRedirect) {
            localStorage.removeItem("hivex_oauth_redirect_to");
            const cleanCurrent = window.location.pathname + window.location.search;
            if (savedRedirect !== cleanCurrent && !cleanCurrent.includes("/login")) {
              console.log(`[Auth Session Recovery] Active session detected. Restoring preserved deep-link redirect back to: ${savedRedirect}`);
              router.push(savedRedirect);
              return;
            }
          }
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        const currentPath = typeof window !== "undefined"
          ? (window.location.pathname + window.location.search)
          : "/dashboard";
        
        if (typeof window !== "undefined" && !currentPath.includes("/login")) {
          localStorage.setItem("hivex_oauth_redirect_to", currentPath);
        }
        
        router.push(`/login?redirectTo=${encodeURIComponent(currentPath)}`);
      } finally {
        setAuthLoading(false);
      }
    };
    checkUser();
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const lang = selectedLanguage || "en";
  const t = translations[lang]?.sidebar || translations["en"].sidebar;

  const isAdmin = profile?.email && (profile.email === "admin@kubicatrading.es" || profile.email.startsWith("admin@kubicatrading"));

  const navItems = [
    { name: t.overview || "Resumen General", path: "/dashboard", icon: LayoutDashboard },
    { name: t.audioStation || "Estación de Audio", path: "/dashboard/audios", icon: Music },
    { name: t.favorites || "Vídeos preferidos", path: "/dashboard/videos?favorite=true", icon: Heart },
    { name: t.favoriteCharts || "Charts Favoritos", path: "/dashboard/charts-favorites", icon: Heart },
    { name: t.economicCalendar || "Calendario Económico", path: "/dashboard/calendar", icon: Calendar },
    ...(isAdmin ? [{ name: t.administration || "Administración", path: "/dashboard/admin", icon: Settings }] : [])
  ];

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-violet-400 animate-spin mb-4" />
        <p className="text-zinc-500 text-sm tracking-wide animate-pulse">{t.verifyingSession || "Verificando sesión segura..."}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex">
      {/* Sidebar background glows */}
      <div className="absolute top-[20%] left-[-10%] w-[350px] h-[350px] bg-glow-purple rounded-full pointer-events-none opacity-40" />

      {/* MOBILE HEADER BAR */}
      <header className="md:hidden flex items-center justify-between w-full h-16 px-4 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md fixed top-0 left-0 z-40">
        <Logo href="/dashboard" className="scale-75 origin-left" />


        {/* Mobile flag switcher */}
        <div className="flex items-center gap-1 bg-zinc-900/40 border border-zinc-900 px-2 py-1 rounded-xl shadow-inner">
          {[
            { code: "en", flag: "🇺🇸", label: "English" },
            { code: "de", flag: "🇩🇪", label: "Deutsch" },
            { code: "tr", flag: "🇹🇷", label: "Türkçe" },
            { code: "es", flag: "🇪🇸", label: "Español" }
          ].map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              title={lang.label}
              className={`text-xs p-1 rounded-md border transition-all duration-200 flex items-center justify-center ${
                selectedLanguage === lang.code
                  ? "bg-violet-600/10 border-violet-500/30 text-white scale-105 shadow-md shadow-violet-500/5"
                  : "bg-transparent border-transparent text-zinc-400"
              }`}
            >
              <span className="text-sm leading-none">{lang.flag}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* SIDEBAR BACKDROP FOR MOBILE */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-45 md:hidden transition-opacity duration-300"
        />
      )}

      {/* SIDEBAR NAVIGATION (Desktop & Mobile drawer) */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 border-r border-zinc-900 bg-zinc-950/90 md:bg-zinc-950/40 md:backdrop-blur-xl flex flex-col justify-between p-6 transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static overflow-y-auto
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <div className="space-y-8">
          {/* Logo Brand */}
          <div className="flex items-center justify-between">
            <Logo href="/dashboard" className="scale-90 origin-left" />

            {/* Mobile close button */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-6">
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-3 mb-3">
                {selectedLanguage === "es" ? "CONSOLA" : selectedLanguage === "de" ? "KONSOLE" : selectedLanguage === "tr" ? "KONSOL" : "CONSOLE"}
              </div>
              {navItems.map((item) => {
                const Icon = item.icon;
                
                // Robust active state calculation checking path parameters
                let isActive = false;
                if (item.path.includes("?favorite=true")) {
                  isActive = pathname === "/dashboard/videos" && searchParams.get("favorite") === "true";
                } else if (item.path === "/dashboard/videos") {
                  isActive = pathname === "/dashboard/videos" && searchParams.get("favorite") !== "true";
                } else {
                  isActive = pathname === item.path;
                }

                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`
                      w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 group
                      ${isActive 
                        ? "bg-zinc-900/50 border-l-2 border-l-violet-400 text-zinc-100 shadow-sm rounded-r-xl rounded-l-none pl-3.5" 
                        : "text-zinc-400 border border-transparent hover:text-zinc-200 hover:bg-zinc-900/40"
                      }
                    `}
                  >
                    <Icon className={`w-5 h-5 transition-transform duration-200 group-hover:scale-105 ${isActive ? "text-violet-400" : "text-zinc-500 group-hover:text-zinc-400"}`} />
                    {item.name}
                  </Link>
                );
              })}
            </div>

            {/* Hierarchical Tree: Nivel 0 "Canales" -> Nivel 1 "Nombre del canal" */}
            <div className="space-y-2 border-t border-zinc-900/80 pt-5">
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-3 mb-2 flex items-center justify-between">
                <span>{t.liveTracking || "SEGUIMIENTO DIRECTO"}</span>
                <span className="text-[8px] px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-sky-400 font-bold font-mono">LIVE</span>
              </div>
              
              <div className="space-y-1">
                {/* Nivel 0: Canales */}
                <button
                  onClick={() => setCanalesOpen(!canalesOpen)}
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-bold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/20 transition-all duration-150"
                >
                  <div className="flex items-center gap-2.5">
                    <Radio className="w-4 h-4 text-sky-400" />
                    <span>{t.channels || "Canales"}</span>
                  </div>
                  {canalesOpen ? <ChevronDown className="w-3.5 h-3.5 text-zinc-500" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />}
                </button>

                {/* Nivel 1: Submenus (Nombres de Canales) */}
                {canalesOpen && (
                  <div className="pl-4 ml-6 border-l border-zinc-900/85 space-y-1.5 mt-1 transition-all">
                    {channels.map((ch) => {
                      const isActive = pathname === "/dashboard/videos" && (searchParams.get("channel") === ch || (ch === "Andrei Jikh" && !searchParams.get("channel")));
                      const maxDate = channelMaxDates[ch];
                      const lastVisited = lastVisitedDates[ch];
                      const hasNewVideos = maxDate && (!lastVisited || new Date(maxDate) > new Date(lastVisited));

                      let dotClass = "w-1.5 h-1.5 rounded-full transition-all duration-150 ";
                      if (isActive) {
                        dotClass += "bg-sky-400 shadow-md shadow-sky-400/50";
                      } else if (hasNewVideos) {
                        dotClass += "bg-rose-500 shadow-md shadow-rose-500/50 animate-pulse";
                      } else {
                        dotClass += "bg-zinc-800";
                      }

                      return (
                        <Link
                          key={ch}
                          href={`/dashboard/videos?channel=${encodeURIComponent(ch)}`}
                          onClick={() => setSidebarOpen(false)}
                          className={`
                            w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150
                            ${isActive
                              ? "bg-sky-500/10 border border-sky-500/20 text-sky-400 shadow-sm"
                              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/20"
                            }
                          `}
                        >
                          <span className="truncate">{ch}</span>
                          <span className={dotClass} />
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </nav>
        </div>

        {/* Profile Card Bottom */}
        <div className="space-y-4 pt-6 border-t border-zinc-900">
          <div className="flex items-center gap-3 px-1">
            <div className="w-10 h-10 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-center text-zinc-300">
              <User className="w-5 h-5" />
            </div>
            <div className="flex-grow min-w-0">
              <div className="text-sm font-bold text-white truncate">{profile?.fullName}</div>
              <div className="text-xs text-zinc-500 truncate">{profile?.email}</div>
            </div>
          </div>

          {isUsingMock && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-emerald-400 text-[10px] font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t.demoMode || "Modo Demostración Local"}</span>
            </div>
          )}

          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-zinc-400 hover:text-rose-400 border border-transparent hover:bg-rose-500/5 transition-all duration-200"
          >
            <LogOut className="w-5 h-5" />
            {t.signOut || "Cerrar Sesión"}
          </button>
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <main className="flex-grow flex flex-col min-w-0 relative z-10 pt-16 md:pt-0">
        {/* GLOBAL TOP NAVIGATION & LANGUAGE BAR */}
        <header className="hidden md:flex sticky top-0 z-30 w-full border-b border-zinc-900/60 bg-zinc-950/70 backdrop-blur-md px-10 py-3.5 items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">{t.controlConsole || "Consola de Control HIVEX"}</span>
            <span className="text-xs text-zinc-600">|</span>
            <span className="text-xs text-zinc-500 bg-zinc-900/40 px-2 py-0.5 rounded-md border border-zinc-800 font-mono">v2.1 Premium</span>
          </div>
          
          {/* PREMIUM FLAG SWITCHER */}
          <div className="flex items-center gap-3 select-none">
            <div className="flex items-center gap-2 bg-zinc-900/40 border border-zinc-900 px-3 py-1.5 rounded-xl shadow-inner">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest hidden sm:inline">{t.globalLanguage || "Idioma Global:"}</span>
              <div className="flex items-center gap-1.5">
                {[
                  { code: "en", flag: "🇺🇸", label: "English" },
                  { code: "de", flag: "🇩🇪", label: "Deutsch" },
                  { code: "tr", flag: "🇹🇷", label: "Türkçe" },
                  { code: "es", flag: "🇪🇸", label: "Español" }
                ].map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => handleLanguageChange(lang.code)}
                    title={lang.label}
                    className={`text-sm p-1.5 rounded-lg border transition-all duration-200 hover:scale-110 flex items-center justify-center relative group ${
                      selectedLanguage === lang.code
                        ? "bg-violet-600/10 border-violet-500/30 text-white scale-105 shadow-md shadow-violet-500/5"
                        : "bg-transparent border-transparent text-zinc-400 hover:text-white"
                    }`}
                  >
                    <span className="text-base leading-none">{lang.flag}</span>
                    <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-zinc-900 text-[10px] text-zinc-300 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-zinc-800 shadow-xl z-50">
                      {lang.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </header>

        <div className="flex-grow p-4 sm:p-6 md:p-10 max-w-7xl w-full mx-auto space-y-8">
          {children}
        </div>
      </main>
      <AssistantBotWidget />
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-violet-400 animate-spin" />
      </div>
    }>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </Suspense>
  );
}
