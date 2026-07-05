/**
 * HIVEX - Telegram Bot Notification Service
 * Secure server-side dispatcher for sending premium financial notifications and alerts.
 */

export function escapeHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export interface VideoAnalysisPayload {
  videoTitle: string;
  channelName: string;
  analysisSummary: string;
  youtubeId?: string;
}

/**
 * Formats a video analysis payload into a premium financial alert HTML template for Telegram.
 */
export function formatVideoNotification({
  videoTitle,
  channelName,
  analysisSummary,
  youtubeId,
}: VideoAnalysisPayload): string {
  const dateStr = new Date().toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  const escapedChannel = escapeHtml(channelName);
  const escapedTitle = escapeHtml(videoTitle);
  
  // Format summary: limit length if extremely long to avoid Telegram's 4096 char limit
  let trimmedSummary = analysisSummary;
  if (trimmedSummary.length > 2500) {
    trimmedSummary = trimmedSummary.slice(0, 2500) + "\n\n<i>[Resumen truncado debido a longitud...]</i>";
  }
  const escapedSummary = escapeHtml(trimmedSummary);

  let message = `<b>🎬 NUEVO VÍDEO SINCRONIZADO EN HIVEX</b>\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  message += `<b>📡 Canal:</b> <code>${escapedChannel}</code>\n`;
  message += `<b>title Título:</b> <i>${escapedTitle}</i>\n`;
  message += `<b>📅 Fecha de Análisis:</b> <code>${dateStr}</code>\n\n`;
  message += `<b>📊 Resumen del Análisis Bursátil:</b>\n`;
  message += `<blockquote>${escapedSummary}</blockquote>\n\n`;
  
  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  if (youtubeId) {
    message += `🔗 <a href="https://www.youtube.com/watch?v=${youtubeId}">Ver en YouTube</a> | `;
  }
  message += `<a href="https://hivex.app">Abrir Plataforma HIVEX</a>`;

  return message;
}

/**
 * Server-side helper to safely transmit a message to Telegram.
 * Operates in mock mode if environment variables are missing.
 */
export async function sendTelegramMessage(text: string): Promise<{
  success: boolean;
  simulated: boolean;
  error?: string;
}> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.log("================ TELEGRAM SIMULATION MODE ================");
    console.log(`TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing.`);
    console.log("Would send the following HTML message to Telegram:");
    console.log("---------------------------------------------------------");
    console.log(text);
    console.log("=========================================================");
    return { success: true, simulated: true };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: "HTML",
        disable_web_page_preview: false,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      const errorMsg = data.description || `HTTP status ${response.status}`;
      console.error("[Telegram Service] Failed to send message:", errorMsg);
      return { success: false, simulated: false, error: errorMsg };
    }

    console.log("[Telegram Service] Message dispatched successfully to chat:", chatId);
    return { success: true, simulated: false };
  } catch (error: any) {
    console.error("[Telegram Service] Fetch error:", error);
    return { success: false, simulated: false, error: error?.message || "Unknown network error" };
  }
}
