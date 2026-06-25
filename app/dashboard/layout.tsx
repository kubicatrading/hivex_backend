"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase, isUsingMock } from "@/lib/supabase";
import { 
  BarChart3, Music, Video, LayoutDashboard, LogOut, Menu, X, User, Sparkles, Loader2 
} from "lucide-react";

interface UserProfile {
  email?: string;
  fullName: string;
}

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Check auth session on load
  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push("/login");
          return;
        }
        setProfile({
          email: user.email,
          fullName: user.user_metadata?.full_name || "Alex Hivex"
        });
      } catch (err) {
        console.error("Auth check failed:", err);
        router.push("/login");
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

  const navItems = [
    { name: "Resumen General", path: "/dashboard", icon: LayoutDashboard },
    { name: "Métricas y Gráficos", path: "/dashboard/charts", icon: BarChart3 },
    { name: "Estación de Audio", path: "/dashboard/audios", icon: Music },
    { name: "Videoteca Premium", path: "/dashboard/videos", icon: Video }
  ];

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-violet-400 animate-spin mb-4" />
        <p className="text-zinc-500 text-sm tracking-wide animate-pulse">Verificando sesión segura...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex">
      {/* Sidebar background glows */}
      <div className="absolute top-[20%] left-[-10%] w-[350px] h-[350px] bg-glow-purple rounded-full pointer-events-none opacity-40" />

      {/* MOBILE HEADER BAR */}
      <header className="md:hidden flex items-center justify-between w-full h-16 px-6 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md fixed top-0 left-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-violet-600 to-emerald-500 flex items-center justify-center font-bold text-xs text-white">
            H
          </div>
          <span className="font-bold text-sm tracking-widest text-white">HIVEX</span>
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* SIDEBAR NAVIGATION (Desktop & Mobile drawer) */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 border-r border-zinc-900 bg-zinc-950/90 md:bg-zinc-950/40 md:backdrop-blur-xl flex flex-col justify-between p-6 transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <div className="space-y-8">
          {/* Logo Brand */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 to-emerald-500 flex items-center justify-center font-bold text-lg text-white shadow-lg shadow-violet-500/10">
                H
              </div>
              <span className="font-extrabold text-xl tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
                HIVEX
              </span>
            </div>
            {/* Mobile close button */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-3 mb-3">CONSOLA</div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 group
                    ${isActive 
                      ? "bg-violet-600/10 border border-violet-500/25 text-violet-400 shadow-md shadow-violet-500/5" 
                      : "text-zinc-400 border border-transparent hover:text-zinc-200 hover:bg-zinc-900/40"
                    }
                  `}
                >
                  <Icon className={`w-5 h-5 transition-transform duration-200 group-hover:scale-105 ${isActive ? "text-violet-400" : "text-zinc-500 group-hover:text-zinc-400"}`} />
                  {item.name}
                </Link>
              );
            })}
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
              <span>Modo Demostración Local</span>
            </div>
          )}

          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-zinc-400 hover:text-rose-400 border border-transparent hover:bg-rose-500/5 transition-all duration-200"
          >
            <LogOut className="w-5 h-5" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <main className="flex-grow flex flex-col min-w-0 relative z-10 pt-16 md:pt-0">
        <div className="flex-grow p-6 md:p-10 max-w-7xl w-full mx-auto space-y-8">
          {children}
        </div>
      </main>
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
