"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Music, Play, Pause, Volume2, VolumeX, Trash2, Clock, Disc, ChevronRight, UploadCloud
} from "lucide-react";
import { translations } from "@/lib/translations";

interface AudioDocument {
  id: string;
  title: string;
  description?: string;
  type: "audio";
  file_url: string;
  created_at: string;
  metadata: {
    duration: string;
    genre: string;
    waveform: number[];
  };
}

export default function AudiosPage() {
  const [audios, setAudios] = useState<AudioDocument[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Active audio playing state
  const [selectedAudio, setSelectedAudio] = useState<AudioDocument | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState("0:00");
  const [audioDuration, setAudioDuration] = useState("0:00");

  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [genre, setGenre] = useState("Ambient");
  const [fileUrl, setFileUrl] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  // Audio HTML5 element reference
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fetchAudios = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("type", "audio");
      if (error) throw error;
      
      if (data) {
        const typedData: AudioDocument[] = (data as {
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
          type: "audio" as const,
          file_url: doc.file_url || "",
          created_at: doc.created_at,
          metadata: {
            duration: String(doc.metadata?.duration || "3:30"),
            genre: String(doc.metadata?.genre || "Ambient"),
            waveform: Array.isArray(doc.metadata?.waveform)
              ? (doc.metadata.waveform as number[])
              : Array.from({ length: 26 }, () => Math.floor(Math.random() * 80) + 20)
          }
        }));
        setAudios(typedData);
        setSelectedAudio(current => {
          if (!current && typedData.length > 0) {
            return typedData[0];
          }
          return current;
        });
      }
    } catch (err) {
      console.error("Failed to load audios:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAudios();
  }, [fetchAudios]);

  useEffect(() => {
    // Whenever selectedAudio changes, load the new track and stop playing
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime("0:00");
    }
  }, [selectedAudio]);

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(err => console.log("Play failed:", err));
      setIsPlaying(true);
    }
  };

  const handleMuteToggle = () => {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const current = audioRef.current.currentTime;
    const total = audioRef.current.duration;
    
    if (!isNaN(total)) {
      setProgress((current / total) * 100);
      setAudioDuration(formatTime(total));
    }
    setCurrentTime(formatTime(current));
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime("0:00");
  };

  const formatTime = (secs: number) => {
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const duration = audioRef.current.duration;
    
    if (!isNaN(duration)) {
      const newTime = (clickX / width) * duration;
      audioRef.current.currentTime = newTime;
      setProgress((clickX / width) * 100);
    }
  };

  const handleCreateAudio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !fileUrl) return;
    setFormLoading(true);

    try {
      const newAudio = {
        title,
        description,
        type: "audio",
        file_url: fileUrl,
        metadata: {
          duration: "3:30", // Placeholder default length
          genre,
          waveform: Array.from({ length: 26 }, () => Math.floor(Math.random() * 80) + 20)
        }
      };

      const { data, error } = await supabase.from("documents").insert(newAudio);
      if (error) throw error;

      setTitle("");
      setDescription("");
      setFileUrl("");
      setGenre("Ambient");
      
      await fetchAudios();
      if (data && data[0]) {
        setSelectedAudio(data[0]);
      }
    } catch (err) {
      console.error("Failed to insert audio:", err);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteAudio = async (id: string) => {
    const lang = selectedLanguage || "en";
    const t = translations[lang]?.audios || translations["en"].audios;
    if (confirm(t.confirmDelete || "¿Estás seguro de que deseas eliminar este audio?")) {
      try {
        const { error } = await supabase.from("documents").delete().eq("id", id);
        if (error) throw error;
        
        const remaining = audios.filter(a => a.id !== id);
        setAudios(remaining);
        
        if (selectedAudio?.id === id) {
          setSelectedAudio(remaining.length > 0 ? remaining[0] : null);
        }
      } catch (err) {
        console.error("Failed to delete audio:", err);
      }
    }
  };

  const lang = selectedLanguage || "en";
  const t = translations[lang]?.audios || translations["en"].audios;

  return (
    <div className="space-y-10">
      {/* Page Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-zinc-900/60">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">
            {t.title || "Estación de Audio"}
          </h1>
          <p className="text-zinc-400 font-light mt-1 text-sm md:text-base">
            {t.subtitle || "Reproductor premium con renderizado de ondas de sonido y gestor de pistas multimedia."}
          </p>
        </div>
      </div>

      {/* Main Body Grid */}
      <div className="grid lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: ACTIVE AUDIO PLAYER */}
        <div className="lg:col-span-8 space-y-6">
          {/* Audio Player Deck */}
          <div className="rounded-2xl border border-zinc-900 bg-zinc-900/10 p-8 space-y-8 relative overflow-hidden flex flex-col items-center text-center">
            {/* Ambient Background Glow inside player */}
            <div className="absolute top-[-30%] left-[-20%] w-[60%] h-[60%] bg-emerald-500/5 blur-[60px] pointer-events-none animate-pulse" />

            {/* Hidden HTML5 Audio Element */}
            {selectedAudio && (
              <audio
                ref={audioRef}
                src={selectedAudio.file_url}
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleAudioEnded}
              />
            )}

            {/* Disk Icon and metadata */}
            <div className="space-y-4 relative z-10 flex flex-col items-center">
              <div className={`w-28 h-28 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center relative shadow-2xl ${isPlaying ? "animate-spin" : ""}`} style={{ animationDuration: "12s" }}>
                <div className="w-8 h-8 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <Disc className="absolute top-2 right-2 w-4 h-4 text-zinc-700" />
                <Music className="absolute bottom-2 left-2 w-4 h-4 text-zinc-700" />
              </div>

              <div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                  {selectedAudio ? selectedAudio.metadata.genre : (t.selectedAudioGenre || "Audio")}
                </span>
                <h2 className="text-xl font-extrabold text-white mt-3 tracking-tight">
                  {selectedAudio ? selectedAudio.title : (t.selectTrack || "Selecciona una pista")}
                </h2>
                <p className="text-xs text-zinc-500 font-light mt-1 max-w-sm">
                  {selectedAudio ? selectedAudio.description : (t.noDescription || "Sin descripción disponible.")}
                </p>
              </div>
            </div>

            {/* WAVEFORM VISUALIZATION */}
            <div className="w-full flex items-end justify-center gap-1 sm:gap-1.5 h-16 pt-4 px-4 relative z-10">
              {selectedAudio?.metadata?.waveform ? (
                selectedAudio.metadata.waveform.map((peak: number, idx: number) => {
                  // Determine peak active color state
                  const isActive = progress >= (idx / selectedAudio.metadata.waveform.length) * 100;
                  return (
                    <div
                      key={idx}
                      className={`w-1 sm:w-1.5 rounded-full transition-all duration-300 ${isActive ? "bg-emerald-400" : "bg-zinc-800"}`}
                      style={{ height: `${peak}%` }}
                    />
                  );
                })
              ) : (
                <div className="text-xs text-zinc-600 font-mono">{t.noSpectrum || "Sin espectro disponible"}</div>
              )}
            </div>

            {/* PLAYER CONTROLS (Progress bar & buttons) */}
            <div className="w-full space-y-4 relative z-10">
              {/* Progress track */}
              <div className="space-y-1">
                <div
                  onClick={handleProgressBarClick}
                  className="w-full h-1.5 bg-zinc-900 border border-zinc-800/80 rounded-full cursor-pointer relative group overflow-hidden"
                >
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-100"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-zinc-500 font-bold">
                  <span>{currentTime}</span>
                  <span>{audioDuration !== "0:00" ? audioDuration : selectedAudio?.metadata?.duration || "0:00"}</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-center gap-6">
                {/* Mute button */}
                <button
                  onClick={handleMuteToggle}
                  disabled={!selectedAudio}
                  className="p-3 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl text-zinc-400 hover:text-white transition-colors"
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>

                {/* Play / Pause button */}
                <button
                  onClick={handlePlayPause}
                  disabled={!selectedAudio}
                  className="w-14 h-14 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black shadow-lg shadow-emerald-500/10 rounded-full flex items-center justify-center transition-all transform hover:scale-105 active:scale-95"
                >
                  {isPlaying ? <Pause className="w-6 h-6 fill-black" /> : <Play className="w-6 h-6 fill-black translate-x-0.5" />}
                </button>

                {/* Reload / Reset track */}
                <button
                  onClick={() => {
                    if (audioRef.current) {
                      audioRef.current.currentTime = 0;
                      setProgress(0);
                    }
                  }}
                  disabled={!selectedAudio}
                  className="p-3 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl text-zinc-400 hover:text-white transition-colors"
                >
                  <Clock className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* AUDIO LIST CONTAINER */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-white">{t.playlistTitle || "Listado de Pistas y Podcast"}</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {loading ? (
                [1, 2].map((i) => (
                  <div key={i} className="h-20 rounded-xl bg-zinc-900/30 border border-zinc-900 animate-pulse" />
                ))
              ) : audios.length === 0 ? (
                <div className="p-6 text-center rounded-2xl bg-zinc-900/20 border border-zinc-900 col-span-2 text-sm text-zinc-500">
                  {t.noAudios || "Aún no tienes pistas de audio cargadas. Sube una a la derecha."}
                </div>
              ) : (
                audios.map((a) => (
                  <div
                    key={a.id}
                    onClick={() => setSelectedAudio(a)}
                    className={`p-4 rounded-xl border cursor-pointer flex items-center justify-between gap-4 transition-all ${selectedAudio?.id === a.id ? "bg-emerald-500/10 border-emerald-500/40" : "bg-zinc-900/30 border-zinc-900/80 hover:border-zinc-800"}`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex-shrink-0">
                        <Music className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white truncate">{a.title}</div>
                        <div className="text-xs text-zinc-500 truncate mt-0.5">{a.metadata.genre} · {a.metadata.duration}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAudio(a.id);
                        }}
                        className="p-1.5 rounded-lg border border-transparent hover:border-rose-500/20 text-zinc-600 hover:text-rose-400 hover:bg-rose-500/5 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <ChevronRight className="w-4 h-4 text-zinc-600" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: AUDIO LOADER / LINK CREATOR */}
        <div className="lg:col-span-4 rounded-2xl border border-zinc-900 bg-zinc-900/20 p-6 space-y-6">
          <div className="flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">{t.uploadTitle || "Subir Pista (Enlace)"}</h3>
          </div>

          <form onSubmit={handleCreateAudio} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{t.trackTitleLabel || "Título de la Pista"}</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="ej. LoFi Background Study"
                className="w-full px-3 py-2 bg-zinc-900/60 border border-zinc-800 focus:border-emerald-500 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{t.descriptionLabel || "Descripción"}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="ej. Ritmos lentos y relajantes para programar..."
                className="w-full px-3 py-2 bg-zinc-900/60 border border-zinc-800 focus:border-emerald-500 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none text-xs min-h-[50px] max-h-[100px]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{t.genreLabel || "Género Musical"}</label>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-900/60 border border-zinc-800 focus:border-emerald-500 rounded-xl text-zinc-300 text-xs focus:outline-none"
              >
                <option value="Ambient">{selectedLanguage === "es" ? "Ambient / Relajante" : selectedLanguage === "de" ? "Ambient / Entspannend" : selectedLanguage === "tr" ? "Ambient / Dinlendirici" : "Ambient / Relaxing"}</option>
                <option value="Synthwave">{selectedLanguage === "es" ? "Synthwave / Retro" : selectedLanguage === "de" ? "Synthwave / Retro" : selectedLanguage === "tr" ? "Synthwave / Retro" : "Synthwave / Retro"}</option>
                <option value="Electronic">{selectedLanguage === "es" ? "Electrónica / Techno" : selectedLanguage === "de" ? "Elektronik / Techno" : selectedLanguage === "tr" ? "Elektronik / Techno" : "Electronic / Techno"}</option>
                <option value="LoFi">{selectedLanguage === "es" ? "Lo-Fi / HipHop" : selectedLanguage === "de" ? "Lo-Fi / HipHop" : selectedLanguage === "tr" ? "Lo-Fi / HipHop" : "Lo-Fi / HipHop"}</option>
                <option value="Podcast">{selectedLanguage === "es" ? "Podcast / Grabación" : selectedLanguage === "de" ? "Podcast / Aufnahme" : selectedLanguage === "tr" ? "Podcast / Kayıt" : "Podcast / Recording"}</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{t.audioUrlLabel || "URL del Archivo de Audio"}</label>
                <span className="text-[9px] text-zinc-500 font-light">MP3 directa</span>
              </div>
              <input
                type="url"
                required
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                placeholder="https://ejemplo.com/pista.mp3"
                className="w-full px-3 py-2 bg-zinc-900/60 border border-zinc-800 focus:border-emerald-500 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none text-xs"
              />
              <span className="text-[9px] text-zinc-600 block leading-tight font-light italic">
                {t.audioUrlHelp || "* Para probar, puedes usar enlaces MP3 directos"}
              </span>
            </div>

            <button
              type="submit"
              disabled={formLoading}
              className="w-full py-2.5 px-4 font-bold text-xs text-black bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {formLoading ? (t.submitting || "Subiendo...") : (t.submitBtn || "Subir Recurso de Audio")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
