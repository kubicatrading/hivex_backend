"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Sparkles, Send, Globe, Play, Bot, User, X, Loader2, ArrowRight,
  HelpCircle, MessageSquare, Compass, ShieldAlert, CheckCircle2, Check
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  sources?: { title: string; url: string; type: "local" | "internet" }[];
  searchedInternet?: boolean;
}

export function AssistantBotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [useInternet, setUseInternet] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("en");
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

  // Sync language selection dynamically
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("hivex_selected_language") || "en";
      setSelectedLanguage(saved);

      // Load chat history from sessionStorage to keep it persistent across page navigations
      const savedChat = sessionStorage.getItem("hivex_bot_chat_history");
      if (savedChat) {
        try {
          setMessages(JSON.parse(savedChat));
        } catch (e) {
          console.error("Error parsing saved chat history:", e);
        }
      }
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

  // Save chat history to sessionStorage when it changes
  useEffect(() => {
    if (messages.length > 0) {
      sessionStorage.setItem("hivex_bot_chat_history", JSON.stringify(messages));
    }
  }, [messages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 80);
    }
  }, [messages, isOpen]);

  // Multilingual content for UI
  const contentByLang: Record<string, {
    title: string;
    subtitle: string;
    placeholder: string;
    searchInternet: string;
    welcomeMsg: string;
    welcomeSub: string;
    internetActive: string;
    errorMsg: string;
    searchBtn: string;
    localSources: string;
    internetSources: string;
    suggestTitle: string;
    suggestions: { title: string; query: string }[];
  }> = {
    es: {
      title: "Asistente AI Premium",
      subtitle: "Asesor Bursátil y Soporte HIVEX",
      placeholder: "Escribe tu consulta financiera...",
      searchInternet: "Búsqueda web en tiempo real",
      welcomeMsg: "Hola, soy tu asistente bursátil premium de HIVEX.",
      welcomeSub: "Tengo acceso completo a las transcripciones de videos y análisis macroeconómicos de la plataforma para guiar tu inversión.",
      internetActive: "Búsqueda web activa",
      errorMsg: "Lo siento, ocurrió un error al procesar tu consulta.",
      searchBtn: "Buscar en Internet ahora",
      localSources: "Videos Analizados",
      internetSources: "Fuentes Web",
      suggestTitle: "Temas de interés:",
      suggestions: [
        { title: "Vídeos en base de datos", query: "¿Qué vídeos tenemos sincronizados en Supabase para mi cuenta?" },
        { title: "Riesgos macroeconómicos", query: "¿Cuáles son los riesgos macroeconómicos clave según los vídeos?" },
        { title: "Soporte de Cabina", query: "¿Cómo funciona la cabina de estudio de HIVEX?" }
      ]
    },
    en: {
      title: "Premium AI Assistant",
      subtitle: "Market Advisor & HIVEX Support",
      placeholder: "Ask a financial question...",
      searchInternet: "Real-time web search",
      welcomeMsg: "Hello! I am your HIVEX premium investment assistant.",
      welcomeSub: "I have direct access to literal video transcripts and macroeconomic reports to guide your asset allocation.",
      internetActive: "Web search active",
      errorMsg: "Sorry, an error occurred while processing your request.",
      searchBtn: "Search on Internet now",
      localSources: "Analyzed Videos",
      internetSources: "Web Sources",
      suggestTitle: "Suggested topics:",
      suggestions: [
        { title: "Synced videos list", query: "Which videos do we have synchronized in Supabase for my account?" },
        { title: "Macroeconomic risks", query: "What are the main macroeconomic risks this week according to the videos?" },
        { title: "Study cabin help", query: "How does the HIVEX study cabin work and what tools does it offer?" }
      ]
    },
    de: {
      title: "Premium KI-Assistent",
      subtitle: "Marktberater & HIVEX Support",
      placeholder: "Stellen Sie eine finanzielle Frage...",
      searchInternet: "Echtzeit-Websuche",
      welcomeMsg: "Hallo! Ich bin Ihr HIVEX Premium-Anlageassistent.",
      welcomeSub: "Ich habe direkten Zugriff auf Transkripte und makroökonomische Berichte, um Ihre Vermögensallokation zu leiten.",
      internetActive: "Websuche aktiv",
      errorMsg: "Es ist ein Fehler bei der Verarbeitung aufgetreten.",
      searchBtn: "Jetzt im Internet suchen",
      localSources: "Analysierte Videos",
      internetSources: "Web-Quellen",
      suggestTitle: "Vorgeschlagene Themen:",
      suggestions: [
        { title: "Synchronisierte Videos", query: "Welche Videos haben wir in Supabase für mein Konto synchronisiert?" },
        { title: "Makro-Risiken", query: "Was sind die wichtigsten makroökonomischen Risiken laut den Videos?" },
        { title: "Hilfe zur Studienkabine", query: "Wie funktioniert die HIVEX-Studienkabine?" }
      ]
    },
    tr: {
      title: "Premium Yapay Zeka Asistanı",
      subtitle: "Piyasa Danışmanı & HIVEX Desteği",
      placeholder: "Finansal bir soru sorun...",
      searchInternet: "Gerçek zamanlı web araması",
      welcomeMsg: "Merhaba! Ben HIVEX premium yatırım asistanınız.",
      welcomeSub: "Yatırımlarınızı yönlendirmek için video transkriptlerine ve makroekonomik raporlara doğrudan erişimim var.",
      internetActive: "Web araması aktif",
      errorMsg: "Talebiniz işlenirken bir hata oluştu.",
      searchBtn: "Şimdi internette ara",
      localSources: "Analiz Edilen Videolar",
      internetSources: "Web Kaynakları",
      suggestTitle: "Önerilen konular:",
      suggestions: [
        { title: "Senkronize videolar", query: "Hesabım için Supabase'de hangi videolar senkronize edilmiş durumda?" },
        { title: "Makro riskler", query: "Videolara göre bu haftanın temel makroekonomik riskleri nelerdir?" },
        { title: "Çalışma Kabini Desteği", query: "HIVEX çalışma kabini nasıl çalışır?" }
      ]
    }
  };

  const ui = contentByLang[selectedLanguage] || contentByLang["en"];

  const handleSendMessage = async (textToSend?: string, forceInternet = false) => {
    const queryText = textToSend || inputValue;
    if (!queryText.trim()) return;

    if (!textToSend) {
      setInputValue("");
    }

    const userMsg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      role: "user",
      content: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      // Fetch safe authorization session token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || "";

      // Fetch all local documents from Supabase client (fully populated on the client-side)
      const { data: localDocs } = await supabase.from("documents").select("*");

      // Format conversation history for api route
      const apiHistory = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const activeSearchMode = forceInternet || useInternet;

      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          message: queryText,
          history: apiHistory,
          useInternet: activeSearchMode,
          localDocuments: localDocs || []
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        const assistantMsg: ChatMessage = {
          id: Math.random().toString(36).substring(2, 9),
          role: "assistant",
          content: data.response,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          sources: data.sources || [],
          searchedInternet: data.searchedInternet
        };
        setMessages(prev => [...prev, assistantMsg]);
      } else {
        throw new Error(data.error || "Error in API response");
      }
    } catch (err: any) {
      console.error("[Assistant Bot Widget] Error querying assistant:", err);
      const errorMsg: ChatMessage = {
        id: Math.random().toString(36).substring(2, 9),
        role: "assistant",
        content: `${ui.errorMsg} (${err.message || String(err)})`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    setMessages([]);
    sessionStorage.removeItem("hivex_bot_chat_history");
  };

  // Helper to parse markdown-like bold and format beautiful lists cleanly in chat bubbles
  const renderMessageContent = (msg: ChatMessage) => {
    const text = msg.content;
    const isFallbackMessage = text.includes("actualmente, mi base de conocimiento no dispone de esa información");

    const parts = text.split(/(\*\*.*?\*\*)/g);
    
    return (
      <div className="space-y-3">
        <p className="text-zinc-200 text-sm leading-relaxed whitespace-pre-wrap">
          {parts.map((part, idx) => {
            if (part.startsWith("**") && part.endsWith("**")) {
              return <strong key={idx} className="font-bold text-violet-300">{part.slice(2, -2)}</strong>;
            }
            return part;
          })}
        </p>

        {/* Fallback Search Trigger Button inline */}
        {isFallbackMessage && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              // Find the last user message to repeat it with Internet active
              const lastUserMessage = [...messages].reverse().find(m => m.role === "user");
              if (lastUserMessage) {
                setUseInternet(true);
                handleSendMessage(lastUserMessage.content, true);
              }
            }}
            className="flex items-center gap-2 mt-2 px-3 py-2 bg-gradient-to-r from-cyan-600/30 to-violet-600/30 hover:from-cyan-600/40 hover:to-violet-600/40 border border-cyan-500/30 text-cyan-300 text-xs font-bold rounded-xl transition-all shadow-md shadow-cyan-950/20 w-full justify-center"
          >
            <Globe className="w-3.5 h-3.5 animate-pulse text-cyan-400" />
            <span>{ui.searchBtn}</span>
          </motion.button>
        )}

        {/* Citations / Sources */}
        {msg.sources && msg.sources.length > 0 && (
          <div className="pt-2 border-t border-zinc-900/60 space-y-1.5">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
              Fuentes Citadas:
            </span>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
              {msg.sources.map((source, index) => (
                <a
                  key={index}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-semibold border transition-all ${
                    source.type === "local"
                      ? "bg-violet-950/20 border-violet-500/20 hover:border-violet-500/40 text-violet-300"
                      : "bg-cyan-950/20 border-cyan-500/20 hover:border-cyan-500/40 text-cyan-300"
                  }`}
                >
                  {source.type === "local" ? (
                    <Play className="w-2.5 h-2.5 text-violet-400 fill-violet-400/20" />
                  ) : (
                    <Globe className="w-2.5 h-2.5 text-cyan-400" />
                  )}
                  <span className="truncate max-w-[140px]">{source.title}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Floating Sparkle Action FAB Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <motion.button
          whileHover={{ scale: 1.05, rotate: 2 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(!isOpen)}
          className={`relative p-4 rounded-full shadow-2xl flex items-center justify-center border transition-all duration-300 ${
            isOpen 
              ? "bg-zinc-900 border-zinc-800 text-zinc-400 shadow-black"
              : "bg-gradient-to-tr from-violet-600 to-indigo-700 border-violet-500/40 text-white shadow-violet-600/10 hover:shadow-violet-600/30"
          }`}
        >
          {isOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <>
              {/* Ripple glowing effect */}
              <span className="absolute inset-0 rounded-full bg-violet-500/20 animate-ping opacity-75" />
              <Bot className="w-6 h-6 animate-pulse" />
            </>
          )}
        </motion.button>
      </div>

      {/* Floating Glassmorphism Chat Bot Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="fixed bottom-24 right-6 w-96 h-[560px] rounded-2xl bg-zinc-950/90 border border-zinc-800/80 shadow-2xl z-50 flex flex-col overflow-hidden backdrop-blur-xl"
          >
            {/* Background neon orb glow */}
            <div className="absolute top-0 right-0 w-36 h-36 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-36 h-36 bg-cyan-600/5 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="px-5 py-4 border-b border-zinc-900 bg-zinc-950/40 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600/20 to-indigo-600/20 border border-violet-500/20 flex items-center justify-center text-violet-400 shadow-md">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-zinc-100 tracking-wide flex items-center gap-2">
                    {ui.title}
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  </h3>
                  <p className="text-[10px] text-zinc-400 font-medium">{ui.subtitle}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    onClick={handleClearHistory}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 transition-colors"
                    title="Limpiar conversación"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Conversation History */}
            <div className="flex-grow overflow-y-auto p-5 space-y-4 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
              {messages.length === 0 ? (
                // Elegant Empty Welcome view
                <div className="h-full flex flex-col items-center justify-center text-center px-4 space-y-5">
                  <motion.div
                    animate={{ y: [0, -6, 0] }}
                    transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                    className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-violet-600/10 to-indigo-600/10 border border-violet-500/10 flex items-center justify-center text-violet-400 shadow-xl"
                  >
                    <Sparkles className="w-7 h-7" />
                  </motion.div>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-200">{ui.welcomeMsg}</h4>
                    <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                      {ui.welcomeSub}
                    </p>
                  </div>

                  {/* Suggestion Chips */}
                  <div className="w-full text-left space-y-2 pt-2">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1 block">
                      {ui.suggestTitle}
                    </span>
                    <div className="space-y-2">
                      {ui.suggestions.map((sug, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setInputValue(sug.query);
                            handleSendMessage(sug.query);
                          }}
                          className="w-full text-left p-2.5 rounded-xl bg-zinc-900/40 hover:bg-zinc-900 border border-zinc-800/40 hover:border-zinc-800 text-xs font-semibold text-zinc-300 hover:text-violet-300 transition-all flex items-center justify-between group"
                        >
                          <span className="truncate mr-2">{sug.title}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-violet-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                // Chat bubbles
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {/* Bot Avatar */}
                    {msg.role === "assistant" && (
                      <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-violet-400 flex-shrink-0 self-end shadow-md">
                        <Bot className="w-4 h-4" />
                      </div>
                    )}

                    <div className="space-y-1 max-w-[80%]">
                      <div
                        className={`px-4 py-3 rounded-2xl text-xs font-medium shadow-md ${
                          msg.role === "user"
                            ? "bg-gradient-to-tr from-violet-600 to-indigo-600 text-white rounded-br-none border border-violet-500/30"
                            : "bg-zinc-900/60 border border-zinc-800/50 text-zinc-200 rounded-bl-none backdrop-blur-sm"
                        }`}
                      >
                        {msg.role === "user" ? (
                          <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        ) : (
                          renderMessageContent(msg)
                        )}
                      </div>

                      {/* Telegram Manual Broadcast Button */}
                      {msg.role === "assistant" && (
                        <div className="flex items-center justify-start mt-0.5 pl-1">
                          <button
                            onClick={() => handleSendToTelegram(msg.id, msg.content)}
                            disabled={telegramStatuses[msg.id] === "sending"}
                            className={`px-2.5 py-1 rounded-xl border text-[9px] font-bold flex items-center gap-1.5 transition-all duration-300 shadow-md ${
                              telegramStatuses[msg.id] === "sending"
                                ? "bg-zinc-950/40 border-zinc-900 text-zinc-500 cursor-not-allowed"
                                : telegramStatuses[msg.id] === "sent"
                                ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400"
                                : telegramStatuses[msg.id] === "error"
                                ? "bg-rose-500/20 border-rose-500/30 text-rose-400"
                                : "bg-zinc-950/20 border-zinc-900/60 hover:border-violet-500/30 text-zinc-400 hover:text-violet-300 hover:bg-violet-500/5 cursor-pointer"
                            }`}
                            title={selectedLanguage === "es" ? "Enviar a Telegram" : "Send to Telegram"}
                          >
                            {telegramStatuses[msg.id] === "sending" ? (
                              <Loader2 className="w-2.5 h-2.5 animate-spin text-zinc-500" />
                            ) : telegramStatuses[msg.id] === "sent" ? (
                              <Check className="w-2.5 h-2.5 text-emerald-400" />
                            ) : telegramStatuses[msg.id] === "error" ? (
                              <ShieldAlert className="w-2.5 h-2.5 text-rose-400" />
                            ) : (
                              <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-current" stroke="none">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.28-.02-.11.02-1.93 1.23-5.46 3.48-.51.35-.98.53-1.39.52-.46-.01-1.35-.26-2.01-.48-.51-.17-.91-.26-.87-.55.02-.15.42-.31 1.21-.48 4.88-2.12 8.14-3.51 9.79-4.18.91-.37 1.81-.54 2.45-.53.15 0 .49.03.71.2.18.15.23.36.24.52z" />
                              </svg>
                            )}
                            <span>
                              {telegramStatuses[msg.id] === "sending"
                                ? (selectedLanguage === "es" ? "Enviando..." : "Sending...")
                                : telegramStatuses[msg.id] === "sent"
                                ? (selectedLanguage === "es" ? "¡Enviado!" : "Sent!")
                                : telegramStatuses[msg.id] === "error"
                                ? (selectedLanguage === "es" ? "Error" : "Error")
                                : (selectedLanguage === "es" ? "Enviar a Telegram" : "Send to Telegram")}
                            </span>
                          </button>
                        </div>
                      )}
                      
                      {/* Timestamp & Internet Indicator */}
                      <div className={`flex items-center gap-2 px-1 text-[9px] text-zinc-500 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <span>{msg.timestamp}</span>
                        {msg.searchedInternet && (
                          <span className="text-cyan-400 font-bold flex items-center gap-0.5 scale-90">
                            <Globe className="w-2.5 h-2.5 animate-pulse" />
                            {ui.internetActive}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* User Avatar */}
                    {msg.role === "user" && (
                      <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 flex-shrink-0 self-end shadow-md">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                ))
              )}

              {/* Bouncing Loader Indicator */}
              {loading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-violet-400 flex-shrink-0 self-end shadow-md">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                  <div className="px-4 py-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/50 rounded-bl-none text-zinc-400 flex items-center gap-1 shadow-md">
                    <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Controls Bar */}
            <div className="p-4 border-t border-zinc-900 bg-zinc-950/60 z-10">
              {/* Web Search Grounding Switcher */}
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <Globe className={`w-3.5 h-3.5 ${useInternet ? "text-cyan-400 animate-pulse" : "text-zinc-500"}`} />
                  <span className={`text-[10px] font-bold tracking-wide transition-colors ${useInternet ? "text-cyan-400" : "text-zinc-500"}`}>
                    {ui.searchInternet}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setUseInternet(!useInternet)}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    useInternet ? "bg-cyan-500/20 border-cyan-400/30" : "bg-zinc-900 border-zinc-800"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full shadow-md transition duration-200 ease-in-out ${
                      useInternet ? "translate-x-4 bg-cyan-400" : "translate-x-0 bg-zinc-600"
                    }`}
                  />
                </button>
              </div>

              {/* Chat Text Input Field */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={ui.placeholder}
                  disabled={loading}
                  className="flex-grow px-4 py-2.5 bg-zinc-900/50 hover:bg-zinc-900/80 focus:bg-zinc-900 border border-zinc-800 focus:border-violet-500/50 rounded-xl text-xs text-white placeholder-zinc-500 tracking-wide outline-none transition-all disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={loading || !inputValue.trim()}
                  className={`p-2.5 rounded-xl flex items-center justify-center border transition-all ${
                    inputValue.trim() && !loading
                      ? "bg-violet-600 hover:bg-violet-500 border-violet-500 text-white shadow-md shadow-violet-600/15"
                      : "bg-zinc-900 border-zinc-800 text-zinc-600 cursor-not-allowed"
                  }`}
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
