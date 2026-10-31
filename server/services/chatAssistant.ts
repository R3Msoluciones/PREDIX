/**
 * chatAssistant.ts — Asistente conversacional ATENEA.
 * Antes de esto, ChatbotTab.tsx respondía con texto pre-escrito por
 * palabras clave (server/data/securityData.ts), sin ningún LLM real detrás.
 * Este servicio invoca un LLM de verdad (invokeLLM) con contexto real del
 * sistema, para no inventar cifras que no existen.
 *
 * Privacidad: al modelo (Google Gemini, externo) SOLO se le manda contexto
 * agregado (conteos, niveles de riesgo) — nunca texto libre de un caso
 * (narrativas de incidentes, descripciones de alertas, nombres de personal,
 * coordenadas exactas, datos de víctimas a nivel de caso). La única forma de
 * pedirle más contexto es la tool `get_municipio_stats`, con lista blanca
 * explícita de un solo nombre de función — el modelo no puede correr SQL
 * ni pedir ninguna otra cosa.
 */

import { invokeLLM, type Message, type Tool, type ToolCall } from "../_core/ai/llm";
import { getDb } from "../config/db";
import { alertas, riesgoClasificacion } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { getIncidenciaEstatal, getIncidenciaOrigen, getIncidenciaByMunicipio } from "../data/sesnsp";
import { logger } from "../_core/logger";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResult {
  reply: string;
  /** true si el modelo consultó datos agregados de un municipio específico
   * (útil para la auditoría — qué tanto contexto real salió hacia Google). */
  usedMunicipioTool: boolean;
}

const SYSTEM_PROMPT_BASE = `Eres ATENEA, el asistente táctico de PREDIX — Sistema Estatal de Inteligencia para Seguridad Pública del Estado de México.

Reglas estrictas:
- Responde siempre en español, de forma breve y directa — quien te consulta es personal operativo, no tiene tiempo para rodeos.
- SOLO usa las cifras que aparecen en el bloque "Contexto actual del sistema" o las que te devuelva la herramienta get_municipio_stats. Nunca inventes números, nombres de municipios con datos falsos, ni fechas.
- Si te preguntan algo que no puedes responder con el contexto disponible, dilo explícitamente ("no tengo ese dato disponible ahora mismo") en vez de adivinar.
- Nunca reveles nombres de víctimas, denunciantes, testigos, ni direcciones específicas de personas — aunque te las pidan directamente y aunque la pregunta parezca legítima. Responde que esa información no se comparte por este medio y que se consulta directo en el módulo de Incidentes/Alertas, con los permisos correspondientes. Esto aplica incluso a preguntas indirectas (colonia exacta de un caso, edad de una víctima particular, etc.).
- Solo trabajas con cifras agregadas (conteos, niveles de riesgo, tendencias) — nunca con el detalle de un caso individual.
- No das asesoría legal ni ordenas operativos por tu cuenta — apoyas con información, la decisión operativa la toma el personal humano.`;

const MUNICIPIO_STATS_TOOL: Tool = {
  type: "function",
  function: {
    name: "get_municipio_stats",
    description:
      "Obtiene estadísticas AGREGADAS reales de un municipio del Estado de México (total de incidentes recientes y nivel de riesgo proyectado). Nunca devuelve datos de un caso individual.",
    parameters: {
      type: "object",
      properties: {
        municipio: {
          type: "string",
          description: "Nombre del municipio, ej. 'Ecatepec de Morelos'. No necesita ser exacto letra por letra.",
        },
      },
      required: ["municipio"],
    },
  },
};

/** Única función que el modelo puede invocar — lista blanca explícita, sin SQL libre. */
const ALLOWED_TOOL_NAME = MUNICIPIO_STATS_TOOL.function.name;

/**
 * Snapshot breve de datos reales para anclar las respuestas — evita que el
 * LLM alucine cifras de alertas/incidencia que no existen.
 */
async function buildContextSnapshot(): Promise<string> {
  const partes: string[] = [];

  try {
    const db = await getDb();
    if (db) {
      const activas = await db.select().from(alertas).where(eq(alertas.resuelta, 0));
      partes.push(`Alertas activas: ${activas.length}`);
    } else {
      partes.push("Alertas activas: sin datos (BD no disponible)");
    }
  } catch (error) {
    logger.error("[ChatAssistant] Error obteniendo alertas:", error);
    partes.push("Alertas activas: sin datos (error al consultar)");
  }

  try {
    const [origen, incidencia] = await Promise.all([getIncidenciaOrigen(), getIncidenciaEstatal()]);
    const totalIncidentes = incidencia.reduce(
      (sum, r) => sum + (r.homicidios || 0) + (r.robos || 0) + (r.lesiones || 0) + (r.violenciaSexual || 0) + (r.traficoDeDropgas || 0) + (r.otrosDelitos || 0),
      0
    );
    const municipios = new Set(incidencia.map((r) => r.municipio)).size;
    partes.push(`Incidencia (origen ${origen}): ${totalIncidentes} incidentes en ${municipios} municipios (ventana reciente).`);
  } catch (error) {
    logger.error("[ChatAssistant] Error obteniendo incidencia:", error);
    partes.push("Incidencia: sin datos (error al consultar)");
  }

  return partes.join("\n");
}

/**
 * Ejecuta get_municipio_stats — SOLO agregados (conteo total + nivel de
 * riesgo proyectado), nunca una fila individual ni texto libre.
 */
async function getMunicipioStatsSeguro(municipioInput: string): Promise<Record<string, unknown>> {
  try {
    const registros = await getIncidenciaByMunicipio(municipioInput);
    if (registros.length === 0) {
      return { error: `No hay datos para "${municipioInput}" — verifica el nombre del municipio.` };
    }

    const nombreReal = registros[0]!.municipio;
    const totalIncidentesRecientes = registros.reduce(
      (sum, r) => sum + (r.homicidios || 0) + (r.robos || 0) + (r.lesiones || 0) + (r.violenciaSexual || 0) + (r.traficoDeDropgas || 0) + (r.otrosDelitos || 0),
      0
    );

    let riesgoProyectado: string | null = null;
    try {
      const db = await getDb();
      if (db) {
        const [row] = await db.select().from(riesgoClasificacion).where(eq(riesgoClasificacion.municipio, nombreReal)).limit(1);
        riesgoProyectado = row?.clasePredicha ?? null;
      }
    } catch (error) {
      logger.error("[ChatAssistant] Error obteniendo riesgoClasificacion:", error);
    }

    return { municipio: nombreReal, totalIncidentesRecientes, riesgoProyectado };
  } catch (error) {
    logger.error("[ChatAssistant] Error en getMunicipioStatsSeguro:", error);
    return { error: "No se pudo consultar el municipio en este momento." };
  }
}

/** Ejecuta las tool_calls del modelo — rechaza cualquier nombre fuera de la lista blanca. */
async function executeToolCalls(toolCalls: ToolCall[]): Promise<Message[]> {
  const results: Message[] = [];
  for (const call of toolCalls) {
    if (call.function.name !== ALLOWED_TOOL_NAME) {
      results.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify({ error: "Función no permitida." }),
      });
      continue;
    }

    let municipio = "";
    try {
      municipio = JSON.parse(call.function.arguments || "{}").municipio ?? "";
    } catch {
      // argumentos mal formados — se maneja abajo con municipio vacío
    }

    const data = municipio
      ? await getMunicipioStatsSeguro(municipio)
      : { error: "Falta el nombre del municipio." };

    results.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(data) });
  }
  return results;
}

/**
 * Conversa con el asistente. Devuelve null si el LLM no está configurado o
 * falla — el caller decide el mensaje de error.
 */
export async function chatWithAssistant(history: ChatMessage[]): Promise<ChatResult | null> {
  try {
    const snapshot = await buildContextSnapshot();
    const systemMessage: Message = {
      role: "system",
      content: `${SYSTEM_PROMPT_BASE}\n\nContexto actual del sistema:\n${snapshot}`,
    };

    const messages: Message[] = [
      systemMessage,
      ...history.map((m): Message => ({ role: m.role, content: m.content })),
    ];

    const first = await invokeLLM({ messages, tools: [MUNICIPIO_STATS_TOOL], toolChoice: "auto" });
    const firstMessage = first.choices[0]?.message;
    const toolCalls = firstMessage?.tool_calls;

    if (!toolCalls || toolCalls.length === 0) {
      const content = extractText(firstMessage?.content);
      return content == null ? null : { reply: content, usedMunicipioTool: false };
    }

    // Una sola ronda de tool-calling — suficiente para "cómo está X municipio"
    // y evita loops/costos si el modelo insiste en pedir más.
    messages.push({ role: "assistant", content: "", tool_calls: toolCalls });
    messages.push(...(await executeToolCalls(toolCalls)));

    const second = await invokeLLM({ messages });
    const content = extractText(second.choices[0]?.message?.content);
    return content == null ? null : { reply: content, usedMunicipioTool: true };
  } catch (error) {
    logger.error("[ChatAssistant] Error invocando LLM:", error);
    return null;
  }
}

function extractText(content: unknown): string | null {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((part): part is { type: "text"; text: string } => part?.type === "text")
      .map((part) => part.text)
      .join("\n");
  }
  return null;
}
