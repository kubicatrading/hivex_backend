"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { 
  BarChart3, Music, Video, Database, ArrowRight, ShieldCheck, Clock, Plus 
} from "lucide-react";

interface DashboardDocument {
  id: string;
  title: string;
  description?: string;
  type: "chart" | "audio" | "video";
  created_at: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState({
    charts: 0,
    audios: 0,
    videos: 0,
    total: 0
  });
  const [recentDocs, setRecentDocs] = useState<DashboardDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const { data, error } = await supabase.from("documents").select("*");
        if (error) throw error;
        
        if (data) {
          const docs = data as DashboardDocument[];
          const charts = docs.filter((d) => d.type === "chart").length;
          const audios = docs.filter((d) => d.type === "audio").length;
          const videos = docs.filter((d) => d.type === "video").length;
          setStats({
            charts,
            audios,
            videos,
            total: docs.length
          });

          // Sort by date and take latest 4
          const sorted = [...docs]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 4);
          setRecentDocs(sorted);
        }
      } catch (err) {
        console.error("Failed to load stats:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  const metricCards = [
    {
      name: "Gráficos & Métricas",
      value: stats.charts,
      description: "Visualizaciones de datos cargadas",
      color: "from-violet-500 to-indigo-500",
      textColor: "text-violet-400",
      bgLight: "bg-violet-500/5",
      borderCol: "border-violet-500/10",
      icon: BarChart3,
      link: "/dashboard/charts"
    },
    {
      name: "Archivos de Audio",
      value: stats.audios,
      description: "Pistas y grabaciones sonoras",
      color: "from-emerald-500 to-teal-500",
      textColor: "text-emerald-400",
      bgLight: "bg-emerald-500/5",
      borderCol: "border-emerald-500/10",
      icon: Music,
      link: "/dashboard/audios"
    },
    {
      name: "Archivos de Vídeo",
      value: stats.videos,
      description: "Videotutoriales y clips",
      color: "from-sky-500 to-blue-500",
      textColor: "text-sky-400",
      bgLight: "bg-sky-500/5",
      borderCol: "border-sky-500/10",
      icon: Video,
      link: "/dashboard/videos"
    }
  ];

  return (
    <div className="space-y-10">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-zinc-900/60">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">
            Resumen General
          </h1>
          <p className="text-zinc-400 font-light mt-1 text-sm md:text-base">
            Monitorea, organiza y gestiona tus recursos analíticos y multimedia.
          </p>
        </div>

        {/* Quick Database Action */}
        <div className="flex items-center gap-3 bg-zinc-900/40 p-1.5 rounded-xl border border-zinc-800/40 text-xs font-medium text-zinc-400">
          <Database className="w-4 h-4 text-violet-400 ml-1.5" />
          <span>Almacenamiento: {stats.total * 4.2} MB de 100 MB</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        </div>
      </div>

      {/* Grid of Metric Cards */}
      <div className="grid sm:grid-cols-3 gap-6">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.name}
              href={card.link}
              className={`group p-6 rounded-2xl border ${card.borderCol} ${card.bgLight} hover:bg-zinc-900/20 transition-all duration-300 relative overflow-hidden flex flex-col justify-between`}
            >
              <div className="absolute top-[-20%] right-[-20%] w-[50%] h-[50%] bg-zinc-800/10 group-hover:bg-violet-600/5 blur-[40px] pointer-events-none transition-colors duration-300" />
              
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/50 ${card.textColor}`}>
                  <Icon className="w-5 h-5 group-hover:scale-105 transition-transform" />
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-300 group-hover:translate-x-1 transition-all" />
              </div>

              <div>
                <div className="text-4xl font-extrabold text-white tracking-tight mb-1">
                  {loading ? "..." : card.value}
                </div>
                <div className="text-sm font-bold text-zinc-300">{card.name}</div>
                <div className="text-xs text-zinc-500 font-light mt-0.5">{card.description}</div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Two Column Section */}
      <div className="grid lg:grid-cols-12 gap-8 pt-4">
        {/* Left Column: Recent Activities */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-zinc-400" />
              Documentos Recientes
            </h2>
            <span className="text-xs text-zinc-500">Últimas subidas</span>
          </div>

          <div className="space-y-4">
            {loading ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-xl bg-zinc-900/30 border border-zinc-900 animate-pulse" />
              ))
            ) : recentDocs.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-zinc-900/20 border border-zinc-900 text-sm text-zinc-500">
                Aún no tienes documentos cargados. Comienza a añadir en las secciones laterales.
              </div>
            ) : (
              recentDocs.map((doc) => {
                const Icon = doc.type === "chart" ? BarChart3 : doc.type === "audio" ? Music : Video;
                const typeColors = 
                  doc.type === "chart" ? "text-violet-400 bg-violet-500/10 border-violet-500/20" :
                  doc.type === "audio" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
                  "text-sky-400 bg-sky-500/10 border-sky-500/20";
                
                return (
                  <div 
                    key={doc.id} 
                    className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-900 hover:border-zinc-800 transition-all flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={`p-2.5 rounded-lg border flex-shrink-0 ${typeColors}`}>
                        <Icon className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white truncate">{doc.title}</div>
                        <div className="text-xs text-zinc-500 truncate mt-0.5">{doc.description}</div>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span className="text-[10px] font-mono font-bold text-zinc-500 block uppercase">
                        {doc.type}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        {new Date(doc.created_at).toLocaleDateString("es-ES", {
                          day: "numeric",
                          month: "short"
                        })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Platform Status & Quick Guides */}
        <div className="lg:col-span-5 space-y-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-violet-400" />
            Estatus del Sistema
          </h2>

          <div className="rounded-2xl border border-zinc-900 bg-zinc-900/20 p-6 space-y-6 relative overflow-hidden">
            <div className="absolute top-[-30%] right-[-20%] w-[50%] h-[50%] bg-emerald-500/5 blur-[40px] pointer-events-none" />

            {/* Service Status List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-900/50 pb-3">
                <span className="text-sm text-zinc-400">Supabase Auth</span>
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Operativo
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-zinc-900/50 pb-3">
                <span className="text-sm text-zinc-400">PostgreSQL DB</span>
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Operativo
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-zinc-900/50 pb-3">
                <span className="text-sm text-zinc-400">Supabase Storage</span>
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Operativo
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Edge Middleware</span>
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Operativo
                </span>
              </div>
            </div>

            {/* Custom CTA */}
            <div className="p-4 rounded-xl bg-violet-600/5 border border-violet-500/10 text-center">
              <h4 className="text-sm font-bold text-white mb-1">¿Necesitas añadir más datos?</h4>
              <p className="text-xs text-zinc-400 font-light mb-3">Sube nuevos recursos analíticos o multimedia en sus respectivos módulos.</p>
              <div className="flex justify-center gap-2">
                <Link
                  href="/dashboard/charts"
                  className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-bold text-white flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Nuevo Gráfico
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
