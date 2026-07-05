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

/**
 * Converts standard Markdown syntax into Telegram-compatible HTML tags.
 * Employs placeholders to ensure content within inline code and code blocks is not formatted.
 */
export function markdownToTelegramHtml(markdown: string): string {
  if (!markdown) return "";

  // 1. First escape raw HTML special characters to prevent Telegram parse errors
  let html = markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // 2. Convert code blocks: ```lang\ncode\n``` -> <pre>code</pre>
  const codeBlocks: string[] = [];
  html = html.replace(/```([\s\S]*?)```/g, (_, code) => {
    const placeholder = `CODEBLOCKPLACEHOLDER${codeBlocks.length}`;
    codeBlocks.push(code.trim());
    return placeholder;
  });

  // 3. Convert inline code: `code` -> <code>code</code>
  const inlineCodes: string[] = [];
  html = html.replace(/`([^`]+)`/g, (_, code) => {
    const placeholder = `INLINECODEPLACEHOLDER${inlineCodes.length}`;
    inlineCodes.push(code.trim());
    return placeholder;
  });

  // 4. Convert links: [text](url) -> <a href="url">text</a>
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');

  // 5. Convert lists (- item, * item, + item -> • item) BEFORE headings/bold/italic
  // This is critical to prevent bullet asterisks from being matched as italic markers.
  html = html.replace(/^\s*[-*+]\s+(.*)$/gm, "• $1");

  // 6. Convert Headings (e.g., ### Title -> <b>Title</b>)
  html = html.replace(/^#+\s+(.*)$/gm, "<b>$1</b>");

  // 7. Convert bold (**text** or __text__) without matching across newlines
  html = html.replace(/\*\*([^\*\n]+?)\*\*/g, "<b>$1</b>");
  html = html.replace(/__([^_\n]+?)__/g, "<b>$1</b>");

  // 8. Convert italic (*text* or _text_) without matching across newlines
  html = html.replace(/\*([^\*\n]+?)\*/g, "<i>$1</i>");
  html = html.replace(/_([^_\n]+?)_/g, "<i>$1</i>");

  // 9. Convert Blockquotes: > text -> <blockquote>text</blockquote>
  html = html.replace(/^\s*>\s+(.*)$/gm, "<blockquote>$1</blockquote>");

  // 10. Restore code blocks and inline code
  codeBlocks.forEach((code, index) => {
    html = html.replace(`CODEBLOCKPLACEHOLDER${index}`, `<pre>${code}</pre>`);
  });

  inlineCodes.forEach((code, index) => {
    html = html.replace(`INLINECODEPLACEHOLDER${index}`, `<code>${code}</code>`);
  });

  return html;
}


export interface VideoAnalysisPayload {
  videoTitle: string;
  channelName: string;
  analysisSummary: string;
  youtubeId?: string;
  videoId?: string;
}

/**
 * Formats a video analysis payload into a premium financial alert HTML template for Telegram.
 */
export function formatVideoNotification({
  videoTitle,
  channelName,
  analysisSummary,
  youtubeId,
  videoId,
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
  message += `<b>🎬 Título:</b> <i>${escapedTitle}</i>\n`;
  message += `<b>📅 Fecha de Análisis:</b> <code>${dateStr}</code>\n\n`;
  message += `<b>📊 Resumen del Análisis Bursátil:</b>\n`;
  message += `<blockquote>${escapedSummary}</blockquote>\n\n`;
  
  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  const targetId = videoId || youtubeId;
  if (targetId) {
    message += `🔗 <a href="https://hivex-backend.vercel.app/dashboard/videos?id=${targetId}">Acceder a la Cabina de Estudio en HIVEX</a>`;
  } else {
    message += `🔗 <a href="https://hivex-backend.vercel.app/dashboard/videos">Abrir Plataforma HIVEX</a>`;
  }

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
