"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase, isUsingMock } from "@/lib/supabase";
import { Mail, Lock, User, Loader2, ArrowLeft, ShieldAlert, Sparkles } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isRegisterParam = searchParams.get("register") === "true";

  const [isRegister, setIsRegister] = useState(isRegisterParam);
  const [prevIsRegisterParam, setPrevIsRegisterParam] = useState(isRegisterParam);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (isRegisterParam !== prevIsRegisterParam) {
    setPrevIsRegisterParam(isRegisterParam);
    setIsRegister(isRegisterParam);
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (isRegister) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName || "Alex Hivex",
            },
          },
        });
        if (signUpError) throw signUpError;
        setSuccess("¡Registro exitoso! Sesión iniciada automáticamente.");
        setTimeout(() => {
          router.push("/dashboard");
        }, 1500);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        setSuccess("Sesión iniciada con éxito. Redirigiendo...");
        setTimeout(() => {
          router.push("/dashboard");
        }, 1200);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Ocurrió un error inesperado.";
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const loginDemoUser = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: "demo@hivex.com",
        password: "demo1234",
      });
      if (signInError) throw signInError;
      setSuccess("¡Bienvenido al modo Demo de HIVEX!");
      setTimeout(() => {
        router.push("/dashboard");
      }, 1000);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Ocurrió un error de inicio de sesión.";
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-8 rounded-2xl glass-morphism border border-zinc-800/80 shadow-2xl relative overflow-hidden">
      {/* Decorative Glow inside Card */}
      <div className="absolute top-[-30%] right-[-30%] w-[60%] h-[60%] bg-violet-600/10 blur-[50px] pointer-events-none" />

      {/* Header Form */}
      <div className="text-center space-y-3 mb-8">
        <h2 className="text-3xl font-extrabold text-white tracking-tight">
          {isRegister ? "Crea tu cuenta" : "Te damos la bienvenida"}
        </h2>
        <p className="text-sm text-zinc-400 font-light">
          {isRegister 
            ? "¿Ya tienes una cuenta? " 
            : "¿Eres nuevo en HIVEX? "}
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
              setSuccess(null);
            }}
            type="button"
            className="text-violet-400 font-semibold hover:text-violet-300 transition-colors focus:outline-none"
          >
            {isRegister ? "Inicia Sesión" : "Regístrate gratis"}
          </button>
        </p>
      </div>

      {/* Error and Success Alerts */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-start gap-3">
          <Sparkles className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {/* Standard Credentials Form */}
      <form onSubmit={handleAuth} className="space-y-5">
        {isRegister && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Nombre Completo</label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Alex Hivex"
                className="w-full pl-11 pr-4 py-3 bg-zinc-900/60 border border-zinc-800 focus:border-violet-500 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all text-sm"
              />
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Correo Electrónico</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="w-full pl-11 pr-4 py-3 bg-zinc-900/60 border border-zinc-800 focus:border-violet-500 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all text-sm"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Contraseña</label>
            {!isRegister && (
              <a href="#" className="text-xs text-zinc-500 hover:text-zinc-400">¿La olvidaste?</a>
            )}
          </div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-11 pr-4 py-3 bg-zinc-900/60 border border-zinc-800 focus:border-violet-500 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all text-sm"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 font-bold text-sm text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 rounded-xl transition-all shadow-lg shadow-violet-500/10 hover:shadow-violet-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isRegister ? (
            "Crear Cuenta"
          ) : (
            "Iniciar Sesión"
          )}
        </button>
      </form>

      {/* Divider */}
      <div className="my-6 flex items-center justify-between text-xs text-zinc-600 font-bold uppercase tracking-wider">
        <span className="w-1/4 h-[1px] bg-zinc-800/80" />
        <span>O ACCEDE INSTANTÁNEAMENTE</span>
        <span className="w-1/4 h-[1px] bg-zinc-800/80" />
      </div>

      {/* Demo Credentials Quick Login Button */}
      <button
        onClick={loginDemoUser}
        disabled={loading}
        type="button"
        className="w-full py-3 px-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-400 hover:text-emerald-300 font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2"
      >
        <Sparkles className="w-4 h-4" />
        Acceder con Usuario Demo
      </button>

      {isUsingMock && (
        <div className="mt-4 text-center text-[10px] text-zinc-500 font-light italic">
          * Ejecutando en Modo Local (LocalStorage). No necesitas claves de Supabase.
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="relative min-h-screen bg-zinc-950 flex flex-col justify-center items-center px-6 py-12 overflow-hidden">
      {/* Background Decorative Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-glow-purple rounded-full pointer-events-none" />

      {/* Back button */}
      <Link
        href="/"
        className="absolute top-6 left-6 inline-flex items-center gap-2 text-xs font-semibold text-zinc-500 hover:text-zinc-300 transition-colors bg-zinc-900/40 p-2.5 rounded-xl border border-zinc-800/40"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a Inicio
      </Link>

      <div className="mb-6 flex items-center gap-2 relative z-10">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-emerald-500 flex items-center justify-center font-bold text-sm text-white">
          H
        </div>
        <span className="font-extrabold text-lg tracking-wider text-white">HIVEX</span>
      </div>

      <Suspense fallback={
        <div className="w-full max-w-md p-8 rounded-2xl glass-morphism border border-zinc-800/80 shadow-2xl flex items-center justify-center min-h-[350px]">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
        </div>
      }>
        <LoginForm />
      </Suspense>
    </div>
  );
}
