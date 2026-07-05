import { sendTelegramMessageWithPhotos } from "../lib/telegram";

async function run() {
  console.log("Starting Telegram Fallback Debug Test...");
  console.log("TELEGRAM_BOT_TOKEN:", process.env.TELEGRAM_BOT_TOKEN ? "Present" : "Missing");
  console.log("TELEGRAM_CHAT_ID:", process.env.TELEGRAM_CHAT_ID || "Missing");

  const testText = `### 📈 Análisis de Volatilidad

#### [01:23] **Gráfico de Volatilidad del Oro**
![Gráfico de Volatilidad del Oro](/snapshots/non_existent_video_uuid/83.jpg)
- **Precio Máximo**: Se sitúa por encima de los $55,000 por onza el 29 de enero.
- **Precio Actual**: Se sitúa en aproximadamente $4,000 por onza.
- **Porcentaje de Caída**: Representado como una caída del 28% desde el máximo.
*Leyenda: Representación visual de la extrema volatilidad de precios en el oro.*`;

  try {
    const result = await sendTelegramMessageWithPhotos(testText);
    console.log("Result:", result);
  } catch (err) {
    console.error("Error running test:", err);
  }
}

run();
