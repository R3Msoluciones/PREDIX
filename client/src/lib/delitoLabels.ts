/**
 * delitoLabels.ts — Etiquetas en español de los 6 buckets de tipo de delito
 * que usa el pipeline de predicción (scripts/predict/, tabla predicciones_ml,
 * server/services/mlPredictor.ts → DesgloseTipo.tipo). Antes vivía solo en
 * PrediccionesTab.tsx; se comparte aquí para que cualquier otro tab que
 * consuma `predicciones.analizarRiesgo` (ej. ZonasTab) use el mismo mapeo.
 */

export const TIPO_DELITO_LABELS: Record<string, string> = {
  homicidios: "Homicidios",
  robos: "Robos",
  lesiones: "Lesiones",
  violencia_sexual: "Violencia sexual",
  narcomenudeo: "Narcomenudeo",
  otros: "Otros delitos",
};
