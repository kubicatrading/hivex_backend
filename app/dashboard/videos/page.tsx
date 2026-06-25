"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Video, Play, Trash2, UploadCloud, Monitor
} from "lucide-react";

interface VideoDocument {
  id: string;
  title: string;
  description?: string;
  file_url: string;
  created_at: string;
  metadata: {
    duration: string;
    resolution: string;
    thumbnail: string;
  };
}

export default function VideosPage() {
  const [videos, setVideos] = useState<VideoDocument[]>([]);
  const [loading, setLoading] = useState(true);

  // Active playing states
  const [selectedVideo, setSelectedVideo] = useState<VideoDocument | null>(null);

  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [resolution, setResolution] = useState("1080p");
  const [fileUrl, setFileUrl] = useState("");
  const [thumbnail, setThumbnail] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  // HTML5 Video element reference
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("type", "video");
      if (error) throw error;
      
      if (data) {
        // Map generic documents to typed VideoDocuments without any-cast rules
        const typedData: VideoDocument[] = (data as {
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
          file_url: doc.file_url || "",
          created_at: doc.created_at,
          metadata: {
            duration: String(doc.metadata?.duration || "1:00"),
            resolution: String(doc.metadata?.resolution || "1080p"),
            thumbnail: String(doc.metadata?.thumbnail || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80")
          }
        }));
        setVideos(typedData);
        setSelectedVideo((prev) => prev || typedData[0] || null);
      }
    } catch (err) {
      console.error("Failed to load videos:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchVideos();
  }, [fetchVideos]);

  useEffect(() => {
    // Stop video if track changes
    if (videoRef.current) {
      videoRef.current.pause();
    }
  }, [selectedVideo]);

  const handleCreateVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !fileUrl) return;
    setFormLoading(true);

    try {
      // If thumbnail is empty, use a nice dark premium abstract image
      const finalThumbnail = thumbnail || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80";

      const newVideo = {
        title,
        description,
        type: "video",
        file_url: fileUrl,
        metadata: {
          duration: "1:00", // Standard placeholder length
          resolution,
          thumbnail: finalThumbnail
        }
      };

      const { error } = await supabase.from("documents").insert(newVideo);
      if (error) throw error;

      setTitle("");
      setDescription("");
      setFileUrl("");
      setThumbnail("");
      setResolution("1080p");
      
      await fetchVideos();
    } catch (err) {
      console.error("Failed to insert video:", err);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteVideo = async (id: string) => {
    if (confirm("¿Estás seguro de que deseas eliminar este vídeo?")) {
      try {
        const { error } = await supabase.from("documents").delete().eq("id", id);
        if (error) throw error;
        
        const remaining = videos.filter(v => v.id !== id);
        setVideos(remaining);
        
        if (selectedVideo?.id === id) {
          setSelectedVideo(remaining.length > 0 ? remaining[0] : null);
        }
      } catch (err) {
        console.error("Failed to delete video:", err);
      }
    }
  };

  return (
    <div className="space-y-10">
      {/* Page Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-zinc-900/60">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">
            Videoteca Premium
          </h1>
          <p className="text-zinc-400 font-light mt-1 text-sm md:text-base">
            Reproductor de vídeo integrado, metadatos enriquecidos y catalogador de archivos de vídeo.
          </p>
        </div>
      </div>

      {/* Main viewport */}
      <div className="grid lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: ACTIVE VIDEO VIEWER & INFOCARD */}
        <div className="lg:col-span-8 space-y-6">
          {/* Video Player Card */}
          <div className="rounded-2xl border border-zinc-900 bg-black overflow-hidden relative group shadow-2xl">
            {selectedVideo ? (
              <div className="relative w-full aspect-video bg-black">
                <video
                  ref={videoRef}
                  src={selectedVideo.file_url}
                  controls
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-full aspect-video flex flex-col items-center justify-center text-center p-8 bg-zinc-950">
                <Video className="w-12 h-12 text-zinc-700 mb-2" />
                <p className="text-sm text-zinc-500">Selecciona o sube un vídeo para reproducirlo.</p>
              </div>
            )}
          </div>

          {/* Video Details Card */}
          {selectedVideo && (
            <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-900/10 space-y-4 relative overflow-hidden">
              <div className="absolute top-[-20%] left-[-20%] w-[50%] h-[50%] bg-sky-500/5 blur-[50px] pointer-events-none" />
              
              <div className="flex items-center justify-between gap-4 border-b border-zinc-900/50 pb-3">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">{selectedVideo.title}</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">Agregado el {new Date(selectedVideo.created_at).toLocaleDateString("es-ES")}</p>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-sky-500/10 border border-sky-500/20 text-[10px] font-bold text-sky-400 uppercase tracking-widest flex-shrink-0">
                  <Monitor className="w-3.5 h-3.5" />
                  {selectedVideo.metadata.resolution}
                </div>
              </div>

              <div className="text-sm text-zinc-400 font-light leading-relaxed">
                {selectedVideo.description || "Sin descripción proporcionada para este vídeo."}
              </div>
            </div>
          )}

          {/* VIDEO LIST CONTEXT */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-white">Catálogo de Vídeos Guardados</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {loading ? (
                [1, 2].map((i) => (
                  <div key={i} className="h-24 rounded-xl bg-zinc-900/30 border border-zinc-900 animate-pulse" />
                ))
              ) : videos.length === 0 ? (
                <div className="p-6 text-center rounded-2xl bg-zinc-900/20 border border-zinc-900 col-span-2 text-sm text-zinc-500">
                  Aún no tienes vídeos cargados. Añade uno con el panel lateral.
                </div>
              ) : (
                videos.map((v) => (
                  <div
                    key={v.id}
                    onClick={() => setSelectedVideo(v)}
                    className={`rounded-xl border overflow-hidden cursor-pointer flex gap-3.5 transition-all ${selectedVideo?.id === v.id ? "bg-sky-500/10 border-sky-500/40" : "bg-zinc-900/30 border-zinc-900/80 hover:border-zinc-800"}`}
                  >
                    {/* Video Thumbnail */}
                    <div className="w-24 h-20 bg-zinc-900 flex-shrink-0 relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={v.metadata.thumbnail} 
                        alt={v.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/50 transition-colors">
                        <Play className="w-5 h-5 text-white/90 fill-white" />
                      </div>
                      <span className="absolute bottom-1 right-1 px-1 rounded bg-black/75 text-[8px] font-bold text-zinc-300 font-mono">
                        {v.metadata.duration}
                      </span>
                    </div>

                    <div className="flex-grow min-w-0 pr-3 py-3 flex flex-col justify-between">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">{v.title}</div>
                        <div className="text-[10px] text-zinc-500 truncate mt-0.5">{v.description}</div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 font-bold">
                        <span>{v.metadata.resolution}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteVideo(v.id);
                          }}
                          className="p-1 rounded hover:bg-rose-500/15 text-zinc-600 hover:text-rose-400 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: VIDEO LOADER / LINK CREATOR */}
        <div className="lg:col-span-4 rounded-2xl border border-zinc-900 bg-zinc-900/20 p-6 space-y-6">
          <div className="flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-sky-400" />
            <h3 className="text-base font-bold text-white">Subir Vídeo (Enlace)</h3>
          </div>

          <form onSubmit={handleCreateVideo} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Título del Vídeo</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="ej. Lanzamiento de Producto 2026"
                className="w-full px-3 py-2 bg-zinc-900/60 border border-zinc-800 focus:border-sky-500 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Descripción</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="ej. Demo cinemática de la plataforma SaaS..."
                className="w-full px-3 py-2 bg-zinc-900/60 border border-zinc-800 focus:border-sky-500 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none text-xs min-h-[50px] max-h-[100px]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Resolución del Vídeo</label>
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
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Enlace de Miniatura (Thumbnail)</label>
              <input
                type="url"
                value={thumbnail}
                onChange={(e) => setThumbnail(e.target.value)}
                placeholder="https://images.unsplash.com/photo-..."
                className="w-full px-3 py-2 bg-zinc-900/60 border border-zinc-800 focus:border-sky-500 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none text-xs"
              />
              <span className="text-[9px] text-zinc-600 block leading-tight font-light italic">
                * Opcional. Si lo dejas en blanco, usaremos una imagen cinemática predeterminada.
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">URL del Archivo de Vídeo</label>
                <span className="text-[9px] text-zinc-500 font-light">MP4 directa</span>
              </div>
              <input
                type="url"
                required
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                placeholder="https://ejemplo.com/video.mp4"
                className="w-full px-3 py-2 bg-zinc-900/60 border border-zinc-800 focus:border-sky-500 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none text-xs"
              />
              <span className="text-[9px] text-zinc-600 block leading-tight font-light italic">
                * Para probar, puedes usar: `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4` o `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4`
              </span>
            </div>

            <button
              type="submit"
              disabled={formLoading}
              className="w-full py-2.5 px-4 font-bold text-xs text-white bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-400 hover:to-blue-400 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {formLoading ? "Guardando..." : "Subir Recurso de Vídeo"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
