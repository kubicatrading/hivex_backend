import { NextRequest, NextResponse } from "next/server";
import { sendTelegramMessage, formatVideoNotification, escapeHtml, markdownToTelegramHtml } from "@/lib/telegram";

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
