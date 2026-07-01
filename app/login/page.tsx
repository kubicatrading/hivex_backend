"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import { supabase, isUsingMock } from "@/lib/supabase";
import { Mail, Lock, User, Loader2, ArrowLeft, ShieldAlert, Sparkles } from "lucide-react";
import { translations } from "@/lib/translations";

interface GoogleGsiResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleAccountsTokenClient {
  requestAccessToken: () => void;
}

interface GoogleGsi {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        callback: (response: GoogleGsiResponse) => void | Promise<void>;
      }) => GoogleAccountsTokenClient;
    };
  };
}

interface WindowWithGoogle extends Window {
  google?: GoogleGsi;
}

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

  // Global Language Selection State
  const [selectedLanguage, setSelectedLanguage] = useState<string>("en");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("hivex_selected_language") || "en";
      setSelectedLanguage(saved);
    }
  }, []);

  const handleLanguageChange = (langCode: string) => {
    setSelectedLanguage(langCode);
    localStorage.setItem("hivex_selected_language", langCode);
    window.dispatchEvent(new CustomEvent("languageChanged", { detail: langCode }));
  };

  const lang = selectedLanguage || "en";
  const t = translations[lang]?.login || translations["en"].login;

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
        setSuccess(
          lang === "es" ? "¡Registro exitoso! Iniciando sesión automáticamente..." :
          lang === "de" ? "Registrierung erfolgreich! Automatische Anmeldung..." :
          lang === "tr" ? "Kayıt başarılı! Otomatik olarak giriş yapılıyor..." :
          "Registration successful! Logging in automatically..."
        );
        setTimeout(() => {
          router.push("/dashboard");
        }, 1500);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        setSuccess(
          lang === "es" ? "Sesión iniciada correctamente. Redirigiendo..." :
          lang === "de" ? "Erfolgreich angemeldet. Weiterleitung..." :
          lang === "tr" ? "Başarıyla giriş yapıldı. Yönlendiriliyor..." :
          "Logged in successfully. Redirecting..."
        );
        setTimeout(() => {
          router.push("/dashboard");
        }, 1200);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "558326121700-ufp44b64pdnb0cisl7nu3c2dqc3vu82k.apps.googleusercontent.com";
    const scopes = "email profile openid https://www.googleapis.com/auth/cloud-platform";

    try {
      if (isUsingMock) {
        if (typeof window === "undefined") return;

        const googleWindow = window as unknown as WindowWithGoogle;

        // Verify Google SDK is loaded
        if (!googleWindow.google || !googleWindow.google.accounts) {
          throw new Error(
            lang === "es" ? "El SDK de Google Sign-In no se ha cargado por completo en su navegador. Por favor espere un segundo e intente de nuevo." :
            lang === "de" ? "Das Google Sign-In SDK wurde noch nicht vollständig in Ihrem Browser geladen. Bitte warten Sie eine Sekunde und versuchen Sie es erneut." :
            lang === "tr" ? "Google Sign-In SDK tarayıcınıza tam olarak yüklenmedi. Lütfen bir saniye bekleyip tekrar deneyin." :
            "The Google Sign-In SDK has not fully loaded in your browser. Please wait a second and try again."
          );
        }

        const client = googleWindow.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: scopes,
          callback: async (response) => {
            if (response.error) {
              setLoading(false);
              setError(`Google authentication error: ${response.error_description || response.error}`);
              return;
            }

            const accessToken = response.access_token;
            if (!accessToken) {
              setLoading(false);
              setError("No valid access token received from Google.");
              return;
            }

            try {
              // Store access token for Google Cloud & Gemini API calls
              localStorage.setItem("google_gcloud_token", accessToken);

              // Fetch Google user profile
              const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                headers: { Authorization: `Bearer ${accessToken}` },
              });

              if (!res.ok) {
                throw new Error("Failed to retrieve Google profile information.");
              }

              const profile = await res.json();

              // Initialize local mock session
              const mockUser = {
                id: profile.sub || "google-user-id-" + Math.random().toString(36).substring(2, 10),
                email: profile.email || "google-user@hivex.com",
                user_metadata: {
                  full_name: profile.name || "Google User",
                  avatar_url: profile.picture || "",
                },
                created_at: new Date().toISOString(),
              };

              // Store mock session in LocalStorage
              localStorage.setItem(
                "hivex_session",
                JSON.stringify({
                  access_token: "mock-token-google-" + mockUser.id,
                  user: mockUser,
                })
              );

              // Store client id for reference
              localStorage.setItem("google_client_id", clientId);

              setSuccess(
                lang === "es" ? `¡Hola, ${profile.given_name || profile.name}! Conectado con éxito a Google Cloud y la API de Gemini.` :
                lang === "de" ? `Hallo, ${profile.given_name || profile.name}! Erfolgreich mit Google Cloud und der Gemini-API verbunden.` :
                lang === "tr" ? `Merhaba, ${profile.given_name || profile.name}! Google Cloud ve Gemini API'ye başarıyla bağlanıldı.` :
                `Hello, ${profile.given_name || profile.name}! Successfully connected to Google Cloud and Gemini API.`
              );
              
              setTimeout(() => {
                router.push("/dashboard");
              }, 1200);

            } catch (err: unknown) {
              const errMsg = err instanceof Error ? err.message : "Error processing your Google account.";
              setError(errMsg);
              setLoading(false);
            }
          },
        });

        client.requestAccessToken();
      } else {
        // Supabase OAuth integration
        const { error: signInError } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/dashboard`,
            queryParams: {
              access_type: "offline",
              prompt: "consent",
            },
            scopes: scopes,
          },
        });
        if (signInError) throw signInError;
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Error signing in with Google.";
      setError(errMsg);
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-8 rounded-2xl glass-morphism border border-zinc-800/80 shadow-2xl relative overflow-hidden">
      {/* Decorative Glow inside Card */}
      <div className="absolute top-[-30%] right-[-30%] w-[60%] h-[60%] bg-violet-600/10 blur-[50px] pointer-events-none" />

      {/* Dynamic flag switcher inside the login card */}
      <div className="absolute top-4 right-4 flex items-center gap-1 bg-zinc-950/40 p-1 rounded-xl border border-zinc-800/50 z-20">
        {[
          { code: "en", flag: "🇺🇸", label: "English" },
          { code: "de", flag: "🇩🇪", label: "Deutsch" },
          { code: "tr", flag: "🇹🇷", label: "Türkçe" },
          { code: "es", flag: "🇪🇸", label: "Español" }
        ].map((langItem) => (
          <button
            key={langItem.code}
            type="button"
            onClick={() => handleLanguageChange(langItem.code)}
            title={langItem.label}
            className={`text-xs p-1 rounded-md transition-all duration-200 hover:scale-110 flex items-center justify-center ${
              selectedLanguage === langItem.code
                ? "bg-violet-600/10 border border-violet-500/25 scale-105 text-white shadow-sm"
                : "bg-transparent border-transparent opacity-50 hover:opacity-100"
            }`}
          >
            <span>{langItem.flag}</span>
          </button>
        ))}
      </div>

      {/* Header Form */}
      <div className="text-center space-y-3 mb-8">
        <h2 className="text-3xl font-extrabold text-white tracking-tight">
          {isRegister ? t.titleRegister : t.titleSignIn}
        </h2>
        <p className="text-sm text-zinc-400 font-light">
          {isRegister 
            ? t.haveAccount || "Already have an account? " 
            : t.noAccount || "New to HIVEX? "}
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
              setSuccess(null);
            }}
            type="button"
            className="text-violet-400 font-semibold hover:text-violet-300 transition-colors focus:outline-none"
          >
            {isRegister ? t.signIn : t.getStarted}
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
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{t.fullName || "Full Name"}</label>
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
          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{t.email || "Email Address"}</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <input
              type="text"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="w-full pl-11 pr-4 py-3 bg-zinc-900/60 border border-zinc-800 focus:border-violet-500 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all text-sm"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{t.password || "Password"}</label>
            {!isRegister && (
              <a href="#" className="text-xs text-zinc-500 hover:text-zinc-400">
                {lang === "es" ? "¿Olvidó su contraseña?" : lang === "de" ? "Passwort vergessen?" : lang === "tr" ? "Şifremi unuttum?" : "Forgot password?"}
              </a>
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
            t.register || "Register"
          ) : (
            t.signIn || "Sign In"
          )}
        </button>
      </form>

      {/* Google Login Premium Button */}
      <div className="mt-4">
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          type="button"
          className="w-full py-3 px-4 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/80 text-zinc-100 font-bold text-sm transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-3 shadow-lg shadow-black/10 hover:border-zinc-700/80 focus:outline-none disabled:opacity-50 disabled:pointer-events-none"
        >
          <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12 5.04c1.65 0 3.12.57 4.29 1.66l3.19-3.19C17.5 1.7 14.95 1 12 1 7.35 1 3.37 3.68 1.41 7.6l3.87 3C6.21 7.6 8.87 5.04 12 5.04z"
            />
            <path
              fill="#4285F4"
              d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.47h6.46c-.28 1.48-1.07 2.74-2.3 3.58l3.58 2.77c2.09-1.93 3.75-4.78 3.75-8.46z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 10.6c-.24-.72-.38-1.5-.38-2.3s.14-1.58.38-2.3l-3.87-3C.55 4.6 0 6.24 0 8s.55 3.4 1.41 4.99l3.87-3.01c-.13-.39-.18-.79-.18-1.2h.18z"
            />
            <path
              fill="#34A853"
              d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.58-2.77c-.99.66-2.26 1.05-4.38 1.05-3.13 0-5.79-2.56-6.72-5.56l-3.87 3C3.37 20.32 7.35 23 12 23z"
            />
          </svg>
          <span>
            {lang === "es" ? "Iniciar sesión con Google" : lang === "de" ? "Mit Google anmelden" : lang === "tr" ? "Google ile giriş yap" : "Sign in with Google"}
          </span>
        </button>
      </div>

      {isUsingMock && (
        <div className="mt-4 text-center text-[10px] text-zinc-500 font-light italic">
          {t.demoNotice || "* Running in Local Mode (LocalStorage). No Supabase keys required."}
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
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

  const lang = selectedLanguage || "en";

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
        {lang === "es" ? "Volver al Inicio" : lang === "de" ? "Zurück zur Startseite" : lang === "tr" ? "Ana Sayfaya Dön" : "Back to Home"}
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

      {/* Async loading of the official Google Identity Services SDK */}
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
    </div>
  );
}

