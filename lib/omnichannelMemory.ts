import { SupabaseClient } from "@supabase/supabase-js";

export interface ConversationTurn {
  role: "user" | "model";
  text: string;
  source: "web" | "telegram";
  sender_name?: string;
  timestamp: number;
  message_id?: number;
  reply_to_message_id?: number | null;
}

export interface OmnichannelUserProfile {
  authUserId: string | null;
  telegramUserId: string | null;
  telegramUsername: string | null;
  fullName: string | null;
  email: string | null;
}

export const ADMIN_UUID = "5c8d65c6-0798-4f8a-aae3-dd2cebebd868";

/**
 * Resolves a user profile in Supabase profiles table using any available identifier.
 * Matches by Supabase auth UUID, email, Telegram user ID, or Telegram username.
 */
export async function resolveOmnichannelUser(
  supabase: SupabaseClient,
  identifiers: {
    authUserId?: string | null;
    userEmail?: string | null;
    telegramUserId?: string | number | null;
    telegramUsername?: string | null;
  }
): Promise<OmnichannelUserProfile> {
  const { authUserId, userEmail, telegramUserId, telegramUsername } = identifiers;
  const cleanTelegramId = telegramUserId ? String(telegramUserId) : null;

  try {
    const orConditions: string[] = [];
    if (authUserId) orConditions.push(`id.eq.${authUserId}`);
    if (userEmail) orConditions.push(`email.eq.${userEmail}`);
    if (cleanTelegramId) orConditions.push(`telegram_user_id.eq.${cleanTelegramId}`);
    if (telegramUsername) orConditions.push(`telegram_username.eq.${telegramUsername}`);

    if (orConditions.length > 0) {
      const { data: matchedProfiles, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, telegram_user_id, telegram_username")
        .or(orConditions.join(","));

      if (!error && matchedProfiles && matchedProfiles.length > 0) {
        const p = matchedProfiles[0];
        return {
          authUserId: p.id || authUserId || null,
          telegramUserId: p.telegram_user_id ? String(p.telegram_user_id) : cleanTelegramId,
          telegramUsername: p.telegram_username || telegramUsername || null,
          fullName: p.full_name || null,
          email: p.email || userEmail || null,
        };
      }
    }
  } catch (err) {
    console.warn("[Omnichannel Memory] Profile resolution error:", err);
  }

  return {
    authUserId: authUserId || null,
    telegramUserId: cleanTelegramId,
    telegramUsername: telegramUsername || null,
    fullName: null,
    email: userEmail || null,
  };
}

/**
 * Retrieves the unified conversation document from Supabase documents table.
 * Supports loading and merging turns from both Web and Telegram.
 */
export async function getOmnichannelConversation(
  supabase: SupabaseClient,
  profile: OmnichannelUserProfile
): Promise<{ docId: string | null; history: ConversationTurn[]; metadata: any }> {
  const { authUserId, telegramUserId } = profile;
  if (!authUserId && !telegramUserId) {
    return { docId: null, history: [], metadata: {} };
  }

  try {
    const orConditions: string[] = [];
    if (telegramUserId) {
      orConditions.push(`metadata->>telegram_user_id.eq.${telegramUserId}`);
    }
    if (authUserId) {
      orConditions.push(`metadata->>auth_user_id.eq.${authUserId}`);
    }

    if (orConditions.length === 0) {
      return { docId: null, history: [], metadata: {} };
    }

    const { data: docs, error } = await supabase
      .from("documents")
      .select("id, metadata, title, updated_at")
      .eq("type", "knowledge_transcription")
      .or(orConditions.join(","))
      .order("updated_at", { ascending: false });

    if (error || !docs || docs.length === 0) {
      return { docId: null, history: [], metadata: {} };
    }

    const primaryDoc = docs[0];
    let combinedHistory: ConversationTurn[] = Array.isArray(primaryDoc.metadata?.history)
      ? primaryDoc.metadata.history
      : [];

    // If multiple documents exist (e.g. historical unmerged docs), merge and sort chronologically
    if (docs.length > 1) {
      for (let i = 1; i < docs.length; i++) {
        const extraHistory: ConversationTurn[] = Array.isArray(docs[i].metadata?.history)
          ? docs[i].metadata.history
          : [];
        combinedHistory = [...combinedHistory, ...extraHistory];
      }

      const seen = new Set<string>();
      combinedHistory = combinedHistory.filter(item => {
        const key = `${item.role}_${(item.text || "").slice(0, 40)}_${Math.floor(item.timestamp || 0)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    }

    return {
      docId: primaryDoc.id,
      history: combinedHistory.slice(-30),
      metadata: primaryDoc.metadata || {}
    };
  } catch (err) {
    console.error("[Omnichannel Memory] Failed to get conversation:", err);
    return { docId: null, history: [], metadata: {} };
  }
}

/**
 * Persists a new interaction exchange (user + assistant/model) into Supabase documents table,
 * recording whether the exchange happened via Web or Telegram.
 */
export async function saveOmnichannelTurn(
  supabase: SupabaseClient,
  params: {
    docId: string | null;
    profile: OmnichannelUserProfile;
    existingHistory: ConversationTurn[];
    userTurn: {
      text: string;
      source: "web" | "telegram";
      sender_name?: string;
      message_id?: number;
      reply_to_message_id?: number | null;
      timestamp?: number;
    };
    modelTurn: {
      text: string;
      source: "web" | "telegram";
      timestamp?: number;
    };
    chatId?: number | string;
  }
): Promise<string> {
  const { docId, profile, existingHistory, userTurn, modelTurn, chatId } = params;
  const nowSec = Math.floor(Date.now() / 1000);

  const updatedHistory: ConversationTurn[] = [
    ...existingHistory,
    {
      role: "user",
      text: userTurn.text,
      source: userTurn.source,
      sender_name: userTurn.sender_name || profile.fullName || "Usuario",
      timestamp: userTurn.timestamp || nowSec,
      message_id: userTurn.message_id,
      reply_to_message_id: userTurn.reply_to_message_id
    },
    {
      role: "model",
      text: modelTurn.text,
      source: modelTurn.source,
      timestamp: modelTurn.timestamp || nowSec
    }
  ];

  const cappedHistory = updatedHistory.slice(-30);
  const displayName = profile.fullName || profile.telegramUsername || profile.email || "Usuario";

  const metadataPayload = {
    is_hivex_conversation: true,
    is_telegram_conversation: true,
    auth_user_id: profile.authUserId,
    telegram_user_id: profile.telegramUserId,
    telegram_username: profile.telegramUsername,
    telegram_chat_id: chatId || null,
    email: profile.email,
    full_name: profile.fullName,
    last_updated: new Date().toISOString(),
    history: cappedHistory
  };

  try {
    if (docId) {
      await supabase
        .from("documents")
        .update({
          metadata: metadataPayload,
          updated_at: new Date().toISOString()
        })
        .eq("id", docId);
      return docId;
    } else {
      const { data: newDoc, error: insErr } = await supabase
        .from("documents")
        .insert({
          user_id: ADMIN_UUID,
          title: `[Omnichannel Context] - ${displayName}`,
          type: "knowledge_transcription",
          description: `Historial omnicanal unificado (Web + Telegram) para ${displayName}`,
          metadata: metadataPayload
        })
        .select("id")
        .single();

      if (insErr) {
        console.error("[Omnichannel Memory] Insert failed:", insErr);
      }
      return newDoc?.id || "";
    }
  } catch (err) {
    console.error("[Omnichannel Memory] Persistence exception:", err);
    return docId || "";
  }
}

/**
 * Formats multi-turn payload for Gemini ensuring strict role alternation (user -> model -> user).
 * Includes cross-channel tags ([Vía Telegram] / [Vía Plataforma Web]) to provide rich conversational clarity.
 */
export function formatGeminiMultiTurnPayload(
  history: ConversationTurn[],
  currentPromptText: string,
  currentSource: "web" | "telegram"
): Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> {
  const contentsPayload: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

  const recentTurns = history.slice(-10);
  let expectedRole: "user" | "model" = "user";

  for (const turn of recentTurns) {
    if (turn.role === expectedRole && turn.text) {
      const sourceTag = turn.source === "telegram" ? "[Vía Telegram]" : "[Vía Plataforma Web]";
      const prefix = turn.role === "user" ? `${sourceTag}: ` : "";
      contentsPayload.push({
        role: turn.role,
        parts: [{ text: `${prefix}${turn.text}` }]
      });
      expectedRole = expectedRole === "user" ? "model" : "user";
    }
  }

  if (contentsPayload.length > 0 && contentsPayload[contentsPayload.length - 1].role === "user") {
    contentsPayload.pop();
  }

  const currentSourceTag = currentSource === "telegram" ? "[Vía Telegram]" : "[Vía Plataforma Web]";
  contentsPayload.push({
    role: "user",
    parts: [{ text: `${currentSourceTag}: ${currentPromptText}` }]
  });

  return contentsPayload;
}
