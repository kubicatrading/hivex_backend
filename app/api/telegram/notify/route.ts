import { NextRequest, NextResponse } from "next/server";
import { sendTelegramMessage, formatVideoNotification, escapeHtml } from "@/lib/telegram";

/**
 * Basic markdown-to-Telegram-HTML conversion utility to ensure
 * formatted text is robustly parsed by Telegram's strict HTML parser.
 */
function markdownToTelegramHtml(markdown: string): string {
  if (!markdown) return "";

  // 1. First escape raw HTML tags
  let html = markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // 2. Convert Headings (e.g., ### Title -> <b>Title</b>)
  html = html.replace(/^###?\s+(.*)$/gm, "<b>$1</b>");
  html = html.replace(/^##\s+(.*)$/gm, "<b>$1</b>");
  html = html.replace(/^#\s+(.*)$/gm, "<b>$1</b>");

  // 3. Convert bold (**text** or __text__)
  html = html.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
  html = html.replace(/__(.*?)__/g, "<b>$1</b>");

  // 4. Convert italic (*text* or _text_)
  html = html.replace(/\*(.*?)\*/g, "<i>$1</i>");
  html = html.replace(/_([^_]+)_/g, "<i>$1</i>");

  // 5. Convert inline code (`code`)
  html = html.replace(/`(.*?)`/g, "<code>$1</code>");

  // 6. Convert lists (- item or * item -> • item)
  html = html.replace(/^\s*[-*+]\s+(.*)$/gm, "• $1");

  return html;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, message, videoTitle, channelName, analysisSummary, youtubeId } = body;

    let textToSend = "";

    if (type === "video_analysis") {
      // Automatic video analysis notification
      if (!videoTitle || !channelName || !analysisSummary) {
        return NextResponse.json(
          { success: false, error: "Missing required video analysis payload fields" },
          { status: 400 }
        );
      }
      textToSend = formatVideoNotification({
        videoTitle,
        channelName,
        analysisSummary,
        youtubeId,
      });
    } else {
      // Manual broadcast or general message
      if (!message) {
        return NextResponse.json(
          { success: false, error: "Message body is empty" },
          { status: 400 }
        );
      }

      // Convert basic markdown formatting into Telegram HTML
      textToSend = markdownToTelegramHtml(message);
    }

    const result = await sendTelegramMessage(textToSend);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Failed to dispatch Telegram message" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      simulated: result.simulated,
      message: result.simulated ? "Message simulated in server console" : "Message dispatched successfully"
    });
  } catch (error: any) {
    console.error("[Telegram API Route] Error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
