"use client";
/* eslint-disable @typescript-eslint/no-unused-vars, react-hooks/set-state-in-effect */

import { useState, useEffect, useRef, useCallback, useId, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { translations } from "@/lib/translations";
import { 
  Video, Play, Trash2, UploadCloud, Monitor, Sparkles, AlertCircle, Eye, Clock, Volume2,
  ChevronDown, ChevronUp, BookOpen, Briefcase, FileText, Headphones, Pause, Square, RotateCcw,
  Languages, Heart, TrendingUp, AlertTriangle, Loader2, EyeOff
} from "lucide-react";

function isFreedomChannel(channelName: string | null | undefined): boolean {
  if (!channelName) return false;
  const name = channelName.toLowerCase();
  return name.includes("freedom") || name.includes("judging") || name.includes("napolitano");
}

// Chart Snapper and Legends helper
function getChartMetadata(title: string) {
  const t = title.toLowerCase();
  if (t.includes("fed") || t.includes("rate") || t.includes("interest") || t.includes("bond") || t.includes("selloff")) {
    return {
      type: "yield-curve" as const,
      legend: "Gráfico de Curva de Tipos y Bonos del Tesoro (T-Bills): Evolución de la rentabilidad real de los bonos a 2 y 10 años frente a la tasa oficial de la Fed. La inversión de la curva se mantiene pronunciada, lo que históricamente antecede presiones de liquidez severas en el mercado inmobiliario e incentiva la acumulación de efectivo en cuentas HYSA de alto interés antes de una eventual rotación bursátil."
    };
  }
  if (t.includes("petro") || t.includes("dollar") || t.includes("gold") || t.includes("devaluation") || t.includes("real")) {
    return {
      type: "dxy-gold" as const,
      legend: "Gráfico Macroeconómico de Activos Físicos y Coberturas (DXY vs Gold/BTC): Se ilustra la correlación inversa histórica entre el índice de fuerza del dólar (DXY) y las reservas institucionales de oro y activos digitales alternativos. A medida que disminuye el uso del Petro Dólar en las transacciones bilaterales de commodities, los flujos institucionales tienden a rotar preventivamente un 5-10% del capital de riesgo hacia reservas duras fuera del sistema bancario tradicional."
    };
  }
  // Fallback / Stocks & Dividend focused
  return {
    type: "candlestick" as const,
    legend: "Gráfico Técnico de Margen Operativo y Valoraciones Bursátiles (S&P 500 / VOO vs Dividend Yield): Desglose técnico de la dispersión de múltiplos de valoración en Wall Street. Mientras que las 7 megacorporaciones de tecnología operan con múltiplos elevados sostenidos por la especulación de capitalización, el mercado promedio y las acciones con dividendos sólidos cotizan a múltiplos defensivos (DGI), validando compras periódicas indexadas (DCA) para amortiguar la volatilidad."
  };
}

// State-of-the-Art Vector Chart Snapshots Component (Pure inline React SVG)
function FinancialChartSnapshot({ type }: { type: "yield-curve" | "dxy-gold" | "candlestick" }) {
  if (type === "yield-curve") {
    return (
      <svg viewBox="0 0 400 300" className="w-full h-full bg-zinc-950 font-sans select-none">
        <defs>
          <linearGradient id="bg-grad-1" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0B0B0F" />
            <stop offset="100%" stopColor="#14141C" />
          </linearGradient>
          <linearGradient id="glow-orange" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#EF4444" />
          </linearGradient>
          <linearGradient id="glow-cyan" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
          <filter id="neon-glow-orange" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background */}
        <rect width="100%" height="100%" fill="url(#bg-grad-1)" />

        {/* Grid Lines */}
        <path d="M 50,40 L 360,40 M 50,90 L 360,90 M 50,140 L 360,140 M 50,190 L 360,190 M 50,240 L 360,240" stroke="#1E1E24" strokeWidth="1" strokeDasharray="3 3" />
        <path d="M 100,40 L 100,240 M 150,40 L 150,240 M 200,40 L 200,240 M 250,40 L 250,240 M 300,40 L 300,240 M 350,40 L 350,240" stroke="#1E1E24" strokeWidth="1" strokeDasharray="3 3" />

        {/* Axes */}
        <line x1="50" y1="240" x2="360" y2="240" stroke="#3F3F46" strokeWidth="1" />
        <line x1="50" y1="40" x2="50" y2="240" stroke="#3F3F46" strokeWidth="1" />

        {/* Y-Axis Labels */}
        <text x="40" y="244" fill="#71717A" fontSize="9" textAnchor="end" fontWeight="bold">2.0%</text>
        <text x="40" y="194" fill="#71717A" fontSize="9" textAnchor="end" fontWeight="bold">3.0%</text>
        <text x="40" y="144" fill="#71717A" fontSize="9" textAnchor="end" fontWeight="bold">4.0%</text>
        <text x="40" y="94" fill="#71717A" fontSize="9" textAnchor="end" fontWeight="bold">5.0%</text>
        <text x="40" y="44" fill="#71717A" fontSize="9" textAnchor="end" fontWeight="bold">6.0%</text>

        {/* X-Axis Labels */}
        <text x="50" y="255" fill="#71717A" fontSize="9" textAnchor="middle" fontWeight="bold">1M</text>
        <text x="100" y="255" fill="#71717A" fontSize="9" textAnchor="middle" fontWeight="bold">3M</text>
        <text x="150" y="255" fill="#71717A" fontSize="9" textAnchor="middle" fontWeight="bold">1Y</text>
        <text x="200" y="255" fill="#F59E0B" fontSize="9" textAnchor="middle" fontWeight="black">2Y</text>
        <text x="250" y="255" fill="#71717A" fontSize="9" textAnchor="middle" fontWeight="bold">5Y</text>
        <text x="300" y="255" fill="#06B6D4" fontSize="9" textAnchor="middle" fontWeight="black">10Y</text>
        <text x="350" y="255" fill="#71717A" fontSize="9" textAnchor="middle" fontWeight="bold">30Y</text>

        {/* Legend */}
        <g transform="translate(60, 20)">
          <line x1="0" y1="5" x2="15" y2="5" stroke="#E4E4E7" strokeWidth="1.5" strokeDasharray="2 2" />
          <text x="20" y="8" fill="#A1A1AA" fontSize="9" fontWeight="medium">Histórica Normal</text>
        </g>
        <g transform="translate(180, 20)">
          <line x1="0" y1="5" x2="15" y2="5" stroke="#F59E0B" strokeWidth="2.5" />
          <circle cx="7.5" cy="5" r="2" fill="#F59E0B" />
          <text x="20" y="8" fill="#F59E0B" fontSize="9" fontWeight="black">Curva Invertida Actual</text>
        </g>

        {/* Healthy Historical Curve (Upward Sloping) */}
        <path d="M 50,220 Q 150,190 250,130 T 350,90" fill="none" stroke="#E4E4E7" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.4" />

        {/* Inverted Yield Curve (Current State) */}
        <path d="M 50,75 C 100,65 150,85 200,90 C 250,95 300,140 350,130" fill="none" stroke="url(#glow-orange)" strokeWidth="3" filter="url(#neon-glow-orange)" strokeLinecap="round" />

        {/* Area of Inversion Highlights */}
        <path d="M 200,90 L 200,165" stroke="#EF4444" strokeWidth="1" strokeDasharray="2 2" />
        <path d="M 300,140 L 300,115" stroke="#EF4444" strokeWidth="1" strokeDasharray="2 2" />

        {/* WARNING annotation badge */}
        <g transform="translate(195, 110)">
          <rect width="85" height="18" rx="4" fill="#EF4444" fillOpacity="0.15" stroke="#EF4444" strokeWidth="1" />
          <text x="42.5" y="12" fill="#EF4444" fontSize="8" fontWeight="black" textAnchor="middle" letterSpacing="0.05em">INVERSIÓN DE CURVA</text>
        </g>

        {/* Spread marker */}
        <circle cx="200" cy="90" r="4" fill="#EF4444" />
        <circle cx="300" cy="140" r="4" fill="#06B6D4" />
        
        {/* Title Tag inside chart */}
        <text x="350" y="285" fill="#52525B" fontSize="8" textAnchor="end" fontStyle="italic">HIVEX Bloomberg Feed</text>
      </svg>
    );
  }

  if (type === "dxy-gold") {
    return (
      <svg viewBox="0 0 400 300" className="w-full h-full bg-zinc-950 font-sans select-none">
        <defs>
          <linearGradient id="bg-grad-2" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0B0B0F" />
            <stop offset="100%" stopColor="#14141C" />
          </linearGradient>
          <linearGradient id="glow-cyan-dxy" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#0891B2" />
          </linearGradient>
          <linearGradient id="glow-gold" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>
          <filter id="neon-glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="neon-glow-gold" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background */}
        <rect width="100%" height="100%" fill="url(#bg-grad-2)" />

        {/* Grid */}
        <path d="M 50,40 L 360,40 M 50,90 L 360,90 M 50,140 L 360,140 M 50,190 L 360,190 M 50,240 L 360,240" stroke="#1E1E24" strokeWidth="1" strokeDasharray="3 3" />
        <path d="M 100,40 L 100,240 M 150,40 L 150,240 M 200,40 L 200,240 M 250,40 L 250,240 M 300,40 L 300,240 M 350,40 L 350,240" stroke="#1E1E24" strokeWidth="1" strokeDasharray="3 3" />

        {/* Axes */}
        <line x1="50" y1="240" x2="360" y2="240" stroke="#3F3F46" strokeWidth="1" />
        <line x1="50" y1="40" x2="50" y2="240" stroke="#3F3F46" strokeWidth="1" />

        {/* Left Y Axis (DXY) */}
        <text x="40" y="244" fill="#06B6D4" fontSize="8" textAnchor="end" fontWeight="bold">99.0</text>
        <text x="40" y="194" fill="#06B6D4" fontSize="8" textAnchor="end" fontWeight="bold">101.0</text>
        <text x="40" y="144" fill="#06B6D4" fontSize="8" textAnchor="end" fontWeight="bold">103.0</text>
        <text x="40" y="94" fill="#06B6D4" fontSize="8" textAnchor="end" fontWeight="bold">105.0</text>
        <text x="40" y="44" fill="#06B6D4" fontSize="8" textAnchor="end" fontWeight="bold">107.0</text>

        {/* Right Y Axis (Gold) */}
        <text x="370" y="244" fill="#F59E0B" fontSize="8" textAnchor="start" fontWeight="bold">$2,000</text>
        <text x="370" y="194" fill="#F59E0B" fontSize="8" textAnchor="start" fontWeight="bold">$2,100</text>
        <text x="370" y="144" fill="#F59E0B" fontSize="8" textAnchor="start" fontWeight="bold">$2,200</text>
        <text x="370" y="94" fill="#F59E0B" fontSize="8" textAnchor="start" fontWeight="bold">$2,300</text>
        <text x="370" y="44" fill="#F59E0B" fontSize="8" textAnchor="start" fontWeight="bold">$2,400</text>

        {/* X Axis Labels */}
        <text x="100" y="255" fill="#71717A" fontSize="9" textAnchor="middle" fontWeight="bold">Ene</text>
        <text x="150" y="255" fill="#71717A" fontSize="9" textAnchor="middle" fontWeight="bold">Feb</text>
        <text x="200" y="255" fill="#71717A" fontSize="9" textAnchor="middle" fontWeight="bold">Mar</text>
        <text x="250" y="255" fill="#71717A" fontSize="9" textAnchor="middle" fontWeight="bold">Abr</text>
        <text x="300" y="255" fill="#71717A" fontSize="9" textAnchor="middle" fontWeight="bold">May</text>
        <text x="350" y="255" fill="#71717A" fontSize="9" textAnchor="middle" fontWeight="bold">Jun</text>

        {/* Legend */}
        <g transform="translate(60, 20)">
          <circle cx="5" cy="5" r="3" fill="#06B6D4" />
          <text x="12" y="8" fill="#A1A1AA" fontSize="9" fontWeight="medium">DXY (Eje Izq)</text>
        </g>
        <g transform="translate(180, 20)">
          <circle cx="5" cy="5" r="3" fill="#F59E0B" />
          <text x="12" y="8" fill="#A1A1AA" fontSize="9" fontWeight="medium">Oro Spot / BTC (Eje Der)</text>
        </g>

        {/* DXY Curve - Declining */}
        <path d="M 50,60 C 100,50 120,110 150,130 C 180,150 200,120 250,180 C 300,210 330,200 350,225" fill="none" stroke="url(#glow-cyan-dxy)" strokeWidth="2.5" filter="url(#neon-glow-cyan)" strokeLinecap="round" />

        {/* Gold Curve - Skyrocketing */}
        <path d="M 50,230 C 100,220 120,190 150,150 C 180,110 200,130 250,90 C 300,60 330,65 350,45" fill="none" stroke="url(#glow-gold)" strokeWidth="2.5" filter="url(#neon-glow-gold)" strokeLinecap="round" />

        {/* Divergence Point Line */}
        <line x1="200" y1="40" x2="200" y2="240" stroke="#F59E0B" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
        <g transform="translate(205, 120)">
          <rect width="90" height="26" rx="4" fill="#18181B" stroke="#F59E0B" strokeWidth="1" />
          <text x="45" y="10" fill="#F59E0B" fontSize="7" fontWeight="black" textAnchor="middle">DESACOPLE ACTIVO</text>
          <text x="45" y="18" fill="#A1A1AA" fontSize="6.5" textAnchor="middle">Rotación de Reservas Fiat</text>
        </g>
        
        {/* Title Tag */}
        <text x="350" y="285" fill="#52525B" fontSize="8" textAnchor="end" fontStyle="italic">HIVEX Macro Correlation</text>
      </svg>
    );
  }

  // Fallback: Elegant Candlestick Chart
  return (
    <svg viewBox="0 0 400 300" className="w-full h-full bg-zinc-950 font-sans select-none">
      <defs>
        <linearGradient id="bg-grad-3" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0B0B0F" />
          <stop offset="100%" stopColor="#14141C" />
        </linearGradient>
        <linearGradient id="purple-glow" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#EC4899" />
        </linearGradient>
        <filter id="neon-glow-purple" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Background */}
      <rect width="100%" height="100%" fill="url(#bg-grad-3)" />

      {/* Grid */}
      <path d="M 50,40 L 360,40 M 50,90 L 360,90 M 50,140 L 360,140 M 50,190 L 360,190 M 50,240 L 360,240" stroke="#1E1E24" strokeWidth="1" strokeDasharray="3 3" />
      <path d="M 100,40 L 100,240 M 150,40 L 150,240 M 200,40 L 200,240 M 250,40 L 250,240 M 300,40 L 300,240 M 350,40 L 350,240" stroke="#1E1E24" strokeWidth="1" strokeDasharray="3 3" />

      {/* Axes */}
      <line x1="50" y1="240" x2="360" y2="240" stroke="#3F3F46" strokeWidth="1" />
      <line x1="50" y1="40" x2="50" y2="240" stroke="#3F3F46" strokeWidth="1" />

      {/* Y Axis Labels */}
      <text x="40" y="244" fill="#71717A" fontSize="8" textAnchor="end" fontWeight="bold">$350</text>
      <text x="40" y="194" fill="#71717A" fontSize="8" textAnchor="end" fontWeight="bold">$380</text>
      <text x="40" y="144" fill="#71717A" fontSize="8" textAnchor="end" fontWeight="bold">$410</text>
      <text x="40" y="94" fill="#71717A" fontSize="8" textAnchor="end" fontWeight="bold">$440</text>
      <text x="40" y="44" fill="#71717A" fontSize="8" textAnchor="end" fontWeight="bold">$470</text>

      {/* X Axis Labels */}
      <text x="80" y="255" fill="#71717A" fontSize="8" textAnchor="middle" fontWeight="bold">Sem 1</text>
      <text x="140" y="255" fill="#71717A" fontSize="8" textAnchor="middle" fontWeight="bold">Sem 2</text>
      <text x="200" y="255" fill="#71717A" fontSize="8" textAnchor="middle" fontWeight="bold">Sem 3</text>
      <text x="260" y="255" fill="#71717A" fontSize="8" textAnchor="middle" fontWeight="bold">Sem 4</text>
      <text x="320" y="255" fill="#71717A" fontSize="8" textAnchor="middle" fontWeight="bold">Sem 5</text>

      {/* EMA Legend */}
      <g transform="translate(60, 20)">
        <line x1="0" y1="5" x2="15" y2="5" stroke="#8B5CF6" strokeWidth="2" />
        <text x="20" y="8" fill="#A1A1AA" fontSize="9" fontWeight="medium">EMA-20 Sólida</text>
      </g>
      <g transform="translate(180, 20)">
        <rect x="0" y="1" width="10" height="8" fill="#10B981" />
        <text x="15" y="8" fill="#A1A1AA" fontSize="9" fontWeight="medium">Soporte DCA (DGI)</text>
      </g>

      {/* Candlesticks */}
      {/* Candle 1 (Red) */}
      <line x1="80" y1="130" x2="80" y2="190" stroke="#F43F5E" strokeWidth="1" />
      <rect x="76" y="145" width="8" height="30" fill="#F43F5E" fillOpacity="0.85" rx="1" />

      {/* Candle 2 (Green) */}
      <line x1="110" y1="120" x2="110" y2="170" stroke="#10B981" strokeWidth="1" />
      <rect x="106" y="130" width="8" height="25" fill="#10B981" fillOpacity="0.85" rx="1" />

      {/* Candle 3 (Red) */}
      <line x1="140" y1="140" x2="140" y2="210" stroke="#F43F5E" strokeWidth="1" />
      <rect x="136" y="150" width="8" height="40" fill="#F43F5E" fillOpacity="0.85" rx="1" />

      {/* Candle 4 (Green) */}
      <line x1="170" y1="150" x2="170" y2="230" stroke="#10B981" strokeWidth="1" />
      <rect x="166" y="170" width="8" height="45" fill="#10B981" fillOpacity="0.85" rx="1" />
      
      {/* Candle 5 (Green) */}
      <line x1="200" y1="130" x2="200" y2="185" stroke="#10B981" strokeWidth="1" />
      <rect x="196" y="140" width="8" height="30" fill="#10B981" fillOpacity="0.85" rx="1" />

      {/* Candle 6 (Green) */}
      <line x1="230" y1="100" x2="230" y2="160" stroke="#10B981" strokeWidth="1" />
      <rect x="226" y="110" width="8" height="35" fill="#10B981" fillOpacity="0.85" rx="1" />

      {/* Candle 7 (Red) */}
      <line x1="260" y1="110" x2="260" y2="155" stroke="#F43F5E" strokeWidth="1" />
      <rect x="256" y="120" width="8" height="20" fill="#F43F5E" fillOpacity="0.85" rx="1" />

      {/* Candle 8 (Green) */}
      <line x1="290" y1="70" x2="290" y2="130" stroke="#10B981" strokeWidth="1" />
      <rect x="286" y="80" width="8" height="40" fill="#10B981" fillOpacity="0.85" rx="1" />

      {/* Candle 9 (Green) */}
      <line x1="320" y1="50" x2="320" y2="100" stroke="#10B981" strokeWidth="1" />
      <rect x="316" y="55" width="8" height="30" fill="#10B981" fillOpacity="0.85" rx="1" />

      {/* EMA Curve */}
      <path d="M 80,165 Q 140,170 200,145 T 320,68" fill="none" stroke="url(#purple-glow)" strokeWidth="2.5" filter="url(#neon-glow-purple)" strokeLinecap="round" />

      {/* DCA Bounce Highlight */}
      <circle cx="170" cy="190" r="14" fill="none" stroke="#10B981" strokeWidth="1" strokeDasharray="2 2" />
      <g transform="translate(185, 205)">
        <rect width="60" height="15" rx="3" fill="#18181B" stroke="#10B981" strokeWidth="0.5" />
        <text x="30" y="9.5" fill="#10B981" fontSize="6.5" fontWeight="bold" textAnchor="middle">SOPORTE DCA</text>
      </g>

      {/* Volume bars */}
      <rect x="77" y="225" width="6" height="15" fill="#F43F5E" opacity="0.3" />
      <rect x="107" y="220" width="6" height="20" fill="#10B981" opacity="0.3" />
      <rect x="137" y="210" width="6" height="30" fill="#F43F5E" opacity="0.3" />
      <rect x="167" y="200" width="6" height="40" fill="#10B981" opacity="0.3" />
      <rect x="197" y="220" width="6" height="20" fill="#10B981" opacity="0.3" />
      <rect x="227" y="215" width="6" height="25" fill="#10B981" opacity="0.3" />

      {/* Title Tag */}
      <text x="350" y="285" fill="#52525B" fontSize="8" textAnchor="end" fontStyle="italic">HIVEX Candle Feed</text>
    </svg>
  );
}

// Custom inline styles parsing helper for markdown rendering
function parseInlineStyles(text: string): React.ReactNode {
  if (!text) return "";
  const parts = text.split("**");
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      return <strong key={i} className="font-bold text-white">{part}</strong>;
    }
    // Handle inline code `code`
    const codeParts = part.split("`");
    if (codeParts.length > 1) {
      return codeParts.map((sub, j) => {
        if (j % 2 === 1) {
          return <code key={j} className="bg-zinc-800 text-amber-400 px-1.5 py-0.5 rounded text-xs font-mono">{sub}</code>;
        }
        return sub;
      }) as React.ReactNode;
    }
    return part;
  }) as React.ReactNode;
}

// Robust, self-healing parser to handle standard, loose, or translated chart tags
function parseChartTag(rawContent: string): { type: "yield-curve" | "dxy-gold" | "candlestick"; caption: string } | null {
  let clean = rawContent.trim();

  // Helper to normalize the chart type to our 3 canonical types
  const normalize = (typeStr: string): "yield-curve" | "dxy-gold" | "candlestick" | null => {
    const s = typeStr.trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // remove accents
    if (s.includes("yield") || s.includes("rendimiento") || s.includes("rendite") || s.includes("verim") || s.includes("curva") || s.includes("bono") || s.includes("interes") || s.includes("rate") || s.includes("rendicion")) {
      return "yield-curve";
    }
    if (s.includes("dxy") || s.includes("gold") || s.includes("oro") || s.includes("altin") || s.includes("dollar") || s.includes("dolar") || s.includes("dxy-gold")) {
      return "dxy-gold";
    }
    if (s.includes("candle") || s.includes("vela") || s.includes("kerzen") || s.includes("mum") || s.includes("candlestick") || s.includes("grafico")) {
      return "candlestick";
    }
    // Direct match fallback
    if (s === "yield-curve" || s === "dxy-gold" || s === "candlestick") {
      return s as "yield-curve" | "dxy-gold" | "candlestick";
    }
    return null;
  };

  // 1. Direct pipe-separated format support: type | caption
  if (clean.includes("|")) {
    const parts = clean.split("|");
    const typeStr = parts[0].trim().replace(/['"']/g, "").toLowerCase();
    const caption = parts.slice(1).join("|").trim();
    const normalizedType = normalize(typeStr);
    if (normalizedType) {
      return {
        type: normalizedType,
        caption
      };
    }
  }

  // 2. Standard JSON format fallback
  try {
    clean = clean.replace(/\\"/g, '"');
    clean = clean.replace(/\\\\"/g, '"');
    const data = JSON.parse(clean);
    if (data && data.type) {
      const normalizedType = normalize(data.type);
      if (normalizedType) {
        return {
          type: normalizedType,
          caption: data.caption || ""
        };
      }
    }
  } catch (e) {
    console.warn("Failed standard JSON parse of chart content, trying loose parsing:", rawContent, e);
    try {
      const typeMatch = rawContent.match(/["']?type["']?\s*:\s*["']([^"']+)["']/);
      const captionMatch = rawContent.match(/["']?caption["']?\s*:\s*["']([^"']+)["']/);
      if (typeMatch && typeMatch[1]) {
        const normalizedType = normalize(typeMatch[1]);
        if (normalizedType) {
          return {
            type: normalizedType,
            caption: captionMatch ? captionMatch[1] : ""
          };
        }
      }
    } catch (looseErr) {
      console.error("Loose parsing also failed:", looseErr);
    }
  }
  return null;
}


// Custom helper to extract seconds from timestamps in format [MM:SS] or [HH:MM:SS]
function extractSeconds(text: string): number | null {
  const match = text.match(/\[(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\]/);
  if (!match) return null;
  const h = match[1] ? parseInt(match[1], 10) : 0;
  const m = parseInt(match[2], 10);
  const s = parseInt(match[3], 10);
  return h * 3600 + m * 60 + s;
}

// Generates dynamic Youtube embed URLs with start timestamp and autoplay
function getEmbedUrl(url: string, seconds: number | null): string {
  if (!url) return "";
  let embedUrl = url;
  if (url.includes("youtube.com/watch")) {
    const match = url.match(/[?&]v=([^&#]+)/);
    if (match && match[1]) {
      embedUrl = `https://www.youtube.com/embed/${match[1]}`;
    }
  } else if (url.includes("youtu.be/")) {
    const match = url.match(/youtu\.be\/([^?&#]+)/);
    if (match && match[1]) {
      embedUrl = `https://www.youtube.com/embed/${match[1]}`;
    }
  } else if (url.includes("youtube.com/embed/")) {
    embedUrl = url.split("?")[0];
  } else if (url.includes("youtube.com/shorts/")) {
    const match = url.match(/shorts\/([^?&#]+)/);
    if (match && match[1]) {
      embedUrl = `https://www.youtube.com/embed/${match[1]}`;
    }
  }
  
  if (seconds === null) return embedUrl;
  const separator = embedUrl.includes("?") ? "&" : "?";
  return `${embedUrl}${separator}start=${seconds}&autoplay=1`;
}

// Safely splits raw database transcription into 3 key segments (verbatim, summary, report)
// Safely splits raw database transcription into 3 key segments (verbatim, summary, report)
function splitTranscription(text: string) {
  if (!text) return { transcription: "", summary: "", charts: "", report: "" };
  
  // Step 1: Attempt standard robust split using various markdown horizontal line syntaxes
  // Matches: ---, ***, ===, ___, - - - with optional spaces or trailing text (like "--- Parte 2 ---")
  const regexSplit = /\n\s*(?:---|===|\*\*\*|___|- - -)[^\n]*\n/;
  const parts = text.split(regexSplit);
  
  let transcription = "";
  let summary = "";
  let charts = "";
  let report = "";
  
  if (parts.length >= 4) {
    transcription = parts[0] || "";
    summary = parts[1] || "";
    charts = parts[2] || "";
    report = parts.slice(3).join("\n---\n") || "";
  } else if (parts.length === 3) {
    transcription = parts[0] || "";
    summary = parts[1] || "";
    charts = "";
    report = parts[2] || "";
  } else {
    // Step 2: Heuristic Heading-based Fallback Slicing
    const lines = text.split("\n");
    let summaryIdx = -1;
    let chartsIdx = -1;
    let reportIdx = -1;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim().toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // strip accents
      
      if (trimmed.startsWith("#") || trimmed.startsWith("- #") || trimmed.startsWith("**")) {
        const headerText = trimmed.replace(/^[\s\-\*#]*/, "").replace(/^\*\*|\*\*$/g, "").trim();
        
        if (summaryIdx === -1) {
          if (headerText.includes("resumen") || headerText.includes("summary") || headerText.includes("zusammenfassung") || headerText.includes("ozet") || headerText.includes("part 2") || headerText.includes("parte 2") || headerText.includes("teil 2") || headerText.includes("bolum 2") || headerText.includes("kisim 2")) {
            summaryIdx = i;
          }
        } else if (chartsIdx === -1) {
          if (headerText.includes("grafico") || headerText.includes("grafik") || headerText.includes("chart") || headerText.includes("diagram") || headerText.includes("visualizac") || headerText.includes("visualis") || headerText.includes("gorsel") || headerText.includes("part 3") || headerText.includes("parte 3") || headerText.includes("teil 3") || headerText.includes("bolum 3") || headerText.includes("kisim 3")) {
            const isReport = headerText.includes("informe") || headerText.includes("report") || headerText.includes("bericht") || headerText.includes("rapor") || headerText.includes("analisis") || headerText.includes("analysis") || headerText.includes("analyse") || headerText.includes("analiz") || headerText.includes("invers") || headerText.includes("invest") || headerText.includes("yatirim");
            if (isReport && !headerText.includes("grafic") && !headerText.includes("grafik") && !headerText.includes("chart") && !headerText.includes("visualizac") && !headerText.includes("visualis") && !headerText.includes("gorsel")) {
              reportIdx = i;
            } else {
              chartsIdx = i;
            }
          }
        } else if (reportIdx === -1) {
          if (headerText.includes("informe") || headerText.includes("report") || headerText.includes("bericht") || headerText.includes("rapor") || headerText.includes("analisis") || headerText.includes("analysis") || headerText.includes("analyse") || headerText.includes("analiz") || headerText.includes("invers") || headerText.includes("invest") || headerText.includes("yatirim") || headerText.includes("part 4") || headerText.includes("parte 4") || headerText.includes("teil 4") || headerText.includes("bolum 4") || headerText.includes("kisim 4")) {
            reportIdx = i;
          }
        }
      }
    }

    if (summaryIdx !== -1 && chartsIdx !== -1 && reportIdx !== -1 && reportIdx > chartsIdx && chartsIdx > summaryIdx) {
      transcription = lines.slice(0, summaryIdx).join("\n");
      summary = lines.slice(summaryIdx, chartsIdx).join("\n");
      charts = lines.slice(chartsIdx, reportIdx).join("\n");
      report = lines.slice(reportIdx).join("\n");
    } else if (summaryIdx !== -1 && reportIdx !== -1 && reportIdx > summaryIdx) {
      transcription = lines.slice(0, summaryIdx).join("\n");
      summary = lines.slice(summaryIdx, reportIdx).join("\n");
      charts = "";
      report = lines.slice(reportIdx).join("\n");
    } else if (summaryIdx !== -1 && chartsIdx !== -1 && chartsIdx > summaryIdx) {
      transcription = lines.slice(0, summaryIdx).join("\n");
      summary = lines.slice(summaryIdx, chartsIdx).join("\n");
      charts = lines.slice(chartsIdx).join("\n");
      report = "";
    } else if (summaryIdx !== -1) {
      transcription = lines.slice(0, summaryIdx).join("\n");
      summary = lines.slice(summaryIdx).join("\n");
      charts = "";
      report = "";
    } else {
      transcription = parts[0] || "";
      summary = parts[1] || "";
      charts = parts[2] || "";
      report = parts.slice(3).join("\n---\n") || "";
      
      if (parts.length === 1) {
        transcription = text;
        summary = "";
        charts = "";
        report = "";
      } else if (parts.length === 2) {
        transcription = parts[0] || "";
        summary = parts[1] || "";
        charts = "";
        report = "";
      } else if (parts.length === 3) {
        transcription = parts[0] || "";
        summary = parts[1] || "";
        charts = "";
        report = parts[2] || "";
      }
    }
  }
  
  // Clean redundant title headers at the beginning of each part if present
  const cleanSummary = summary.replace(/^#*\s*(?:Resumen Detallado|Resumen Detallado del Contenido|Resumen|Detailed Summary|Zusammenfassung|Ozet|Part 2|Parte 2|Teil 2|Teil2|Bolum 2|Kisim 2)[^\n]*\n+/i, "").trim();
  const cleanCharts = charts.replace(/^#*\s*(?:Graficos y Visualizaciones Detectadas|Graficos y Visualizaciones|Graficos|Charts and Visualizations|Charts|Visualizaciones|Erkannte Grafiken und Visualisierungen|Erkannte Grafiken|Tespit Edilen Grafikler ve Gorsellestirmeler|Tespit Edilen Grafikler|Part 3|Parte 3|Teil 3|Teil3|Bolum 3|Kisim 3)[^\n]*\n+/i, "").trim();
  const cleanReport = report.replace(/^#*\s*(?:Informe de Inversión|Informe de Análisis|Informe|Investment Report|Investitionsbericht|Investitionsanalysebericht|Rapor|Yatirim Analiz Raporu|Analysis|Analyse|Analiz|Part 4|Parte 4|Teil 4|Teil4|Bolum 4|Kisim 4|Part 3|Parte 3)[^\n]*\n+/i, "").trim();
  
  return {
    transcription: transcription.trim(),
    summary: cleanSummary,
    charts: cleanCharts,
    report: cleanReport
  };
}

// Persiste por separado la transcripción literal, el resumen estructurado, los gráficos y el análisis de inversión
async function saveVideoKnowledgeBase(videoDoc: { id?: string; title: string; file_url?: string; metadata?: any }, transcriptionText: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn("[Base de Conocimiento] No user session found, skipping knowledge base save.");
      return;
    }

    const splitResult = splitTranscription(transcriptionText);
    const channelTitle = videoDoc.metadata?.channel_title || "Andrei Jikh";
    const dateStr = new Date().toISOString();
    const fileUrl = videoDoc.file_url || "";

    // 1. Literal transcription
    const transcriptionDoc = {
      user_id: user.id,
      title: `[Transcripción] - ${videoDoc.title}`,
      description: `Transcripción completa literal de ${videoDoc.title}`,
      type: "knowledge_transcription",
      file_url: fileUrl,
      metadata: {
        fecha_transcripcion: dateStr,
        canal_origen: channelTitle,
        nombre_video: videoDoc.title,
        texto_transcripcion: splitResult.transcription
      }
    };

    // 2. Content summary
    const summaryDoc = {
      user_id: user.id,
      title: `[Resumen] - ${videoDoc.title}`,
      description: `Resumen de contenido completo de ${videoDoc.title}`,
      type: "knowledge_summary",
      file_url: fileUrl,
      metadata: {
        fecha_resumen: dateStr,
        canal_origen: channelTitle,
        nombre_video: videoDoc.title,
        resumen_markdown: splitResult.summary
      }
    };

    // 3. Charts and Visualizations
    const chartsDoc = {
      user_id: user.id,
      title: `[Gráficos] - ${videoDoc.title}`,
      description: `Gráficos y visualizaciones detectadas de ${videoDoc.title}`,
      type: "knowledge_charts",
      file_url: fileUrl,
      metadata: {
        fecha_graficos: dateStr,
        canal_origen: channelTitle,
        nombre_video: videoDoc.title,
        graficos_markdown: splitResult.charts
      }
    };

    // 4. Investment analysis report
    const analysisDoc = {
      user_id: user.id,
      title: `[Análisis] - ${videoDoc.title}`,
      description: `Informe de análisis financiero de ${videoDoc.title}`,
      type: "knowledge_analysis",
      file_url: fileUrl,
      metadata: {
        fecha_informe: dateStr,
        canal_origen: channelTitle,
        nombre_video: videoDoc.title,
        informe_completo: splitResult.report
      }
    };

    const docsToInsert = [
      { doc: transcriptionDoc, type: "knowledge_transcription" },
      { doc: summaryDoc, type: "knowledge_summary" },
      { doc: chartsDoc, type: "knowledge_charts" },
      { doc: analysisDoc, type: "knowledge_analysis" }
    ];

    let newlyAnalyzed = false;

    for (const item of docsToInsert) {
      // Query to avoid duplicate rows for the same file_url and type
      const { data: existing, error: checkErr } = await supabase
        .from("documents")
        .select("id")
        .eq("type", item.type)
        .eq("file_url", fileUrl);

      if (checkErr) {
        console.warn(`[Base de Conocimiento] Error al verificar existencia de ${item.type}:`, checkErr);
      }

      if (!existing || existing.length === 0) {
        const { error: insertErr } = await supabase
          .from("documents")
          .insert(item.doc as any);
        if (insertErr) {
          console.warn(`[Base de Conocimiento] Error al insertar ${item.type} para ${videoDoc.title}:`, insertErr);
        } else {
          console.log(`[Base de Conocimiento] Persistido con éxito ${item.type} para: ${videoDoc.title}`);
          if (item.type === "knowledge_analysis") {
            newlyAnalyzed = true;
          }
        }
      } else {
        const { error: updateErr } = await supabase
          .from("documents")
          .update(item.doc as any)
          .eq("id", existing[0].id);
        if (updateErr) {
          console.warn(`[Base de Conocimiento] Error al actualizar ${item.type} para ${videoDoc.title}:`, updateErr);
        } else {
          console.log(`[Base de Conocimiento] Actualizado con éxito ${item.type} para: ${videoDoc.title}`);
          if (item.type === "knowledge_analysis") {
            newlyAnalyzed = true;
          }
        }
      }
    }

    if (newlyAnalyzed) {
      // Extract youtubeId from fileUrl
      let ytId = "";
      const regexes = [
        /youtube\.com\/embed\/([a-zA-Z0-9_\-]{11})/,
        /youtube\.com\/watch\?v=([a-zA-Z0-9_\-]{11})/,
        /youtu\.be\/([a-zA-Z0-9_\-]{11})/,
        /youtube\.com\/shorts\/([a-zA-Z0-9_\-]{11})/
      ];
      for (const regex of regexes) {
        const match = fileUrl.match(regex);
        if (match && match[1]) {
          ytId = match[1];
          break;
        }
      }

      console.log(`[Base de Conocimiento] Triggering automatic Telegram notification for newly analyzed video: ${videoDoc.title}`);
      fetch("/api/telegram/notify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "video_analysis",
          videoTitle: videoDoc.title,
          channelName: channelTitle,
          analysisSummary: splitResult.summary || splitResult.report || "Análisis bursátil guardado con éxito.",
          youtubeId: ytId || undefined,
          videoId: videoDoc.id,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            console.log(`[Base de Conocimiento] Telegram notification triggered successfully! ${data.simulated ? "(Simulated)" : ""}`);
          } else {
            console.warn(`[Base de Conocimiento] Telegram notification failed:`, data.error);
          }
        })
        .catch((err) => {
          console.error(`[Base de Conocimiento] Failed to call Telegram notify API:`, err);
        });
    }
  } catch (err) {
    console.error("[Base de Conocimiento] Error al procesar guardado persistente:", err);
  }
}

// Extrae de forma estable la clave de caché global basada en el ID de YouTube o URL del vídeo
function getGlobalCacheKey(videoDoc: { id: string; file_url?: string }): string {
  const fileUrl = videoDoc.file_url || "";
  let ytId = "";
  
  const regexes = [
    /youtube\.com\/embed\/([a-zA-Z0-9_\-]{11})/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_\-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_\-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_\-]{11})/
  ];

  for (const regex of regexes) {
    const match = fileUrl.match(regex);
    if (match && match[1]) {
      ytId = match[1];
      break;
    }
  }
  
  if (!ytId && videoDoc.id && videoDoc.id.length === 11 && !videoDoc.id.startsWith("yt-video-")) {
    ytId = videoDoc.id;
  }
  
  if (!ytId) {
    const cleanId = videoDoc.id.startsWith("yt-video-") ? videoDoc.id.slice(9) : videoDoc.id;
    if (cleanId.length === 11) {
      ytId = cleanId;
    }
  }

  const cleanKey = ytId || videoDoc.id || fileUrl;
  return `hivex_global_trans_cache_${cleanKey}`;
}


// Custom MarkdownRenderer component to avoid external markdown libraries and ensure security
function MarkdownRenderer({
  content,
  onSeek,
  modelUsed,
  selectedLanguage = "en",
}: {
  content: string;
  onSeek?: (seconds: number) => void;
  modelUsed?: string;
  selectedLanguage?: string;
}) {
  if (!content) return null;

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  
  let inList = false;
  let currentListLevel = 2;
  let isNumberedList = false;
  let listItems: React.ReactNode[] = [];
  
  let inBlockquote = false;
  let blockquoteLines: string[] = [];

  const flushList = (key: string | number) => {
    if (inList && listItems.length > 0) {
      const listStyle = isNumberedList ? "list-none" : "list-disc";
      let ulClass = `${listStyle} ml-6 md:ml-8 pl-2 space-y-1.5 mb-2 text-zinc-300`;
      if (currentListLevel === 2) {
        ulClass = `${listStyle} ml-12 md:ml-16 pl-2 space-y-1.5 mb-2 text-zinc-300`;
      } else if (currentListLevel === 3) {
        ulClass = `${listStyle} ml-20 md:ml-28 pl-2 space-y-1.5 mb-2 text-zinc-400`;
      }
      elements.push(
        <ul key={`list-${key}`} className={ulClass}>
          {listItems}
        </ul>
      );
      inList = false;
      listItems = [];
      isNumberedList = false;
    }
  };

  const flushBlockquote = (key: string | number) => {
    if (inBlockquote && blockquoteLines.length > 0) {
      let title = "";
      let themeClass = "border-zinc-700 bg-zinc-900/50 text-zinc-300";
      let iconColor = "text-zinc-400";
      
      const displayLines = [...blockquoteLines];
      const firstLine = displayLines[0]?.trim() || "";
      
      if (firstLine.startsWith("[!IMPORTANT]")) {
        title = "IMPORTANT";
        themeClass = "border-red-500/50 bg-red-950/20 text-red-200";
        iconColor = "text-red-400";
        displayLines.shift();
      } else if (firstLine.startsWith("[!WARNING]")) {
        title = "WARNING";
        themeClass = "border-amber-500/50 bg-amber-950/20 text-amber-200";
        iconColor = "text-amber-400";
        displayLines.shift();
      } else if (firstLine.startsWith("[!TIP]")) {
        title = "TIP";
        themeClass = "border-emerald-500/50 bg-emerald-950/20 text-emerald-200";
        iconColor = "text-emerald-400";
        displayLines.shift();
      } else if (firstLine.startsWith("[!CAUTION]")) {
        title = "CAUTION";
        themeClass = "border-purple-500/50 bg-purple-950/20 text-purple-200";
        iconColor = "text-purple-400";
        displayLines.shift();
      } else if (firstLine.startsWith("[!NOTE]")) {
        title = "NOTE";
        themeClass = "border-blue-500/50 bg-blue-950/20 text-blue-200";
        iconColor = "text-blue-400";
        displayLines.shift();
      }

      elements.push(
        <div key={`bq-${key}`} className={`border-l-4 p-4 rounded-r-lg my-4 ${themeClass}`}>
          {title && (
            <div className="flex items-center gap-2 mb-1.5 font-bold text-xs tracking-wider uppercase">
              <AlertCircle className={`w-4 h-4 ${iconColor}`} />
              <span>{title}</span>
            </div>
          )}
          <div className="text-sm leading-relaxed space-y-1">
            {displayLines.map((line, idx) => (
              <p key={idx}>{parseInlineStyles(line)}</p>
            ))}
          </div>
        </div>
      );
      inBlockquote = false;
      blockquoteLines = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    let trimmed = line.trim();

    // Support nested or bulleted charts e.g. "- [CHART: ...]" -> "[CHART: ...]"
    if (/^[\s\-\*]*\[CHART:\s*/i.test(trimmed)) {
      trimmed = trimmed.replace(/^[\s\-\*]*/, "").trim();
    }

    // Check if line is a Chart block (ignore trailing dots or extra trailing characters after the closing bracket)
    const chartMatch = trimmed.match(/^\[CHART:\s*([^\]]+)\]/i);
    if (chartMatch) {
      // Completely discard/ignore simulated charts as requested by the user
      continue;
    }

    // Support nested or bulleted headers e.g. "- #### [MM:SS] Title" -> "#### [MM:SS] Title"
    if (/^[\s\-\*]*####\s+/.test(line)) {
      line = line.replace(/^[\s\-\*]*####/, "####");
      trimmed = line.trim();
    }

    // Horizontal Rule
    if (trimmed === "---") {
      flushList(i);
      flushBlockquote(i);
      elements.push(<hr key={i} className="border-zinc-800 my-6" />);
      continue;
    }

    // Blockquotes / Alerts
    if (trimmed.startsWith(">")) {
      flushList(i);
      inBlockquote = true;
      let contentLine = line.substring(line.indexOf(">") + 1);
      if (contentLine.startsWith(" ")) {
        contentLine = contentLine.substring(1);
      }
      blockquoteLines.push(contentLine);
      continue;
    } else {
      flushBlockquote(i);
    }

    // Bullet / Numbered Lists
    const listMatch = line.match(/^(\s*)(?:([\-\*])|(\d+\.))\s+(.*)/);
    if (listMatch) {
      const indentStr = listMatch[1];
      const isNum = !!listMatch[3];
      const listContent = listMatch[4];
      const indentLength = indentStr.replace(/\t/g, "    ").length;
      
      let level = 1;
      if (indentLength >= 4) {
        level = 3;
      } else if (indentLength >= 2) {
        level = 2;
      }

      if (inList && (currentListLevel !== level || isNumberedList !== isNum)) {
        flushList(i);
      }

      if (!inList) {
        inList = true;
        currentListLevel = level;
        isNumberedList = isNum;
      }

      if (level === 1) {
        // Extract timestamp
        const tsMatch = listContent.match(/\[?((?:(?:\d{1,2}):)?(?:\d{1,2}):(?:\d{2}))\]?/);
        const tsStr = tsMatch ? tsMatch[1] : "";
        const seconds = tsStr ? parseDurationToSeconds(tsStr) : null;
        
        let cleanText = listContent;
        if (tsStr) {
          cleanText = listContent.replace(/\[?((?:(?:\d{1,2}):)?(?:\d{1,2}):(?:\d{2}))\]?/, "").trim();
          cleanText = cleanText.replace(/^[:\-\s\s*]+|[:\-\s\s*]+$/g, "").trim();
        }
        
        const itemText = isNum ? `${listMatch[3]} ${cleanText}` : cleanText;
        const displayNode = parseInlineStyles(itemText);

        if (seconds !== null && onSeek) {
          flushList(i);
          elements.push(
            <div
              key={i}
              onClick={() => onSeek(seconds)}
              className="text-lg md:text-xl font-bold text-zinc-100 hover:text-indigo-400 cursor-pointer mt-6 mb-3 flex flex-wrap items-center gap-2 underline underline-offset-4 decoration-indigo-500/40 hover:decoration-indigo-300 transition-colors group select-none pb-1"
            >
              <span className="inline-flex items-center gap-1 bg-indigo-500/10 group-hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded text-xs font-mono no-underline">
                <Play className="w-2.5 h-2.5 fill-current" />
                <span>{tsStr}</span>
              </span>
              <span className="font-bold">{displayNode}</span>
            </div>
          );
        } else {
          listItems.push(
            <li 
              key={`li-${i}`} 
              className="pl-1 mb-1.5 text-sm leading-relaxed"
            >
              {displayNode}
            </li>
          );
        }
        continue;
      } else {
        // Extract any internal timestamp for Level 2 or 3
        const tsMatch = listContent.match(/\[?((?:(?:\d{1,2}):)?(?:\d{1,2}):(?:\d{2}))\]?/);
        const tsStr = tsMatch ? tsMatch[1] : "";
        const seconds = tsStr ? parseDurationToSeconds(tsStr) : null;
        
        let cleanText = listContent;
        if (tsStr) {
          cleanText = listContent.replace(/\[?((?:(?:\d{1,2}):)?(?:\d{1,2}):(?:\d{2}))\]?/, "").trim();
          cleanText = cleanText.replace(/^[:\-\s\s*]+|[:\-\s\s*]+$/g, "").trim();
        }

        const itemText = isNum ? `${listMatch[3]} ${cleanText}` : cleanText;
        const displayNode = parseInlineStyles(itemText);
        
        listItems.push(
          <li 
            key={`li-${i}`} 
            className="pl-1 mb-1.5 text-sm leading-relaxed"
          >
            {tsStr && onSeek && seconds !== null && (
              <span 
                onClick={() => onSeek(seconds)}
                className="inline-flex items-center gap-0.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-1 py-0.5 rounded text-[10px] font-mono cursor-pointer mr-1.5 transition-colors select-none"
              >
                <Play className="w-2 h-2 fill-current" />
                <span>{tsStr}</span>
              </span>
            )}
            {displayNode}
          </li>
        );
        continue;
      }
    } else {
      flushList(i);
    }

    // Headers
    if (trimmed.startsWith("#### ")) {
      const headingContent = trimmed.substring(5);
      const seconds = extractSeconds(headingContent);
      
      let cleanText = headingContent;
      if (seconds !== null) {
        cleanText = headingContent.replace(/\[(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\]\s*/, "");
      }
      
      const displayNode = parseInlineStyles(cleanText);
      
      if (seconds !== null && onSeek) {
        const tsMatch = headingContent.match(/\[?((?:(?:\d{1,2}):)?(?:\d{1,2}):(?:\d{2}))\]?/);
        const tsStr = tsMatch ? tsMatch[1] : "";
        
        elements.push(
          <div
            key={i}
            onClick={() => onSeek(seconds)}
            className="text-lg md:text-xl font-bold text-zinc-100 hover:text-indigo-400 cursor-pointer mt-6 mb-3 flex flex-wrap items-center gap-2 underline underline-offset-4 decoration-indigo-500/40 hover:decoration-indigo-300 transition-colors group select-none pb-1"
          >
            <span className="inline-flex items-center gap-1 bg-indigo-500/10 group-hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded text-xs font-mono no-underline">
              <Play className="w-2.5 h-2.5 fill-current" />
              <span>{tsStr}</span>
            </span>
            <span className="font-bold">{displayNode}</span>
          </div>
        );
      } else {
        elements.push(
          <div key={i} className="text-lg md:text-xl font-bold text-white mt-6 mb-3 underline underline-offset-4 decoration-zinc-700 pb-1">
            <span className="font-bold">{displayNode}</span>
          </div>
        );
      }
      continue;
    }

    if (trimmed.startsWith("### ")) {
      elements.push(
        <h3 key={i} className="text-base font-bold text-white mt-5 mb-2 flex items-center gap-2">
          {parseInlineStyles(trimmed.substring(4))}
        </h3>
      );
      continue;
    }
    if (trimmed.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="text-lg font-bold text-white mt-6 mb-3 border-b border-zinc-800 pb-1">
          {parseInlineStyles(trimmed.substring(3))}
        </h2>
      );
      continue;
    }
    if (trimmed.startsWith("# ")) {
      elements.push(
        <h1 key={i} className="text-xl font-extrabold text-white mt-8 mb-4">
          {parseInlineStyles(trimmed.substring(2))}
        </h1>
      );
      continue;
    }

    // Empty Lines / Paragraphs
    if (trimmed === "") {
      elements.push(<div key={i} className="h-2" />);
      continue;
    }

    // Standard line
    elements.push(
      <p key={i} className="text-zinc-300 text-sm leading-relaxed mb-2">
        {parseInlineStyles(line)}
      </p>
    );
  }

  // Flush remaining blocks
  flushList(lines.length);
  flushBlockquote(lines.length);

  return <div className="space-y-1">{elements}</div>;
}

// Highly comprehensive Spanish transcription helper
function parseDurationToSeconds(durationStr?: string): number {
  if (!durationStr) return 720;
  const parts = durationStr.split(":").map(p => parseInt(p, 10));
  if (parts.some(isNaN)) return 720;
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 1) {
    return parts[0];
  }
  return 720;
}

function formatSecondsToTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

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
    is_youtube?: boolean;
    channel_title?: string;
    transcription?: string;
    transcription_model?: string;
    is_favorite?: boolean;
    is_old?: boolean;
    translations?: Record<string, string>;
  };
}


// Module-level global lock for synchronizer to prevent Strict Mode concurrent insertion duplicates
const globallySyncedUrls = new Set<string>();

// Text-to-Speech (TTS) formatting and cleaning helpers
function cleanSummaryForSpeech(summaryStr: string): string {
  if (!summaryStr) return "";
  // 1. Completely strip any chart blocks like [CHART: ...] so the TTS ignores them
  let text = summaryStr.replace(/\[CHART:\s*[\s\S]*?\]/gi, "");
  // 2. Remove timestamps in brackets like [MM:SS] or [H:MM:SS]
  text = text.replace(/\[\d{1,2}:\d{2}(?::\d{2})?\]/g, "");
  // 3. Remove markdown title indicators (###, ##, #)
  text = text.replace(/#+\s+/g, "");
  // 4. Remove inline styles like **, *, _, `
  text = text.replace(/[\*\_`]/g, "");
  // 5. Remove list markers like "-", "*", "1.", "2."
  text = text.replace(/^\s*[\-\*]\s+/gm, "");
  text = text.replace(/^\s*\d+\.\s+/gm, "");
  // 6. Remove blockquote markers ">"
  text = text.replace(/^\s*>\s*/gm, "");
  // 7. Normalize double line breaks, multiple spaces, and trim
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

function chunkTextForSpeech(text: string): string[] {
  if (!text) return [];
  // Split by common sentence endings (. ? !) while preserving the punctuation
  const sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
  return sentences
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function ShimmerSkeleton() {
  return (
    <div className="space-y-4 animate-pulse py-4">
      <div className="h-4 bg-zinc-800 rounded-lg w-3/4"></div>
      <div className="h-4 bg-zinc-800 rounded-lg w-5/6"></div>
      <div className="h-4 bg-zinc-800 rounded-lg w-2/3"></div>
      <div className="space-y-2 pl-4">
        <div className="h-3 bg-zinc-800 rounded-lg w-11/12"></div>
        <div className="h-3 bg-zinc-800 rounded-lg w-4/5"></div>
      </div>
      <div className="h-4 bg-zinc-800 rounded-lg w-1/2"></div>
    </div>
  );
}

interface ParsedChart {
  timestamp: string;
  seconds: number;
  endSeconds?: number;
  title: string;
  bullets: string[];
  legend: string;
}

function parseChartsMarkdown(content: string): ParsedChart[] {
  if (!content || content.includes("No se detectaron gráficos") || content.includes("No charts detected")) {
    return [];
  }

  const sections = content.split(/(?:^|\n)\s*(?:#{2,5}|#+\s*\*+|\*\*+)\s*(?=\[?\d{1,2}:\d{2})/);
  const parsed: ParsedChart[] = [];

  const timestampRangeRegex = /\[?(\d{1,2}:\d{2}(?::\d{2})?)(?:\s*\]?\s*(?:[\-–—]|to)\s*\[?\s*|\s*(?:[\-–—]|to)\s*)(\d{1,2}:\d{2}(?::\d{2})?)\]?/;
  const timestampSingleRegex = /\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?/;

  for (let i = 1; i < sections.length; i++) {
    const section = sections[i].trim();
    if (!section) continue;

    const lines = section.split("\n");
    const headerLine = lines[0].trim();

    const rangeMatch = headerLine.match(timestampRangeRegex);
    let timestamp = "";
    let seconds = 0;
    let endSeconds: number | undefined = undefined;

    if (rangeMatch) {
      timestamp = `${rangeMatch[1]} - ${rangeMatch[2]}`;
      const partsStart = rangeMatch[1].split(":").map(Number);
      if (partsStart.length === 3) {
        seconds = partsStart[0] * 3600 + partsStart[1] * 60 + partsStart[2];
      } else if (partsStart.length === 2) {
        seconds = partsStart[0] * 60 + partsStart[1];
      }

      const partsEnd = rangeMatch[2].split(":").map(Number);
      if (partsEnd.length === 3) {
        endSeconds = partsEnd[0] * 3600 + partsEnd[1] * 60 + partsEnd[2];
      } else if (partsEnd.length === 2) {
        endSeconds = partsEnd[0] * 60 + partsEnd[1];
      }
    } else {
      const singleMatch = headerLine.match(timestampSingleRegex);
      if (!singleMatch) continue;

      timestamp = singleMatch[1];
      const parts = timestamp.split(":").map(Number);
      if (parts.length === 3) {
        seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
      } else if (parts.length === 2) {
        seconds = parts[0] * 60 + parts[1];
      }
    }

    const matchedText = rangeMatch ? rangeMatch[0] : (headerLine.match(timestampSingleRegex)?.[0] || "");
    const title = headerLine
      .replace(matchedText, "")
      .replace(/[\[\]\*#\-\:]/g, "")
      .trim();

    const bullets: string[] = [];
    let legend = "";

    for (let j = 1; j < lines.length; j++) {
      const line = lines[j].trim();
      if (!line) continue;

      if (line.startsWith("-") || line.startsWith("*")) {
        if (line.toLowerCase().includes("leyenda:") || line.toLowerCase().includes("legend:") || (line.startsWith("*") && line.endsWith("*") && !line.startsWith("-"))) {
          legend = line.replace(/^\*+/, "").replace(/\*+$/, "").trim();
        } else {
          bullets.push(line.replace(/^[\-\*\s]+/, "").trim());
        }
      } else if (line.toLowerCase().includes("leyenda:") || line.toLowerCase().includes("legend:")) {
        legend = line.replace(/[_\*]/g, "").trim();
      } else if (line.startsWith("_") && line.endsWith("_")) {
        legend = line.replace(/^_+/, "").replace(/_+$/, "").trim();
      } else {
        if (!legend && bullets.length > 0) {
          bullets[bullets.length - 1] += " " + line;
        }
      }
    }

    parsed.push({
      timestamp,
      seconds,
      endSeconds,
      title: title || `Visualización @ ${timestamp}`,
      bullets,
      legend
    });
  }

  // Backfill endSeconds sequentially if not parsed explicitly
  for (let k = 0; k < parsed.length; k++) {
    if (parsed[k].endSeconds === undefined) {
      if (k < parsed.length - 1) {
        const nextStart = parsed[k + 1].seconds;
        if (nextStart > parsed[k].seconds) {
          const diff = nextStart - parsed[k].seconds;
          parsed[k].endSeconds = diff <= 120 ? nextStart : parsed[k].seconds + 45;
        } else {
          parsed[k].endSeconds = parsed[k].seconds + 45;
        }
      } else {
        parsed[k].endSeconds = parsed[k].seconds + 45;
      }
    }
  }

  return parsed;
}

function YoutubeCorsWarning({ selectedLanguage }: { selectedLanguage: string }) {
  const t = {
    es: {
      title: "Restricción de Captura de Fotogramas (CORS)",
      desc: "Debido a las políticas de seguridad del navegador (CORS) y al sandbox de YouTube, no es posible capturar capturas de pantalla del reproductor iframe de YouTube en tiempo real.",
      detail: "Sin embargo, puedes pulsar el botón 'Ir' para saltar directamente a este segundo exacto en el vídeo principal."
    },
    en: {
      title: "Frame Capture Restriction (CORS)",
      desc: "Due to browser security policies (CORS) and YouTube's iframe sandbox, capturing real-time screenshots from the YouTube player is not allowed.",
      detail: "However, you can click the 'Play' button to seek directly to this exact second in the main video player."
    },
    de: {
      title: "Einschränkung der Bilderfassung (CORS)",
      desc: "Aufgrund von Browsersicherheitsrichtlinien (CORS) und der Sandbox von YouTube ist das Erfassen von Screenshots aus dem YouTube-Player in Echtzeit nicht möglich.",
      detail: "Sie können jedoch auf die Schaltfläche 'Ansehen' klicken, um direkt zu dieser genauen Sekunde im Hauptvideo zu springen."
    },
    tr: {
      title: "Ekran Görüntüsü Yakalama Kısıtlaması (CORS)",
      desc: "Tarayıcı güvenlik politikaları (CORS) ve YouTube iframe sanal alanı nedeniyle, YouTube oynatıcısından gerçek zamanlı ekran görüntüsü yakalanamamaktadır.",
      detail: "Ancak, ana video oynatıcıda doğrudan bu saniyeye atlamak için 'Git' düğmesine tıklayabilirsiniz."
    }
  }[selectedLanguage as "es" | "en" | "de" | "tr"] || {
    title: "Frame Capture Restriction (CORS)",
    desc: "Due to browser security policies (CORS) and YouTube's iframe sandbox, capturing real-time screenshots from the YouTube player is not allowed.",
    detail: "However, you can click the 'Play' button to seek directly to this exact second in the main video player."
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-rose-950/25 border border-rose-900/40 rounded-xl aspect-[16/9] w-full text-center">
      <EyeOff className="w-8 h-8 text-rose-400 mb-3 animate-pulse" />
      <h4 className="text-xs font-black text-rose-200 tracking-wide uppercase mb-1">{t.title}</h4>
      <p className="text-[11px] text-rose-300/80 leading-relaxed max-w-[280px] mb-2">{t.desc}</p>
      <p className="text-[10px] text-zinc-500 font-medium leading-relaxed max-w-[260px]">{t.detail}</p>
    </div>
  );
}

function VideoFrameSnapshot({ src, targetTime }: { src: string; targetTime: number }) {
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    setSnapshotUrl(null);

    const video = document.createElement("video");
    video.src = src;
    video.crossOrigin = "anonymous";
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.currentTime = targetTime;
    videoRef.current = video;

    const handleSeeked = () => {
      if (!active) return;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 360;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
          if (active) {
            setSnapshotUrl(dataUrl);
            setLoading(false);
          }
        } else {
          throw new Error("Could not get 2d context");
        }
      } catch (err) {
        console.error("Error generating frame snapshot:", err);
        if (active) {
          setError(true);
          setLoading(false);
        }
      }
    };

    const handleError = () => {
      if (active) {
        setError(true);
        setLoading(false);
      }
    };

    video.addEventListener("seeked", handleSeeked);
    video.addEventListener("error", handleError);

    video.load();

    return () => {
      active = false;
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("error", handleError);
      video.src = "";
    };
  }, [src, targetTime]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-zinc-950 border border-zinc-900 rounded-xl aspect-[16/9] text-center w-full">
        <Loader2 className="w-6 h-6 text-emerald-400 animate-spin mb-2" />
        <span className="text-[10px] font-black tracking-wider text-zinc-500 uppercase">Generando Snapshot...</span>
      </div>
    );
  }

  if (error || !snapshotUrl) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-zinc-950 border border-zinc-900 rounded-xl aspect-[16/9] text-center w-full">
        <AlertTriangle className="w-6 h-6 text-zinc-600 mb-2" />
        <span className="text-[10px] font-black tracking-wider text-zinc-500 uppercase">Snapshot no disponible</span>
      </div>
    );
  }

  return (
    <div className="relative group rounded-xl overflow-hidden border border-zinc-900 shadow-lg aspect-[16/9] w-full bg-zinc-950">
      <img
        src={snapshotUrl}
        alt={`Snapshot at ${targetTime}s`}
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-350 flex items-end p-3">
        <span className="text-[9px] font-black tracking-wide text-white uppercase bg-zinc-900/95 px-2 py-1 rounded border border-zinc-850">
          Timestamp: {Math.floor(targetTime / 60)}:{(targetTime % 60).toString().padStart(2, "0")}
        </span>
      </div>
    </div>
  );
}

// Helper function to extract the 11-char YouTube ID from various URL formats
function getYoutubeId(url: string): string | null {
  if (!url) return null;
  const regexes = [
    /youtube\.com\/embed\/([a-zA-Z0-9_\-]{11})/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_\-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_\-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_\-]{11})/
  ];
  for (const regex of regexes) {
    const match = url.match(regex);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

function YouTubeSnapshotPlayer({
  ytId,
  targetTime,
  endSeconds,
  selectedLanguage,
  isPlaying,
  onEnded,
  onPlayingStateChange,
}: {
  ytId: string;
  targetTime: number;
  endSeconds?: number;
  selectedLanguage: string;
  isPlaying?: boolean;
  onEnded?: () => void;
  onPlayingStateChange?: (isPlaying: boolean) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isPausedAtTarget, setIsPausedAtTarget] = useState(false);
  const hasPaused = useRef(false);
  const hasEnded = useRef(false);

  // Send command to the YouTube iframe
  const sendPlayerCommand = useCallback((func: string, args: any[] = []) => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({
            event: "command",
            func: func,
            args: args,
          }),
          "*"
        );
      } catch (e) {
        console.error("Error sending postMessage to YouTube iframe:", e);
      }
    }
  }, []);

  // Send a listening ping to the YouTube iframe so it starts broadcasting events (essential for postMessage API)
  const sendListeningPing = useCallback(() => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({
            event: "listening",
            id: 1,
            channel: "widget"
          }),
          "*"
        );
      } catch (e) {
        console.error("Error sending listening ping to YouTube iframe:", e);
      }
    }
  }, []);

  const triggerEnd = useCallback(() => {
    hasEnded.current = true;
    sendPlayerCommand("pauseVideo");
    sendPlayerCommand("seekTo", [targetTime, true]);
    if (onEnded) {
      onEnded();
    }
  }, [sendPlayerCommand, targetTime, onEnded]);

  // Listen to messages from the YouTube iframe to detect when it starts playing
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Ensure the message is from YouTube
      if (!event.origin.includes("youtube.com")) return;
      if (!iframeRef.current || !iframeRef.current.contentWindow) return;
      if (event.source !== iframeRef.current.contentWindow) return;

      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data && (data.event === "onStateChange" || data.event === "infoDelivery")) {
          const stateVal = data.info?.playerState ?? data.info;
          const state = typeof stateVal === "number" ? stateVal : undefined;
          const currentTime = data.info?.currentTime;

          // Check if we reached the end limit based on currentTime
          if (typeof currentTime === "number" && endSeconds && currentTime >= endSeconds - 0.2) {
            triggerEnd();
            return;
          }

          // Boundary enforcement: if we are somehow way out of bounds, seek back to targetTime
          if (typeof currentTime === "number") {
            if (currentTime < targetTime - 1.5) {
              sendPlayerCommand("seekTo", [targetTime, true]);
              return;
            }
          }

          // State 1 is PLAYING
          if (state === 1) {
            if (hasEnded.current) {
              hasEnded.current = false;
              sendPlayerCommand("seekTo", [targetTime, true]);
              if (onPlayingStateChange) {
                onPlayingStateChange(true);
              }
              return;
            }

            if (!hasPaused.current) {
              hasPaused.current = true;
              if (!isPlaying) {
                // Immediately pause the video on the target frame
                sendPlayerCommand("pauseVideo");
                // Unmute so when the user manually plays, it has sound
                sendPlayerCommand("unMute");
                setIsPausedAtTarget(true);
              } else {
                // If we want it to keep playing, just unmute and mark ready
                sendPlayerCommand("unMute");
                setIsPausedAtTarget(true);
              }
            } else {
              // Subsequent play events: report to parent to synchronize play state
              if (!isPlaying && onPlayingStateChange) {
                onPlayingStateChange(true);
              }
            }
          }

          // State 2 is PAUSED
          if (state === 2) {
            if (isPlaying && onPlayingStateChange && hasPaused.current) {
              onPlayingStateChange(false);
            }
          }

          // State 0 is ENDED
          if (state === 0) {
            triggerEnd();
          }
        }
      } catch (e) {
        // Safe catch for non-JSON or unrelated messages
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [sendPlayerCommand, targetTime, endSeconds, isPlaying, triggerEnd, onPlayingStateChange]);

  // Robust fallback: if playing message is not captured within 3 seconds, force pause and unmute
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasPaused.current) {
        hasPaused.current = true;
        if (!isPlaying) {
          sendPlayerCommand("pauseVideo");
        }
        sendPlayerCommand("unMute");
        setIsPausedAtTarget(true);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [sendPlayerCommand, ytId, targetTime, isPlaying]);

  // Respond to isPlaying changes instantly (without waiting for isPausedAtTarget)
  useEffect(() => {
    if (isPlaying) {
      if (hasEnded.current) {
        sendPlayerCommand("seekTo", [targetTime, true]);
        hasEnded.current = false;
        // Wait 150ms before playing to avoid race condition of seek & play in YouTube player API
        const timer = setTimeout(() => {
          sendPlayerCommand("playVideo");
        }, 150);
        return () => clearTimeout(timer);
      } else {
        sendPlayerCommand("playVideo");
      }
    } else {
      sendPlayerCommand("pauseVideo");
    }
  }, [isPlaying, sendPlayerCommand, targetTime]);

  // Reset state if video or target time changes
  useEffect(() => {
    hasPaused.current = false;
    setIsPausedAtTarget(false);
    hasEnded.current = false;
  }, [ytId, targetTime, endSeconds]);

  // Ping the "listening" event to the iframe so it starts broadcasting playback info
  useEffect(() => {
    let pings = 0;
    // Send standard handshake ping immediately
    sendListeningPing();
    
    // Repeat periodic pings to cover iframe load latency
    const interval = setInterval(() => {
      sendListeningPing();
      pings++;
      if (pings >= 10) {
        clearInterval(interval);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [ytId, targetTime, endSeconds, sendListeningPing]);

  const originParam = typeof window !== "undefined" ? `&origin=${encodeURIComponent(window.location.origin)}` : "";
  const srcUrl = `https://www.youtube.com/embed/${ytId}?start=${targetTime}${endSeconds ? `&end=${Math.floor(endSeconds)}` : ""}&autoplay=1&mute=1&enablejsapi=1${originParam}&controls=1&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3`;

  const showLoader = !isPausedAtTarget && !isPlaying;

  return (
    <div className="relative group rounded-xl overflow-hidden border border-zinc-900 shadow-lg aspect-[16/9] w-full bg-zinc-950 hover:border-zinc-800 transition-all duration-300">
      <iframe
        ref={iframeRef}
        src={srcUrl}
        onLoad={sendListeningPing}
        title={`Snapshot at ${targetTime}s`}
        className="w-full h-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
      
      {showLoader && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 z-20 transition-opacity duration-300 pointer-events-none">
          <Loader2 className="w-6 h-6 text-emerald-400 animate-spin mb-2" />
          <span className="text-[10px] font-black tracking-wider text-zinc-500 uppercase">
            {selectedLanguage === "es" ? "Capturando fotograma..." : "Capturing frame..."}
          </span>
        </div>
      )}

      {/* Elegant active live preview badge */}
      <div className="absolute top-2 left-2 z-10 pointer-events-none">
        <span className="text-[8px] font-black tracking-wider text-emerald-400 bg-zinc-950/95 border border-emerald-500/20 px-2.5 py-1 rounded-full uppercase shadow-md flex items-center gap-1.5 backdrop-blur-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
          LIVE PREVIEW: {Math.floor(targetTime / 60)}:{(targetTime % 60).toString().padStart(2, "0")}
          {endSeconds && ` - ${Math.floor(endSeconds / 60)}:${(endSeconds % 60).toString().padStart(2, "0")}`}
        </span>
      </div>
    </div>
  );
}

function SmartVideoSnapshot({ 
  videoId, 
  fileUrl, 
  targetTime, 
  endSeconds,
  isYt, 
  selectedLanguage,
  isPlaying,
  onEnded,
  onPlayingStateChange,
}: { 
  videoId: string; 
  fileUrl: string; 
  targetTime: number; 
  endSeconds?: number;
  isYt: boolean; 
  selectedLanguage: string; 
  isPlaying?: boolean;
  onEnded?: () => void;
  onPlayingStateChange?: (isPlaying: boolean) => void;
}) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(isYt);
  const [hasBeenPlayed, setHasBeenPlayed] = useState(false);

  // Reset persistent player state if target frame or video ID changes
  useEffect(() => {
    setHasBeenPlayed(false);
  }, [videoId, targetTime]);

  // Activate player once the user starts playback
  useEffect(() => {
    if (isPlaying) {
      setHasBeenPlayed(true);
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!isYt) {
      setImgUrl(fileUrl);
      setLoading(false);
      return;
    }

    setError(false);
    setLoading(true);

    const testImg = new Image();
    const publicPath = `/snapshots/${videoId}/${targetTime}.jpg`;

    testImg.onload = () => {
      setImgUrl(publicPath);
      setLoading(false);
    };

    testImg.onerror = () => {
      setError(true);
      setLoading(false);
    };

    testImg.src = publicPath;
  }, [videoId, fileUrl, targetTime, isYt]);

  const loadingText = {
    es: "Cargando visualización...",
    en: "Loading visualization...",
    de: "Lade Visualisierung...",
    tr: "Görüntü yükleniyor..."
  }[selectedLanguage as "es" | "en" | "de" | "tr"] || "Loading visualization...";

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-zinc-950 border border-zinc-900 rounded-xl aspect-[16/9] text-center w-full">
        <Loader2 className="w-6 h-6 text-emerald-400 animate-spin mb-2" />
        <span className="text-[10px] font-black tracking-wider text-zinc-500 uppercase">{loadingText}</span>
      </div>
    );
  }

  // Render YouTubeSnapshotPlayer if it is a YT video and either isPlaying is true, hasBeenPlayed is true, or snapshot image errored (e.g. in production)
  const showPlayer = isYt && (isPlaying || hasBeenPlayed || error);

  if (showPlayer) {
    const ytId = getYoutubeId(fileUrl);
    if (ytId) {
      return (
        <YouTubeSnapshotPlayer
          ytId={ytId}
          targetTime={targetTime}
          endSeconds={endSeconds}
          selectedLanguage={selectedLanguage}
          isPlaying={isPlaying}
          onEnded={onEnded}
          onPlayingStateChange={onPlayingStateChange}
        />
      );
    }
    return <YoutubeCorsWarning selectedLanguage={selectedLanguage} />;
  }

  if (!isYt) {
    return <VideoFrameSnapshot src={fileUrl} targetTime={targetTime} />;
  }

  return (
    <div 
      onClick={() => {
        if (onPlayingStateChange) {
          onPlayingStateChange(true);
        }
      }}
      className="relative group rounded-xl overflow-hidden border border-zinc-900 hover:border-zinc-800 shadow-lg aspect-[16/9] w-full bg-zinc-950 cursor-pointer transition-all duration-300"
    >
      <img
        src={imgUrl || ""}
        alt={`Snapshot at ${targetTime}s`}
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-102"
      />
      {/* Premium glassmorphic play overlay */}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
        <div className="p-4 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 backdrop-blur-md transform scale-90 group-hover:scale-100 transition-all duration-300 shadow-lg">
          <Play className="w-6 h-6 fill-current" />
        </div>
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-350 flex items-end p-3">
        <span className="text-[9px] font-black tracking-wide text-white uppercase bg-zinc-900/95 px-2 py-1 rounded border border-zinc-850">
          Timestamp: {Math.floor(targetTime / 60)}:{(targetTime % 60).toString().padStart(2, "0")}
        </span>
      </div>
    </div>
  );
}

export default function VideosPage() {
  const [videos, setVideos] = useState<VideoDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Concurrency lock for sync process
  const isSyncingRef = useRef(false);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserEmail(user.email || null);
        }
      } catch (err) {
        console.error("Error fetching user session for admin button:", err);
      }
    };
    fetchUser();
  }, []);

  // Absolute, complete wipe/purge of video dg8y1s0d5ih and its knowledge from local Supabase / localStorage
  useEffect(() => {
    const purgeTargetVideo = async () => {
      console.log("[Wipe] Running absolute purge of video dg8y1s0d5ih and its associated knowledge...");
      
      try {
        const targetId = "dg8y1s0d5ih";
        const targetYtUrl1 = "https://www.youtube.com/watch?v=dg8y1s0d5ih";
        const targetYtUrl2 = "https://youtu.be/dg8y1s0d5ih";
        const targetYtUrl3 = "https://youtube.com/watch?v=dg8y1s0d5ih";
        const targetYtUrl4 = "https://www.youtube.com/embed/dg8y1s0d5ih";

        // 1. Delete matching documents from mockSupabase database / tables
        await supabase.from("documents").delete().eq("id", targetId);
        await supabase.from("documents").delete().eq("file_url", targetYtUrl1);
        await supabase.from("documents").delete().eq("file_url", targetYtUrl2);
        await supabase.from("documents").delete().eq("file_url", targetYtUrl3);
        await supabase.from("documents").delete().eq("file_url", targetYtUrl4);
        await supabase.from("documents").delete().eq("file_url", targetId);

        // 2. Clear all local storage keys containing the video ID or its cache
        if (typeof window !== "undefined") {
          localStorage.removeItem("hivex_global_trans_cache_dg8y1s0d5ih");
          
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.includes("dg8y1s0d5ih")) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach((k) => localStorage.removeItem(k));

          // Scan all document cache keys and filter them out
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key === "hivex_docs_global" || key.startsWith("hivex_docs_"))) {
              try {
                const dataStr = localStorage.getItem(key);
                if (dataStr) {
                  const parsed = JSON.parse(dataStr);
                  if (Array.isArray(parsed)) {
                    const filtered = parsed.filter((d: any) => {
                      const str = JSON.stringify(d).toLowerCase();
                      const fileUrl = d.file_url || "";
                      const matchesVideoId = d.id === targetId || fileUrl.includes(targetId);
                      return !matchesVideoId;
                    });
                    localStorage.setItem(key, JSON.stringify(filtered));
                  }
                }
              } catch (e) {
                console.warn("[Wipe] Error parsing key in purge:", key, e);
              }
            }
          }
        }

        // 3. Clear from react state
        setVideos((prevVideos) => prevVideos.filter((v) => v.id !== targetId && !v.file_url?.includes(targetId)));
        setSelectedVideo((prev) => (prev?.id === targetId || prev?.file_url?.includes(targetId)) ? null : prev);
        setActiveStudyVideo((prev) => (prev?.id === targetId || prev?.file_url?.includes(targetId)) ? null : prev);

        console.log("[Wipe] Absolute purge complete. Target video and all its associated knowledge have been deleted.");
      } catch (err) {
        console.error("[Wipe] Error during absolute purge:", err);
      }
    };

    purgeTargetVideo();
  }, []);

  // Active playing states
  const [selectedVideo, setSelectedVideo] = useState<VideoDocument | null>(null);
  const [activeStudyVideo, setActiveStudyVideo] = useState<VideoDocument | null>(null);
  const [playerTime, setPlayerTime] = useState<number | null>(null);
  const [playingChartIdx, setPlayingChartIdx] = useState<number | null>(null);

  // Reset playing chart index when active video changes
  useEffect(() => {
    setPlayingChartIdx(null);
  }, [activeStudyVideo]);
  const [transcriptionExpanded, setTranscriptionExpanded] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false); // Collapsed by default for a cleaner study desk
  const [chartsExpanded, setChartsExpanded] = useState(false);
  const [reportExpanded, setReportExpanded] = useState(false);
  const studyVideoRef = useRef<HTMLVideoElement | null>(null);

  // TTS Audio Narrador States
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isPausedAudio, setIsPausedAudio] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0); // Default to 1.0, options: 1.0, 1.5, 2.0
  const [activeSentenceIndex, setActiveSentenceIndex] = useState<number>(-1);
  const [totalSentences, setTotalSentences] = useState<number>(0);
  const [sentenceChunks, setSentenceChunks] = useState<string[]>([]);
  const [audioError, setAudioError] = useState<string | null>(null);

  // Voice selection states (premium Gemini voices)
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("gemini-charon");
  const selectedVoiceIdRef = useRef<string>("gemini-charon");
  useEffect(() => {
    selectedVoiceIdRef.current = selectedVoiceId;
  }, [selectedVoiceId]);

  // Audio queue references for playing
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeObjectUrlRef = useRef<string | null>(null);
  const prefetchedAudioRef = useRef<{ index: number; audio: HTMLAudioElement } | null>(null);

  const stopGeminiAudio = () => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current.onended = null;
      activeAudioRef.current.onerror = null;
      activeAudioRef.current.src = "";
      activeAudioRef.current = null;
    }
    if (prefetchedAudioRef.current) {
      prefetchedAudioRef.current.audio.pause();
      prefetchedAudioRef.current.audio.src = "";
      prefetchedAudioRef.current = null;
    }
    if (activeObjectUrlRef.current) {
      URL.revokeObjectURL(activeObjectUrlRef.current);
      activeObjectUrlRef.current = null;
    }
  };

  const getVoiceNameFromId = (id: string): string => {
    if (id === "gemini-aoede") return "Aoede";
    if (id === "gemini-puck") return "Puck";
    return "Charon"; // Default
  };

  const playGeminiSentence = (index: number) => {
    setAudioError(null); // Reset audio error on any new sentence attempt
    const chunks = sentenceChunksRef.current;
    if (index < 0 || index >= chunks.length) {
      setIsPlayingAudio(false);
      setIsPausedAudio(false);
      setActiveSentenceIndex(-1);
      activeSentenceIndexRef.current = -1;
      return;
    }

    // Stop active audio if any (but do NOT pause or delete the prefetch if it matches the current index)
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current.onended = null;
      activeAudioRef.current.onerror = null;
      activeAudioRef.current.src = "";
      activeAudioRef.current = null;
    }

    setIsPlayingAudio(true);
    setIsPausedAudio(false);
    setActiveSentenceIndex(index);
    activeSentenceIndexRef.current = index;

    let audio: HTMLAudioElement;

    // Use prefetched audio if it exists for this sentence to achieve instantaneous transition
    if (prefetchedAudioRef.current && prefetchedAudioRef.current.index === index) {
      console.log(`[Gemini Audio Queue] Using prefetched audio for sentence ${index}`);
      audio = prefetchedAudioRef.current.audio;
      prefetchedAudioRef.current = null; // Clear since it is now active
    } else {
      console.log(`[Gemini Audio Queue] No prefetch found for sentence ${index}, loading on-demand`);
      const voiceName = getVoiceNameFromId(selectedVoiceIdRef.current);
      const audioSrc = `/api/videos/speak?text=${encodeURIComponent(chunks[index])}&voice=${voiceName}`;
      audio = new Audio();
      audio.preload = "auto";
      audio.src = audioSrc;
    }

    activeAudioRef.current = audio;

    // Apply playback rate
    audio.playbackRate = playbackRateRef.current;

    // Setup events
    audio.onended = () => {
      if (!isPlayingAudioRef.current) return;
      
      const nextIdx = index + 1;
      if (nextIdx < chunks.length) {
        playGeminiSentence(nextIdx);
      } else {
        setIsPlayingAudio(false);
        setIsPausedAudio(false);
        setActiveSentenceIndex(-1);
        activeSentenceIndexRef.current = -1;
      }
    };

    audio.onerror = (e) => {
      console.error("[Gemini Audio Player Error] Failed to play audio URL:", index, e);
      setIsPlayingAudio(false);
      setIsPausedAudio(false);
      setAudioError(`Error al reproducir el fragmento de audio (Código ${audio.error?.code || 'desconocido'}).`);
    };

    // Play current sentence immediately
    audio.play().catch((playErr: any) => {
      if (playErr.name === "AbortError") {
        console.log("[Gemini Audio Player] Playback was aborted/paused for chunk:", index);
        return;
      }
      console.error("[Gemini Play Failure] Could not play audio:", playErr);
      if (playErr.name === "NotAllowedError") {
        setAudioError("El navegador bloqueó la reproducción automática. Por favor haga clic en el botón de reproducción.");
      } else {
        setAudioError(`Bloqueo de reproducción en el navegador: ${playErr.message || "Por favor haga clic de nuevo para interactuar."}`);
      }
      setIsPlayingAudio(false);
      setIsPausedAudio(false);
    });

    // Prefetch the NEXT sentences in the background to hide the Gemini API synthesis latency (especially at higher playback rates)
    // We prefetch a rolling window of 3 sentences ahead.
    const prefetchWindowSize = 3;
    for (let w = 1; w <= prefetchWindowSize; w++) {
      const nextIdx = index + w;
      if (nextIdx < chunks.length) {
        const voiceName = getVoiceNameFromId(selectedVoiceIdRef.current);
        const nextAudioSrc = `/api/videos/speak?text=${encodeURIComponent(chunks[nextIdx])}&voice=${voiceName}`;
        
        console.log(`[Gemini Audio Queue] Prefetching sentence ${nextIdx} (cushion +${w}) in background...`);
        
        // Warm up the browser's HTTP cache with a background fetch
        fetch(nextAudioSrc).catch(err => {
          console.warn("[Gemini Audio Prefetch Fetch Error]:", err);
        });

        // Store the immediate next sentence (w === 1) as the active preloaded Audio object
        if (w === 1) {
          const nextAudio = new Audio();
          nextAudio.preload = "auto";
          nextAudio.src = nextAudioSrc;
          nextAudio.load(); // Triggers the network request and buffers content
          prefetchedAudioRef.current = {
            index: nextIdx,
            audio: nextAudio
          };
        }
      }
    }
  };

  // Multilingual states
  const [selectedLanguage, setSelectedLanguage] = useState<string>("en"); // Default is English ("en")
  const [translationsCache, setTranslationsCache] = useState<Record<string, Record<string, {
    text: string;
    loading: boolean;
    error: string | null;
  }>>>({});
  const [translationProgress, setTranslationProgress] = useState<Record<string, Record<string, number>>>({});

  const t = translations[selectedLanguage]?.videos || translations["en"].videos;

  // Sync references to prevent stale closures in async browser events
  const isPlayingAudioRef = useRef(false);
  const isPausedAudioRef = useRef(false);
  const activeSentenceIndexRef = useRef<number>(-1);
  const playbackRateRef = useRef<number>(1.0);
  const sentenceChunksRef = useRef<string[]>([]);

  useEffect(() => {
    isPlayingAudioRef.current = isPlayingAudio;
  }, [isPlayingAudio]);

  useEffect(() => {
    isPausedAudioRef.current = isPausedAudio;
  }, [isPausedAudio]);

  useEffect(() => {
    activeSentenceIndexRef.current = activeSentenceIndex;
  }, [activeSentenceIndex]);

  useEffect(() => {
    playbackRateRef.current = playbackRate;
  }, [playbackRate]);

  // TTS playback tracking state and estimated duration calculations
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const chunkStarts = useMemo(() => {
    if (sentenceChunks.length === 0) return [];
    const starts: number[] = [];
    let current = 0;
    sentenceChunks.forEach(chunk => {
      starts.push(current);
      const wordCount = chunk.split(/\s+/).filter(Boolean).length;
      current += Math.max(1.5, wordCount / 2.5);
    });
    return starts;
  }, [sentenceChunks]);

  const totalDuration = useMemo(() => {
    if (sentenceChunks.length === 0) return 0;
    let total = 0;
    sentenceChunks.forEach(chunk => {
      const wordCount = chunk.split(/\s+/).filter(Boolean).length;
      total += Math.max(1.5, wordCount / 2.5);
    });
    return total;
  }, [sentenceChunks]);

  useEffect(() => {
    if (activeSentenceIndex >= 0 && chunkStarts[activeSentenceIndex] !== undefined) {
      setElapsedSeconds(chunkStarts[activeSentenceIndex]);
    } else if (activeSentenceIndex === -1) {
      setElapsedSeconds(0);
    }
  }, [activeSentenceIndex, chunkStarts]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlayingAudio && !isPausedAudio) {
      timer = setInterval(() => {
        setElapsedSeconds(prev => {
          if (prev < totalDuration) {
            return prev + 1;
          }
          return prev;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isPlayingAudio, isPausedAudio, totalDuration]);

  const formatElapsed = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `[${mins.toString().padStart(2, "0")}]:[${secs.toString().padStart(2, "0")}]`;
  };

  const formatTotal = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `[${mins.toString().padStart(2, "0")}]:[${secs.toString().padStart(2, "0")}]`;
  };

  // Controller for translation to active study video
  const translateContent = async (videoDoc: VideoDocument, langCode: string, originalText: string) => {
    if (!originalText || originalText.trim().length === 0) return;
    if (langCode === "en") return; // Original English content, no API translation needed

    // If already translating or has value, return to save quota
    const cached = translationsCache[videoDoc.id]?.[langCode];
    if (cached && (cached.loading || cached.text)) return;

    // Set loading state and progress in state
    setTranslationsCache(prev => {
      const videoCache = prev[videoDoc.id] || {};
      return {
        ...prev,
        [videoDoc.id]: {
          ...videoCache,
          [langCode]: {
            text: "",
            loading: true,
            error: null
          }
        }
      };
    });

    setTranslationProgress(prev => ({
      ...prev,
      [videoDoc.id]: {
        ...(prev[videoDoc.id] || {}),
        [langCode]: 0
      }
    }));

    // Start asymptotic exponential progress curve simulation
    const progressInterval = setInterval(() => {
      setTranslationProgress(prev => {
        const videoProg = prev[videoDoc.id] || {};
        const currentProg = videoProg[langCode] ?? 0;
        if (currentProg >= 95) {
          return prev;
        }
        // Asymptotically approach 95%
        const delta = Math.max(1, Math.floor((95 - currentProg) * 0.15));
        return {
          ...prev,
          [videoDoc.id]: {
            ...videoProg,
            [langCode]: currentProg + delta
          }
        };
      });
    }, 600);

    try {
      const targetLanguageName = {
        en: "English (US)",
        tr: "Turkish",
        de: "German",
        es: "Spanish"
      }[langCode] || "Spanish";

      const token = typeof window !== "undefined" ? localStorage.getItem("google_gcloud_token") : null;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      console.log(`[Traducción] Enviando petición a /api/videos/translate para idioma: ${targetLanguageName}`);
      const response = await fetch("/api/videos/translate", {
        method: "POST",
        headers,
        body: JSON.stringify({
          text: originalText,
          targetLanguage: targetLanguageName
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Translation failed with status: ${response.status}`);
      }

      if (data.success && data.translatedText) {
        console.log(`[Traducción] Traducido con éxito a ${targetLanguageName} usando ${data.modelUsed || "Gemini"}!`);
        clearInterval(progressInterval);

        setTranslationProgress(prev => ({
          ...prev,
          [videoDoc.id]: {
            ...(prev[videoDoc.id] || {}),
            [langCode]: 100
          }
        }));

        setTranslationsCache(prev => {
          const videoCache = prev[videoDoc.id] || {};
          return {
            ...prev,
            [videoDoc.id]: {
              ...videoCache,
              [langCode]: {
                text: data.translatedText,
                loading: false,
                error: null
              }
            }
          };
        });

        // PERSIST TRANSLATION IN SUPABASE (Base of Knowledge)
        try {
          const { data: list, error: fetchErr } = await supabase
            .from("documents")
            .select("metadata")
            .eq("id", videoDoc.id);

          if (!fetchErr && list && list.length > 0) {
            const currentMetadata = list[0].metadata || {};
            const currentTranslations = currentMetadata.translations || {};
            const updatedMetadata = {
              ...currentMetadata,
              translations: {
                ...currentTranslations,
                [langCode]: data.translatedText
              }
            };

            const { error: updateError } = await supabase
              .from("documents")
              .update({ metadata: updatedMetadata })
              .eq("id", videoDoc.id);

            if (updateError) {
              console.warn(`[Traducción] Error al persistir traducción en Supabase para ${videoDoc.title}:`, updateError);
            } else {
              console.log(`[Traducción] Traducción a ${langCode} persistida en Supabase con éxito para: ${videoDoc.title}!`);
            }
          }
        } catch (dbErr) {
          console.error(`[Traducción] Error en base de datos al persistir traducción:`, dbErr);
        }
      } else {
        throw new Error(data.error || "Respuesta vacía del servidor de traducción");
      }
    } catch (err: any) {
      console.error(`[Traducción] Error traduciendo video ${videoDoc.id} a ${langCode}:`, err);
      const errMsg = err.message || "Error al traducir";
      clearInterval(progressInterval);

      setTranslationProgress(prev => ({
        ...prev,
        [videoDoc.id]: {
          ...(prev[videoDoc.id] || {}),
          [langCode]: 0
        }
      }));

      setTranslationsCache(prev => {
        const videoCache = prev[videoDoc.id] || {};
        return {
          ...prev,
          [videoDoc.id]: {
            ...videoCache,
            [langCode]: {
              text: "",
              loading: false,
              error: errMsg
            }
          }
        };
      });
    }
  };

  // Stop Gemini audio when active video changes or component unmounts
  useEffect(() => {
    return () => {
      stopGeminiAudio();
    };
  }, [activeStudyVideo]);

  const startAudioSummary = () => {
    const chunks = sentenceChunksRef.current;
    if (chunks.length === 0) return;

    // Stop any active audio
    stopGeminiAudio();
    setAudioError(null); // Clean any previous error

    setIsPlayingAudio(true);
    setIsPausedAudio(false);

    const startIdx = activeSentenceIndexRef.current >= 0 && activeSentenceIndexRef.current < chunks.length
      ? activeSentenceIndexRef.current
      : 0;

    setActiveSentenceIndex(startIdx);
    activeSentenceIndexRef.current = startIdx;

    playGeminiSentence(startIdx);
  };

  const pauseAudio = () => {
    setIsPausedAudio(true);
    isPausedAudioRef.current = true;

    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
    }
  };

  const resumeAudio = () => {
    setIsPausedAudio(false);
    isPausedAudioRef.current = false;

    if (activeAudioRef.current) {
      activeAudioRef.current.play().catch((err) => {
        console.error("Failed to resume audio:", err);
      });
    } else {
      playGeminiSentence(activeSentenceIndexRef.current >= 0 ? activeSentenceIndexRef.current : 0);
    }
  };

  const stopAudio = () => {
    // Stop any active audio
    stopGeminiAudio();
    setAudioError(null); // Clean any previous error

    setIsPlayingAudio(false);
    setIsPausedAudio(false);
    setActiveSentenceIndex(-1);
    activeSentenceIndexRef.current = -1;
  };

  const handleSeek = (index: number) => {
    const chunks = sentenceChunksRef.current;
    if (chunks.length === 0) return;

    const targetIdx = Math.max(0, Math.min(index, chunks.length - 1));
    setActiveSentenceIndex(targetIdx);
    activeSentenceIndexRef.current = targetIdx;

    if (isPlayingAudioRef.current && !isPausedAudioRef.current) {
      playGeminiSentence(targetIdx);
    }
  };

  const handleRateChange = (newRate: number, immediateRestart = true) => {
    setPlaybackRate(newRate);
    playbackRateRef.current = newRate;

    if (activeAudioRef.current) {
      activeAudioRef.current.playbackRate = newRate;
    }
  };

  const handleVoiceIdChange = (voiceId: string) => {
    setSelectedVoiceId(voiceId);
    selectedVoiceIdRef.current = voiceId;

    // Clear any active prefetch since the voice has changed!
    if (prefetchedAudioRef.current) {
      prefetchedAudioRef.current.audio.pause();
      prefetchedAudioRef.current.audio.src = "";
      prefetchedAudioRef.current = null;
    }

    // Pre-warm the first three sentences for the new voice!
    const chunks = sentenceChunksRef.current;
    const voiceName = getVoiceNameFromId(voiceId);
    if (chunks.length > 0) {
      const src0 = `/api/videos/speak?text=${encodeURIComponent(chunks[0])}&voice=${voiceName}`;
      fetch(src0).catch(() => {});
    }
    if (chunks.length > 1) {
      const src1 = `/api/videos/speak?text=${encodeURIComponent(chunks[1])}&voice=${voiceName}`;
      fetch(src1).catch(() => {});
    }
    if (chunks.length > 2) {
      const src2 = `/api/videos/speak?text=${encodeURIComponent(chunks[2])}&voice=${voiceName}`;
      fetch(src2).catch(() => {});
    }

    // If already playing and not paused, apply change immediately
    if (isPlayingAudioRef.current && !isPausedAudioRef.current) {
      playGeminiSentence(activeSentenceIndexRef.current >= 0 ? activeSentenceIndexRef.current : 0);
    }
  };

  // Concurrency tracker to ensure a video transcription is triggered ONLY once
  const transcribingVideoIdsRef = useRef<Set<string>>(new Set());

  // Track the progress and status of active/background transcriptions
  const [transcriptionStates, setTranscriptionStates] = useState<Record<string, {
    progress: number;
    transcribing: boolean;
    text?: string;
    model?: string | null;
    error?: string | null;
  }>>({});

  // Synchronize language state reactively using custom window events
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("hivex_selected_language") || "en";
      setSelectedLanguage(saved);
    }

    const handleLangChangedEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && typeof customEvent.detail === "string") {
        setSelectedLanguage(customEvent.detail);
        stopAudio();
      }
    };

    window.addEventListener("languageChanged", handleLangChangedEvent);
    return () => {
      window.removeEventListener("languageChanged", handleLangChangedEvent);
    };
  }, []);

  // Pre-populate audio chunks and total sentences whenever the study video, selected language, or its transcription text changes
  useEffect(() => {
    setAudioError(null); // Reset audio error state when content changes

    if (!activeStudyVideo) {
      sentenceChunksRef.current = [];
      setSentenceChunks([]);
      setTotalSentences(0);
      setActiveSentenceIndex(-1);
      return;
    }

    const activeState = transcriptionStates[activeStudyVideo.id];
    const originalText = activeStudyVideo.metadata?.transcription || activeState?.text || "";

    let textToUse = originalText;
    if (selectedLanguage !== "en") {
      const cached = translationsCache[activeStudyVideo.id]?.[selectedLanguage];
      if (cached && cached.text) {
        textToUse = cached.text;
      } else {
        textToUse = ""; // Don't prepare chunks yet while translation is in progress
      }
    }

    const { summary, transcription } = splitTranscription(textToUse);
    const textForSpeech = summary || transcription || textToUse;

    if (textForSpeech) {
      const cleanedText = cleanSummaryForSpeech(textForSpeech);
      const chunks = chunkTextForSpeech(cleanedText);
      sentenceChunksRef.current = chunks;
      setSentenceChunks(chunks);
      setTotalSentences(chunks.length);

      // Pre-warm the first three sentences to make the very first Play click instant!
      const voiceName = getVoiceNameFromId(selectedVoiceIdRef.current);
      if (chunks.length > 0) {
        const src0 = `/api/videos/speak?text=${encodeURIComponent(chunks[0])}&voice=${voiceName}`;
        fetch(src0).catch(() => {});
      }
      if (chunks.length > 1) {
        const src1 = `/api/videos/speak?text=${encodeURIComponent(chunks[1])}&voice=${voiceName}`;
        fetch(src1).catch(() => {});
      }
      if (chunks.length > 2) {
        const src2 = `/api/videos/speak?text=${encodeURIComponent(chunks[2])}&voice=${voiceName}`;
        fetch(src2).catch(() => {});
      }
    } else {
      sentenceChunksRef.current = [];
      setSentenceChunks([]);
      setTotalSentences(0);
    }
    setActiveSentenceIndex(-1);
  }, [activeStudyVideo, selectedLanguage, transcriptionStates, translationsCache]);

  // Trigger translation automatically when video, selected language, or original transcription changes
  useEffect(() => {
    if (!activeStudyVideo) return;

    const activeState = transcriptionStates[activeStudyVideo.id];
    const originalText = activeStudyVideo.metadata?.transcription || activeState?.text || "";

    if (originalText && selectedLanguage !== "en") {
      translateContent(activeStudyVideo, selectedLanguage, originalText);
    }
  }, [activeStudyVideo, selectedLanguage, transcriptionStates]);

  // Pre-translate all catalog videos to the selected language in the background on load or language change
  useEffect(() => {
    if (selectedLanguage === "en" || videos.length === 0) return;

    videos.forEach((v) => {
      const activeState = transcriptionStates[v.id];
      const originalText = v.metadata?.transcription || activeState?.text || "";
      if (originalText && !originalText.trim().startsWith("{") && !activeState?.transcribing) {
        translateContent(v, selectedLanguage, originalText);
      }
    });
  }, [videos, selectedLanguage, transcriptionStates]);

  // Asynchronous background transcription runner for smart automatic sync transcribing
  const triggerBackgroundTranscription = useCallback(async (videoDoc: VideoDocument) => {
    if (videoDoc.metadata?.transcription) {
      console.log(`[Asíncrono] El vídeo ya tiene transcripción en BBDD: ${videoDoc.title}. Asegurando presencia en base de conocimiento y disparando extracción de snapshots...`);
      saveVideoKnowledgeBase(videoDoc, videoDoc.metadata.transcription);
      
      // Lanzar petición silenciosa al backend para asegurar la extracción de snapshots
      fetch("/api/videos/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId: videoDoc.id,
          fileUrl: videoDoc.file_url,
          title: videoDoc.title,
          duration: videoDoc.metadata?.duration || "12:00",
          transcription: videoDoc.metadata.transcription
        })
      }).catch(err => console.warn("[Asíncrono] Error al disparar extracción silenciosa de snapshots:", err));

      return;
    }
    if (transcribingVideoIdsRef.current.has(videoDoc.id)) {
      console.log(`[Asíncrono] Transcripción ya en curso en segundo plano para: ${videoDoc.title}`);
      return;
    }

    // Comprobar la caché global persistente antes de lanzar la simulación de carga o la petición de red
    if (typeof window !== "undefined") {
      const cacheKey = getGlobalCacheKey({ id: videoDoc.id, file_url: videoDoc.file_url });
      const cachedDataStr = localStorage.getItem(cacheKey);
      if (cachedDataStr) {
        try {
          const cached = JSON.parse(cachedDataStr);
          if (cached && cached.transcription) {
            console.log(`[Caché Global] Recuperando transcripción instantánea desde localStorage para: ${videoDoc.title}`);
            const transcriptionText = cached.transcription;
            const modelUsed = cached.modelUsed || "Google Vertex AI Gemini 1.5 Pro";

            // Asegurar la presencia en la base de conocimiento persistente
            saveVideoKnowledgeBase(videoDoc, transcriptionText);

            // Lanzar petición silenciosa al backend para asegurar la extracción de snapshots
            fetch("/api/videos/transcribe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                videoId: videoDoc.id,
                fileUrl: videoDoc.file_url,
                title: videoDoc.title,
                duration: videoDoc.metadata?.duration || "12:00",
                transcription: transcriptionText
              })
            }).catch(err => console.warn("[Asíncrono] Error al disparar extracción silenciosa de snapshots desde caché:", err));

            // Sincronizar de forma silenciosa la base de datos Supabase del usuario actual para asociarlo de forma nativa
            const updatedMetadata = {
              ...videoDoc.metadata,
              transcription: transcriptionText,
              transcription_model: modelUsed
            };

            // Ejecutar la actualización en Supabase de forma no bloqueante
            supabase
              .from("documents")
              .update({ metadata: updatedMetadata })
              .eq("id", videoDoc.id)
              .then(({ error: updateError }) => {
                if (updateError) {
                  console.warn(`[Asíncrono] Error al vincular transcripción de caché en Supabase para ${videoDoc.title}:`, updateError);
                } else {
                  console.log(`[Asíncrono] Transcripción vinculada exitosamente en Supabase para: ${videoDoc.title}`);
                }
              });

            // Establecer el estado como completado directamente al 100%
            setTranscriptionStates((prev) => ({
              ...prev,
              [videoDoc.id]: {
                progress: 100,
                transcribing: false,
                text: transcriptionText,
                model: modelUsed,
                error: null
              }
            }));

            setVideos((prevVideos) =>
              prevVideos.map((v) =>
                v.id === videoDoc.id
                  ? {
                      ...v,
                      metadata: {
                        ...v.metadata,
                        transcription: transcriptionText,
                        transcription_model: modelUsed
                      }
                    }
                  : v
              )
            );

            setSelectedVideo((prev) => {
              if (prev && prev.id === videoDoc.id) {
                return {
                  ...prev,
                  metadata: {
                    ...prev.metadata,
                    transcription: transcriptionText,
                    transcription_model: modelUsed
                  }
                };
              }
              return prev;
            });

            setActiveStudyVideo((prev) => {
              if (prev && prev.id === videoDoc.id) {
                return {
                  ...prev,
                  metadata: {
                    ...prev.metadata,
                    transcription: transcriptionText,
                    transcription_model: modelUsed
                  }
                };
              }
              return prev;
            });

            return;
          }
        } catch (err) {
          console.warn("[Caché Global] Error al parsear caché local en triggerBackgroundTranscription:", err);
        }
      }
    }

    // Lock the transcription
    transcribingVideoIdsRef.current.add(videoDoc.id);

    // Initialize progress state
    setTranscriptionStates((prev) => ({
      ...prev,
      [videoDoc.id]: {
        progress: 0,
        transcribing: true,
        text: "",
        model: null,
        error: null
      }
    }));

    // Start asymptotic exponential progress curve simulation
    const startTime = Date.now();
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const currentProg = Math.min(98, Math.floor(98 * (1 - Math.exp(-elapsed / 20000))));

      setTranscriptionStates((prev) => {
        const existing = prev[videoDoc.id];
        if (!existing || !existing.transcribing) {
          clearInterval(progressInterval);
          return prev;
        }
        return {
          ...prev,
          [videoDoc.id]: {
            ...existing,
            progress: currentProg
          }
        };
      });
    }, 150);

    try {
      console.log(`[Asíncrono] Solicitando API de transcripción para: ${videoDoc.title}`);
      const token = typeof window !== "undefined" ? localStorage.getItem("google_gcloud_token") : null;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch("/api/videos/transcribe", {
        method: "POST",
        headers,
        body: JSON.stringify({
          videoId: videoDoc.id,
          fileUrl: videoDoc.file_url,
          title: videoDoc.title,
          description: videoDoc.description || "",
          duration: videoDoc.metadata?.duration || "12:00",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to transcribe video in background. Status: ${response.status}`);
      }

      if (data.success && data.transcription) {
        // Guardar en la caché global de localStorage antes de persistir en BBDD
        if (typeof window !== "undefined") {
          const cacheKey = getGlobalCacheKey({ id: videoDoc.id, file_url: videoDoc.file_url });
          localStorage.setItem(cacheKey, JSON.stringify({
            transcription: data.transcription,
            modelUsed: data.modelUsed || "Google Vertex AI Gemini 1.5 Pro"
          }));
          console.log(`[Caché Global] Guardada exitosamente en localStorage para: ${videoDoc.title}`);
        }

        console.log(`[Asíncrono] Guardando caché en Supabase para: ${videoDoc.title}...`);
        const updatedMetadata = {
          ...videoDoc.metadata,
          transcription: data.transcription,
          transcription_model: data.modelUsed || "Google Vertex AI Gemini 1.5 Pro"
        };

        const { error: updateError } = await supabase
          .from("documents")
          .update({ metadata: updatedMetadata })
          .eq("id", videoDoc.id);

        if (updateError) {
          console.warn(`[Asíncrono] Error al guardar caché en Supabase para ${videoDoc.title}:`, updateError);
        } else {
          console.log(`[Asíncrono] Transcripción guardada y cacheada en BBDD con éxito para: ${videoDoc.title}!`);
        }

        // Persistir los metadatos en la base de conocimiento duradera de forma asíncrona
        saveVideoKnowledgeBase(videoDoc, data.transcription);

        // Stop progress and set success
        clearInterval(progressInterval);
        
        setTranscriptionStates((prev) => ({
          ...prev,
          [videoDoc.id]: {
            progress: 100,
            transcribing: false,
            text: data.transcription,
            model: data.modelUsed || "Google Vertex AI Gemini 1.5 Pro",
            error: null
          }
        }));

        setVideos((prevVideos) =>
          prevVideos.map((v) =>
            v.id === videoDoc.id
              ? {
                  ...v,
                  metadata: {
                    ...v.metadata,
                    transcription: data.transcription,
                    transcription_model: data.modelUsed || "Google Vertex AI Gemini 1.5 Pro"
                  }
                }
              : v
          )
        );

        // Sync currently opened videos if applicable
        setSelectedVideo((prev) => {
          if (prev && prev.id === videoDoc.id) {
            return {
              ...prev,
              metadata: {
                ...prev.metadata,
                transcription: data.transcription,
                transcription_model: data.modelUsed || "Google Vertex AI Gemini 1.5 Pro"
              }
            };
          }
          return prev;
        });

        setActiveStudyVideo((prev) => {
          if (prev && prev.id === videoDoc.id) {
            return {
              ...prev,
              metadata: {
                ...prev.metadata,
                transcription: data.transcription,
                transcription_model: data.modelUsed || "Google Vertex AI Gemini 1.5 Pro"
              }
            };
          }
          return prev;
        });
      } else {
        throw new Error(data.error || "Respuesta de transcripción inválida.");
      }
    } catch (err: any) {
      console.error(`[Asíncrono] Error durante la transcripción de segundo plano para ${videoDoc.title}:`, err);
      clearInterval(progressInterval);

      const errMsg = err instanceof Error ? err.message : "Error de comunicación con el backend.";

      setTranscriptionStates((prev) => ({
        ...prev,
        [videoDoc.id]: {
          progress: 0,
          transcribing: false,
          text: "",
          model: null,
          error: errMsg
        }
      }));
    } finally {
      clearInterval(progressInterval);
      transcribingVideoIdsRef.current.delete(videoDoc.id);
    }
  }, []);

  // Monitor active study cabin video and trigger background transcription ONLY if needed
  // DESACTIVADO: La sincronización ya no se relanza automáticamente al entrar a la cabina de estudio para evitar solicitudes innecesarias.
  // Solo se inicia mediante un botón manual de análisis o vía cron job en segundo plano.
  /*
  useEffect(() => {
    let active = true;

    const run = async () => {
      // Defer state update to satisfy strict ESLint rules
      await Promise.resolve();
      if (!active) return;
      if (!activeStudyVideo) return;

      // If already has cached transcription in the document, use it instantly (0ms delay)
      if (activeStudyVideo.metadata?.transcription) {
        return;
      }

      // If already in progress, we simply let the cabin UI map itself to its active state progress
      if (transcribingVideoIdsRef.current.has(activeStudyVideo.id)) {
        return;
      }

      // Trigger background transcription (will run asynchronously and write back once complete)
      triggerBackgroundTranscription(activeStudyVideo);
    };

    run();

    return () => {
      active = false;
    };
  }, [activeStudyVideo, triggerBackgroundTranscription]);
  */

  const searchParams = useSearchParams();
  const filterChannel = searchParams.get("channel");
  const filterFavorite = searchParams.get("favorite") === "true";
  const videoIdParam = searchParams.get("id") || searchParams.get("video");

  // Handle URL deep-linking for specific video inside study cabin
  useEffect(() => {
    if (videoIdParam && videos.length > 0) {
      const matched = videos.find(
        (v) =>
          v.id === videoIdParam ||
          v.file_url?.includes(videoIdParam)
      );
      if (matched) {
        console.log(`[Deep Link] Direct URL deep-link matched video: ${matched.title}. Setting as active study video.`);
        setActiveStudyVideo(matched);
      } else {
        console.warn(`[Deep Link] Video with ID/URL-snippet "${videoIdParam}" not found in videos list.`);
      }
    }
  }, [videos, videoIdParam]);

  const filteredVideos = videos.filter((v: VideoDocument) => {
    const ch = v.metadata?.channel_title || "";
    const title = v.title || "";
    const description = v.description || "";

    // Strictly exclude contaminated Judging Freedom videos that are actually Andrei Jikh videos
    const isLabeledAsFreedom = isFreedomChannel(ch);
    const hasAndreiContent = title.toLowerCase().includes("andrei") || 
                             title.toLowerCase().includes("jikh") ||
                             title.toLowerCase().includes("dividend") ||
                             title.toLowerCase().includes("gold system") ||
                             title.toLowerCase().includes("webull") ||
                             title.toLowerCase().includes("interest rate") ||
                             title.toLowerCase().includes("hysa") ||
                             title.toLowerCase().includes("portfolio") ||
                             title.toLowerCase().includes("the fed") ||
                             title.toLowerCase().includes("stock market") ||
                             description.toLowerCase().includes("andrei") ||
                             description.toLowerCase().includes("jikh") ||
                             description.toLowerCase().includes("funvest") ||
                             description.toLowerCase().includes("webull") ||
                             description.toLowerCase().includes("hysa") ||
                             description.toLowerCase().includes("seekingalpha") ||
                             description.toLowerCase().includes("seeking alpha") ||
                             description.toLowerCase().includes("dividend") ||
                             description.toLowerCase().includes("portfolio") ||
                             description.toLowerCase().includes("savings account") ||
                             v.id.startsWith("yt-video-fed-") ||
                             v.id.startsWith("yt-video-market-") ||
                             v.id.startsWith("yt-video-btc-");
    
    if (isLabeledAsFreedom && hasAndreiContent) {
      return false;
    }

    // Safety check: Filter out Andrei Jikh older videos (before 2026-06-24) to be absolutely safe
    const isAndrei = (ch === "" || 
                     ch === "Andrei Jikh" || 
                     ch.toLowerCase().includes("andrei") || 
                     title.toLowerCase().includes("andrei") || 
                     v.id.startsWith("yt-video-")) &&
                     !isFreedomChannel(ch) &&
                     !isFreedomChannel(title);
    
    if (isAndrei) {
      const dateVal = Date.parse(v.created_at);
      const cutoffVal = Date.parse("2026-06-24T00:00:00Z");
      const isBeforeCutoff = v.created_at.includes("2026-06-22") || 
                             (!isNaN(dateVal) && dateVal < cutoffVal);
      if (isBeforeCutoff) {
        return false;
      }
    }

    if (filterFavorite) {
      return Boolean(v.metadata?.is_favorite);
    }

    const rawCh = v.metadata?.channel_title || "Andrei Jikh";
    const finalCh = rawCh.replace(/\s*\(Mock\s+Feed\)/i, "").trim();
    
    const currentFilter = filterChannel || "Andrei Jikh";

    if (isFreedomChannel(currentFilter)) {
      return isFreedomChannel(finalCh);
    }

    return finalCh.toLowerCase() === currentFilter.toLowerCase();
  });

  // Sort favorites first by channel alphabetically ascending, and then by age descending (most recent first)
  if (filterFavorite) {
    filteredVideos.sort((a, b) => {
      const chanA = (a.metadata?.channel_title || "Andrei Jikh").toLowerCase().trim();
      const chanB = (b.metadata?.channel_title || "Andrei Jikh").toLowerCase().trim();
      if (chanA !== chanB) {
        return chanA.localeCompare(chanB);
      }
      const timeA = Date.parse(a.created_at) || 0;
      const timeB = Date.parse(b.created_at) || 0;
      return timeB - timeA;
    });
  }

  // Refs to track previous channel and favorite filters to detect feed switches
  const prevFilterChannelRef = useRef<string | null>(null);
  const prevFilterFavoriteRef = useRef<boolean>(false);

  // Automatically select the first video of the feed when changing channels/favorites, or on initial load
  useEffect(() => {
    const channelChanged = prevFilterChannelRef.current !== filterChannel;
    const favoriteChanged = prevFilterFavoriteRef.current !== filterFavorite;

    if (!loading) {
      const shouldForceFirstVideo = channelChanged || favoriteChanged || !selectedVideo;
      
      if (shouldForceFirstVideo) {
        setActiveStudyVideo(null);
        if (filteredVideos && filteredVideos.length > 0) {
          setSelectedVideo(filteredVideos[0]);
        } else {
          setSelectedVideo(null);
        }
      }
      
      // Update refs to the current values
      prevFilterChannelRef.current = filterChannel;
      prevFilterFavoriteRef.current = filterFavorite;
    }
  }, [filterChannel, filterFavorite, loading, selectedVideo, filteredVideos.length]);


  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [resolution, setResolution] = useState("1080p");
  const [duration, setDuration] = useState("12:00");
  const [fileUrl, setFileUrl] = useState("");
  const [thumbnail, setThumbnail] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  // HTML5 Video element reference
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Check videos older than 7 days daemon
  const checkOldVideos = useCallback(async (loadedVideos: VideoDocument[]) => {
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const toUpdate: VideoDocument[] = [];

    const updatedVideos = loadedVideos.map(v => {
      const createdAtMs = Date.parse(v.created_at);
      const isOld = (now - createdAtMs) > SEVEN_DAYS_MS;
      if (isOld && !v.metadata?.is_old) {
        toUpdate.push(v);
        return {
          ...v,
          metadata: {
            ...v.metadata,
            is_old: true
          }
        };
      }
      return v;
    });

    if (toUpdate.length > 0) {
      // Update state immediately
      setVideos(prev => prev.map(v => {
        const found = updatedVideos.find(uv => uv.id === v.id);
        return found ? found : v;
      }));

      // Update Supabase for each old video found
      for (const video of toUpdate) {
        try {
          const { data: list, error } = await supabase
            .from("documents")
            .select("metadata")
            .eq("id", video.id);

          if (error) throw error;
          const data = list && list.length > 0 ? list[0] : null;

          const updatedMetadata = {
            ...(data?.metadata || {}),
            is_old: true
          };

          const { error: updateError } = await supabase
            .from("documents")
            .update({ metadata: updatedMetadata })
            .eq("id", video.id);

          if (updateError) throw updateError;
          console.log(`[Daemon] Video marked as old in Supabase: ${video.title}`);
        } catch (err) {
          console.error(`[Daemon] Error marking video ${video.id} as old:`, err);
        }
      }
    }
  }, []);

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("type", "video");
      if (error) throw error;
      
      if (data) {
        // Map generic documents to typed VideoDocuments
        const typedData: VideoDocument[] = (data as {
          id: string;
          title: string;
          description?: string;
          file_url?: string;
          created_at: string;
          metadata?: Record<string, unknown>;
        }[]).map((doc) => {
          let trans = doc.metadata?.transcription ? String(doc.metadata.transcription) : undefined;
          let model = doc.metadata?.transcription_model ? String(doc.metadata.transcription_model) : undefined;

          // Si falta en base de datos local, intentar recuperar desde la caché global persistente
          if (!trans && typeof window !== "undefined") {
            const cacheKey = getGlobalCacheKey({ id: doc.id, file_url: doc.file_url });
            const cachedDataStr = localStorage.getItem(cacheKey);
            if (cachedDataStr) {
              try {
                const cached = JSON.parse(cachedDataStr);
                if (cached && cached.transcription) {
                  trans = cached.transcription;
                  model = cached.modelUsed || "Google Vertex AI Gemini 1.5 Pro";
                  console.log(`[Caché Global] Población inmediata en fetchVideos para: ${doc.title}`);
                }
              } catch (e) {
                console.warn("[Caché Global] Error al parsear caché local:", e);
              }
            }
          }

          const rawDesc = doc.description || "";
          let cleanedDesc = rawDesc;
          const markers = [
            "### 📊 ANÁLISIS DE INVERSIÓN HIVEX",
            "### 📊 ANÁLISIS DE INVERSIÓN",
            "ANÁLISIS DE INVERSIÓN HIVEX",
            "Este informe ejecutivo sintetiza los factores críticos comentados por Andrei Jikh",
            "Este informe ejecutivo sintetiza los factores críticos",
            "Este informe ejecutivo sintetiza",
            "Análisis automatizado por HIVEX Engine",
            "### 💼 Investment Analysis Report",
            "### Investment Analysis Report",
            "💼 Investment Analysis Report",
            "### 📝 Detailed Content Summary",
            "### Detailed Content Summary",
            "### 📈 Macroeconomic Trends",
            "Análisis de Inversión Inicial Simulado"
          ];
          for (const marker of markers) {
            const idx = cleanedDesc.indexOf(marker);
            if (idx !== -1) {
              cleanedDesc = cleanedDesc.substring(0, idx).trim();
            }
          }
          cleanedDesc = cleanedDesc.trim();
          if (!cleanedDesc) {
            cleanedDesc = doc.id.startsWith("yt-") || doc.id.includes("youtube") || doc.file_url?.includes("youtube")
              ? `YouTube video from ${doc.metadata?.channel_title || "Andrei Jikh"}: "${doc.title}".`
              : doc.description || "";
          }

          return {
            id: doc.id,
            title: doc.title,
            description: cleanedDesc,
            file_url: doc.file_url || "",
            created_at: doc.created_at,
            metadata: {
              duration: String(doc.metadata?.duration || "1:00"),
              resolution: String(doc.metadata?.resolution || "1080p"),
              thumbnail: String(doc.metadata?.thumbnail || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80"),
              is_youtube: Boolean(doc.metadata?.is_youtube),
              channel_title: String(doc.metadata?.channel_title || (doc.id.startsWith("video-") ? "HIVEX Demo" : "")),
              transcription: trans,
              transcription_model: model,
              is_favorite: Boolean(doc.metadata?.is_favorite),
              is_old: Boolean(doc.metadata?.is_old),
              translations: doc.metadata?.translations as Record<string, string> | undefined
            }
          };
        });

        // Dynamic Date Pruner for Andrei Jikh's older videos (pre-June 24, 2026)
        // AND Contamination Pruner for Judging Freedom videos that are actually Andrei Jikh videos
        const prunedData = typedData.filter((video) => {
          const ch = video.metadata?.channel_title || "";
          const title = video.title || "";
          const description = video.description || "";
          
          // 1. Contamination check for Judging Freedom
          const isLabeledAsFreedom = isFreedomChannel(ch);
          const hasAndreiContent = title.toLowerCase().includes("andrei") || 
                                   title.toLowerCase().includes("jikh") ||
                                   title.toLowerCase().includes("dividend") ||
                                   title.toLowerCase().includes("gold system") ||
                                   title.toLowerCase().includes("webull") ||
                                   title.toLowerCase().includes("interest rate") ||
                                   title.toLowerCase().includes("hysa") ||
                                   title.toLowerCase().includes("portfolio") ||
                                   title.toLowerCase().includes("the fed") ||
                                   title.toLowerCase().includes("stock market") ||
                                   description.toLowerCase().includes("andrei") ||
                                   description.toLowerCase().includes("jikh") ||
                                   description.toLowerCase().includes("funvest") ||
                                   description.toLowerCase().includes("webull") ||
                                   description.toLowerCase().includes("hysa") ||
                                   description.toLowerCase().includes("seekingalpha") ||
                                   description.toLowerCase().includes("seeking alpha") ||
                                   description.toLowerCase().includes("dividend") ||
                                   description.toLowerCase().includes("portfolio") ||
                                   description.toLowerCase().includes("savings account") ||
                                   video.id.startsWith("yt-video-fed-") ||
                                   video.id.startsWith("yt-video-market-") ||
                                   video.id.startsWith("yt-video-btc-");
          
          if (isLabeledAsFreedom && hasAndreiContent) {
            console.log(`[Pruner] Pruning contaminated Judging Freedom video (actually Andrei Jikh): ${video.title}`);
            // Delete permanently in background from Supabase / mockSupabase
            supabase.from("documents").delete().eq("id", video.id).then(({ error }) => {
              if (error) console.error(`[Pruner] Error deleting contaminated record ${video.id}:`, error);
            });
            return false;
          }

          // 2. Original Andrei date cutoff check
          const isAndrei = (ch === "" || 
                           ch === "Andrei Jikh" || 
                           ch.toLowerCase().includes("andrei") || 
                           title.toLowerCase().includes("andrei") || 
                           video.id.startsWith("yt-video-")) &&
                           !isFreedomChannel(ch) &&
                           !isFreedomChannel(title);
          
          if (isAndrei) {
            const dateVal = Date.parse(video.created_at);
            const cutoffVal = Date.parse("2026-06-24T00:00:00Z");
            const isBeforeCutoff = video.created_at.includes("2026-06-22") || 
                                   (!isNaN(dateVal) && dateVal < cutoffVal);
            if (isBeforeCutoff) {
              console.log(`[Pruner] Pruning old Andrei video: ${video.title} (${video.created_at})`);
              // Delete permanently in background from Supabase
              supabase.from("documents").delete().eq("id", video.id).then(({ error }) => {
                if (error) console.error(`[Pruner] Error deleting old record ${video.id}:`, error);
              });
              return false;
            }
          }
          return true;
        });

        // Sort videos chronologically (newest first)
        const sortedData = [...prunedData].sort(
          (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)
        );

        setVideos(sortedData);

        // Preload any existing translations from the database into the translationsCache
        const preloadedTranslations: Record<string, Record<string, { text: string; loading: boolean; error: string | null }>> = {};
        for (const v of sortedData) {
          if (v.metadata?.translations) {
            preloadedTranslations[v.id] = {};
            for (const [lang, text] of Object.entries(v.metadata.translations)) {
              if (text) {
                preloadedTranslations[v.id][lang] = {
                  text: String(text),
                  loading: false,
                  error: null
                };
              }
            }
          }
        }
        setTranslationsCache(prev => {
          const updated = { ...prev };
          for (const videoId of Object.keys(preloadedTranslations)) {
            updated[videoId] = {
              ...(updated[videoId] || {}),
              ...preloadedTranslations[videoId]
            };
          }
          return updated;
        });
        
        // Execute immediate daemon check on load
        checkOldVideos(sortedData);

        setSelectedVideo((prev) => {
          if (prev) {
            const found = sortedData.find((v) => v.id === prev.id);
            if (found) return found;
          }
          return sortedData[0] || null;
        });

        // DESACTIVADO: La transcripción automática masiva al cargar se delega completamente al cron de monitoreo (/api/videos/monitor-analysis)
        // para prevenir cuellos de botella y sobrecarga de la API de Gemini en el frontend.
      }
    } catch (err) {
      console.error("Failed to load videos:", err);
    } finally {
      setLoading(false);
    }
  }, [triggerBackgroundTranscription, checkOldVideos]);

  // Toggle favorite property inside document metadata in Supabase
  const toggleFavorite = async (video: VideoDocument, e: React.MouseEvent) => {
    e.stopPropagation();
    const isFav = !video.metadata.is_favorite;
    
    // Optimistic UI state update
    setVideos(prev => prev.map(v => {
      if (v.id === video.id) {
        return {
          ...v,
          metadata: {
            ...v.metadata,
            is_favorite: isFav
          }
        };
      }
      return v;
    }));

    if (selectedVideo?.id === video.id) {
      setSelectedVideo(prev => prev ? {
        ...prev,
        metadata: {
          ...prev.metadata,
          is_favorite: isFav
        }
      } : null);
    }

    if (activeStudyVideo?.id === video.id) {
      setActiveStudyVideo(prev => prev ? {
        ...prev,
        metadata: {
          ...prev.metadata,
          is_favorite: isFav
        }
      } : null);
    }

    try {
      const { data: list, error } = await supabase
        .from("documents")
        .select("metadata")
        .eq("id", video.id);

      if (error) throw error;
      const data = list && list.length > 0 ? list[0] : null;

      const updatedMetadata = {
        ...(data?.metadata || {}),
        is_favorite: isFav
      };

      const { error: updateError } = await supabase
        .from("documents")
        .update({ metadata: updatedMetadata })
        .eq("id", video.id);

      if (updateError) throw updateError;
      console.log(`Video ${video.id} favorite updated successfully in Supabase:`, isFav);
    } catch (err) {
      console.error("Failed to update favorite in Supabase:", err);
      // Revert state if error
      setVideos(prev => prev.map(v => {
        if (v.id === video.id) {
          return {
            ...v,
            metadata: {
              ...v.metadata,
              is_favorite: !isFav
            }
          };
        }
        return v;
      }));
    }
  };

  // Background daemon checking every day
  useEffect(() => {
    if (videos.length === 0) return;
    const interval = setInterval(() => {
      checkOldVideos(videos);
    }, 24 * 60 * 60 * 1000); // Daily execution
    return () => clearInterval(interval);
  }, [checkOldVideos, videos]);

  // VIDEO RE-ANALYSIS FUNCTIONALITY
  const [isReanalyzing, setIsReanalyzing] = useState(false);

  const handleReanalyzeVideo = async (videoDoc: VideoDocument) => {
    if (isReanalyzing) return;

    const confirmReanalyze = window.confirm(
      selectedLanguage === "es"
        ? "¿Re-analizar este vídeo con el modelo premium de Google Gemini? Esto borrará el análisis anterior y generará uno nuevo con soporte de gráficos."
        : selectedLanguage === "de"
        ? "Dieses Video mit dem Premium-Modell von Google Gemini erneut analysieren? Dies löscht die vorherige Analyse und generiert eine neue mit Diagramm-Support."
        : selectedLanguage === "tr"
        ? "Bu videoyu Google Gemini premium modeli ile yeniden analiz etmek istiyor musunuz? Bu işlem önceki analizi silecek ve grafik desteğiyle yenisini oluşturacaktır."
        : "Re-analyze this video with Google Gemini's premium model? This will clear the previous analysis and generate a new one with chart support."
    );
    if (!confirmReanalyze) return;

    setIsReanalyzing(true);

    try {
      // 1. Clear local/localStorage caches
      if (typeof window !== "undefined") {
        const cacheKey = getGlobalCacheKey({ id: videoDoc.id, file_url: videoDoc.file_url });
        localStorage.removeItem(cacheKey);
      }

      // 2. Prepare empty metadata and update Supabase
      const updatedMetadata = {
        ...videoDoc.metadata,
        transcription: undefined,
        transcription_model: undefined,
        translations: undefined
      };

      // Also clean the translations cache for this video
      setTranslationsCache(prev => {
        const updated = { ...prev };
        delete updated[videoDoc.id];
        return updated;
      });

      // Explicitly delete previous knowledge base entries and audio records matching the file_url of the video
      if (videoDoc.file_url) {
        const typesToDelete = [
          "knowledge_transcription",
          "knowledge_summary",
          "knowledge_charts",
          "knowledge_analysis",
          "audio"
        ];
        const { error: deleteError } = await supabase
          .from("documents")
          .delete()
          .in("type", typesToDelete)
          .eq("file_url", videoDoc.file_url);

        if (deleteError) {
          console.warn("[Re-analizar] Error al eliminar documentos antiguos de Supabase:", deleteError);
        } else {
          console.log("[Re-analizar] Documentos antiguos de la base de conocimientos y audios eliminados correctamente para:", videoDoc.file_url);
        }
      }

      const { error: updateError } = await supabase
        .from("documents")
        .update({ metadata: updatedMetadata })
        .eq("id", videoDoc.id);

      if (updateError) throw updateError;

      // 3. Clear transient transcribing states and unlock this video ID so it can transcribe again
      transcribingVideoIdsRef.current.delete(videoDoc.id);

      const cleanedVideoDoc = {
        ...videoDoc,
        metadata: {
          ...videoDoc.metadata,
          transcription: undefined,
          transcription_model: undefined,
          translations: undefined
        }
      };

      // 4. Update parent lists & states so they reflect the loading state
      setVideos(prev => prev.map(v => v.id === videoDoc.id ? cleanedVideoDoc : v));
      setSelectedVideo(prev => prev && prev.id === videoDoc.id ? cleanedVideoDoc : prev);
      setActiveStudyVideo(cleanedVideoDoc);

      // 5. Trigger asynchronously
      triggerBackgroundTranscription(cleanedVideoDoc);

    } catch (err) {
      console.error("Error trigger background re-analysis:", err);
    } finally {
      setIsReanalyzing(false);
    }
  };

  // TESTING RESET FUNCTIONALITY
  const [isResetting, setIsResetting] = useState(false);

  const handleResetTestingVideos = async () => {
    if (isResetting) return;

    const confirmReset = window.confirm(
      selectedLanguage === "es"
        ? "¿Estás seguro de que deseas vaciar por completo la videoteca y audioteca para pruebas? Se eliminarán todos los vídeos y audios asociados de la base de datos."
        : selectedLanguage === "de"
        ? "Sind Sie sicher, dass Sie die Video- und Audiobibliothek zu Testzwecken vollständig leeren möchten? Alle Videos und zugehörigen Audios werden aus der Datenbank gelöscht."
        : selectedLanguage === "tr"
        ? "Test amaçlı video ve ses kütüphanesini tamamen boşaltmak istediğinizden emin misiniz? Tüm videolar ve ilgili sesler veritabanından silinecektir."
        : "Are you sure you want to completely clear the video and audio library for testing? All videos and associated audios will be deleted from the database."
    );
    if (!confirmReset) return;

    setIsResetting(true);
    try {
      // 1. Delete all video documents from Supabase
      const { error } = await supabase
        .from("documents")
        .delete()
        .eq("type", "video");
      if (error) throw error;

      // 1b. Delete all audio documents from Supabase
      const { error: audioError } = await supabase
        .from("documents")
        .delete()
        .eq("type", "audio");
      if (audioError) throw audioError;

      // 1c. Delete all knowledge documents from Supabase to maintain referential integrity
      const { error: kTranscriptionError } = await supabase
        .from("documents")
        .delete()
        .eq("type", "knowledge_transcription");
      if (kTranscriptionError) throw kTranscriptionError;

      const { error: kSummaryError } = await supabase
        .from("documents")
        .delete()
        .eq("type", "knowledge_summary");
      if (kSummaryError) throw kSummaryError;

      const { error: kChartsError } = await supabase
        .from("documents")
        .delete()
        .eq("type", "knowledge_charts");
      if (kChartsError) throw kChartsError;

      const { error: kAnalysisError } = await supabase
        .from("documents")
        .delete()
        .eq("type", "knowledge_analysis");
      if (kAnalysisError) throw kAnalysisError;

      // 1d. Delete any other knowledge documents matching knowledge_*
      const { error: kAnyError } = await supabase
        .from("documents")
        .delete()
        .like("type", "knowledge_%");
      if (kAnyError) throw kAnyError;

      // 1e. Delete all chart documents of type 'chart'
      const { error: chartError } = await supabase
        .from("documents")
        .delete()
        .eq("type", "chart");
      if (chartError) throw chartError;

      // 2. Reset React states
      setTranscriptionStates({});
      setTranslationProgress({});
      setTranslationsCache({});

      // 2b. Clear localStorage cache keys for global translations and target video IDs
      if (typeof window !== "undefined") {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith("hivex_global_trans_cache_") || key.includes("dg8y1s0d5ih"))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      }

      // 3. Clear globally synced URLs
      globallySyncedUrls.clear();

      // 4. Clear active and selected video views
      setActiveStudyVideo(null);
      setSelectedVideo(null);

      // 5. Refetch videos
      await fetchVideos();

      console.log("Videoteca, audioteca y base de conocimientos vaciadas con éxito.");
    } catch (err) {
      console.error("Error al vaciar la videoteca y audioteca:", err);
      alert(
        selectedLanguage === "es"
          ? "Error al vaciar la videoteca y audioteca."
          : selectedLanguage === "de"
          ? "Fehler beim Leeren der Video- und Audiobibliothek."
          : selectedLanguage === "tr"
          ? "Video ve ses kütüphanesi boşaltılırken hata oluştu."
          : "Error clearing the video and audio library."
      );
    } finally {
      setIsResetting(false);
    }
  };

  // Sync YouTube Channel, purge old data, and download strict filtered video feed
  const handleSyncChannel = useCallback(async (autoTrigger = false) => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    setSyncing(true);
    setSyncError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No se encontró una sesión de usuario activa.");

      const targetChannel = filterChannel || "Andrei Jikh";

      // Start-from-scratch cleanup disabled by user request. We keep existing videos and continue syncing new ones incrementally.

      // Fetch existing videos in the DB first to execute a smart sync (skip already synced & transcribed)
      const { data: existingDocs, error: fetchErr } = await supabase
        .from("documents")
        .select("*")
        .eq("type", "video");
      if (fetchErr) throw fetchErr;

      const existingUrls = new Set((existingDocs || []).map((v) => v.file_url));
      existingUrls.forEach(url => globallySyncedUrls.add(url));

      // 2. Call our API Route
      const res = await fetch(`/api/videos/sync?channel=${encodeURIComponent(targetChannel)}`, { method: "POST" });
      if (!res.ok) {
        throw new Error("No se pudo obtener el feed del canal de inversión.");
      }
      
      const syncResult = await res.json();
      if (!syncResult.success) {
        throw new Error(syncResult.error || "Error de sincronización.");
      }

      const freshVideos: VideoDocument[] = syncResult.videos || [];
      const newlyAddedVideos: VideoDocument[] = [];

      // 3. Insert only NEW videos that don't already exist in our database list
      for (const fv of freshVideos) {
        // Fetch existing videos in real-time inside the loop to avoid duplicate-insert race conditions under React Strict Mode double-mount
        const { data: currentDocs } = await supabase
          .from("documents")
          .select("*")
          .eq("type", "video");
        
        const currentUrls = new Set((currentDocs || []).map((v) => v.file_url));
        currentUrls.forEach(url => globallySyncedUrls.add(url));

        if (globallySyncedUrls.has(fv.file_url)) {
          console.log(`Skipping sync for already existing video: ${fv.title}`);
          continue;
        }

        // Lock synchronously!
        globallySyncedUrls.add(fv.file_url);

        const newDoc = {
          user_id: user.id,
          title: fv.title,
          description: fv.description,
          type: "video",
          file_url: fv.file_url,
          created_at: fv.created_at, // Preserve original upload date
          metadata: {
            duration: fv.metadata.duration,
            resolution: fv.metadata.resolution,
            thumbnail: fv.metadata.thumbnail,
            is_youtube: true,
            channel_title: fv.metadata?.channel_title || targetChannel
          }
        };

        const { data: insertedData, error: insertError } = await supabase
          .from("documents")
          .insert(newDoc)
          .select();

        if (insertError) {
          console.warn("Failed to insert synced video:", fv.title, insertError);
          // Unlock on failure
          globallySyncedUrls.delete(fv.file_url);
        } else if (insertedData && insertedData[0]) {
          console.log(`Inserted new video: ${fv.title} with DB ID: ${insertedData[0].id}`);
          const typedInserted: VideoDocument = {
            id: insertedData[0].id,
            title: insertedData[0].title,
            description: insertedData[0].description,
            file_url: insertedData[0].file_url || "",
            created_at: insertedData[0].created_at,
            metadata: {
              duration: String(insertedData[0].metadata?.duration || "12:00"),
              resolution: String(insertedData[0].metadata?.resolution || "4K UHD"),
              thumbnail: String(insertedData[0].metadata?.thumbnail || ""),
              is_youtube: true,
              channel_title: insertedData[0].metadata?.channel_title || targetChannel
            }
          };
          newlyAddedVideos.push(typedInserted);
        }
      }

      // 4. Reload Videos Catalogue
      await fetchVideos();

      // 5. Trigger asynchronous background transcriptions for all newly added videos
      if (newlyAddedVideos.length > 0) {
        console.log(`Triggering async background transcriptions for ${newlyAddedVideos.length} new videos...`);
        newlyAddedVideos.forEach((nv) => {
          triggerBackgroundTranscription(nv);
        });
      }
    } catch (err) {
      console.error("YouTube sync failure:", err);
      if (!autoTrigger) {
        setSyncError(err instanceof Error ? err.message : "Error de sincronización desconocido.");
      }
      // Ensure we still load/clear state correctly in case of failure
      await fetchVideos();
    } finally {
      setSyncing(false);
      isSyncingRef.current = false;
    }
  }, [fetchVideos, triggerBackgroundTranscription]);

  // Initial mount load: execute the synchronization automatically (Limpieza y Sincronización incondicional al cargar)
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    const initLoad = async () => {
      // Defer state update to next event loop tick to satisfy strict ESLint rules
      await Promise.resolve();
      
      const rawParams = typeof window !== 'undefined' 
        ? new URLSearchParams(window.location.search) 
        : null;
      
      const rawFrom = rawParams ? rawParams.get("from") : null;
      const rawId = rawParams ? (rawParams.get("id") || rawParams.get("video")) : null;

      const isFromTelegram = rawFrom === "telegram" || searchParams.get("from") === "telegram";
      const hasSpecificVideo = rawId || searchParams.get("id") || searchParams.get("video");

      if (isFromTelegram || hasSpecificVideo) {
        console.log("[Cabinet] Skipping channel sync to load pre-existing videos instantly. Origin/Specific video detected.");
        await fetchVideos();
        return;
      }
      await handleSyncChannel(true);
    };

    initLoad();
  }, [handleSyncChannel, searchParams, fetchVideos]);

  useEffect(() => {
    // Stop local video player if track changes
    if (videoRef.current) {
      videoRef.current.pause();
    }
  }, [selectedVideo]);

  useEffect(() => {
    // Reset player time and expansion flags when changing study video
    setPlayerTime(null);
    setTranscriptionExpanded(false);
    setSummaryExpanded(true);
    setChartsExpanded(false);
    setReportExpanded(false);
  }, [activeStudyVideo]);

  const handleCreateVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !fileUrl) return;

    // Enforce strict duration limit (>= 5 minutes = 300 seconds)
    const durationSeconds = parseDurationToSeconds(duration);
    if (durationSeconds < 300) {
      alert(
        selectedLanguage === "es"
          ? "⚠️ No cumple las reglas de la cabina de estudio. Los vídeos deben tener una duración mínima de 5 minutos (300 segundos)."
          : selectedLanguage === "de"
          ? "⚠️ Erfüllt nicht die Regeln der Studienkabine. Videos müssen eine Mindestdauer von 5 Minuten (300 Sekunden) haben."
          : selectedLanguage === "tr"
          ? "⚠️ Çalışma kabini kurallarına uymuyor. Videoların en az 5 dakika (300 saniye) uzunluğunda olması gerekir."
          : "⚠️ Does not meet the study cabin rules. Videos must have a minimum duration of 5 minutes (300 seconds)."
      );
      return;
    }

    setFormLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No se encontró una sesión de usuario activa.");

      const finalThumbnail = thumbnail || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80";

      const newVideo = {
        user_id: user.id,
        title,
        description,
        type: "video",
        file_url: fileUrl,
        metadata: {
          duration,
          resolution,
          thumbnail: finalThumbnail,
          is_youtube: false,
          channel_title: "Manual Upload"
        }
      };

      const { error } = await supabase.from("documents").insert(newVideo);
      if (error) throw error;

      setTitle("");
      setDescription("");
      setFileUrl("");
      setThumbnail("");
      setResolution("1080p");
      setDuration("12:00");
      
      await fetchVideos();
    } catch (err) {
      console.error("Failed to insert video:", err);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteVideo = async (id: string) => {
    if (confirm(t.confirmDelete || "¿Estás seguro de que deseas eliminar este vídeo?")) {
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

  const isSelectedYoutube = selectedVideo?.file_url.includes("youtube.com") || selectedVideo?.file_url.includes("youtu.be");

  // Ventana de Estudio (Study view overlay/replacement)
  if (activeStudyVideo) {
    const isYt = activeStudyVideo.metadata?.is_youtube || 
                  activeStudyVideo.file_url?.includes("youtube.com") || 
                  activeStudyVideo.file_url?.includes("youtu.be");

    // Derived values for transcription states to match existing JSX variables precisely
    const activeState = transcriptionStates[activeStudyVideo.id];
    const transcribing = activeStudyVideo.metadata?.transcription ? false : (activeState?.transcribing ?? false);
    const transcriptionProgress = activeStudyVideo.metadata?.transcription ? 100 : (activeState?.progress ?? 0);
    
    // Original Spanish transcription text
    const originalTranscriptionText = activeStudyVideo.metadata?.transcription || activeState?.text || "";

    // Translation cache states
    const translationCached = translationsCache[activeStudyVideo.id]?.[selectedLanguage];
    const translationLoading = !transcribing && selectedLanguage !== "en" && (!translationCached || translationCached.loading);
    const translationError = selectedLanguage !== "en" ? (translationCached?.error ?? null) : null;
    const currentTranslationProgress = translationProgress[activeStudyVideo.id]?.[selectedLanguage] ?? 0;

    // Transcription text to use for display/splitting
    const transcriptionText = selectedLanguage === "en"
      ? originalTranscriptionText
      : (translationCached?.text || "");

    const transcriptionModel = activeStudyVideo.metadata?.transcription
      ? (activeStudyVideo.metadata.transcription_model || "Google Gemini (Cached)")
      : (activeState?.model ?? null);
    const modelParts = transcriptionModel ? String(transcriptionModel).split("\n") : [];
    const displayModelName = modelParts[0] || null;
    const liveStreamWarning = modelParts[1] || null;
    const transcriptionErrorFinal = translationError || (activeStudyVideo.metadata?.transcription ? null : (activeState?.error ?? null));

    return (
      <div className="space-y-8 animate-fade-in pb-12">
        {/* Back and Title Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-900/60">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveStudyVideo(null)}
              className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold transition-all flex items-center gap-2"
            >
              {t.backToCatalog || "← Volver al Catálogo"}
            </button>
            <div className="h-6 w-px bg-zinc-900 hidden md:block" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  {t.studyCabin || "Cabina de Estudio"}
                </span>
                <span className="text-[10px] font-bold text-zinc-500">
                  {t.intelligent || "HIVEX Inteligente"}
                </span>
              </div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-white mt-1">
                {activeStudyVideo.title}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start md:self-auto select-none">
            <div className="px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-mono text-emerald-400 font-bold">
              {selectedLanguage === "es" ? "Canal" : selectedLanguage === "de" ? "Kanal" : selectedLanguage === "tr" ? "Kanal" : "Channel"}: {activeStudyVideo.metadata.channel_title || "Andrei Jikh"}
            </div>
            <button
              onClick={() => handleReanalyzeVideo(activeStudyVideo)}
              disabled={isReanalyzing || transcribing}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 hover:border-amber-500/50 text-[11px] font-mono text-amber-400 font-bold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isReanalyzing || transcribing ? 'animate-spin' : ''}`} />
              {isReanalyzing || transcribing 
                ? (
                    activeStudyVideo.metadata?.transcription
                      ? (selectedLanguage === "es" ? "Re-analizando..." : selectedLanguage === "de" ? "Wird neu analysiert..." : selectedLanguage === "tr" ? "Yeniden Analiz Ediliyor..." : "Re-analyzing...")
                      : (selectedLanguage === "es" ? "Analizando..." : selectedLanguage === "de" ? "Wird analysiert..." : selectedLanguage === "tr" ? "Analiz Ediliyor..." : "Analyzing...")
                  )
                : (
                    activeStudyVideo.metadata?.transcription
                      ? (selectedLanguage === "es" ? "Re-analizar Inteligencia" : selectedLanguage === "de" ? "Intelligenz neu analysieren" : selectedLanguage === "tr" ? "Zekayı Yeniden Analiz Et" : "Re-analyze Intelligence")
                      : (selectedLanguage === "es" ? "Analizar Inteligencia" : selectedLanguage === "de" ? "Intelligenz analysieren" : selectedLanguage === "tr" ? "Zekayı Analiz Et" : "Analyze Intelligence")
                  )
              }
            </button>
          </div>
        </div>

        {/* Study Cabin View Layout - Pure focused single-column layout */}
        <div className="max-w-4xl mx-auto space-y-10">
          
          {/* 1. ORIGINAL VIDEO PLAYER CARD */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2.5 border-b border-zinc-900">
              <Monitor className="w-4 h-4 text-red-500 animate-pulse" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                {t.originalVideo || "Vídeo Original Completo de Estudio"}
              </h3>
            </div>
            <div className="rounded-2xl border border-zinc-900 bg-black overflow-hidden relative shadow-xl group">
              <div className="px-4 py-2.5 bg-zinc-900/30 border-b border-zinc-900/60 flex items-center justify-between">
                <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-widest flex items-center gap-1.5">
                  {selectedLanguage === "es" ? "Reproducción de Metadatos Completos" : selectedLanguage === "de" ? "Wiedergabe vollständiger Metadaten" : selectedLanguage === "tr" ? "Tam Meta Veri Oynatma" : "Full Metadata Playback"}
                </span>
                <span className="text-[9px] text-zinc-500 font-mono">ID: {activeStudyVideo.id.replace("yt-video-", "")}</span>
              </div>
              <div className="relative w-full aspect-video bg-zinc-950">
                {isYt ? (
                  <iframe
                    src={getEmbedUrl(activeStudyVideo.file_url, playerTime)}
                    title={`${activeStudyVideo.title} (Original)`}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="w-full h-full"
                  />
                ) : (
                  <video
                    ref={studyVideoRef}
                    src={activeStudyVideo.file_url}
                    controls
                    className="w-full h-full object-contain"
                  />
                )}
              </div>
            </div>
          </div>

          {/* 2. THREE COLLAPSIBLE STUDY CABIN SECTIONS */}
          {(() => {
            const { transcription, summary, charts, report } = splitTranscription(transcriptionText);
            
            return (
              <div className="space-y-6">
                {/* A. TRANSCRIPCIÓN LITERAL ORIGINAL */}
                <div className="rounded-2xl border border-zinc-900 bg-zinc-900/5 overflow-hidden shadow-xl">
                  <button
                    onClick={() => setTranscriptionExpanded(!transcriptionExpanded)}
                    className="w-full px-6 py-4 bg-zinc-900/10 hover:bg-zinc-900/20 border-b border-zinc-900/40 flex items-center justify-between transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <Volume2 className="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform" />
                      <div className="text-left">
                        <h3 className="text-sm font-extrabold text-white tracking-wide uppercase">
                          {selectedLanguage === "es"
                            ? "Transcripción Literal Original"
                            : selectedLanguage === "de"
                            ? "Originale wörtliche Transkription"
                            : selectedLanguage === "tr"
                            ? "Orijinal Deşifre Metni"
                            : "Original Verbatim Transcription"}
                        </h3>
                        <p className="text-[10px] text-zinc-500 font-medium">
                          {selectedLanguage === "es" ? "Soporte Judicial Verbatim Estricto" : selectedLanguage === "de" ? "Strikte wörtliche gerichtliche Unterstützung" : selectedLanguage === "tr" ? "Sıkı Verbatim Adli Destek" : "Strict Verbatim Judicial Support"}
                        </p>
                      </div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-zinc-900/50 group-hover:bg-zinc-800/80 border border-zinc-800/30 text-zinc-400 group-hover:text-white transition-all">
                      {transcriptionExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </button>

                  <div 
                    className={`transition-all duration-300 ease-in-out overflow-hidden ${
                      transcriptionExpanded ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0"
                    }`}
                  >
                    <div className="p-6 space-y-4 relative">
                      <div className="absolute top-0 left-0 w-32 h-32 bg-sky-500/5 blur-[40px] pointer-events-none" />
                      
                      {(transcribing || transcriptionModel || transcriptionErrorFinal) && (
                        <div className="p-4 rounded-xl border border-zinc-900/60 bg-zinc-950/40 backdrop-blur-md flex flex-col gap-3 relative z-10">
                          {(transcribing || transcriptionModel) && (
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <div className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </div>
                                <span className="text-xs font-bold text-zinc-400">
                                  {selectedLanguage === "es" ? "Consumo de Modelos:" : selectedLanguage === "de" ? "Modellverbrauch:" : selectedLanguage === "tr" ? "Model Tüketimi:" : "Model Consumption:"}
                                </span>
                                <span className="text-xs font-mono text-zinc-100 bg-zinc-900/80 px-2 py-0.5 rounded border border-zinc-800">
                                  {transcribing ? (selectedLanguage === "es" ? "Google Gemini 3.5 Flash (Llamando...)" : selectedLanguage === "de" ? "Google Gemini 3.5 Flash (Wird aufgerufen...)" : selectedLanguage === "tr" ? "Google Gemini 3.5 Flash (Aranıyor...)" : "Google Gemini 3.5 Flash (Calling...)") : displayModelName}
                                </span>
                              </div>
                              <div>
                                <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full tracking-wider uppercase flex items-center gap-1.5">
                                  <span className="relative flex h-1.5 w-1.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                  </span>
                                  {selectedLanguage === "es" ? "Conexión en Vivo Activa" : selectedLanguage === "de" ? "Aktive Live-Verbindung" : selectedLanguage === "tr" ? "Aktif Canlı Bağlantı" : "Active Live Connection"}
                                </span>
                              </div>
                            </div>
                          )}
                          {!transcribing && liveStreamWarning && (
                            <div className="mt-1 text-xs font-semibold text-amber-400/90 bg-amber-500/5 border border-amber-500/10 px-3 py-2 rounded-lg flex items-center gap-2">
                              <span>⚠️</span>
                              <span>{liveStreamWarning}</span>
                            </div>
                          )}

                          {!transcribing && transcriptionErrorFinal && (
                            <div className="p-3.5 rounded-lg bg-rose-500/5 border border-rose-500/15 flex flex-col gap-1.5">
                              <div className="flex items-center gap-2 text-rose-450 text-[10px] font-extrabold uppercase tracking-wider">
                                <AlertCircle className="w-3.5 h-3.5 text-rose-450 flex-shrink-0" />
                                <span>{selectedLanguage === "es" ? "Detalle de Alerta en Google Cloud (Live API)" : selectedLanguage === "de" ? "Google Cloud Warnungsdetails (Live-API)" : selectedLanguage === "tr" ? "Google Cloud Uyarı Detayı (Canlı API)" : "Google Cloud Alert Details (Live API)"}</span>
                              </div>
                              <p className="text-[11px] font-mono text-rose-400 break-all leading-normal whitespace-pre-wrap select-text selection:bg-rose-500/20 max-h-40 overflow-y-auto pr-1">
                                {transcriptionErrorFinal}
                              </p>
                              <div className="mt-1 text-[9px] text-zinc-500 leading-normal">
                                {selectedLanguage === "es" ? (
                                  <>Tip de Conexión: Asegúrate de que el ID de proyecto <span className="font-semibold text-zinc-400">558326121700</span> tenga la facturación activa y que la <span className="font-semibold text-zinc-400">Vertex AI API</span> se encuentre habilitada en la consola de Google Cloud. Puedes habilitarla con un clic en: <a href="https://console.cloud.google.com/apis/library/aiplatform.googleapis.com" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 underline font-semibold">Consola de GCP</a>.</>
                                ) : selectedLanguage === "de" ? (
                                  <>Verbindungstipp: Stellen Sie sicher, dass für die Projekt-ID <span className="font-semibold text-zinc-400">558326121700</span> die Abrechnung aktiv ist und die <span className="font-semibold text-zinc-400">Vertex AI API</span> in der Google Cloud Console aktiviert ist. Sie können sie mit einem Klick aktivieren auf: <a href="https://console.cloud.google.com/apis/library/aiplatform.googleapis.com" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 underline font-semibold">GCP-Konsole</a>.</>
                                ) : selectedLanguage === "tr" ? (
                                  <>Bağlantı İpucu: <span className="font-semibold text-zinc-400">558326121700</span> proje kimliği için faturalandırmanın etkin olduğundan ve Google Cloud Konsolunda <span className="font-semibold text-zinc-400">Vertex AI API</span>&apos;sinin etkinleştirildiğinden emin olun. Tek bir tıklama ile etkinleştirebilirsiniz: <a href="https://console.cloud.google.com/apis/library/aiplatform.googleapis.com" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 underline font-semibold">GCP Konsolu</a>.</>
                                ) : (
                                  <>Connection Tip: Make sure the project ID <span className="font-semibold text-zinc-400">558326121700</span> has active billing and the <span className="font-semibold text-zinc-400">Vertex AI API</span> is enabled in the Google Cloud Console. You can enable it with one click at: <a href="https://console.cloud.google.com/apis/library/aiplatform.googleapis.com" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 underline font-semibold">GCP Console</a>.</>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {transcribing || translationLoading ? (
                        <div className="py-12 px-4 flex flex-col items-center justify-center space-y-6 text-center relative">
                          <div className="relative w-28 h-28 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 112 116">
                              <defs>
                                <linearGradient id="gradientProgress" x1="0%" y1="0%" x2="100%" y2="100%">
                                  <stop offset="0%" stopColor="#6366f1" />
                                  <stop offset="50%" stopColor="#a855f7" />
                                  <stop offset="100%" stopColor="#f59e0b" />
                                </linearGradient>
                              </defs>
                              <circle
                                cx="56"
                                cy="58"
                                r="48"
                                stroke="#18181b"
                                strokeWidth="6"
                                fill="transparent"
                              />
                              <circle
                                cx="56"
                                cy="58"
                                r="48"
                                stroke="url(#gradientProgress)"
                                strokeWidth="6"
                                fill="transparent"
                                strokeDasharray={2 * Math.PI * 48}
                                strokeDashoffset={2 * Math.PI * 48 * (1 - (transcribing ? transcriptionProgress : currentTranslationProgress) / 100)}
                                strokeLinecap="round"
                                className="transition-all duration-300 ease-out"
                              />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center space-y-0.5">
                              <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-amber-400 font-mono tracking-tighter">
                                {transcribing ? transcriptionProgress : currentTranslationProgress}%
                              </span>
                              <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest animate-pulse">
                                {transcribing
                                  ? (selectedLanguage === "es" ? "Procesando" : selectedLanguage === "de" ? "Wird verarbeitet" : selectedLanguage === "tr" ? "İşleniyor" : "Processing")
                                  : (selectedLanguage === "es" ? "Traduciendo" : selectedLanguage === "de" ? "Wird übersetzt" : selectedLanguage === "tr" ? "Çevriliyor" : "Translating")}
                              </span>
                            </div>
                          </div>
                          
                          <div className="space-y-1.5 max-w-sm">
                            <div className="text-xs font-bold text-zinc-200 flex items-center justify-center gap-1.5">
                              {transcribing ? (
                                <>
                                  <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
                                  <span>{selectedLanguage === "es" ? "Transcripción en Curso" : selectedLanguage === "de" ? "Transkription läuft" : selectedLanguage === "tr" ? "Deşifre İşlemi Devam Ediyor" : "Transcription in Progress"}</span>
                                </>
                              ) : (
                                <>
                                  <Languages className="w-4 h-4 text-amber-400 animate-pulse" />
                                  <span>{selectedLanguage === "es" ? "Traducción Inteligente en Curso" : selectedLanguage === "de" ? "Intelligente Übersetzung läuft" : selectedLanguage === "tr" ? "Akıllı Çeviri Devam Ediyor" : "Intelligent Translation in Progress"}</span>
                                </>
                              )}
                            </div>
                            <p className="text-[10px] text-zinc-500 leading-relaxed">
                              {transcribing ? (
                                selectedLanguage === "es" ? "El audio original está siendo procesado en segundo plano con el modelo premium de Google Gemini. Esto puede tomar alrededor de 1 minuto para vídeos de más de 10 minutos. No tienes que esperar, puedes continuar navegando de forma segura." : selectedLanguage === "de" ? "Das Original-Audio wird im Hintergrund mit dem Premium-Modell von Google Gemini verarbeitet. Dies kann bei Videos von mehr als 10 Minuten etwa 1 Minute dauern. Sie müssen nicht warten, Sie können die Navigation sicher fortsetzen." : selectedLanguage === "tr" ? "Orijinal ses, Google Gemini premium modeli ile arka planda işleniyor. Bu işlem, 10 dakikadan uzun videolar için yaklaşık 1 dakika sürebilir. Beklemek zorunda değilsiniz, güvenle gezinmeye devam edebilirsiniz." : "The original audio is being processed in the background with Google Gemini's premium model. This can take around 1 minute for videos longer than 10 minutes. You do not have to wait, you can safely continue browsing."
                              ) : (
                                selectedLanguage === "es" ? `El contenido está siendo traducido en segundo plano al Español usando el modelo premium de Google Gemini. Las tarjetas se actualizarán en cuanto finalice.` : selectedLanguage === "de" ? `Der Inhalt wird im Hintergrund mit dem Premium-Modell von Google Gemini ins Deutsche übersetzt. Die Karten werden aktualisiert, sobald dies abgeschlossen ist.` : selectedLanguage === "tr" ? `İçerik, Google Gemini premium modeli kullanılarak arka planda Türkçe'ye çevriliyor. Tamamlandığında kartlar güncellenecektir.` : `The content is being translated in the background to English using Google Gemini's premium model. The cards will update once finished.`
                              )}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="relative z-10 mt-1 select-text">
                          <MarkdownRenderer 
                            content={transcription || "No hay transcripción disponible."} 
                            modelUsed={transcriptionModel || "Google Vertex AI Gemini 1.5 Pro"}
                            selectedLanguage={selectedLanguage}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* B. RESUMEN DETALLADO DEL CONTENIDO */}
                {(transcribing || summary || translationLoading || !transcriptionErrorFinal) && (
                  <div className="rounded-2xl border border-zinc-900 bg-zinc-900/5 overflow-hidden shadow-xl">
                    <button
                      onClick={() => setSummaryExpanded(!summaryExpanded)}
                      className="w-full px-6 py-4 bg-zinc-900/10 hover:bg-zinc-900/20 border-b border-zinc-900/40 flex items-center justify-between transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <BookOpen className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
                        <div className="text-left">
                          <h3 className="text-sm font-extrabold text-white tracking-wide uppercase">
                            {selectedLanguage === "es"
                              ? "Resumen Detallado del Contenido"
                              : selectedLanguage === "de"
                              ? "Detaillierte Inhaltszusammenfassung"
                              : selectedLanguage === "tr"
                              ? "Detaylı İçerik Özeti"
                              : "Detailed Content Summary"}
                          </h3>
                          <p className="text-[10px] text-zinc-500 font-medium">
                            {selectedLanguage === "es" ? "Navegación Segmentada con Marcas de Tiempo Interactivas" : selectedLanguage === "de" ? "Segmentierte Navigation mit interaktiven Zeitstempeln" : selectedLanguage === "tr" ? "Etkileşimli Zaman Damgaları ile Bölümlere Ayrılmış Gezinti" : "Segmented Navigation with Interactive Timestamps"}
                          </p>
                        </div>
                      </div>
                      <div className="p-1.5 rounded-lg bg-zinc-900/50 group-hover:bg-zinc-800/80 border border-zinc-800/30 text-zinc-400 group-hover:text-white transition-all">
                        {summaryExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </button>
 
                    <div 
                      className={`transition-all duration-300 ease-in-out overflow-hidden ${
                        summaryExpanded ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0"
                      }`}
                    >
                      <div className="p-6 relative select-text">
                        <div className="absolute top-0 left-0 w-32 h-32 bg-indigo-500/5 blur-[40px] pointer-events-none" />
                        <div className="relative z-10">
                          {transcribing || translationLoading ? (
                            <ShimmerSkeleton />
                          ) : (
                            <>
                              {/* Model Consumption Banner */}
                              {transcriptionModel && (
                                <div className="mb-4 p-4 rounded-xl border border-zinc-900/60 bg-zinc-950/40 backdrop-blur-md flex flex-col gap-3 pb-3">
                                  <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div className="flex items-center gap-2">
                                      <div className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                      </div>
                                      <span className="text-xs font-bold text-zinc-400">
                                        {selectedLanguage === "es" ? "Consumo de Modelos:" : selectedLanguage === "de" ? "Modellverbrauch:" : selectedLanguage === "tr" ? "Model Tüketimi:" : "Model Consumption:"}
                                      </span>
                                      <span className="text-xs font-mono text-zinc-100 bg-zinc-900/80 px-2 py-0.5 rounded border border-zinc-800">
                                        {displayModelName}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full tracking-wider uppercase flex items-center gap-1.5">
                                        <span className="relative flex h-1.5 w-1.5">
                                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                        </span>
                                        {selectedLanguage === "es" ? "Conexión en Vivo Activa" : selectedLanguage === "de" ? "Aktive Live-Verbindung" : selectedLanguage === "tr" ? "Aktif Canlı Bağlantı" : "Active Live Connection"}
                                      </span>
                                    </div>
                                  </div>
                                  {liveStreamWarning && (
                                    <div className="mt-1 text-xs font-semibold text-amber-400/90 bg-amber-500/5 border border-amber-500/10 px-3 py-2 rounded-lg flex items-center gap-2">
                                      <span>⚠️</span>
                                      <span>{liveStreamWarning}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                              <MarkdownRenderer 
                                content={summary || "No hay resumen detallado disponible."} 
                                modelUsed={transcriptionModel || "Google Vertex AI Gemini 1.5 Pro"}
                                selectedLanguage={selectedLanguage}
                                onSeek={(seconds) => {
                                  setPlayerTime(seconds);
                                  if (studyVideoRef.current) {
                                    studyVideoRef.current.currentTime = seconds;
                                    studyVideoRef.current.play().catch(err => console.log("Autoplay local video prevented:", err));
                                  }
                                }}
                              />
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* C. GRÁFICOS Y VISUALIZACIONES DETECTADAS */}
                {(transcribing || charts || translationLoading || !transcriptionErrorFinal) && (() => {
                  return (
                    <div className="rounded-2xl border border-zinc-900 bg-zinc-900/5 overflow-hidden shadow-xl">
                      <button
                        onClick={() => setChartsExpanded(!chartsExpanded)}
                        className="w-full px-6 py-4 bg-zinc-900/10 hover:bg-zinc-900/20 border-b border-zinc-900/40 flex items-center justify-between transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <TrendingUp className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                          <div className="text-left">
                            <h3 className="text-sm font-extrabold text-white tracking-wide uppercase">
                              {selectedLanguage === "es"
                                ? "Gráficos y Visualizaciones Detectadas"
                                : selectedLanguage === "de"
                                ? "Erkannte Grafiken und Visualisierungen"
                                : selectedLanguage === "tr"
                                ? "Tespit Edilen Grafikler ve Görselleştirmeler"
                                : "Detected Charts & Visualizations"}
                            </h3>
                            <p className="text-[10px] text-zinc-500 font-medium">
                              {selectedLanguage === "es"
                                ? "Análisis Técnico Multidimensional y Métricas de Mercado"
                                : selectedLanguage === "de"
                                ? "Multidimensionale technische Analyse und Marktkennzahlen"
                                : selectedLanguage === "tr"
                                ? "Çok Boyutlu Teknik Analiz ve Piyasa Metrikleri"
                                : "Multidimensional Technical Analysis & Market Metrics"}
                            </p>
                          </div>
                        </div>
                        <div className="p-1.5 rounded-lg bg-zinc-900/50 group-hover:bg-zinc-800/80 border border-zinc-800/30 text-zinc-400 group-hover:text-white transition-all">
                          {chartsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </button>

                      <div 
                        className={`transition-all duration-300 ease-in-out overflow-hidden ${
                          chartsExpanded ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0"
                        }`}
                      >
                        <div className="p-6 relative select-text">
                          <div className="absolute top-0 left-0 w-32 h-32 bg-indigo-500/5 blur-[40px] pointer-events-none" />
                          <div className="relative z-10">
                            {transcribing || translationLoading ? (
                              <ShimmerSkeleton />
                            ) : (
                              <>
                                {/* Model Consumption Banner */}
                                {transcriptionModel && (
                                  <div className="mb-4 p-4 rounded-xl border border-zinc-900/60 bg-zinc-950/40 backdrop-blur-md flex flex-col gap-3 pb-3">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                      <div className="flex items-center gap-2">
                                        <div className="relative flex h-2 w-2">
                                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                        </div>
                                        <span className="text-xs font-bold text-zinc-400">
                                          {selectedLanguage === "es" ? "Consumo de Modelos:" : selectedLanguage === "de" ? "Modellverbrauch:" : selectedLanguage === "tr" ? "Model Tüketimi:" : "Model Consumption:"}
                                        </span>
                                        <span className="text-xs font-mono text-zinc-100 bg-zinc-900/80 px-2 py-0.5 rounded border border-zinc-800">
                                          {displayModelName}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full tracking-wider uppercase flex items-center gap-1.5">
                                          <span className="relative flex h-1.5 w-1.5">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                          </span>
                                          {selectedLanguage === "es" ? "Conexión en Vivo Activa" : selectedLanguage === "de" ? "Aktive Live-Verbindung" : selectedLanguage === "tr" ? "Aktif Canlı Bağlantı" : "Active Live Connection"}
                                        </span>
                                      </div>
                                    </div>
                                    {liveStreamWarning && (
                                      <div className="mt-1 text-xs font-semibold text-amber-400/90 bg-amber-500/5 border border-amber-500/10 px-3 py-2 rounded-lg flex items-center gap-2">
                                        <span>⚠️</span>
                                        <span>{liveStreamWarning}</span>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {(() => {
                                  const parsedCharts = parseChartsMarkdown(charts);
                                  if (parsedCharts.length > 0) {
                                    return (
                                      <div className="space-y-8 select-text">
                                        {parsedCharts.map((chart, idx) => (
                                          <div 
                                            key={idx} 
                                            className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center p-6 rounded-2xl border border-zinc-900/60 bg-zinc-950/20 backdrop-blur-md hover:border-zinc-800/80 hover:bg-zinc-950/40 transition-all duration-300 relative group"
                                          >
                                            {/* Left Column: Visual Snapshot / YouTube Alert */}
                                            <div className="w-full">
                                              <SmartVideoSnapshot
                                                videoId={activeStudyVideo.id}
                                                fileUrl={activeStudyVideo.file_url}
                                                targetTime={chart.seconds}
                                                endSeconds={chart.endSeconds}
                                                isYt={isYt}
                                                selectedLanguage={selectedLanguage}
                                                isPlaying={isYt && playingChartIdx === idx}
                                                onEnded={() => setPlayingChartIdx(null)}
                                                onPlayingStateChange={(playing) => {
                                                  if (playing) {
                                                    setPlayingChartIdx(idx);
                                                  } else {
                                                    if (playingChartIdx === idx) {
                                                      setPlayingChartIdx(null);
                                                    }
                                                  }
                                                }}
                                              />
                                            </div>

                                            {/* Right Column: Title, Play Button, Bullets, Legend */}
                                            <div className="space-y-4">
                                              <div className="flex items-start justify-between gap-3">
                                                <div>
                                                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                                    <span className="text-[10px] font-black tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full uppercase">
                                                      {chart.timestamp}
                                                    </span>
                                                    <span className="text-[9px] font-black tracking-widest text-zinc-500 bg-zinc-900/80 px-2 py-0.5 rounded-full uppercase">
                                                      {selectedLanguage === "es" ? "Gráfico Detectado" : selectedLanguage === "de" ? "Grafik Erkannt" : selectedLanguage === "tr" ? "Grafik Tespit Edildi" : "Chart Detected"}
                                                    </span>
                                                  </div>
                                                  <h4 className="text-sm font-extrabold text-white tracking-tight leading-snug">
                                                    {chart.title}
                                                  </h4>
                                                </div>
                                                <button
                                                  onClick={() => {
                                                    if (isYt) {
                                                      if (playingChartIdx === idx) {
                                                        setPlayingChartIdx(null);
                                                      } else {
                                                        setPlayingChartIdx(idx);
                                                      }
                                                    } else {
                                                      // Local html5 video playback control fallback
                                                      setPlayerTime(chart.seconds);
                                                      if (studyVideoRef.current) {
                                                        studyVideoRef.current.currentTime = chart.seconds;
                                                        studyVideoRef.current.play().catch(err => console.log("Autoplay prevented:", err));
                                                      }
                                                    }
                                                  }}
                                                  className={`p-2 rounded-xl transition-all shadow-md shrink-0 flex items-center justify-center gap-1 text-[11px] font-black uppercase tracking-wider px-3 ${
                                                    isYt && playingChartIdx === idx
                                                      ? "bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 hover:border-amber-500/40 text-amber-400 hover:text-amber-300"
                                                      : "bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-400 hover:text-emerald-300"
                                                  }`}
                                                >
                                                  {isYt && playingChartIdx === idx ? (
                                                    <>
                                                      <Pause className="w-3.5 h-3.5 fill-current" />
                                                      <span>{selectedLanguage === "es" ? "Pausar" : selectedLanguage === "de" ? "Pause" : selectedLanguage === "tr" ? "Duraklat" : "Pause"}</span>
                                                    </>
                                                  ) : (
                                                    <>
                                                      <Play className="w-3.5 h-3.5 fill-current" />
                                                      <span>
                                                        {isYt
                                                          ? (selectedLanguage === "es" ? "Play" : selectedLanguage === "de" ? "Abspielen" : selectedLanguage === "tr" ? "Oynat" : "Play")
                                                          : (selectedLanguage === "es" ? "Ir" : selectedLanguage === "de" ? "Ansehen" : selectedLanguage === "tr" ? "Git" : "Play")
                                                        }
                                                      </span>
                                                    </>
                                                  )}
                                                </button>
                                              </div>

                                              {chart.bullets.length > 0 && (
                                                <ul className="space-y-2 text-xs text-zinc-400 leading-relaxed font-medium">
                                                  {chart.bullets.map((bullet, bIdx) => {
                                                    const parts = bullet.split(/\*\*([^*]+)\*\*/);
                                                    return (
                                                      <li key={bIdx} className="flex items-start gap-2">
                                                        <span className="text-emerald-500 font-extrabold select-none mt-0.5">•</span>
                                                        <span>
                                                          {parts.map((part, pIdx) => 
                                                            pIdx % 2 === 1 ? <strong key={pIdx} className="text-zinc-100 font-extrabold">{part}</strong> : part
                                                          )}
                                                        </span>
                                                      </li>
                                                    );
                                                  })}
                                                </ul>
                                              )}

                                              {chart.legend && (
                                                <p className="text-[11px] text-zinc-500 font-medium italic border-t border-zinc-900/60 pt-3 leading-relaxed text-justify">
                                                  <span className="text-[10px] not-italic font-black tracking-wider uppercase text-zinc-400 mr-1.5">
                                                    {selectedLanguage === "es" ? "Conclusión Clave:" : selectedLanguage === "de" ? "Fazit:" : selectedLanguage === "tr" ? "Ana Sonuç:" : "Key Takeaway:"}
                                                  </span>
                                                  {chart.legend.replace(/^(leyenda|legend):\s*/i, "")}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  } else {
                                    return (
                                      <div className="py-12 text-center">
                                        <EyeOff className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                                        <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">
                                          {selectedLanguage === "es"
                                            ? "No se detectaron gráficos en este vídeo."
                                            : selectedLanguage === "de"
                                            ? "In diesem Video wurden keine Grafiken erkannt."
                                            : selectedLanguage === "tr"
                                            ? "Bu videoda herhangi bir grafik tespit edilmedi."
                                            : "No charts detected in this video."}
                                        </p>
                                      </div>
                                    );
                                  }
                                })()}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* NEW TTS AUDIO NARRATION SECTION */}
                {(transcribing || summary || translationLoading) && (
                  <div className="rounded-2xl border border-zinc-900 bg-zinc-900/5 overflow-hidden shadow-xl">
                    <div className="w-full px-6 py-4 bg-zinc-900/10 border-b border-zinc-900/40 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
                          <Headphones className="w-4 h-4 animate-pulse" />
                        </div>
                        <div className="text-left">
                          <h3 className="text-sm font-extrabold text-white tracking-wide uppercase flex items-center gap-1.5">
                            {selectedLanguage === "es"
                              ? "Audio Resumen Narrado por IA"
                              : selectedLanguage === "de"
                              ? "KI-narrative Audio-Zusammenfassung"
                              : selectedLanguage === "tr"
                              ? "Yapay Zeka Anlatımlı Sesli Özet"
                              : "AI-Narrated Audio Summary"}
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-violet-500/10 text-violet-300 border border-violet-500/20 uppercase">
                              {selectedLanguage === "es" ? "PREMIUM IA" : selectedLanguage === "de" ? "PREMIUM KI" : selectedLanguage === "tr" ? "PREMIUM YZ" : "PREMIUM AI"}
                            </span>
                          </h3>
                          <p className="text-[10px] text-zinc-500 font-medium">
                            {selectedLanguage === "es"
                              ? `Navegación Interactive de Locución ${selectedVoiceId === "gemini-aoede" ? "Femenina" : "Masculina"} Profesional`
                              : selectedLanguage === "de"
                              ? `Interaktive Navigation professioneller ${selectedVoiceId === "gemini-aoede" ? "weiblicher" : "männlicher"} Sprecher`
                              : selectedLanguage === "tr"
                              ? `Profesyonel ${selectedVoiceId === "gemini-aoede" ? "Kadın" : "Erkek"} Seslendirme ile Etkileşimli Gezinti`
                              : `Interactive Navigation of Professional ${selectedVoiceId === "gemini-aoede" ? "Female" : "Male"} Voiceover`}
                          </p>
                        </div>
                      </div>

                      {/* Speed & Voice Selection Options */}
                      <div className="flex flex-wrap items-center gap-3">
                        {/* Voice Selector */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                            {selectedLanguage === "es" ? "Voz:" : selectedLanguage === "de" ? "Stimme:" : selectedLanguage === "tr" ? "Ses:" : "Voice:"}
                          </span>
                          <select
                            value={selectedVoiceId}
                            onChange={(e) => handleVoiceIdChange(e.target.value)}
                            className="bg-zinc-950/80 hover:bg-zinc-900 border border-zinc-800/80 text-zinc-300 hover:text-white px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer outline-none focus:border-indigo-500/50 transition-all select-none"
                          >
                            <option value="gemini-charon">
                              Charon ({selectedLanguage === "es" ? "Narrador Masculino" : selectedLanguage === "de" ? "Männlicher Erzähler" : selectedLanguage === "tr" ? "Erkek Anlatıcı" : "Male Narrator"})
                            </option>
                            <option value="gemini-aoede">
                              Aoede ({selectedLanguage === "es" ? "Narradora Femenina" : selectedLanguage === "de" ? "Weibliche Erzälerin" : selectedLanguage === "tr" ? "Kadın Anlatıcı" : "Female Narrator"})
                            </option>
                            <option value="gemini-puck">
                              Puck ({selectedLanguage === "es" ? "Narrador Masculino" : selectedLanguage === "de" ? "Männlicher Erzähler" : selectedLanguage === "tr" ? "Erkek Anlatıcı" : "Male Narrator"})
                            </option>
                          </select>
                        </div>

                        {/* Speed Slider Control */}
                        <div className="flex items-center gap-3 bg-zinc-950/40 border border-zinc-800/30 px-3 py-1.5 rounded-xl select-none">
                          <span className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-wider">
                            {selectedLanguage === "es" ? "Velocidad:" : selectedLanguage === "de" ? "Geschwindigkeit:" : selectedLanguage === "tr" ? "Hız:" : "Speed:"}
                          </span>
                          <input
                            type="range"
                             min="1.0"
                            max="2.0"
                            step="0.1"
                            value={playbackRate}
                            onChange={(e) => handleRateChange(parseFloat(e.target.value), false)}
                            onMouseUp={() => handleRateChange(playbackRate, true)}
                            onTouchEnd={() => handleRateChange(playbackRate, true)}
                            className="w-24 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-violet-500 outline-none transition-all hover:accent-violet-400"
                            style={{
                              background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${(playbackRate - 1.0) * 100}%, #27272a ${(playbackRate - 1.0) * 100}%, #27272a 100%)`
                            }}
                          />
                          <span className="text-xs font-mono font-bold text-violet-400 w-8 text-right shrink-0">
                            {playbackRate.toFixed(1)}x
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 relative">
                      <div className="absolute top-0 left-0 w-32 h-32 bg-violet-500/5 blur-[40px] pointer-events-none" />
                      
                      {transcribing ? (
                        <div className="relative z-10 py-8 flex flex-col items-center justify-center text-center space-y-3">
                          <div className="p-4 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 animate-pulse">
                            <Headphones className="w-8 h-8" />
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-xs font-bold text-zinc-200 animate-pulse">
                              {selectedLanguage === "es" ? "Generando narración de audio..." : selectedLanguage === "de" ? "Audio-Erzählung wird generiert..." : selectedLanguage === "tr" ? "Sesli anlatım oluşturuluyor..." : "Generating audio narration..."}
                            </h4>
                            <p className="text-[10px] text-zinc-500 max-w-xs">
                              {selectedLanguage === "es" 
                                ? "Sincronizando el flujo de audio narrado por el presentador inteligente de HIVEX." 
                                : selectedLanguage === "de" 
                                ? "Synchronisieren des vom intelligenten HIVEX-Präsentator gesprochenen Audiostreams." 
                                : selectedLanguage === "tr" 
                                ? "HIVEX akıllı sunucusu tarafından seslendirilen ses akışı senkronize ediliyor." 
                                : "Synchronizing the audio stream narrated by the intelligent HIVEX presenter."}
                            </p>
                          </div>
                        </div>
                      ) : translationLoading ? (
                        <div className="relative z-10 py-8 flex flex-col items-center justify-center text-center space-y-3">
                          <div className="p-4 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 animate-bounce">
                            <Headphones className="w-8 h-8" />
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-xs font-bold text-zinc-200">
                              {selectedLanguage === "es" ? "Traduciendo narración de audio..." : selectedLanguage === "de" ? "Audio-Erzählung wird übersetzt..." : selectedLanguage === "tr" ? "Sesli anlatım çevriliyor..." : "Translating audio narration..."}
                            </h4>
                            <p className="text-[10px] text-zinc-500 max-w-xs">
                              {selectedLanguage === "es" 
                                ? "Estamos adaptando las marcas de tiempo y el resumen al idioma seleccionado para el narrador de IA." 
                                : selectedLanguage === "de" 
                                ? "Wir passen die Zeitstempel und die Zusammenfassung an die für den KI-Erzähler ausgewählte Sprache an." 
                                : selectedLanguage === "tr" 
                                ? "Zaman damgalarını ve özeti yapay zeka anlatıcısı için seçilen dile uyarlıyoruz." 
                                : "We are adapting the timestamps and the summary to the selected language for the AI narrator."}
                            </p>
                          </div>
                        </div>
                      ) : (
                        /* Premium horizontal scrubber deck */
                        <div className="relative z-10 flex flex-col gap-4 w-full">
                          {audioError && (
                            <div className="flex items-center gap-3 text-xs font-semibold text-rose-400 bg-rose-950/20 border border-rose-900/40 p-4 rounded-xl animate-fade-in select-none">
                              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 animate-pulse" />
                              <span className="flex-grow">{audioError}</span>
                              <button
                                onClick={() => {
                                  setAudioError(null);
                                  playGeminiSentence(activeSentenceIndexRef.current >= 0 ? activeSentenceIndexRef.current : 0);
                                }}
                                className="px-3 py-1.5 text-[10px] font-bold bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 rounded-lg active:scale-95 transition-all uppercase tracking-wider"
                              >
                                Reintentar
                              </button>
                            </div>
                          )}
                          <div className="flex flex-col md:flex-row items-center gap-4 w-full bg-zinc-950/40 border border-zinc-900/60 p-4 rounded-2xl select-none">
                            
                            {/* Controls: Play/Pause, Reset */}
                            <div className="flex items-center gap-3 shrink-0 w-full md:w-auto justify-center md:justify-start">
                              {isPlayingAudio && !isPausedAudio ? (
                                <button
                                  onClick={pauseAudio}
                                  className="w-12 h-12 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 border border-violet-500/30 text-white flex items-center justify-center shadow-lg shadow-violet-500/20 hover:scale-105 active:scale-95 transition-all group"
                                  title={t.pauseAudio || "Pausar Narración"}
                                >
                                  <Pause className="w-4.5 h-4.5 fill-current" />
                                </button>
                              ) : (
                                <button
                                  onClick={isPausedAudio ? resumeAudio : startAudioSummary}
                                  className="w-12 h-12 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 border border-violet-500/30 text-white flex items-center justify-center shadow-lg shadow-violet-500/20 hover:scale-105 active:scale-95 transition-all group"
                                  title={t.playTranslatedAudio || "Iniciar Narración"}
                                >
                                  <Play className="w-4.5 h-4.5 fill-current ml-0.5" />
                                </button>
                              )}

                              <button
                                onClick={stopAudio}
                                disabled={!isPlayingAudio && activeSentenceIndex === -1}
                                className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${
                                  isPlayingAudio || activeSentenceIndex >= 0
                                    ? "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800"
                                    : "bg-zinc-950/20 border-zinc-900/20 text-zinc-600 cursor-not-allowed"
                                }`}
                                title={selectedLanguage === "es" ? "Reiniciar Narración" : selectedLanguage === "de" ? "Erzählung zurücksetzen" : selectedLanguage === "tr" ? "Anlatımı Sıfırla" : "Reset Narration"}
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Progress Scrubber and Metadata Area */}
                            <div className="w-full flex-grow flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                              {/* Metadata Line (Only separate above scrubber on mobile, inline on desktop) */}
                              <div className="flex md:hidden items-center justify-between w-full">
                                {/* Estimated Playback Timer (Mobile) */}
                                <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-zinc-400 bg-zinc-900/60 border border-zinc-800/40 px-2.5 py-1 rounded-lg">
                                  <span className="text-violet-400">
                                    {formatElapsed(elapsedSeconds)}
                                  </span>
                                  <span className="text-zinc-600">/</span>
                                  <span>{formatTotal(totalDuration)}</span>
                                </div>

                                {/* Percentage Badge (Mobile) */}
                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-violet-500/10 text-violet-400 border border-violet-500/20">
                                  {(() => {
                                    const percent = totalSentences > 0 
                                      ? Math.round(((activeSentenceIndex >= 0 ? activeSentenceIndex + 1 : 0) / totalSentences) * 100)
                                      : 0;
                                    return `${percent}%`;
                                  })()}
                                </span>
                              </div>

                              {/* Estimated Playback Timer (Desktop only, positioned before scrubber) */}
                              <div className="hidden md:flex items-center gap-1 text-[11px] shrink-0 font-mono font-bold text-zinc-400 bg-zinc-900/60 border border-zinc-800/40 px-2.5 py-1 rounded-lg">
                                <span className="text-violet-400">
                                  {formatElapsed(elapsedSeconds)}
                                </span>
                                <span className="text-zinc-600">/</span>
                                <span>{formatTotal(totalDuration)}</span>
                              </div>

                              {/* Range Slider Scrubber */}
                              <div className="flex-1 w-full flex items-center">
                                <input
                                  type="range"
                                  min="0"
                                  max={Math.max(0, totalSentences - 1)}
                                  value={activeSentenceIndex >= 0 ? activeSentenceIndex : 0}
                                  onChange={(e) => handleSeek(parseInt(e.target.value))}
                                  disabled={totalSentences === 0}
                                  className="w-full h-1.5 bg-zinc-800/80 rounded-lg appearance-none cursor-pointer accent-violet-500 outline-none transition-all hover:h-2"
                                  style={{
                                    background: (() => {
                                      const percent = totalSentences > 1 
                                        ? ((activeSentenceIndex >= 0 ? activeSentenceIndex : 0) / (totalSentences - 1)) * 100 
                                        : 0;
                                      return `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${percent}%, #27272a ${percent}%, #27272a 100%)`;
                                    })()
                                  }}
                                />
                              </div>

                              {/* Percentage Badge (Desktop only, positioned after scrubber) */}
                              <div className="hidden md:block shrink-0">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-violet-500/10 text-violet-400 border border-violet-500/20">
                                  {(() => {
                                    const percent = totalSentences > 0 
                                      ? Math.round(((activeSentenceIndex >= 0 ? activeSentenceIndex + 1 : 0) / totalSentences) * 100)
                                      : 0;
                                    return `${percent}%`;
                                  })()}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Interactive text bubble showing the active reading sentence */}
                          <div className="h-12 bg-zinc-950/20 border border-zinc-900/60 rounded-xl px-4 flex items-center justify-between gap-4 overflow-hidden relative">
                            {activeSentenceIndex >= 0 && sentenceChunks[activeSentenceIndex] ? (
                              <>
                                <div className="text-xs text-zinc-300 font-medium truncate flex-1 select-none italic">
                                  &ldquo;{sentenceChunks[activeSentenceIndex]}&rdquo;
                                </div>
                                {isPlayingAudio && !isPausedAudio && (
                                  <div className="flex items-center gap-0.5 shrink-0 h-6">
                                    {[1, 2, 3, 4, 5, 6, 7].map((bar) => {
                                      const heights = ["h-3", "h-5", "h-2", "h-6", "h-4", "h-5", "h-3"];
                                      const delays = ["delay-75", "delay-200", "delay-100", "delay-300", "delay-150", "delay-500", "delay-200"];
                                      return (
                                        <div
                                          key={bar}
                                          className={`w-0.5 bg-indigo-400 rounded-full animate-bounce ${heights[bar - 1]} ${delays[bar - 1]}`}
                                          style={{
                                            animationDuration: `${0.6 + bar * 0.15}s`
                                          }}
                                        />
                                      );
                                    })}
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="text-xs text-zinc-500 font-medium select-none">
                                {totalSentences > 0 
                                  ? (selectedLanguage === "es" 
                                      ? `Resumen preparado (${totalSentences} frases). Presiona el botón de reproducción para escuchar la locución profesional.` 
                                      : selectedLanguage === "de" 
                                      ? `Zusammenfassung bereit (${totalSentences} Sätze). Drücken Sie die Wiedergabetaste, um die professionelle Erzählung anzuhören.` 
                                      : selectedLanguage === "tr" 
                                      ? `Özet hazır (${totalSentences} cümle). Profesyonel seslendirmeyi dinlemek için oynat düğmesine basın.` 
                                      : `Summary prepared (${totalSentences} sentences). Press the play button to listen to the professional narration.`)
                                  : (selectedLanguage === "es" 
                                      ? "No hay resumen de audio disponible." 
                                      : selectedLanguage === "de" 
                                      ? "Keine Audio-Zusammenfassung verfügbar." 
                                      : selectedLanguage === "tr" 
                                      ? "Sesli özet bulunmuyor." 
                                      : "No audio summary available.")
                                }
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* D. INFORME DE ANÁLISIS DE INVERSIÓN */}
                {(transcribing || report || translationLoading || !transcriptionErrorFinal) && (
                  <div className="rounded-2xl border border-zinc-900 bg-zinc-900/5 overflow-hidden shadow-xl">
                    <button
                      onClick={() => setReportExpanded(!reportExpanded)}
                      className="w-full px-6 py-4 bg-zinc-900/10 hover:bg-zinc-900/20 border-b border-zinc-900/40 flex items-center justify-between transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <Briefcase className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                        <div className="text-left">
                          <h3 className="text-sm font-extrabold text-white tracking-wide uppercase">
                            {selectedLanguage === "es"
                              ? "Informe de Análisis de Inversión"
                              : selectedLanguage === "de"
                              ? "Investitionsanalysebericht"
                              : selectedLanguage === "tr"
                              ? "Yatırım Analiz Raporu"
                              : "Investment Analysis Report"}
                          </h3>
                          <p className="text-[10px] text-zinc-500 font-medium">
                            {selectedLanguage === "es"
                              ? "Análisis Macroeconómico de Vehículos Inversores y Mercados"
                              : selectedLanguage === "de"
                              ? "Makroökonomische Analyse von Anlageinstrumenten und Märkten"
                              : selectedLanguage === "tr"
                              ? "Yatırım Araçları ve Piyasaların Makroekonomik Analizi"
                              : "Macroeconomic Analysis of Investment Vehicles and Markets"}
                          </p>
                        </div>
                      </div>
                      <div className="p-1.5 rounded-lg bg-zinc-900/50 group-hover:bg-zinc-800/80 border border-zinc-800/30 text-zinc-400 group-hover:text-white transition-all">
                        {reportExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </button>

                    <div 
                      className={`transition-all duration-300 ease-in-out overflow-hidden ${
                        reportExpanded ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0"
                      }`}
                    >
                      <div className="p-6 relative select-text">
                        <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-500/5 blur-[40px] pointer-events-none" />
                        <div className="relative z-10">
                          {transcribing || translationLoading ? (
                            <ShimmerSkeleton />
                          ) : (
                            <>
                              {/* Model Consumption Banner */}
                              {transcriptionModel && (
                                <div className="mb-4 p-4 rounded-xl border border-zinc-900/60 bg-zinc-950/40 backdrop-blur-md flex flex-col gap-3 pb-3">
                                  <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div className="flex items-center gap-2">
                                      <div className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                      </div>
                                      <span className="text-xs font-bold text-zinc-400">
                                        {selectedLanguage === "es" ? "Consumo de Modelos:" : selectedLanguage === "de" ? "Modellverbrauch:" : selectedLanguage === "tr" ? "Model Tüketimi:" : "Model Consumption:"}
                                      </span>
                                      <span className="text-xs font-mono text-zinc-100 bg-zinc-900/80 px-2 py-0.5 rounded border border-zinc-800">
                                        {displayModelName}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full tracking-wider uppercase flex items-center gap-1.5">
                                        <span className="relative flex h-1.5 w-1.5">
                                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                        </span>
                                        {selectedLanguage === "es" ? "Conexión en Vivo Activa" : selectedLanguage === "de" ? "Aktive Live-Verbindung" : selectedLanguage === "tr" ? "Aktif Canlı Bağlantı" : "Active Live Connection"}
                                      </span>
                                    </div>
                                  </div>
                                  {liveStreamWarning && (
                                    <div className="mt-1 text-xs font-semibold text-amber-400/90 bg-amber-500/5 border border-amber-500/10 px-3 py-2 rounded-lg flex items-center gap-2">
                                      <span>⚠️</span>
                                      <span>{liveStreamWarning}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                              <MarkdownRenderer 
                                content={report || (
                                  selectedLanguage === "es"
                                    ? "No hay informe de análisis de inversión disponible."
                                    : selectedLanguage === "de"
                                    ? "Kein Investitionsanalysebericht verfügbar."
                                    : selectedLanguage === "tr"
                                    ? "Yatırım analiz raporu bulunmuyor."
                                    : "No investment analysis report available."
                                )} 
                                modelUsed={transcriptionModel || "Google Vertex AI Gemini 1.5 Pro"}
                                selectedLanguage={selectedLanguage}
                              />
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Page Title Header with Sync Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-zinc-900/60">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl flex items-center gap-3">
            {filterFavorite ? (t.titleFavs || "Vídeos Preferidos") : (filterChannel || "Andrei Jikh")}
          </h1>
          <p className="text-zinc-400 font-light mt-1 text-sm md:text-base">
            {filterFavorite ? (t.subtitleFavs || "Feed cronológico de tus lecciones de estudio en vídeo seleccionadas preferidas.") : (t.subtitle || "Consola multimedia HTML5 avanzada con resúmenes de IA, traducciones y síntesis de voz premium.")}
          </p>
        </div>

        <div className="flex flex-col gap-2.5 self-start md:self-auto">
          {/* RESET BUTTON - Only visible to superuser */}
          {userEmail && (userEmail === "admin@kubicatrading.es" || userEmail.startsWith("admin@kubicatrading") || userEmail === "semeviene@hotmail.es") && (
            <button
              onClick={handleResetTestingVideos}
              disabled={isResetting || syncing}
              className="px-5 py-2 rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-400 hover:text-red-300 text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Trash2 className={`w-4 h-4 ${isResetting ? "animate-spin text-red-400" : ""}`} />
              {isResetting 
                ? (selectedLanguage === "es" ? "Restableciendo..." : selectedLanguage === "de" ? "Zurücksetzen..." : selectedLanguage === "tr" ? "Sıfırlanıyor..." : "Resetting...") 
                : (selectedLanguage === "es" ? "Restablecer Videoteca (Reset)" : selectedLanguage === "de" ? "Videothek zurücksetzen" : selectedLanguage === "tr" ? "Kütüphaneyi Sıfırla" : "Reset Video Library")}
            </button>
          )}

          {/* SYNC BUTTON */}
          <button
            onClick={() => handleSyncChannel(false)}
            disabled={syncing || isResetting}
            className="px-5 py-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-400 hover:text-emerald-300 text-xs font-bold transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Sparkles className={`w-4 h-4 ${syncing ? "animate-spin text-emerald-400" : ""}`} />
            {syncing 
              ? `${t.syncing || "Sincronizando..."}` 
              : (t.syncBtn || "Sincronizar Canal")}
          </button>
        </div>
      </div>

      {/* Sync Error Alert */}
      {syncError && (
        <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{syncError}</span>
        </div>
      )}

      {/* Main viewport */}
      <div className="grid lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: ACTIVE VIDEO VIEWER & INFOCARD */}
        <div className="lg:col-span-8 space-y-6">
          {/* Hibrid Player Card */}
          <div className="rounded-2xl border border-zinc-900 bg-black overflow-hidden relative group shadow-2xl">
            {selectedVideo ? (
              <div className="relative w-full aspect-video bg-black">
                {isSelectedYoutube ? (
                  <iframe
                    src={selectedVideo.file_url}
                    title={selectedVideo.title}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <video
                    ref={videoRef}
                    src={selectedVideo.file_url}
                    controls
                    className="w-full h-full object-contain"
                  />
                )}
              </div>
            ) : (
              <div className="w-full aspect-video flex flex-col items-center justify-center text-center p-8 bg-zinc-950">
                <Video className="w-12 h-12 text-zinc-700 mb-2" />
                <p className="text-sm text-zinc-500">
                  {selectedLanguage === "es" 
                    ? "Selecciona o sube un vídeo para reproducir." 
                    : selectedLanguage === "de" 
                      ? "Wählen Sie ein Video aus oder laden Sie eines hoch, um es abzuspielen." 
                      : selectedLanguage === "tr" 
                        ? "Oynatmak için bir video seçin veya yükleyin." 
                        : "Select or upload a video to play."}
                </p>
              </div>
            )}
          </div>

          {/* Video Details Card & Financial Reports */}
          {selectedVideo && (
            <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-900/10 relative overflow-hidden">
              <div className="absolute top-[-20%] left-[-20%] w-[50%] h-[50%] bg-sky-500/5 blur-[50px] pointer-events-none" />
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight leading-snug">{selectedVideo.title}</h2>
                  <p className="text-xs text-zinc-500 mt-1">
                    {selectedVideo.metadata.channel_title ? `${selectedLanguage === "es" ? "Canal" : selectedLanguage === "de" ? "Kanal" : selectedLanguage === "tr" ? "Kanal" : "Channel"}: ${selectedVideo.metadata.channel_title} • ` : ""}
                    {selectedLanguage === "es" ? "Publicado el" : selectedLanguage === "de" ? "Veröffentlicht am" : selectedLanguage === "tr" ? "Yayınlanma tarihi" : "Published on"}: {new Date(selectedVideo.created_at).toLocaleDateString(selectedLanguage === "en" ? "en-US" : selectedLanguage === "es" ? "es-ES" : selectedLanguage === "de" ? "de-DE" : "tr-TR")}
                  </p>
                </div>
                
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setActiveStudyVideo(selectedVideo)}
                    className="px-3.5 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-black text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    {t.studyCabin || "Cabina de Estudio"}
                  </button>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                    <Monitor className="w-3.5 h-3.5" />
                    {selectedVideo.metadata.resolution}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIDEO LIST CONTEXT */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-white">{t.catalogTitle || "Catálogo de Vídeos Guardados"}</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {loading ? (
                [1, 2].map((i) => (
                  <div key={i} className="h-24 rounded-xl bg-zinc-900/30 border border-zinc-900 animate-pulse" />
                ))
              ) : filteredVideos.length === 0 ? (
                <div className="p-6 text-center rounded-2xl bg-zinc-900/20 border border-zinc-900 col-span-2 text-sm text-zinc-500">
                  {filterFavorite ? (
                    "No hay vídeos favoritos"
                  ) : (
                    <>Aún no tienes vídeos cargados para el canal {filterChannel || "seleccionado"}. Pulsa &quot;Sincronizar Canal&quot; o usa el panel lateral.</>
                  )}
                </div>
              ) : (
                 filteredVideos.map((v) => {
                  const isYt = v.metadata?.is_youtube || 
                                v.file_url?.includes("youtube.com") || 
                                v.file_url?.includes("youtu.be");
                  const isOld = Boolean(v.metadata?.is_old) && !v.metadata?.is_favorite;
                  return (
                    <div
                      key={v.id}
                      onClick={() => {
                        if (filterFavorite) {
                          setActiveStudyVideo(v);
                        } else {
                          setSelectedVideo(v);
                        }
                      }}
                      className={`rounded-xl border overflow-hidden cursor-pointer flex gap-3.5 transition-all p-2 relative ${isOld ? "opacity-75 grayscale border-zinc-800 bg-zinc-950/20" : ""} ${selectedVideo?.id === v.id ? "bg-sky-500/10 border-sky-500/40" : "bg-zinc-900/30 border-zinc-900/80 hover:border-zinc-800"}`}
                    >
                      {isOld && (
                        <div className="absolute inset-0 bg-zinc-950/30 pointer-events-none rounded-xl" />
                      )}

                      {/* Video Thumbnail */}
                      <div className="w-24 h-16 bg-zinc-950 flex-shrink-0 relative rounded-lg overflow-hidden border border-zinc-900">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={v.metadata.thumbnail} 
                          alt={v.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.currentTarget;
                            if (target.src.includes("maxresdefault.jpg")) {
                              target.src = target.src.replace("maxresdefault.jpg", "hqdefault.jpg");
                            } else if (target.src.includes("hqdefault.jpg")) {
                              target.src = "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=800&q=80";
                            } else if (target.src !== "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=800&q=80") {
                              target.src = "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=800&q=80";
                            }
                          }}
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <Play className="w-4 h-4 text-white/90 fill-white" />
                        </div>
                        <span className="absolute bottom-1 right-1 px-1 rounded bg-black/75 text-[8px] font-bold text-zinc-300 font-mono">
                          {v.metadata.duration}
                        </span>
                      </div>

                      <div className="flex-grow min-w-0 pr-1 flex flex-col justify-between relative z-20">
                        <div className="min-w-0">
                          <div className={`text-xs font-bold truncate ${isYt ? "text-emerald-400" : "text-white"}`}>{v.title}</div>
                          <div className="text-[10px] text-zinc-500 truncate mt-0.5">
                            {new Date(v.created_at).toLocaleDateString("en-US")}
                            {isOld && (
                              <span className="ml-1.5 px-1.5 py-0.5 rounded bg-zinc-800/80 border border-zinc-700/60 text-zinc-400 font-mono text-[8.5px] font-extrabold uppercase">
                                Old
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 font-bold">
                          <span className="text-[9px] uppercase">{isYt ? (v.metadata?.channel_title || "Andrei Jikh") : v.metadata?.resolution}</span>
                          <div className="flex items-center gap-1.5">
                            {isYt && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveStudyVideo(v);
                                }}
                                className="px-2 py-0.5 rounded bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 text-sky-400 text-[9px] font-bold transition-all"
                              >
                                Analysis
                              </button>
                            )}

                            {/* Heart Toggle Button */}
                            <button
                              onClick={(e) => toggleFavorite(v, e)}
                              className={`p-1 rounded hover:bg-rose-500/10 transition-all ${v.metadata.is_favorite ? "text-rose-500 hover:text-rose-600 animate-pulse-subtle" : "text-zinc-600 hover:text-rose-400"}`}
                              title={
                                selectedLanguage === "es"
                                  ? (v.metadata.is_favorite ? "Quitar de preferidos" : "Marcar como preferido")
                                  : selectedLanguage === "de"
                                  ? (v.metadata.is_favorite ? "Aus Favoriten entfernen" : "Als Favorit markieren")
                                  : selectedLanguage === "tr"
                                  ? (v.metadata.is_favorite ? "Favorilerden kaldır" : "Favorilere ekle")
                                  : (v.metadata.is_favorite ? "Remove from favorites" : "Mark as favorite")
                              }
                            >
                              <Heart className={`w-3.5 h-3.5 ${v.metadata.is_favorite ? "fill-current" : ""}`} />
                            </button>

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
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: VIDEO LOADER / LINK CREATOR */}
        <div className="lg:col-span-4 rounded-2xl border border-zinc-900 bg-zinc-900/20 p-6 space-y-6">
          <div className="flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-sky-400" />
            <h3 className="text-base font-bold text-white">
              {t.uploadTitle || "Subir Vídeo (Enlace)"}
            </h3>
          </div>

          <form onSubmit={handleCreateVideo} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                {t.videoTitleLabel || "Título del Vídeo"}
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  selectedLanguage === "es"
                    ? "ej. Lanzamiento de Producto 2026"
                    : selectedLanguage === "de"
                    ? "z.B. Produktvorstellung 2026"
                    : selectedLanguage === "tr"
                    ? "örn. Ürün Tanıtımı 2026"
                    : "e.g., Product Launch 2026"
                }
                className="w-full px-3 py-2 bg-zinc-900/60 border border-zinc-800 focus:border-sky-500 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                {t.descriptionLabel || "Descripción"}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  selectedLanguage === "es"
                    ? "ej. Demo cinemática de la plataforma SaaS..."
                    : selectedLanguage === "de"
                    ? "z.B. Kinoreife Demo der SaaS-Plattform..."
                    : selectedLanguage === "tr"
                    ? "örn. SaaS platformu sinematik demosu..."
                    : "e.g., Cinematic SaaS platform demo..."
                }
                className="w-full px-3 py-2 bg-zinc-900/60 border border-zinc-800 focus:border-sky-500 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none text-xs min-h-[50px] max-h-[100px]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                {t.resolutionLabel || "Resolución del Vídeo"}
              </label>
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
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                {t.durationLabel || "Duración del Vídeo"}
              </label>
              <input
                type="text"
                required
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder={
                  selectedLanguage === "es"
                    ? "ej. 12:00 (Mínimo 5:00)"
                    : selectedLanguage === "de"
                    ? "z.B. 12:00 (Mindestens 5:00)"
                    : selectedLanguage === "tr"
                    ? "örn. 12:00 (En az 5:00)"
                    : "e.g., 12:00 (Minimum 5:00)"
                }
                className="w-full px-3 py-2 bg-zinc-900/60 border border-zinc-800 focus:border-sky-500 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none text-xs"
              />
              <span className="text-[9px] text-zinc-600 block leading-tight font-light italic">
                {selectedLanguage === "es"
                  ? "* Debe ser de al menos 5 minutos (5:00) para poder sincronizarse."
                  : selectedLanguage === "de"
                  ? "* Muss mindestens 5 Minuten (5:00) lang sein, um synchronisiert zu werden."
                  : selectedLanguage === "tr"
                  ? "* Senkronize edilebilmesi için en az 5 dakika (5:00) olmalıdır."
                  : "* Must be at least 5 minutes (5:00) to synchronize."}
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                {t.thumbnailLabel || "Enlace de Miniatura (Thumbnail)"}
              </label>
              <input
                type="url"
                value={thumbnail}
                onChange={(e) => setThumbnail(e.target.value)}
                placeholder="https://images.unsplash.com/photo-..."
                className="w-full px-3 py-2 bg-zinc-900/60 border border-zinc-800 focus:border-sky-500 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none text-xs"
              />
              <span className="text-[9px] text-zinc-600 block leading-tight font-light italic">
                {selectedLanguage === "es"
                  ? "* Opcional. Si lo dejas en blanco, usaremos una imagen cinemática predeterminada."
                  : selectedLanguage === "de"
                  ? "* Optional. Wenn Sie es leer lassen, verwenden wir ein standardmäßiges kinoreifes Bild."
                  : selectedLanguage === "tr"
                  ? "* İsteğe bağlı. Boş bırakırsanız, varsayılan bir sinematik görsel kullanırız."
                  : "* Optional. If left blank, we will use a default cinematic image."}
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  {selectedLanguage === "es"
                    ? "URL del Archivo de Vídeo"
                    : selectedLanguage === "de"
                    ? "URL der Videodatei"
                    : selectedLanguage === "tr"
                    ? "Video Dosyası URL'si"
                    : "Video File URL"}
                </label>
                <span className="text-[9px] text-zinc-500 font-light">
                  {selectedLanguage === "es"
                    ? "MP4 directa"
                    : selectedLanguage === "de"
                    ? "Direkte MP4"
                    : selectedLanguage === "tr"
                    ? "Doğrudan MP4"
                    : "Direct MP4"}
                </span>
              </div>
              <input
                type="url"
                required
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                placeholder={
                  selectedLanguage === "es"
                    ? "https://ejemplo.com/video.mp4"
                    : selectedLanguage === "de"
                    ? "https://beispiel.de/video.mp4"
                    : selectedLanguage === "tr"
                    ? "https://ornek.com/video.mp4"
                    : "https://example.com/video.mp4"
                }
                className="w-full px-3 py-2 bg-zinc-900/60 border border-zinc-800 focus:border-sky-500 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none text-xs"
              />
              <span className="text-[9px] text-zinc-600 block leading-tight font-light italic">
                {selectedLanguage === "es"
                  ? "* Para probar, puedes usar: `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4` o `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4`"
                  : selectedLanguage === "de"
                  ? "* Zum Testen können Sie verwenden: `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4` oder `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4`"
                  : selectedLanguage === "tr"
                  ? "* Test etmek için şunları kullanabilirsiniz: `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4` veya `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4`"
                  : "* For testing, you can use: `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4` or `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4`"}
              </span>
            </div>

            <button
              type="submit"
              disabled={formLoading}
              className="w-full py-2.5 px-4 font-bold text-xs text-white bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-400 hover:to-blue-400 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {formLoading
                ? (selectedLanguage === "es"
                  ? "Guardando..."
                  : selectedLanguage === "de"
                  ? "Speichern..."
                  : selectedLanguage === "tr"
                  ? "Kaydediliyor..."
                  : "Saving...")
                : (t.submitBtn || "Subir Recurso de Vídeo")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
