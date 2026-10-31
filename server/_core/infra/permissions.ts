// Define module names
export const MODULES = {
  MAPA_GEOESPACIAL: "mapa_geoespacial",
  ALERTAS: "alertas",
  INCIDENTES: "incidentes",
  PREDICCIONES: "predicciones",
  TABLERO: "tablero",
  ZONAS_DELICTIVAS: "zonas_delictivas",
  CHATBOT: "chatbot",
  ADMIN: "admin",
} as const;

export type ModuleName = (typeof MODULES)[keyof typeof MODULES];
export type PermissionAction = "canView" | "canEdit" | "canDelete" | "canExport";

// Define role permissions
export const DEFAULT_PERMISSIONS = {
  operador: {
    [MODULES.MAPA_GEOESPACIAL]: { canView: 1, canEdit: 0, canDelete: 0, canExport: 0 },
    [MODULES.ALERTAS]: { canView: 1, canEdit: 0, canDelete: 0, canExport: 0 },
    [MODULES.INCIDENTES]: { canView: 1, canEdit: 1, canDelete: 0, canExport: 0 },
    [MODULES.PREDICCIONES]: { canView: 0, canEdit: 0, canDelete: 0, canExport: 0 },
    [MODULES.TABLERO]: { canView: 0, canEdit: 0, canDelete: 0, canExport: 0 },
    [MODULES.ZONAS_DELICTIVAS]: { canView: 1, canEdit: 0, canDelete: 0, canExport: 0 },
    [MODULES.CHATBOT]: { canView: 1, canEdit: 0, canDelete: 0, canExport: 0 },
    [MODULES.ADMIN]: { canView: 0, canEdit: 0, canDelete: 0, canExport: 0 },
  },
  supervisor: {
    [MODULES.MAPA_GEOESPACIAL]: { canView: 1, canEdit: 1, canDelete: 0, canExport: 1 },
    [MODULES.ALERTAS]: { canView: 1, canEdit: 1, canDelete: 0, canExport: 1 },
    [MODULES.INCIDENTES]: { canView: 1, canEdit: 1, canDelete: 0, canExport: 1 },
    [MODULES.PREDICCIONES]: { canView: 1, canEdit: 0, canDelete: 0, canExport: 1 },
    [MODULES.TABLERO]: { canView: 1, canEdit: 1, canDelete: 0, canExport: 1 },
    [MODULES.ZONAS_DELICTIVAS]: { canView: 1, canEdit: 1, canDelete: 0, canExport: 1 },
    [MODULES.CHATBOT]: { canView: 1, canEdit: 0, canDelete: 0, canExport: 0 },
    [MODULES.ADMIN]: { canView: 0, canEdit: 0, canDelete: 0, canExport: 0 },
  },
  analista: {
    [MODULES.MAPA_GEOESPACIAL]: { canView: 1, canEdit: 0, canDelete: 0, canExport: 1 },
    [MODULES.ALERTAS]: { canView: 1, canEdit: 0, canDelete: 0, canExport: 1 },
    [MODULES.INCIDENTES]: { canView: 1, canEdit: 0, canDelete: 0, canExport: 1 },
    [MODULES.PREDICCIONES]: { canView: 1, canEdit: 0, canDelete: 0, canExport: 1 },
    [MODULES.TABLERO]: { canView: 1, canEdit: 0, canDelete: 0, canExport: 1 },
    [MODULES.ZONAS_DELICTIVAS]: { canView: 1, canEdit: 0, canDelete: 0, canExport: 1 },
    [MODULES.CHATBOT]: { canView: 1, canEdit: 0, canDelete: 0, canExport: 0 },
    [MODULES.ADMIN]: { canView: 0, canEdit: 0, canDelete: 0, canExport: 0 },
  },
  admin: {
    [MODULES.MAPA_GEOESPACIAL]: { canView: 1, canEdit: 1, canDelete: 1, canExport: 1 },
    [MODULES.ALERTAS]: { canView: 1, canEdit: 1, canDelete: 1, canExport: 1 },
    [MODULES.INCIDENTES]: { canView: 1, canEdit: 1, canDelete: 1, canExport: 1 },
    [MODULES.PREDICCIONES]: { canView: 1, canEdit: 1, canDelete: 1, canExport: 1 },
    [MODULES.TABLERO]: { canView: 1, canEdit: 1, canDelete: 1, canExport: 1 },
    [MODULES.ZONAS_DELICTIVAS]: { canView: 1, canEdit: 1, canDelete: 1, canExport: 1 },
    [MODULES.CHATBOT]: { canView: 1, canEdit: 1, canDelete: 1, canExport: 1 },
    [MODULES.ADMIN]: { canView: 1, canEdit: 1, canDelete: 1, canExport: 1 },
  },
  consulta: {
    [MODULES.MAPA_GEOESPACIAL]: { canView: 0, canEdit: 0, canDelete: 0, canExport: 0 },
    [MODULES.ALERTAS]: { canView: 0, canEdit: 0, canDelete: 0, canExport: 0 },
    [MODULES.INCIDENTES]: { canView: 0, canEdit: 0, canDelete: 0, canExport: 0 },
    [MODULES.PREDICCIONES]: { canView: 0, canEdit: 0, canDelete: 0, canExport: 0 },
    [MODULES.TABLERO]: { canView: 1, canEdit: 0, canDelete: 0, canExport: 0 },
    [MODULES.ZONAS_DELICTIVAS]: { canView: 0, canEdit: 0, canDelete: 0, canExport: 0 },
    [MODULES.CHATBOT]: { canView: 0, canEdit: 0, canDelete: 0, canExport: 0 },
    [MODULES.ADMIN]: { canView: 0, canEdit: 0, canDelete: 0, canExport: 0 },
  },
  policia: {
    [MODULES.MAPA_GEOESPACIAL]: { canView: 1, canEdit: 0, canDelete: 0, canExport: 0 },
    [MODULES.ALERTAS]: { canView: 1, canEdit: 1, canDelete: 0, canExport: 0 },
    [MODULES.INCIDENTES]: { canView: 1, canEdit: 1, canDelete: 0, canExport: 0 },
    [MODULES.PREDICCIONES]: { canView: 0, canEdit: 0, canDelete: 0, canExport: 0 },
    [MODULES.TABLERO]: { canView: 0, canEdit: 0, canDelete: 0, canExport: 0 },
    [MODULES.ZONAS_DELICTIVAS]: { canView: 0, canEdit: 0, canDelete: 0, canExport: 0 },
    [MODULES.CHATBOT]: { canView: 0, canEdit: 0, canDelete: 0, canExport: 0 },
    [MODULES.ADMIN]: { canView: 0, canEdit: 0, canDelete: 0, canExport: 0 },
  },
  comandante: {
    [MODULES.MAPA_GEOESPACIAL]: { canView: 1, canEdit: 1, canDelete: 0, canExport: 1 },
    [MODULES.ALERTAS]: { canView: 1, canEdit: 1, canDelete: 0, canExport: 1 },
    [MODULES.INCIDENTES]: { canView: 1, canEdit: 1, canDelete: 0, canExport: 1 },
    [MODULES.PREDICCIONES]: { canView: 1, canEdit: 0, canDelete: 0, canExport: 1 },
    [MODULES.TABLERO]: { canView: 1, canEdit: 0, canDelete: 0, canExport: 1 },
    [MODULES.ZONAS_DELICTIVAS]: { canView: 1, canEdit: 0, canDelete: 0, canExport: 1 },
    [MODULES.CHATBOT]: { canView: 1, canEdit: 0, canDelete: 0, canExport: 0 },
    [MODULES.ADMIN]: { canView: 0, canEdit: 0, canDelete: 0, canExport: 0 },
  },
} as const;
