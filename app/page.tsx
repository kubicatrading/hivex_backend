import Link from "next/link";
import { ArrowRight, BarChart3, Music, Video, ShieldCheck, Zap, Database, Check, Sparkles } from "lucide-react";
import { Logo } from "@/components/Logo";


export default function Home() {
  return (
    <div className="relative min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between overflow-hidden">
      {/* Background Decorative Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-glow-purple rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-glow-emerald rounded-full pointer-events-none" />

      {/* Header */}
      <header className="navbar">
        <div className="navbar-container">
          <Logo href="/" />

          
          <nav className="hidden md:flex items-center gap-10 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            <a href="#features" className="hover:text-violet-400 transition-colors duration-200">Features</a>
            <a href="#technology" className="hover:text-violet-400 transition-colors duration-200">Technology</a>
          </nav>

          <div className="flex items-center gap-6">
            <Link 
              href="/login" 
              className="text-xs font-bold uppercase tracking-wider hover:text-white transition-colors text-zinc-400"
            >
              Sign In
            </Link>
            <Link 
              href="/login?register=true" 
              className="px-5 py-2.5 text-xs font-bold uppercase tracking-widest rounded-md border border-violet-400 text-violet-400 hover:bg-violet-400 hover:text-zinc-950 transition-all duration-300 shadow-[0_0_15px_rgba(212,175,55,0.05)] hover:shadow-[0_0_20px_rgba(212,175,55,0.2)]"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-grow flex flex-col justify-center max-w-7xl mx-auto px-6 py-20 relative z-10">
        <div className="grid lg:grid-cols-12 gap-16 items-center">
          {/* Hero Left */}
          <div className="lg:col-span-7 space-y-8 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-md glass-morphism text-[11px] font-bold uppercase tracking-widest text-violet-400 border border-violet-400/20">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              HIVEX Portal v1.0 Available
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] text-zinc-100">
              Control your <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-zinc-100 via-zinc-200 to-violet-400 font-extrabold">
                intelligent document management
              </span>
            </h1>

            <p className="text-zinc-400 text-lg md:text-xl max-w-2xl mx-auto lg:mx-0 font-serif italic leading-relaxed">
              &ldquo;HIVEX unifies your interactive charts analytics, premium audio players, and high-speed video libraries under a single ultra-fast dashboard.&rdquo;
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-2">
              <Link
                href="/login"
                className="group px-7 py-4 rounded-md bg-violet-400 text-zinc-950 hover:bg-violet-300 font-bold text-xs uppercase tracking-widest shadow-[0_0_25px_rgba(212,175,55,0.15)] hover:shadow-[0_0_30px_rgba(212,175,55,0.3)] transition-all duration-300 flex items-center justify-center gap-2"
              >
                Sign In
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
              </Link>
              <a
                href="#features"
                className="px-7 py-4 rounded-md glass-morphism border border-zinc-800 hover:border-violet-400/30 font-bold text-xs uppercase tracking-widest text-zinc-300 hover:text-white transition-all duration-300 flex items-center justify-center"
              >
                Explore features
              </a>
            </div>

            {/* Micro Stats */}
            <div className="pt-8 border-t border-zinc-900 grid grid-cols-3 gap-6 max-w-lg mx-auto lg:mx-0">
              <div>
                <div className="text-2xl font-bold text-zinc-100 font-logo tracking-wider">99.9%</div>
                <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-1">Uptime SLA</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-zinc-100 font-logo tracking-wider">&lt; 100ms</div>
                <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-1">API Latency</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-zinc-100 font-logo tracking-wider">AES-256</div>
                <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-1">Encryption</div>
              </div>
            </div>
          </div>

          {/* Hero Right - Interactive Feature Preview Card */}
          <div className="lg:col-span-5 relative">
            <div className="w-full aspect-square md:aspect-[4/3] lg:aspect-square rounded-2xl glass-morphism-card p-6 flex flex-col justify-between shadow-2xl relative overflow-hidden group border border-zinc-800/50 hover:border-violet-400/20">
              <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] bg-violet-600/10 blur-[80px] pointer-events-none" />
              
              <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-800" />
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-800" />
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-800" />
                </div>
                <span className="text-[10px] text-zinc-500 font-mono tracking-wider">console.hivex.app</span>
              </div>

              {/* Dynamic Mockup UI */}
              <div className="space-y-5 my-6 flex-grow flex flex-col justify-center">
                <div className="p-4 rounded-xl bg-zinc-900/20 border border-zinc-900/80 flex items-center gap-4 hover:border-violet-400/20 transition-all duration-300">
                  <div className="p-2.5 rounded-lg bg-violet-400/5 text-violet-400 border border-violet-400/10">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div className="flex-grow">
                    <div className="h-3 bg-zinc-800 rounded-md w-32 mb-2 animate-pulse" />
                    <div className="h-2 bg-zinc-800/50 rounded-md w-48" />
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-zinc-900/20 border border-zinc-900/80 flex items-center gap-4 hover:border-violet-400/20 transition-all duration-300">
                  <div className="p-2.5 rounded-lg bg-violet-400/5 text-violet-400 border border-violet-400/10">
                    <Music className="w-5 h-5" />
                  </div>
                  <div className="flex-grow">
                    <div className="h-3 bg-zinc-800 rounded-md w-24 mb-2 animate-pulse" />
                    <div className="h-2 bg-zinc-800/50 rounded-md w-40" />
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-zinc-900/20 border border-zinc-900/80 flex items-center gap-4 hover:border-violet-400/20 transition-all duration-300">
                  <div className="p-2.5 rounded-lg bg-violet-400/5 text-violet-400 border border-violet-400/10">
                    <Video className="w-5 h-5" />
                  </div>
                  <div className="flex-grow">
                    <div className="h-3 bg-zinc-800 rounded-md w-28 mb-2 animate-pulse" />
                    <div className="h-2 bg-zinc-800/50 rounded-md w-44" />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-zinc-900 text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">
                <span>Console Status: Ready</span>
                <span className="text-violet-400 flex items-center gap-1.5 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-ping" />
                  Secure Node
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <section id="features" className="py-24 border-t border-zinc-900/60 mt-20">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-violet-400">Platform Features</h2>
            <p className="text-3xl md:text-4xl font-extrabold text-zinc-100 font-sans tracking-tight">
              Integrated Workspace Ecosystem
            </p>
            <p className="text-zinc-400 font-serif italic text-lg">
              &ldquo;We have packaged critical interactive modules in an interface with an unsurpassed corporate user experience.&rdquo;
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 rounded-2xl glass-morphism-card space-y-5 border border-zinc-900/50">
              <div className="w-12 h-12 rounded-lg bg-violet-400/5 border border-violet-400/10 text-violet-400 flex items-center justify-center shadow-lg">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-zinc-100 font-logo tracking-wider">Analytical Charts</h3>
              <p className="text-zinc-400 text-sm leading-relaxed font-light">
                Render fluid interactive charts locally. Input values directly and visualize growth, retention, or financial metrics in real-time with an elegant dark profile.
              </p>
            </div>

            <div className="p-8 rounded-2xl glass-morphism-card space-y-5 border border-zinc-900/50">
              <div className="w-12 h-12 rounded-lg bg-violet-400/5 border border-violet-400/10 text-violet-400 flex items-center justify-center shadow-lg">
                <Music className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-zinc-100 font-logo tracking-wider">Audio Station</h3>
              <p className="text-zinc-400 text-sm leading-relaxed font-light">
                Upload or play your music tracks and podcasts. Dynamic wave spectrum visualization and playback controls optimized for maximum foley and fidelity.
              </p>
            </div>

            <div className="p-8 rounded-2xl glass-morphism-card space-y-5 border border-zinc-900/50">
              <div className="w-12 h-12 rounded-lg bg-violet-400/5 border border-violet-400/10 text-violet-400 flex items-center justify-center shadow-lg">
                <Video className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-zinc-100 font-logo tracking-wider">Video Library</h3>
              <p className="text-zinc-400 text-sm leading-relaxed font-light">
                View and manage your videos with an advanced HTML5 player featuring support for various resolutions and an integrated metadata translation side panel.
              </p>
            </div>
          </div>
        </section>

        {/* Technical Stack Section */}
        <section id="technology" className="py-24 border-t border-zinc-900/60">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <h2 className="text-xs font-bold uppercase tracking-widest text-violet-400">Architecture</h2>
              <p className="text-3xl font-bold text-zinc-100 font-sans tracking-tight">High-Performance Tech Stack</p>
              <p className="text-zinc-400 leading-relaxed font-serif italic text-lg">
                &ldquo;Designed to load instantly, optimized with Next.js Server Components, strict TypeScript types, and the absolute robustness of Supabase.&rdquo;
              </p>
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-3.5 text-sm text-zinc-300">
                  <div className="w-5 h-5 rounded-full bg-violet-400/10 border border-violet-400/20 flex items-center justify-center text-violet-400 flex-shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>Next.js App Router & React Server Components</span>
                </div>
                <div className="flex items-center gap-3.5 text-sm text-zinc-300">
                  <div className="w-5 h-5 rounded-full bg-violet-400/10 border border-violet-400/20 flex items-center justify-center text-violet-400 flex-shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>Supabase Authentication, Storage & Row Level Security (RLS)</span>
                </div>
                <div className="flex items-center gap-3.5 text-sm text-zinc-300">
                  <div className="w-5 h-5 rounded-full bg-violet-400/10 border border-violet-400/20 flex items-center justify-center text-violet-400 flex-shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>Strict TypeScript compile-time safety guards</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-6 rounded-xl bg-zinc-950 border border-zinc-900 flex flex-col gap-4 hover:border-violet-400/10 transition-all duration-300">
                <Database className="w-7 h-7 text-violet-400" />
                <span className="font-logo font-bold text-xs tracking-wider text-zinc-100">Supabase DB</span>
                <span className="text-xs text-zinc-500 leading-relaxed">High-performance PostgreSQL and auto-generated REST APIs</span>
              </div>
              <div className="p-6 rounded-xl bg-zinc-950 border border-zinc-900 flex flex-col gap-4 hover:border-violet-400/10 transition-all duration-300">
                <ShieldCheck className="w-7 h-7 text-violet-400" />
                <span className="font-logo font-bold text-xs tracking-wider text-zinc-100">Secure RLS</span>
                <span className="text-xs text-zinc-500 leading-relaxed">Granular Row Level Security for documents and profiles</span>
              </div>
              <div className="p-6 rounded-xl bg-zinc-950 border border-zinc-900 flex flex-col gap-4 hover:border-violet-400/10 transition-all duration-300">
                <Zap className="w-7 h-7 text-violet-400" />
                <span className="font-logo font-bold text-xs tracking-wider text-zinc-100">Next.js v15</span>
                <span className="text-xs text-zinc-500 leading-relaxed">Turbopack and incremental caching for millisecond responses</span>
              </div>
              <div className="p-6 rounded-xl bg-zinc-950 border border-zinc-900 flex flex-col gap-4 hover:border-violet-400/10 transition-all duration-300">
                <Video className="w-7 h-7 text-violet-400" />
                <span className="font-logo font-bold text-xs tracking-wider text-zinc-100">Vercel Edge</span>
                <span className="text-xs text-zinc-500 leading-relaxed">Globally distributed static files and secure API execution</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950/40 py-16 relative z-10 text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-8">
          <div className="flex items-center">
            <Logo className="scale-75 origin-left opacity-80" />
          </div>

          <p className="font-sans text-zinc-500">© 2026 HIVEX Inc. All rights reserved.</p>
          <div className="flex gap-8 font-semibold uppercase tracking-wider text-zinc-400">
            <a href="#" className="hover:text-violet-400 transition-colors">Terms</a>
            <a href="#" className="hover:text-violet-400 transition-colors">Privacy</a>
            <a href="#" className="hover:text-violet-400 transition-colors">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
