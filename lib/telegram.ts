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

  // 4. Convert relative panel links (e.g. [/dashboard/videos?id=UUID]) to absolute Vercel production links for Telegram
  html = html.replace(/\[([^\]]+)\]\((\/dashboard\/[^\s)]+)\)/g, '<a href="https://hivex-backend.vercel.app$2">$1</a>');

  // Convert flat UUID citations (e.g. [035ab5e6-330a-4b53-847e-8e11e9ec7382]) to clickable absolute HTML links in Telegram
  html = html.replace(/\[([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/gi, '<a href="https://hivex-backend.vercel.app/dashboard/videos?id=$1">Ver Análisis</a>');

  // 4b. Convert standard absolute links: [text](url) -> <a href="url">text</a>
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
  html = html.replace(/^\s*(?:>|&gt;)\s+(.*)$/gm, "<blockquote>$1</blockquote>");

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
export async function sendTelegramMessage(text: string, customChatId?: string): Promise<{
  success: boolean;
  simulated: boolean;
  error?: string;
}> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = customChatId || process.env.TELEGRAM_CHAT_ID;

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

/**
 * Splits a markdown text into chunks of at most maxLength characters,
 * respecting paragraph boundaries (\n\n) where possible.
 */
export function splitMarkdown(text: string, maxLength: number = 3000): string[] {
  if (!text) return [];
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  const paragraphs = text.split("\n\n");
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxLength) {
      // If a single paragraph is longer than maxLength, split it by lines
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = "";
      }

      const lines = paragraph.split("\n");
      for (const line of lines) {
        if (line.length > maxLength) {
          // If a single line is still longer than maxLength, split by characters
          if (currentChunk) {
            chunks.push(currentChunk.trim());
            currentChunk = "";
          }

          let remaining = line;
          while (remaining.length > 0) {
            let sliceEnd = maxLength;
            if (remaining.length > maxLength) {
              // Try to split at a space to avoid cutting words
              const lastSpace = remaining.lastIndexOf(" ", maxLength);
              if (lastSpace > 0) {
                sliceEnd = lastSpace;
              }
            }
            chunks.push(remaining.slice(0, sliceEnd).trim());
            remaining = remaining.slice(sliceEnd).trim();
          }
        } else {
          // Check if adding this line exceeds limit
          const separator = currentChunk ? "\n" : "";
          if ((currentChunk + separator + line).length > maxLength) {
            chunks.push(currentChunk.trim());
            currentChunk = line;
          } else {
            currentChunk += separator + line;
          }
        }
      }
    } else {
      // Check if adding this paragraph exceeds limit
      const separator = currentChunk ? "\n\n" : "";
      if ((currentChunk + separator + paragraph).length > maxLength) {
        chunks.push(currentChunk.trim());
        currentChunk = paragraph;
      } else {
        currentChunk += separator + paragraph;
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Helper to extract YouTube video ID (11 chars) from a URL.
 */
export function getYoutubeId(url: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

/**
 * Helper to send a photo to Telegram with HTML caption and auto-fallback to text.
 */
export async function sendTelegramPhoto(
  photoUrl: string,
  caption?: string,
  customChatId?: string,
  fallbackText?: string
): Promise<{
  success: boolean;
  simulated: boolean;
  photoSent: boolean;
  error?: string;
}> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = customChatId || process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.log("================ TELEGRAM PHOTO SIMULATION MODE ================");
    console.log(`URL: ${photoUrl}`);
    console.log(`Caption: ${caption || "[Ninguno]"}`);
    if (fallbackText) {
      console.log(`Fallback Text (would be used if sendPhoto failed):`);
      console.log(fallbackText);
    }
    console.log("=========================================================");
    return { success: true, simulated: true, photoSent: true };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        photo: photoUrl,
        caption: caption,
        parse_mode: "HTML"
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      const errorMsg = data.description || `HTTP status ${response.status}`;
      console.warn("[Telegram Service] Failed to send photo, falling back to message text. Error:", errorMsg);
      
      // Determine what text to send as fallback
      let finalFallbackText = "";
      if (fallbackText) {
        // Safe truncation of markdown before HTML conversion to avoid broken HTML tags
        let truncatedMarkdown = fallbackText;
        if (truncatedMarkdown.length > 3500) {
          truncatedMarkdown = truncatedMarkdown.slice(0, 3500) + "\n\n... *[Análisis truncado por longitud]*";
        }
        const fallbackHtml = markdownToTelegramHtml(truncatedMarkdown);
        finalFallbackText = `${fallbackHtml}\n\n<i>[Nota: No se pudo cargar el gráfico adjunto: ${photoUrl}]</i>`;
      } else if (caption) {
        finalFallbackText = `${caption}\n\n<i>[Nota: No se pudo cargar el gráfico adjunto: ${photoUrl}]</i>`;
        if (finalFallbackText.length > 4000) {
          finalFallbackText = finalFallbackText.slice(0, 4000) + "... <i>[Mensaje truncado]</i>";
        }
      } else {
        finalFallbackText = `<i>[Nota: No se pudo cargar el gráfico adjunto: ${photoUrl}]</i>`;
      }

      console.log("[Telegram Fallback Debug] finalFallbackText constructed (API fail):", finalFallbackText);
      
      const msgResult = await sendTelegramMessage(finalFallbackText, chatId);
      return { 
        success: msgResult.success, 
        simulated: msgResult.simulated, 
        photoSent: false,
        error: `Photo failed (${errorMsg}), fallback success: ${msgResult.success}` 
      };
    }

    console.log("[Telegram Service] Photo dispatched successfully to chat:", chatId);
    return { success: true, simulated: false, photoSent: true };
  } catch (error: any) {
    console.error("[Telegram Service] Photo fetch error:", error);
    let finalFallbackText = "";
    if (fallbackText) {
      let truncatedMarkdown = fallbackText;
      if (truncatedMarkdown.length > 3500) {
        truncatedMarkdown = truncatedMarkdown.slice(0, 3500) + "\n\n... *[Análisis truncado por longitud]*";
      }
      const fallbackHtml = markdownToTelegramHtml(truncatedMarkdown);
      finalFallbackText = `${fallbackHtml}\n\n<i>[Nota: Error de red al cargar el gráfico adjunto: ${photoUrl}]</i>`;
    } else if (caption) {
      finalFallbackText = `${caption}\n\n<i>[Nota: Error de red al cargar el gráfico adjunto: ${photoUrl}]</i>`;
      if (finalFallbackText.length > 4000) {
        finalFallbackText = finalFallbackText.slice(0, 4000) + "... <i>[Mensaje truncado]</i>";
      }
    } else {
      finalFallbackText = `<i>[Nota: Error de red al cargar el gráfico adjunto: ${photoUrl}]</i>`;
    }
    
    const msgResult = await sendTelegramMessage(finalFallbackText, chatId);
    return { 
      success: msgResult.success, 
      simulated: msgResult.simulated, 
      photoSent: false,
      error: `Photo crashed (${error?.message}), fallback success: ${msgResult.success}` 
    };
  }
}

/**
 * Parses markdown text, intercepts images (e.g. ![alt](url)), formats HTML,
 * and distributes them appropriately via /sendPhoto and /sendMessage.
 */
export async function sendTelegramMessageWithPhotos(
  text: string,
  customChatId?: string
): Promise<{
  success: boolean;
  simulated: boolean;
  error?: string;
}> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = customChatId || process.env.TELEGRAM_CHAT_ID;

  // 1. Regex to capture markdown images: ![alt](url)
  const imageRegex = /!\[([^\]]*)\]\(((?:https?:\/\/[^\s)]+|\/[^\s)]+))\)/g;
  const matches: { alt: string; url: string; start: number; end: number }[] = [];
  let match;

  while ((match = imageRegex.exec(text)) !== null) {
    matches.push({
      alt: match[1],
      url: match[2],
      start: match.index,
      end: imageRegex.lastIndex
    });
  }

  // If no images found, route transparently to standard sendTelegramMessage
  if (matches.length === 0) {
    return sendTelegramMessage(markdownToTelegramHtml(text), chatId);
  }

  // Helper to resolve relative snapshot URLs
  const resolveUrl = (url: string) => {
    if (url.startsWith("/")) {
      return `https://hivex-backend.vercel.app${url}`;
    }
    return url;
  };

  // 2. Partition the text into alternating non-image blocks
  const nonImageBlocks: string[] = [];
  let lastIndex = 0;
  for (let i = 0; i < matches.length; i++) {
    nonImageBlocks.push(text.substring(lastIndex, matches[i].start));
    lastIndex = matches[i].end;
  }
  nonImageBlocks.push(text.substring(lastIndex));

  // 3. Extract headings and explanations with a highly resilient bottom-to-top pattern
  let introText = "";
  const headings: string[] = [];
  const preExplanations: string[] = [];
  const postExplanations: string[] = [];

  for (let i = 0; i < matches.length; i++) {
    const block = nonImageBlocks[i];
    const lines = block.split("\n");
    
    // Find heading index bottom-to-top (only formal headings)
    let hIdx = -1;
    for (let j = lines.length - 1; j >= 0; j--) {
      const trimmedLine = lines[j].trim();
      if (trimmedLine === "") continue;
      
      const isHeading = 
        trimmedLine.startsWith("#") || 
        /^\[\d{1,2}:\d{2}(?::\d{2})?\]/i.test(trimmedLine) ||
        (/^####\s+\[?\d{1,2}:\d{2}/i.test(trimmedLine)) ||
        (trimmedLine.startsWith("**") && trimmedLine.endsWith("**") && trimmedLine.length < 120);
        
      if (isHeading) {
        hIdx = j;
        break;
      }
    }

    let heading = "";
    let leftoverBefore = "";
    let rightoverAfter = "";

    if (hIdx !== -1) {
      heading = lines[hIdx].trim();
      leftoverBefore = lines.slice(0, hIdx).join("\n").trim();
      rightoverAfter = lines.slice(hIdx + 1).join("\n").trim();
    } else {
      // If no formal heading is found:
      // - Treat the entire block as description/explanation (so rightoverAfter = entire block.trim())
      // - Fall back to the image's alt text as the heading
      heading = matches[i].alt || "Gráfico de Análisis";
      leftoverBefore = "";
      rightoverAfter = block.trim();
    }

    headings.push(heading);
    preExplanations.push(rightoverAfter);

    if (i === 0) {
      introText = leftoverBefore;
    } else {
      postExplanations.push(leftoverBefore);
    }
  }

  // The final block belongs entirely to the explanation of the last image
  postExplanations.push(nonImageBlocks[matches.length].trim());

  // Recombine explanation parts (pre-image and post-image) for each image
  const explanations: string[] = [];
  for (let i = 0; i < matches.length; i++) {
    const preExp = preExplanations[i] || "";
    const postExp = postExplanations[i] || "";
    
    let combined = "";
    if (preExp && postExp) {
      combined = `${preExp}\n\n${postExp}`;
    } else {
      combined = preExp || postExp;
    }
    explanations.push(combined.trim());
  }

  // If mock/simulation mode (no env vars)
  if (!botToken || !chatId) {
    console.log("================ TELEGRAM MULTIMEDIA SIMULATION MODE ================");
    console.log(`TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing.`);
    console.log(`Intro Text:`, introText);
    for (let i = 0; i < matches.length; i++) {
      console.log(`Image ${i}:`);
      console.log(`  URL: ${resolveUrl(matches[i].url)}`);
      console.log(`  Heading: ${headings[i]}`);
      console.log(`  Explanation: ${explanations[i]}`);
    }
    console.log("=========================================================");
    return { success: true, simulated: true };
  }

  // 4. Dispatch the sequence
  try {
    // 4.1. Send intro text if present
    if (introText.trim().length > 0) {
      const introHtml = markdownToTelegramHtml(introText);
      const introResult = await sendTelegramMessage(introHtml, chatId);
      if (!introResult.success) {
        console.warn("[Telegram Service] Failed to send intro text:", introResult.error);
      }
    }

    // 4.2. Send each image with its accompanying explanation as caption
    for (let i = 0; i < matches.length; i++) {
      const imgUrl = resolveUrl(matches[i].url);
      const heading = headings[i];
      const explanation = explanations[i];

      // Format caption
      const captionMarkdown = explanation
        ? `${heading}\n\n${explanation}`
        : heading;

      const captionHtml = markdownToTelegramHtml(captionMarkdown);

      if (captionHtml.length <= 950) {
        // Send image with full description as caption
        // Pass captionMarkdown as the fallbackText to ensure complete, tag-safe markdown truncation on failure
        const photoResult = await sendTelegramPhoto(imgUrl, captionHtml, chatId, captionMarkdown);
        if (!photoResult.success) {
          console.warn(`[Telegram Service] Failed to send photo ${i}:`, photoResult.error);
        }
      } else {
        // Caption exceeds 950 characters: send image with just the title/heading as caption
        const headingHtml = markdownToTelegramHtml(heading);
        // Pass captionMarkdown as fallbackText to send full explanation as text if sending photo fails
        const photoResult = await sendTelegramPhoto(imgUrl, headingHtml, chatId, captionMarkdown);
        if (!photoResult.success) {
          console.warn(`[Telegram Service] Failed to send photo ${i} with heading:`, photoResult.error);
        }

        // If the photo was successfully sent, we must send the detailed explanation as separate message(s)
        // If the photo failed, sendTelegramPhoto already fallback-sent the full unified explanation (via captionMarkdown),
        // so we must skip sending the explanation separately to prevent duplicate messages.
        if (photoResult.photoSent && explanation) {
          const chunks = splitMarkdown(explanation, 3000);
          for (const chunk of chunks) {
            const chunkHtml = markdownToTelegramHtml(chunk);
            await sendTelegramMessage(chunkHtml, chatId);
          }
        }
      }
    }

    return { success: true, simulated: false };
  } catch (error: any) {
    console.error("[Telegram Service] Error in sendTelegramMessageWithPhotos:", error);
    return { success: false, simulated: false, error: error?.message || "Unknown error" };
  }
}

