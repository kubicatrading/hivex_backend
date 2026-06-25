import Link from "next/link";
import { ArrowRight, BarChart3, Music, Video, ShieldCheck, Zap, Database, Check } from "lucide-react";

export default function Home() {
  return (
    <div className="relative min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between overflow-hidden">
      {/* Background Decorative Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-glow-purple rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-glow-emerald rounded-full pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 glass-morphism border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 to-emerald-500 flex items-center justify-center font-bold text-lg text-white shadow-lg shadow-violet-500/20">
              H
            </div>
            <span className="font-extrabold text-xl tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
              HIVEX
            </span>
          </div>
          
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
            <a href="#features" className="hover:text-white transition-colors">Características</a>
            <a href="#technology" className="hover:text-white transition-colors">Tecnología</a>
            <a href="#pricing" className="hover:text-white transition-colors">Planes</a>
          </nav>

          <div className="flex items-center gap-4">
            <Link 
              href="/login" 
              className="px-4 py-2 text-sm font-medium hover:text-white transition-colors text-zinc-300"
            >
              Iniciar Sesión
            </Link>
            <Link 
              href="/login?register=true" 
              className="px-4 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-violet-600 to-emerald-500 hover:from-violet-500 hover:to-emerald-400 text-white shadow-lg shadow-violet-500/10 hover:shadow-violet-500/20 transition-all duration-200"
            >
              Comenzar Gratis
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-grow flex flex-col justify-center max-w-7xl mx-auto px-6 py-20 relative z-10">
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          {/* Hero Left */}
          <div className="lg:col-span-7 space-y-8 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-morphism text-xs font-semibold text-violet-400 border border-violet-500/20">
              <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
              SaaS Premium v1.0 disponible para Vercel
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-black tracking-tight leading-none">
              Controla tu gestión <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-purple-400 to-emerald-400">
                documental inteligente
              </span>
            </h1>

            <p className="text-zinc-400 text-lg md:text-xl max-w-2xl mx-auto lg:mx-0 font-light leading-relaxed">
              HIVEX unifica tus analíticas de gráficos interactivos, reproductores premium de audio y videotecas de alta velocidad bajo un mismo dashboard ultra rápido. Potenciado por Supabase y optimizado para desarrolladores.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link
                href="/login"
                className="group px-6 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 font-bold text-white shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 transition-all duration-200 flex items-center justify-center gap-2"
              >
                Acceder al Dashboard Demo
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a
                href="#features"
                className="px-6 py-3.5 rounded-xl glass-morphism hover:bg-zinc-900/60 font-semibold text-zinc-300 hover:text-white transition-all duration-200 flex items-center justify-center"
              >
                Ver características
              </a>
            </div>

            {/* Micro Stats */}
            <div className="pt-8 border-t border-zinc-900 grid grid-cols-3 gap-6 max-w-lg mx-auto lg:mx-0">
              <div>
                <div className="text-2xl font-bold text-white">99.9%</div>
                <div className="text-xs text-zinc-500">Uptime SLA</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">&lt; 100ms</div>
                <div className="text-xs text-zinc-500">Latencia API</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">AES-256</div>
                <div className="text-xs text-zinc-500">Encriptación</div>
              </div>
            </div>
          </div>

          {/* Hero Right - Interactive Feature Preview Card */}
          <div className="lg:col-span-5 relative">
            <div className="w-full aspect-square md:aspect-[4/3] lg:aspect-square rounded-3xl glass-morphism-card p-6 flex flex-col justify-between shadow-2xl relative overflow-hidden group">
              <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] bg-violet-600/10 blur-[80px] pointer-events-none" />
              
              <div className="flex items-center justify-between border-b border-zinc-800/50 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-rose-500" />
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                </div>
                <span className="text-xs text-zinc-500 font-mono">console.hivex.app</span>
              </div>

              {/* Dynamic Mockup UI */}
              <div className="space-y-6 my-6 flex-grow flex flex-col justify-center">
                <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/40 flex items-center gap-4">
                  <div className="p-2.5 rounded-lg bg-violet-500/10 text-violet-400">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div className="flex-grow">
                    <div className="h-4 bg-zinc-800 rounded-md w-32 mb-1.5 animate-pulse" />
                    <div className="h-3 bg-zinc-800/60 rounded-md w-48" />
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/40 flex items-center gap-4">
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <Music className="w-5 h-5" />
                  </div>
                  <div className="flex-grow">
                    <div className="h-4 bg-zinc-800 rounded-md w-24 mb-1.5 animate-pulse" />
                    <div className="h-3 bg-zinc-800/60 rounded-md w-40" />
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/40 flex items-center gap-4">
                  <div className="p-2.5 rounded-lg bg-sky-500/10 text-sky-400">
                    <Video className="w-5 h-5" />
                  </div>
                  <div className="flex-grow">
                    <div className="h-4 bg-zinc-800 rounded-md w-28 mb-1.5 animate-pulse" />
                    <div className="h-3 bg-zinc-800/60 rounded-md w-44" />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-zinc-800/50 text-xs text-zinc-500 font-medium">
                <span>Sesión activa: demo@hivex.com</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Conectado a Supabase
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <section id="features" className="py-24 border-t border-zinc-900 mt-20">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-violet-400">Características Clave</h2>
            <p className="text-3xl md:text-4xl font-extrabold text-white">Todo lo que necesitas para tu SaaS multimedia</p>
            <p className="text-zinc-400 font-light">
              Hemos empaquetado los tres pilares de gestión documental más importantes en una interfaz de experiencia insuperable.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 rounded-2xl glass-morphism-card space-y-4">
              <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center shadow-lg shadow-violet-500/5">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white">Gráficos Analíticos</h3>
              <p className="text-zinc-400 text-sm leading-relaxed font-light">
                Renderiza gráficos interactivos fluidos de forma local. Introduce valores directamente y visualiza el crecimiento, retención o métricas financieras en tiempo real.
              </p>
            </div>

            <div className="p-8 rounded-2xl glass-morphism-card space-y-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/5">
                <Music className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white">Reproductor de Audio</h3>
              <p className="text-zinc-400 text-sm leading-relaxed font-light">
                Sube o reproduce tus pistas musicales y podcasts. Visualización dinámica del espectro de ondas y controles de reproducción optimizados para la máxima fluidez.
              </p>
            </div>

            <div className="p-8 rounded-2xl glass-morphism-card space-y-4">
              <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shadow-lg shadow-sky-500/5">
                <Video className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white">Videoteca Premium</h3>
              <p className="text-zinc-400 text-sm leading-relaxed font-light">
                Visualiza y gestiona tus videos con un reproductor HTML5 avanzado con soporte para diferentes resoluciones y panel lateral de metadatos integrados.
              </p>
            </div>
          </div>
        </section>

        {/* Technical Stack Section */}
        <section id="technology" className="py-16 border-t border-zinc-900">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400">Arquitectura Moderna</h2>
              <p className="text-3xl font-bold text-white">Stack de Alto Rendimiento</p>
              <p className="text-zinc-400 leading-relaxed font-light">
                Diseñado para cargar instantáneamente en Vercel, con soporte completo de TypeScript que reduce errores en desarrollo, Tailwind CSS para un estilado modular eficiente y la robustez de Supabase como backend.
              </p>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm text-zinc-300">
                  <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <span>Next.js App Router (React Server Components)</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-zinc-300">
                  <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <span>Supabase Authentication, Database, & Storage RLS</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-zinc-300">
                  <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <span>TypeScript Estricto para máxima seguridad de código</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-6 rounded-xl bg-zinc-900/30 border border-zinc-800/50 flex flex-col gap-3">
                <Database className="w-8 h-8 text-violet-400" />
                <span className="font-semibold text-white">Supabase PostgREST</span>
                <span className="text-xs text-zinc-500">API PostgreSQL de alto rendimiento auto-generada</span>
              </div>
              <div className="p-6 rounded-xl bg-zinc-900/30 border border-zinc-800/50 flex flex-col gap-3">
                <ShieldCheck className="w-8 h-8 text-emerald-400" />
                <span className="font-semibold text-white">Row Level Security</span>
                <span className="text-xs text-zinc-500">Tus datos multimedia y perfiles protegidos a nivel base de datos</span>
              </div>
              <div className="p-6 rounded-xl bg-zinc-900/30 border border-zinc-800/50 flex flex-col gap-3">
                <Zap className="w-8 h-8 text-amber-400" />
                <span className="font-semibold text-white">Next.js Turbopack</span>
                <span className="text-xs text-zinc-500">Compilación incremental ultra-rápida en milisegundos</span>
              </div>
              <div className="p-6 rounded-xl bg-zinc-900/30 border border-zinc-800/50 flex flex-col gap-3">
                <Video className="w-8 h-8 text-sky-400" />
                <span className="font-semibold text-white">Vercel Edge</span>
                <span className="text-xs text-zinc-500">Entrega de archivos estáticos y API distribuida globalmente</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950/80 py-12 relative z-10 text-center text-sm text-zinc-500">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-violet-600 to-emerald-500 flex items-center justify-center font-bold text-xs text-white">
              H
            </div>
            <span className="font-semibold text-white">HIVEX SaaS</span>
          </div>
          <p>© 2026 HIVEX Inc. Todos los derechos reservados.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-zinc-300 transition-colors">Términos</a>
            <a href="#" className="hover:text-zinc-300 transition-colors">Privacidad</a>
            <a href="#" className="hover:text-zinc-300 transition-colors">Soporte</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
