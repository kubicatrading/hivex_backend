import { createClient } from "@supabase/supabase-js";

const GLOBAL_ADMIN_USER_ID = "5c8d65c6-0798-4f8a-aae3-dd2cebebd868";

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_PRODUCTION_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_PRODUCTION_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });
}

export interface CronExecutionRecord {
  path: string;
  cronName: string;
  statusCode: number;
  status: "success" | "error";
  error?: string | null;
  errorEs?: string | null;
  durationMs?: number;
  details?: Record<string, any>;
  executedAt?: string;
}

export function translateErrorToSpanish(error: any): string {
  if (!error) return "Sin errores registrados";
  const errStr = typeof error === "string" ? error : (error.message || error.details || JSON.stringify(error));

  if (/canceling statement due to statement timeout/i.test(errStr) || /statement timeout/i.test(errStr)) {
    return "Tiempo de espera de la base de datos agotado (Statement Timeout).";
  }
  if (/fetch failed/i.test(errStr) || /ENOTFOUND/i.test(errStr) || /ECONNREFUSED/i.test(errStr) || /ECONNRESET/i.test(errStr)) {
    return "Fallo de conexión de red o corte de conexión con el servidor externo (ECONNRESET/ENOTFOUND).";
  }
  if (/ETIMEDOUT/i.test(errStr) || /timeout of .* exceeded/i.test(errStr)) {
    return "Tiempo de espera agotado al conectar con el servidor externo.";
  }
  if (/401/i.test(errStr) || /unauthorized/i.test(errStr) || /invalid api key/i.test(errStr)) {
    return "Error de autenticación o credenciales no válidas.";
  }
  if (/403/i.test(errStr) || /forbidden/i.test(errStr)) {
    return "Acceso denegado o bloqueado por el servidor externo (posible bloqueo por Cloudflare/bot).";
  }
  if (/404/i.test(errStr) || /not found/i.test(errStr)) {
    return "Recurso no encontrado en el servidor externo (404 Not Found).";
  }
  if (/429/i.test(errStr) || /too many requests/i.test(errStr) || /rate limit/i.test(errStr)) {
    return "Límite de peticiones excedido (Rate Limit alcanzado).";
  }
  if (/500/i.test(errStr) || /internal server error/i.test(errStr)) {
    return "Error interno del servidor en el endpoint o servicio externo.";
  }
  if (/502/i.test(errStr) || /bad gateway/i.test(errStr)) {
    return "Puerta de enlace incorrecta o servicio no disponible temporalmente (Bad Gateway 502).";
  }
  if (/503/i.test(errStr) || /service unavailable/i.test(errStr)) {
    return "Servicio temporalmente no disponible (Service Unavailable 503).";
  }
  if (/504/i.test(errStr) || /gateway timeout/i.test(errStr)) {
    return "Tiempo de respuesta de la pasarela agotado (Gateway Timeout 504).";
  }
  if (/telegram/i.test(errStr)) {
    return `Error en la API de Telegram: ${errStr.substring(0, 150)}`;
  }
  if (/gemini/i.test(errStr) || /ai studio/i.test(errStr)) {
    return `Error en el servicio de IA Gemini: ${errStr.substring(0, 150)}`;
  }
  if (/cookie/i.test(errStr) || /login/i.test(errStr)) {
    return "Error en la sesión o inicio de sesión en Trends Journal.";
  }

  return `Error durante la ejecución: ${errStr.substring(0, 200)}`;
}

/**
 * Records a cron job execution to the documents table (type: "cron_log").
 * Safely handles any failures so the cron itself is never interrupted.
 */
export async function recordCronExecution(params: {
  path: string;
  cronName: string;
  statusCode: number;
  status: "success" | "error";
  error?: any;
  durationMs?: number;
  details?: Record<string, any>;
}): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const executedAt = new Date().toISOString();
    const errorStr = params.error ? (typeof params.error === "string" ? params.error : params.error.message || JSON.stringify(params.error)) : null;
    const errorEs = params.status === "error" ? translateErrorToSpanish(params.error) : null;

    const logMetadata = {
      is_cron_log: true,
      path: params.path,
      cron_name: params.cronName,
      status_code: params.statusCode,
      status: params.status,
      error_raw: errorStr,
      error_es: errorEs,
      duration_ms: params.durationMs || 0,
      details: params.details || {},
      executed_at: executedAt
    };

    const title = `[Cron Log] ${params.cronName} - ${params.statusCode}`;
    const description = params.status === "success" 
      ? `Ejecución exitosa (${params.statusCode} OK) en ${params.durationMs || 0}ms`
      : `Fallo HTTP ${params.statusCode}: ${errorEs}`;

    const { error: insertError } = await supabase.from("documents").insert({
      user_id: GLOBAL_ADMIN_USER_ID,
      title,
      description,
      type: "knowledge_analysis",
      file_url: params.path,
      metadata: logMetadata
    });

    if (insertError) {
      console.error("[CronLogger] Insert error:", insertError);
    }
  } catch (logErr: any) {
    console.error("[CronLogger] Failed to write cron log:", logErr?.message || logErr);
  }
}

/**
 * Prunes cron logs older than 7 days. Designed to run only during daily maintenance (health-check).
 */
export async function pruneOldCronLogs(): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from("documents")
      .delete()
      .eq("type", "knowledge_analysis")
      .eq("metadata->>is_cron_log", "true")
      .lt("created_at", sevenDaysAgo);
    console.log("[CronLogger] Old cron logs pruned successfully.");
  } catch (err: any) {
    console.warn("[CronLogger] Failed to prune old cron logs:", err?.message || err);
  }
}

export interface LatestCronSummary {
  path: string;
  cronName: string;
  statusCode: number;
  status: "success" | "error" | "pending";
  errorEs: string | null;
  executedAt: string | null;
  durationMs: number;
  createdAt?: string;
  schedule?: string;
}

export const KNOWN_CRONS: Array<{ path: string; cronName: string; schedule: string; maxStaleMinutes: number }> = [
  { path: "/api/videos/sync", cronName: "Sincronización de Vídeos (YouTube Sync)", schedule: "Cada hora (:00)", maxStaleMinutes: 125 },
  { path: "/api/videos/monitor-analysis", cronName: "Monitor de Análisis de Vídeos", schedule: "Cada 5 min", maxStaleMinutes: 30 },
  { path: "/api/videos/alerts-24h", cronName: "Alertas Instantáneas de Vídeos", schedule: "Cada 15 min", maxStaleMinutes: 45 },
  { path: "/api/videos/digest", cronName: "Resumen Diario: HIVEX Alerts - 24H", schedule: "Diario 06:30 UTC", maxStaleMinutes: 26 * 60 },
  { path: "/api/videos/investors-24h", cronName: "Decisiones Tácticas: HIVEX Investors - 24H", schedule: "Diario 07:00 UTC", maxStaleMinutes: 26 * 60 },
  { path: "/api/videos/backfill-snapshots", cronName: "Recuperación de Gráficos (Backfill Snapshots)", schedule: "Cada 5 min", maxStaleMinutes: 30 },
  { path: "/api/videos/health-check", cronName: "Salud de Cabina (Health Check)", schedule: "Diario 08:00 UTC", maxStaleMinutes: 26 * 60 },
  { path: "/api/news/sync", cronName: "Sincronización de Revistas (Trends Journal)", schedule: "Cada 15 min", maxStaleMinutes: 45 },
];

/**
 * Returns the most recent execution log for all known crons, querying each cron path
 * individually so high-frequency crons never push lower-frequency or failing crons out of the window.
 * Also enforces staleness checks so a silent/missing cron is flagged as an error rather than "pending".
 */
export async function getLatestCronExecutions(): Promise<LatestCronSummary[]> {
  try {
    const supabase = getSupabaseClient();
    const nowMs = Date.now();

    const perCronResults = await Promise.all(
      KNOWN_CRONS.map(async (known): Promise<LatestCronSummary> => {
        try {
          const { data: rows, error } = await supabase
            .from("documents")
            .select("id, title, description, file_url, created_at, metadata")
            .eq("type", "knowledge_analysis")
            .eq("file_url", known.path)
            .order("created_at", { ascending: false })
            .limit(1);

          if (error) {
            console.warn(`[CronLogger] Error querying latest log for ${known.path}:`, error.message);
          }

          const row = rows && rows.length > 0 ? rows[0] : null;
          if (!row) {
            // If health-check itself has no prior row while currently running, treat as active
            if (known.path === "/api/videos/health-check") {
              return {
                path: known.path,
                cronName: known.cronName,
                statusCode: 200,
                status: "success",
                errorEs: null,
                executedAt: new Date().toISOString(),
                durationMs: 0,
                createdAt: new Date().toISOString(),
                schedule: known.schedule
              };
            }
            return {
              path: known.path,
              cronName: known.cronName,
              statusCode: 504,
              status: "error",
              errorEs: `Sin registros de ejecución recientes (${known.schedule}). El cron no se ha lanzado o murió por timeout antes de guardar registro.`,
              executedAt: null,
              durationMs: 0,
              schedule: known.schedule
            };
          }

          const meta = row.metadata || {};
          const executedAt = meta.executed_at || row.created_at;
          const executedMs = executedAt ? new Date(executedAt).getTime() : 0;
          const ageMinutes = executedMs ? (nowMs - executedMs) / 60000 : Infinity;

          let status: "success" | "error" | "pending" = meta.status || "success";
          let statusCode: number = meta.status_code || 200;
          let errorEs: string | null = meta.error_es || null;

          // Staleness check (skip for health-check which is currently running)
          if (known.path !== "/api/videos/health-check" && ageMinutes > known.maxStaleMinutes) {
            status = "error";
            if (statusCode >= 200 && statusCode < 300) {
              statusCode = 504;
            }
            const ageDesc = ageMinutes >= 120
              ? `${Math.round(ageMinutes / 60)} horas`
              : `${Math.round(ageMinutes)} min`;
            const staleNotice = `Cron retrasado o inactivo: última ejecución hace ${ageDesc} (frecuencia esperada: ${known.schedule}).`;
            errorEs = errorEs ? `${staleNotice} Último error: ${errorEs}` : staleNotice;
          }

          return {
            path: known.path,
            cronName: known.cronName,
            statusCode,
            status,
            errorEs,
            executedAt,
            durationMs: meta.duration_ms || 0,
            createdAt: row.created_at,
            schedule: known.schedule
          };
        } catch (innerErr: any) {
          return {
            path: known.path,
            cronName: known.cronName,
            statusCode: 500,
            status: "error",
            errorEs: `No se pudo verificar el estado del cron: ${innerErr?.message || innerErr}`,
            executedAt: null,
            durationMs: 0,
            schedule: known.schedule
          };
        }
      })
    );

    return perCronResults;
  } catch (err: any) {
    console.error("[CronLogger] Error in getLatestCronExecutions:", err?.message || err);
    return [];
  }
}
