"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Sparkles, Send, Globe, Play, Bot, User, ArrowRight, HelpCircle, 
  TrendingUp, AlertCircle, RefreshCw, Compass, CheckCircle2, ChevronRight,
  Loader2, Check
} from "lucide-react";
import { translations } from "@/lib/translations";
import { motion, AnimatePresence } from "framer-motion";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  sources?: { title: string; url: string; type: "local" | "internet" }[];
  searchedInternet?: boolean;
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [useInternet, setUseInternet] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [userProfile, setUserProfile] = useState<{ fullName: string; email: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [telegramStatuses, setTelegramStatuses] = useState<Record<string, "idle" | "sending" | "sent" | "error">>({});

  const handleSendToTelegram = async (msgId: string, text: string) => {
    setTelegramStatuses(prev => ({ ...prev, [msgId]: "sending" }));
    try {
      const res = await fetch("/api/telegram/notify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ message: text })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTelegramStatuses(prev => ({ ...prev, [msgId]: "sent" }));
        setTimeout(() => {
          setTelegramStatuses(prev => ({ ...prev, [msgId]: "idle" }));
        }, 3000);
      } else {
        console.error("[Telegram Manual Send] Error:", data.error);
        setTelegramStatuses(prev => ({ ...prev, [msgId]: "error" }));
        setTimeout(() => {
          setTelegramStatuses(prev => ({ ...prev, [msgId]: "idle" }));
        }, 3000);
      }
    } catch (err) {
      console.error("[Telegram Manual Send] Crash:", err);
      setTelegramStatuses(prev => ({ ...prev, [msgId]: "error" }));
      setTimeout(() => {
        setTelegramStatuses(prev => ({ ...prev, [msgId]: "idle" }));
      }, 3000);
    }
  };

  // Suggested questions based on selected language
  const suggestionsByLang: Record<string, { title: string; desc: string; query: string }[]> = {
    es: [
      { 
        title: "Vídeos Sincronizados", 
        desc: "Saber qué vídeos de tus canales de inversión sincronizados hay guardados", 
        query: "¿Qué vídeos tenemos sincronizados en Supabase para mi cuenta?" 
      },
      { 
        title: "Riesgos Macroeconómicos", 
        desc: "Evolución de tipos de interés y riesgo de recesión actual", 
        query: "¿Cuáles son los principales riesgos macroeconómicos de esta semana según los vídeos?" 
      },
      { 
        title: "Soporte de Cabina", 
        desc: "Aprender a usar la cabina inteligente de estudio", 
        query: "¿Cómo funciona la cabina de estudio de HIVEX y qué herramientas ofrece?" 
      },
      {
        title: "Consejo de Inversión",
        desc: "Análisis y rotación de activos según el desacople de divisas",
        query: "¿Qué recomiendan los análisis sobre la rotación de efectivo hacia oro, BTC o cuentas de alto interés (HYSA)?"
      }
    ],
    en: [
      { 
        title: "Synced Videos", 
        desc: "Check which videos from your synchronized investment channels are saved", 
        query: "Which videos do we have synchronized in Supabase for my account?" 
      },
      { 
        title: "Macro Risks", 
        desc: "Federal Reserve interest rates and current recession warning signs", 
        query: "What are the main macroeconomic risks of this week according to the videos?" 
      },
      { 
        title: "Study Cabin Help", 
        desc: "Learn how to use the HIVEX intelligent study cockpit", 
        query: "How does the HIVEX study cabin work and what tools does it offer?" 
      },
      {
        title: "Investment Advice",
        desc: "Asset rotation and portfolio allocations given fiat debasement",
        query: "What do the video analyses recommend regarding cash rotation into hard assets like gold, BTC, or high-yield savings (HYSA)?"
      }
    ],
    de: [
      { 
        title: "Synchronisierte Videos", 
        desc: "Prüfen Sie, welche Videos von Ihren synchronisierten Anlagekanälen gespeichert sind", 
        query: "Welche Videos haben wir in Supabase für mein Konto synchronisiert?" 
      },
      { 
        title: "Makroökonomische Risiken", 
        desc: "Zinsentwicklung der Fed und aktuelle Rezessionsindikatoren", 
        query: "Was sind die wichtigsten makroökonomischen Risiken dieser Woche laut den Videos?" 
      },
      { 
        title: "Hilfe zur Studienkabine", 
        desc: "Erfahren Sie, wie das intelligente HIVEX-Studien-Cockpit funktioniert", 
        query: "Wie funktioniert die HIVEX-Studienkabine und welche Tools bietet sie?" 
      },
      {
        title: "Anlageempfehlung",
        desc: "Vermögensrotation und Portfolioallokation angesichts der Fiat-Abwertung",
        query: "Was empfehlen die Videoanalysen zur Cash-Rotation in harte Vermögenswerte wie Gold, BTC oder hochverzinsliche Sparkonten (HYSA)?"
      }
    ],
    tr: [
      { 
        title: "Senkronize Videolar", 
        desc: "Senkronize edilmiş yatırım kanallarınızdan hangi videoların kayıtlı olduğunu görün", 
        query: "Hesabım için Supabase'de hangi videolar senkronize edilmiş durumda?" 
      },
      { 
        title: "Makro Riskler", 
        desc: "Fed faiz oranları ve mevcut resesyon uyarı sinyalleri", 
        query: "Videolara göre bu haftanın temel makroekonomik riskleri nelerdir?" 
      },
      { 
        title: "Çalışma Kabini Desteği", 
        desc: "HIVEX akıllı çalışma kokpitini nasıl kullanacağınızı öğrenin", 
        query: "HIVEX çalışma kabini nasıl çalışır ve hangi araçları sunar?" 
      },
      {
        title: "Yatırım Tavsiyesi",
        desc: "Para devalüasyonu karşısında varlık rotasyonu ve portföy tahsisi",
        query: "Video analizleri nakit paranın altın, BTC veya yüksek faizli mevduat (HYSA) hesaplarına rotasyonu hakkında ne öneriyor?"
      }
    ]
  };

  // Sync translation language
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("hivex_selected_language") || "en";
      setSelectedLanguage(saved);
    }

    const handleLangChanged = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && typeof customEvent.detail === "string") {
        setSelectedLanguage(customEvent.detail);
      }
    };

    window.addEventListener("languageChanged", handleLangChanged);
    return () => window.removeEventListener("languageChanged", handleLangChanged);
  }, []);

  // Fetch authenticated user profile
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserProfile({
            fullName: user.user_metadata?.full_name || "Alex Hivex",
            email: user.email || ""
          });
        }
      } catch (err) {
        console.error("Failed to fetch user in assistant:", err);
      }
    };
    fetchUser();
  }, []);

  // Load chat history from localStorage on mount (for persistent experience)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedHistory = localStorage.getItem("hivex_assistant_history");
      if (savedHistory) {
        try {
          setMessages(JSON.parse(savedHistory));
        } catch (e) {
          console.error("Failed to parse chat history:", e);
        }
      }
    }
  }, []);

  // Save chat history to localStorage on update
  useEffect(() => {
    if (typeof window !== "undefined" && messages.length > 0) {
      localStorage.setItem("hivex_assistant_history", JSON.stringify(messages));
    }
  }, [messages]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const clearHistory = () => {
    setMessages([]);
    localStorage.removeItem("hivex_assistant_history");
  };

  // Send message handler
  const handleSendMessage = async (textToSend: string, forceInternet: boolean = false) => {
    const queryText = textToSend.trim();
    if (!queryText) return;

    // Add user message to chat state
    const userMsg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 15),
      role: "user",
      content: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue("");
    setLoading(true);

    const useWebSearch = forceInternet || useInternet;

    try {
      // Fetch access token to authenticate request safely with Supabase RLS
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token || "";

      // Fetch all local documents from Supabase client (fully populated on the client-side)
      const { data: localDocs } = await supabase.from("documents").select("*");

      // Convert local message format to history required by API route
      const apiHistory = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": accessToken ? `Bearer ${accessToken}` : ""
        },
        body: JSON.stringify({
          message: queryText,
          history: apiHistory,
          useInternet: useWebSearch,
          localDocuments: localDocs || []
        })
      });

      const data = await response.json();

      if (data.success) {
        const assistantMsg: ChatMessage = {
          id: Math.random().toString(36).substring(2, 15),
          role: "assistant",
          content: data.response,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          sources: data.sources || [],
          searchedInternet: data.searchedInternet
        };
        setMessages(prev => [...prev, assistantMsg]);
      } else {
        const errMsg: ChatMessage = {
          id: Math.random().toString(36).substring(2, 15),
          role: "assistant",
          content: `Hubo un inconveniente al procesar tu consulta: ${data.error || "Error de comunicación con Gemini"}. Por favor, vuelve a intentarlo en un momento.`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        };
        setMessages(prev => [...prev, errMsg]);
      }
    } catch (err: any) {
      console.error("Error communicating with AI assistant API:", err);
      const errMsg: ChatMessage = {
        id: Math.random().toString(36).substring(2, 15),
        role: "assistant",
        content: `Error de red en el cliente: no se pudo establecer contacto con el servicio del Asistente HIVEX. Asegúrate de estar ejecutando en local de forma correcta.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  // Safe Fallback String matching helper
  const FALLBACK_PATTERN = "actualmente, mi base de conocimiento no dispone de esa información. Pero si quieres puedo consultar en internet y darte una respuesta de mercado actualizada a día de hoy.";

  const suggestions = suggestionsByLang[selectedLanguage] || suggestionsByLang["en"];
  const isSpanish = selectedLanguage === "es";

  // Simple Markdown and Links formatter helper
  const formatMarkdown = (text: string) => {
    if (!text) return null;

    // Split text by lines
    const lines = text.split("\n");

    return lines.map((line, lineIdx) => {
      let trimmed = line.trim();

      // Check if line is a heading
      if (trimmed.startsWith("### ")) {
        return (
          <h4 key={lineIdx} className="text-sm font-bold text-violet-300 mt-4 mb-2 tracking-wide uppercase">
            {parseInlineMarkup(trimmed.substring(4))}
          </h4>
        );
      }
      if (trimmed.startsWith("## ")) {
        return (
          <h3 key={lineIdx} className="text-base font-extrabold text-violet-400 mt-5 mb-2.5 border-b border-zinc-900/50 pb-1">
            {parseInlineMarkup(trimmed.substring(3))}
          </h3>
        );
      }
      if (trimmed.startsWith("# ")) {
        return (
          <h2 key={lineIdx} className="text-lg font-black text-white mt-6 mb-3 tracking-wide">
            {parseInlineMarkup(trimmed.substring(2))}
          </h2>
        );
      }

      // Check if line is a bullet item
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        return (
          <li key={lineIdx} className="ml-4 list-disc text-zinc-300 py-0.5 text-xs md:text-sm">
            {parseInlineMarkup(trimmed.substring(2))}
          </li>
        );
      }

      // Check if line is a numbered item
      const numMatch = trimmed.match(/^(\d+)\.\s(.*)/);
      if (numMatch) {
        return (
          <li key={lineIdx} className="ml-4 list-decimal text-zinc-300 py-0.5 text-xs md:text-sm">
            {parseInlineMarkup(numMatch[2])}
          </li>
        );
      }

      // Default paragraph line
      if (trimmed === "") {
        return <div key={lineIdx} className="h-2" />;
      }

      return (
        <p key={lineIdx} className="text-zinc-300 text-xs md:text-sm leading-relaxed mb-1.5">
          {parseInlineMarkup(line)}
        </p>
      );
    });
  };

  // Helper to parse bold (**), inline code (`), and markdown links ([label](url))
  const parseInlineMarkup = (text: string) => {
    // 1. Parse markdown links [Label](url)
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = linkRegex.exec(text)) !== null) {
      const matchIndex = match.index;
      const plainText = text.substring(lastIndex, matchIndex);
      
      if (plainText) {
        parts.push(...parseBoldAndCode(plainText));
      }

      const label = match[1];
      const url = match[2];
      
      parts.push(
        <a 
          key={matchIndex} 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-violet-400 hover:text-violet-300 underline font-medium transition-colors"
        >
          {label}
        </a>
      );
      
      lastIndex = linkRegex.lastIndex;
    }

    const remainingText = text.substring(lastIndex);
    if (remainingText) {
      parts.push(...parseBoldAndCode(remainingText));
    }

    return parts.length > 0 ? parts : text;
  };

  const parseBoldAndCode = (text: string): React.ReactNode[] => {
    // Split by bold notation **
    const boldParts = text.split("**");
    return boldParts.map((bPart, bIdx) => {
      // Alternate parts are bold
      const isBold = bIdx % 2 === 1;

      // Now split by inline code `
      const codeParts = bPart.split("`");
      const elements = codeParts.map((cPart, cIdx) => {
        const isCode = cIdx % 2 === 1;
        if (isCode) {
          return (
            <code key={`${bIdx}-${cIdx}`} className="bg-zinc-900/80 text-violet-400 px-1.5 py-0.5 rounded text-xs font-mono border border-zinc-800/40">
              {cPart}
            </code>
          );
        }
        return cPart;
      });

      if (isBold) {
        return (
          <strong key={bIdx} className="font-bold text-zinc-100">
            {elements}
          </strong>
        );
      }
      return <span key={bIdx}>{elements}</span>;
    });
  };

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-4rem)] relative md:pl-4">
      {/* Background glow violet aura */}
      <div className="absolute top-[10%] right-[10%] w-[450px] h-[450px] bg-glow-purple rounded-full pointer-events-none opacity-20 filter blur-3xl" />

      {/* Main Container */}
      <div className="flex-1 max-w-5xl w-full mx-auto flex flex-col bg-zinc-950/20 backdrop-blur-md rounded-2xl border border-zinc-900 overflow-hidden shadow-2xl relative z-10 my-4">
        
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-zinc-900 bg-zinc-950/60 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center shadow-lg shadow-violet-500/5">
              <Sparkles className="w-5 h-5 text-violet-400 animate-pulse" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-zinc-100 tracking-tight flex items-center gap-2">
                {isSpanish ? "Asistente AI Premium" : "Premium AI Assistant"}
                <span className="text-[10px] bg-violet-500/10 border border-violet-500/20 text-violet-400 px-2 py-0.5 rounded-full font-bold tracking-wide uppercase">
                  v2.0
                </span>
              </h1>
              <p className="text-xs text-zinc-500">
                {isSpanish 
                  ? "Analista bursátil con base de conocimiento local y Google Grounding" 
                  : "Bespoke stock analyst backed by local knowledge base & Google Grounding"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end md:self-auto">
            {messages.length > 0 && (
              <button 
                onClick={clearHistory}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors border border-zinc-900 hover:bg-zinc-900/30 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {isSpanish ? "Borrar Historial" : "Clear Chat"}
              </button>
            )}
          </div>
        </div>

        {/* Chat History / Welcome Screen */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 flex flex-col bg-zinc-950/40 min-h-[350px]">
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center max-w-2xl mx-auto my-auto space-y-8">
              
              <div className="relative">
                <div className="absolute inset-0 bg-violet-500/10 rounded-full filter blur-xl animate-pulse" />
                <div className="relative w-16 h-16 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 flex items-center justify-center shadow-2xl">
                  <Bot className="w-8 h-8 text-violet-400" />
                </div>
              </div>

              <div>
                <h2 className="text-xl font-extrabold text-zinc-100 tracking-tight">
                  {isSpanish 
                    ? `Bienvenido a HIVEX AI, ${userProfile?.fullName || "Inversor"}`
                    : `Welcome to HIVEX AI, ${userProfile?.fullName || "Investor"}`}
                </h2>
                <p className="text-xs text-zinc-400 mt-2 max-w-md mx-auto leading-relaxed">
                  {isSpanish 
                    ? "Soy tu asistente financiero privado de élite. Mi base de conocimiento contiene las transcripciones completas, resúmenes, gráficos detectados e informes de todos tus vídeos sincronizados en Supabase."
                    : "I am your bespoke private investment analyst. My knowledge base contains complete text transcripts, visual charts, summaries, and stock reports from all videos synced to Supabase."}
                </p>
              </div>

              {/* Suggestions Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                {suggestions.map((sug, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(sug.query)}
                    className="group text-left p-4 rounded-xl border border-zinc-900/80 bg-zinc-950/20 hover:bg-zinc-900/20 hover:border-violet-500/20 transition-all duration-200 shadow-md relative"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 group-hover:bg-violet-600/10 group-hover:border-violet-500/20 transition-colors">
                        <Compass className="w-4 h-4 text-zinc-500 group-hover:text-violet-400" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-zinc-300 group-hover:text-violet-300 transition-colors flex items-center gap-1.5">
                          {sug.title}
                          <ChevronRight className="w-3 h-3 opacity-0 group-hover:translate-x-1 group-hover:opacity-100 transition-all" />
                        </h4>
                        <p className="text-[10px] text-zinc-500 mt-1 line-clamp-2 leading-relaxed">
                          {sug.desc}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((msg) => {
                const isAI = msg.role === "assistant";
                // Check if the reply includes the exact fallback pattern or contains the standard fallback text
                const containsFallback = msg.content.includes(FALLBACK_PATTERN) || msg.content.includes("base de conocimiento no dispone");

                return (
                  <div
                    key={msg.id}
                    className={`flex gap-4 ${isAI ? "justify-start" : "justify-end"}`}
                  >
                    {/* Assistant Avatar */}
                    {isAI && (
                      <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center flex-shrink-0 shadow-md">
                        <Sparkles className="w-4 h-4 text-violet-400" />
                      </div>
                    )}

                    <div className={`max-w-[85%] flex flex-col space-y-2`}>
                      {/* Message bubble */}
                      <div
                        className={`px-5 py-4 rounded-2xl shadow-lg relative ${
                          isAI
                            ? "bg-zinc-900/20 border border-zinc-900/60 backdrop-blur-md rounded-tl-none text-zinc-200"
                            : "bg-violet-600/15 border border-violet-500/15 rounded-tr-none text-zinc-100"
                        }`}
                      >
                        {isAI ? (
                          <div className="space-y-1">
                            {formatMarkdown(msg.content)}
                          </div>
                        ) : (
                          <p className="text-xs md:text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                        )}

                        <span className="text-[9px] text-zinc-600 absolute bottom-1.5 right-3 block">
                          {msg.timestamp}
                        </span>

                        {/* Inline fallback action button */}
                        {isAI && containsFallback && (
                          <div className="mt-3 pt-3 border-t border-zinc-900/50 flex justify-start">
                            <button
                              onClick={() => {
                                // Extract original query from preceding user message
                                const index = messages.findIndex(m => m.id === msg.id);
                                if (index > 0) {
                                  const prevUserMsg = messages[index - 1];
                                  if (prevUserMsg && prevUserMsg.role === "user") {
                                    setUseInternet(true);
                                    handleSendMessage(prevUserMsg.content, true);
                                  }
                                }
                              }}
                              className="text-xs font-black bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-4 py-2 rounded-xl shadow-lg shadow-violet-500/10 flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                            >
                              <Globe className="w-3.5 h-3.5 text-white animate-spin" style={{ animationDuration: '3s' }} />
                              {isSpanish ? "Buscar en Internet ahora" : "Search Internet Now"}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Telegram Manual Broadcast Button */}
                      {isAI && (
                        <div className="flex items-center justify-start mt-0.5 pl-1">
                          <button
                            onClick={() => handleSendToTelegram(msg.id, msg.content)}
                            disabled={telegramStatuses[msg.id] === "sending"}
                            className={`px-3 py-1.5 rounded-xl border text-[10px] font-bold flex items-center gap-1.5 transition-all duration-300 shadow-md ${
                              telegramStatuses[msg.id] === "sending"
                                ? "bg-zinc-950/40 border-zinc-900 text-zinc-500 cursor-not-allowed"
                                : telegramStatuses[msg.id] === "sent"
                                ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400"
                                : telegramStatuses[msg.id] === "error"
                                ? "bg-rose-500/20 border-rose-500/30 text-rose-400"
                                : "bg-zinc-950/20 border-zinc-900/60 hover:border-violet-500/30 text-zinc-400 hover:text-violet-300 hover:bg-violet-500/5 cursor-pointer"
                            }`}
                            title={isSpanish ? "Enviar a Telegram" : "Send to Telegram"}
                          >
                            {telegramStatuses[msg.id] === "sending" ? (
                              <Loader2 className="w-3 h-3 animate-spin text-zinc-500" />
                            ) : telegramStatuses[msg.id] === "sent" ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : telegramStatuses[msg.id] === "error" ? (
                              <AlertCircle className="w-3 h-3 text-rose-400" />
                            ) : (
                              <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current" stroke="none">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.28-.02-.11.02-1.93 1.23-5.46 3.48-.51.35-.98.53-1.39.52-.46-.01-1.35-.26-2.01-.48-.51-.17-.91-.26-.87-.55.02-.15.42-.31 1.21-.48 4.88-2.12 8.14-3.51 9.79-4.18.91-.37 1.81-.54 2.45-.53.15 0 .49.03.71.2.18.15.23.36.24.52z" />
                              </svg>
                            )}
                            <span>
                              {telegramStatuses[msg.id] === "sending"
                                ? (isSpanish ? "Enviando..." : "Sending...")
                                : telegramStatuses[msg.id] === "sent"
                                ? (isSpanish ? "¡Enviado!" : "Sent!")
                                : telegramStatuses[msg.id] === "error"
                                ? (isSpanish ? "Error" : "Error")
                                : (isSpanish ? "Enviar a Telegram" : "Send to Telegram")}
                            </span>
                          </button>
                        </div>
                      )}


                      {/* Cited Sources pills section */}
                      {isAI && msg.sources && msg.sources.length > 0 && (
                        <div className="pl-1 flex flex-col space-y-1.5">
                          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-violet-400" />
                            {isSpanish ? "Fuentes y referencias:" : "Cited sources:"}
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {msg.sources.map((src, sIdx) => {
                              const isLocal = src.type === "local";
                              return (
                                <a
                                  key={sIdx}
                                  href={src.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`text-xs px-3 py-1.5 rounded-full border flex items-center gap-1.5 transition-all hover:scale-[1.03] hover:shadow-md cursor-pointer ${
                                    isLocal
                                      ? "bg-violet-600/10 border-violet-500/20 hover:border-violet-500/35 text-violet-300"
                                      : "bg-cyan-500/10 border-cyan-500/20 hover:border-cyan-500/35 text-cyan-300"
                                  }`}
                                >
                                  {isLocal ? (
                                    <Play className="w-3 h-3 text-violet-400 fill-violet-400" />
                                  ) : (
                                    <Globe className="w-3 h-3 text-cyan-400" />
                                  )}
                                  <span className="max-w-[140px] truncate font-semibold">
                                    {src.title}
                                  </span>
                                </a>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* User Avatar */}
                    {!isAI && (
                      <div className="w-8 h-8 rounded-lg bg-violet-600/15 border border-violet-500/20 flex items-center justify-center flex-shrink-0 shadow-md">
                        <User className="w-4 h-4 text-violet-400" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Typing Indicator dots */}
          {loading && (
            <div className="flex gap-4 justify-start">
              <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center flex-shrink-0 shadow-md">
                <Sparkles className="w-4 h-4 text-violet-400" />
              </div>
              <div className="bg-zinc-900/20 border border-zinc-900/60 backdrop-blur-md px-5 py-4 rounded-2xl rounded-tl-none flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input & Control Panel */}
        <div className="p-4 border-t border-zinc-900 bg-zinc-950/40 backdrop-blur-md">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputValue);
            }}
            className="space-y-4"
          >
            {/* Internet toggle control bar */}
            <div className="flex items-center justify-between bg-zinc-950/60 border border-zinc-900/80 p-2.5 rounded-xl">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg border transition-colors ${useInternet ? "bg-cyan-500/10 border-cyan-500/20" : "bg-zinc-900 border-zinc-800"}`}>
                  <Globe className={`w-4 h-4 transition-colors ${useInternet ? "text-cyan-400" : "text-zinc-500"}`} />
                </div>
                <div>
                  <span className="text-xs font-bold text-zinc-300 block">
                    {isSpanish ? "Consultar en Internet" : "Consult Internet"}
                  </span>
                  <span className="text-[10px] text-zinc-500 block leading-none mt-0.5">
                    {isSpanish 
                      ? "Activa Google Search Grounding para complementar con datos bursátiles en tiempo real" 
                      : "Leverages Google Search Grounding to enrich advice with real-time market data"}
                  </span>
                </div>
              </div>

              {/* Styled neon switch */}
              <button
                type="button"
                onClick={() => setUseInternet(!useInternet)}
                className={`w-10 h-5.5 rounded-full relative transition-all duration-300 border focus:outline-none cursor-pointer ${
                  useInternet 
                    ? "bg-cyan-500/10 border-cyan-400/40 shadow-inner" 
                    : "bg-zinc-900 border-zinc-800"
                }`}
              >
                <div 
                  className={`w-3.5 h-3.5 rounded-full absolute top-[3px] transition-all duration-300 ${
                    useInternet 
                      ? "bg-cyan-400 left-[21px] shadow-md shadow-cyan-400/50" 
                      : "bg-zinc-500 left-[3px]"
                  }`} 
                />
              </button>
            </div>

            {/* Input keyboard row */}
            <div className="flex items-center gap-2 relative">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={
                  loading 
                    ? (isSpanish ? "Procesando consulta..." : "Analyzing query...") 
                    : (isSpanish ? "Escribe tu consulta bursátil o de soporte aquí..." : "Ask your investment or platform question...")
                }
                disabled={loading}
                className="w-full bg-zinc-950/60 text-zinc-200 text-xs md:text-sm px-4 py-3.5 rounded-xl border border-zinc-900 focus:outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20 placeholder-zinc-600 disabled:opacity-50 transition-all shadow-inner pr-12"
              />
              <button
                type="submit"
                disabled={loading || !inputValue.trim()}
                className="absolute right-2 top-2 p-2 rounded-lg bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-40 disabled:hover:bg-violet-600 active:scale-95 transition-all shadow-lg shadow-violet-600/10 cursor-pointer"
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
