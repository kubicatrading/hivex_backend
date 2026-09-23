import { NextRequest, NextResponse } from "next/server";
import { 
  sendTelegramMessage, 
  sendTelegramMessageWithPhotos,
  sendVideoNotification, 
  sendMagazineNotification,
  markdownToTelegramHtml, 
  getTelegramLanguage,
  getSupabaseAdmin
} from "@/lib/telegram";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      type, 
      message, 
      videoTitle, 
      channelName, 
      analysisSummary, 
      youtubeId, 
      videoId, 
      coverUrl, 
      thumbnailUrl, 
      publishedAt, 
      title, 
      documentId, 
      issueSlug, 
      lang 
    } = body;

    if (type === "video_analysis" || type === "new_video") {
      // Automatic video analysis notification
      if (!videoTitle || !channelName) {
        return NextResponse.json(
          { success: false, error: "Missing required video analysis payload fields" },
          { status: 400 }
        );
      }
      const activeLang = lang || (await getTelegramLanguage());
      const result = await sendVideoNotification({
        videoTitle,
        channelName,
        analysisSummary,
        youtubeId,
        videoId,
        coverUrl: coverUrl || thumbnailUrl || (youtubeId ? `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg` : undefined),
        publishedAt,
        lang: activeLang,
      });

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error || "Failed to dispatch Telegram video notification" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        simulated: result.simulated,
        photoSent: result.photoSent,
        message: result.simulated ? "Video notification simulated in server console" : "Video notification dispatched successfully"
      });
    }

    if (type === "new_magazine" || type === "magazine") {
      const magTitle = title || videoTitle;
      if (!magTitle) {
        return NextResponse.json(
          { success: false, error: "Missing required magazine title" },
          { status: 400 }
        );
      }
      const activeLang = lang || (await getTelegramLanguage());
      const result = await sendMagazineNotification({
        title: magTitle,
        channelName: channelName || "Trends Journal",
        publishedAt,
        documentId,
        issueSlug,
        coverUrl,
        lang: activeLang,
      });

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error || "Failed to dispatch Telegram magazine notification" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        simulated: result.simulated,
        message: result.simulated ? "Magazine notification simulated in server console" : "Magazine notification dispatched successfully"
      });
    }

    // Manual broadcast or general assistant message from web platform
    if (!message) {
      return NextResponse.json(
        { success: false, error: "Message body is empty" },
        { status: 400 }
      );
    }

    // Resolve target chatId: from body, or look up authenticated user profile's linked telegram_chat_id
    let targetChatId = body.chatId;
    if (!targetChatId) {
      const authHeader = request.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        try {
          const supabaseAdmin = getSupabaseAdmin();
          if (supabaseAdmin) {
            const token = authHeader.substring(7);
            const { data: { user } } = await supabaseAdmin.auth.getUser(token);
            if (user) {
              const { data: profile } = await supabaseAdmin
                .from("profiles")
                .select("id, telegram_user_id, metadata")
                .eq("id", user.id)
                .maybeSingle();

              const userChatId = profile?.metadata?.telegram_chat_id || profile?.telegram_user_id;
              if (userChatId) {
                targetChatId = String(userChatId);
              }
            }
          }
        } catch (authErr) {
          console.warn("[Telegram Notify] Could not resolve user telegram chat ID:", authErr);
        }
      }
    }

    // Dispatch message with full photos, chart captures, clean link captions, and safe auto-chunking (Golden Rule 3)
    const result = await sendTelegramMessageWithPhotos(message, targetChatId);

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
