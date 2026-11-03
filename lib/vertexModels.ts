/**
 * Configuración centralizada de modelos en Vertex AI (Google Cloud Agent Platform)
 * y enrutamiento inteligente por tipo de tarea para optimizar calidad y costes.
 */

export const GCP_PROJECT_NUMBER = process.env.GCP_PROJECT_NUMBER || '558326121700';

/**
 * Construye el endpoint exacto de Vertex AI (`aiplatform.googleapis.com`) para cada modelo.
 * - `gemini-4-argon` requiere la ruta global con proyecto (`locations/global`).
 * - `gemini-2.5-flash-preview-tts` requiere la ruta regional `us-central1`.
 * - La familia 3.x (`3.8`, `3.7`, `3.6`, `3.5`, `3.1`, `3`) opera directamente sobre el endpoint global de publishers.
 */
export function getVertexBaseUrl(model: string): string {
    if (model === 'gemini-4-argon') {
        return `https://aiplatform.googleapis.com/v1beta1/projects/${GCP_PROJECT_NUMBER}/locations/global/publishers/google/models/${model}:generateContent`;
    }
    if (model === 'gemini-2.5-flash-preview-tts') {
        return `https://us-central1-aiplatform.googleapis.com/v1beta1/projects/${GCP_PROJECT_NUMBER}/locations/us-central1/publishers/google/models/${model}:generateContent`;
    }
    return `https://aiplatform.googleapis.com/v1beta1/publishers/google/models/${model}:generateContent`;
}

export function getVertexEndpoint(model: string, apiKey: string): string {
    return `${getVertexBaseUrl(model)}?key=${apiKey}`;
}

/**
 * NIVEL 1 (REASONING / FLAGSHIP):
 * Cascada maestra estricta en orden descendente:
 * Gemini 4.0 Argon (`gemini-4-argon`) -> Familia X.X Flash desde 3.8 hacia abajo.
 *
 * Uso: Asistente interactivo, Bot de Telegram (análisis bursátil), Dossier Macro (digest),
 * Alertas Operativas 24h, Tesis de Inversores 24h y Resúmenes Ejecutivos de Revistas.
 */
export const VERTEX_CASCADE_REASONING = [
    'gemini-4-argon',
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.1-pro-preview',
    'gemini-3-flash-preview',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
] as const;

/**
 * NIVEL 2 (FLASH EFFICIENT - TRADUCCIÓN MASIVA, TRANSCRIPCIÓN Y ESTRUCTURACIÓN MECÁNICA):
 * Salta `gemini-4-argon` en primera instancia para reducir drásticamente el coste por millón
 * de tokens y acelerar la velocidad en tareas mecánicas de gran volumen, empezando directamente
 * en `gemini-3.8-flash` y bajando en orden descendente (con `gemini-4-argon` como último respaldo).
 *
 * Uso: Traducción de vídeos y artículos, sincronización de noticias, índice ToC y transcripción.
 */
export const VERTEX_CASCADE_FLASH_EFFICIENT = [
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3-flash-preview',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-4-argon',
] as const;

/**
 * NIVEL 3 (VISION FILTER - CLASIFICACIÓN BINARIA SÍ/NO DE FOTOGRAMAS):
 * Optimizado por coste para evaluar decenas de capturas por vídeo (`YES`/`NO` si hay gráfico).
 * Prioriza los modelos Flash-Lite de la familia 3.x seguidos de la cascada 3.8 -> 3.0.
 */
export const VERTEX_CASCADE_VISION_FILTER = [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3-flash-preview',
] as const;

/**
 * NIVEL 4 (TTS - SÍNTESIS DE VOZ):
 * Prioriza `gemini-3.8-flash-lite-tts` y `gemini-3.8-flash-tts` en Vertex AI por menor coste
 * y menor latencia, seguidos de `3.1` y `2.5` en orden descendente.
 */
export const VERTEX_CASCADE_TTS = [
    'gemini-3.8-flash-lite-tts',
    'gemini-3.8-flash-tts',
    'gemini-3.1-flash-tts-preview',
    'gemini-2.5-flash-preview-tts',
] as const;
