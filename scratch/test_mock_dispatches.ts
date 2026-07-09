import * as fs from 'fs';
import path from 'path';
import { sendTelegramMessageWithPhotos } from '../lib/telegram';

// 1. Read and load all environment variables from .env.local
const envPath = path.join(__dirname, '../.env.local');
console.log(`[Mock Dispatch] Loading environment variables from: ${envPath}`);
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, 'utf8');
  envText.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.\-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] || "";
      value = value.replace(/^["']|["']$/g, "").trim();
      process.env[match[1]] = value;
    }
  });
}

const chatId = process.env.TELEGRAM_CHAT_ID;

if (!chatId) {
  console.error("[Mock Dispatch] Missing TELEGRAM_CHAT_ID!");
  process.exit(1);
}

async function run() {
  console.log("[Mock Dispatch] Preparing Test 1 (Strict HIVEX Context)...");

  // ==========================================
  // TEST 1: STRICT HIVEX CONTEXT (No Internet)
  // ==========================================
  const mockResponse1 = `Estimados inversores de HIVEX, les presento a continuación nuestro informe de asesoría financiera bursátil de alta gama. El propósito de esta comunicación es analizar los movimientos clave y las tendencias macroeconómicas que se han monitorizado en nuestra cabina de estudio durante las últimas 48 horas para ajustar nuestro posicionamiento táctico.

A través de las transmisiones analizadas en HIVEX, observamos un patrón contundente de acumulación silenciosa de activos refugio por parte de instituciones globales de primer orden, lo que exige una reevaluación inmediata de nuestra liquidez.

**▫️ Tesis del Análisis**:
La reciente restricción en las operaciones de oro por parte de reguladores asiáticos busca frenar la fuga de capitales fiat hacia activos físicos. Los bancos centrales continúan adquiriendo metal físico en la sombra, preparándose para una reestructuración monetaria global.

**▫️ Números y Niveles Tácticos**:
Las compras oficiales netas reportadas ascienden a \`244 toneladas\`. Sin embargo, la acumulación no oficial o en la sombra ("shadow accumulation") se estima en más del doble, sirviendo como cobertura preventiva contra el envilecimiento del dólar.

![Central Bank Net Gold Purchases (Q1)](https://lhtlrztsmkllcqiziftn.supabase.co/storage/v1/object/public/documents/clips/15c513a0-81bf-4880-b3e9-9524c7c0624f/740.mp4)

*   Acceso Premium al gráfico en la videoteca de estudio: [Central Bank Net Gold Purchases (Q1)](https://hivex-backend.vercel.app/dashboard/videos?id=15c513a0-81bf-4880-b3e9-9524c7c0624f&start=740&end=780&from=telegram)
*   Fuente del estudio completo: [China Just Shut Down Gold Trading](https://hivex-backend.vercel.app/dashboard/videos?id=15c513a0-81bf-4880-b3e9-9524c7c0624f)

━━━━━━━━━━━━━━━━━━━━━━━━━━
_Asesoría premium basada exclusivamente en la base de datos de HIVEX._`;

  console.log(`[Mock Dispatch] Dispatching Test 1 to Telegram Chat ID: ${chatId}...`);
  try {
    const result1 = await sendTelegramMessageWithPhotos(mockResponse1, chatId);
    console.log("[Mock Dispatch] Test 1 dispatched successfully!", result1);
  } catch (err) {
    console.error("[Mock Dispatch] Test 1 failed:", err);
  }

  // Sleep for 4 seconds to respect Telegram limits
  console.log("[Mock Dispatch] Waiting 4 seconds before Test 2...");
  await new Promise(resolve => setTimeout(resolve, 4000));

  // ==========================================
  // TEST 2: HIVEX CONTEXT + GOOGLE SEARCH GROUNDING
  // ==========================================
  console.log("\n[Mock Dispatch] Preparing Test 2 (HIVEX Context + Internet)...");

  const mockResponse2 = `Estimados inversores de HIVEX, les presento a continuación nuestro análisis bursátil integral de mercado. El propósito de este mensaje es cruzar los últimos datos estratégicos y gráficos de nuestra cabina de estudio con las noticias financieras de internet de última hora, permitiendo una visión de 360 grados sobre el entorno de tipos de interés.

Combinando los informes internos de HIVEX con las noticias frescas de la prensa financiera internacional, asistimos a una coyuntura crítica donde los mercados de deuda anticipan con fuerza las decisiones de la Reserva Federal.

**▫️ Tesis del Análisis**:
El rendimiento del bono del Tesoro a 10 años muestra una fuerte volatilidad en respuesta a las declaraciones recientes de los gobernadores de la Fed. Los datos en tiempo real de internet confirman que la inflación subyacente sigue presionando los márgenes, mientras que en HIVEX estudiamos cómo el endurecimiento cuantitativo impacta directamente en la liquidez bancaria comercial.

**▫️ Números y Niveles Tácticos**:
El rendimiento del bono a 10 años fluctúa en torno al \`4.28%\`. Las cotizaciones en vivo reflejan un soporte técnico crítico en el \`4.15%\`, cuya ruptura podría acelerar la rotación hacia valores de renta variable defensiva.

![US 10-Year Treasury Yield Trend](https://lhtlrztsmkllcqiziftn.supabase.co/storage/v1/object/public/documents/clips/15c513a0-81bf-4880-b3e9-9524c7c0624f/740.mp4)

*   Acceso Premium al gráfico en la videoteca de estudio: [US 10-Year Treasury Yield Trend](https://hivex-backend.vercel.app/dashboard/videos?id=15c513a0-81bf-4880-b3e9-9524c7c0624f&start=740&end=780&from=telegram)
*   Fuente del estudio completo de HIVEX: [China Just Shut Down Gold Trading](https://hivex-backend.vercel.app/dashboard/videos?id=15c513a0-81bf-4880-b3e9-9524c7c0624f)
*   Fuentes externas de internet: [Yahoo Finance Markets](https://finance.yahoo.com) y [Bloomberg Bond Yields](https://www.bloomberg.com/markets/rates-bonds)

━━━━━━━━━━━━━━━━━━━━━━━━━━
_Asesoría premium de 360 grados combinando HIVEX con Google Search Grounding._`;

  console.log(`[Mock Dispatch] Dispatching Test 2 to Telegram Chat ID: ${chatId}...`);
  try {
    const result2 = await sendTelegramMessageWithPhotos(mockResponse2, chatId);
    console.log("[Mock Dispatch] Test 2 dispatched successfully!", result2);
  } catch (err) {
    console.error("[Mock Dispatch] Test 2 failed:", err);
  }

  console.log("\n[Mock Dispatch] All mock dispatches complete!");
}

run();
