/**
 * AdminTab — Administración de Usuarios, Roles, Permisos y Auditoría
 * Design: Command Center / Tactical Intelligence
 * FUNCIONAL: Nuevo usuario, editar permisos, duplicar roles, campo identificación
 */

import { useState, useMemo, useCallback } from "react";
import {
  Users, UserPlus, Shield, Activity, FileText, Settings,
  Search, Filter, Edit, Trash2, Lock, Unlock, Eye, EyeOff,
  CheckCircle, XCircle, AlertTriangle, Clock, ChevronDown,
  ChevronRight, BarChart3, Calendar, Download, RefreshCw,
  UserCheck, UserX, ShieldCheck, ShieldAlert, KeyRound,
  MapPin, Radio, Navigation, X, Save, Plus
} from "lucide-react";
import { toast } from "sonner";
import { ModuleHeader, OriginBadge } from "@/components/dashboard";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { INSTITUTIONAL_ROLE_LABELS as ROLE_SLUG_TO_LABEL, ROLE_LABEL_TO_SLUG, ROLE_COLORS } from "@/lib/institutionalRoles";

/* ─── Types ─── */
interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  department: string;
  status: "active" | "inactive" | "suspended";
  lastLogin: string;
  loginCount: number;
  createdAt: string;
  identification?: {
    type: "patrulla" | "grupo_operativo" | "gps" | "red_celular";
    value: string;
    lat?: number;
    lng?: number;
    lastUpdate?: string;
  };
}


interface AuditLog {
  id: number;
  timestamp: string;
  user: string;
  action: string;
  module: string;
  detail: string;
  ip: string;
  status: "success" | "failed" | "warning";
}

/**
 * Etiquetas de los módulos que SÍ escriben en audit_log (server/config/auditLog.ts
 * callers) — distinto de MODULE_LABELS (los 8 módulos con RBAC), porque acá no
 * hay "usuarios"/"vault", y "admin" se registra como "administracion".
 */
const ACTIVITY_MODULE_LABELS: Record<string, string> = {
  alertas: "Alertas",
  incidentes: "Incidentes",
  usuarios: "Usuarios",
  vault: "Bóveda de Secretos",
  chatbot: "Asistente IA",
  administracion: "Administración",
};

/* ─── Initial Demo Data ─── */
const INITIAL_USERS: User[] = [
  { id: 1, name: "Cmdte. Roberto Hernández", email: "r.hernandez@edomex.gob.mx", role: "Administrador", department: "Dirección General de Seguridad", status: "active", lastLogin: "17/04/2026 20:15", loginCount: 342, createdAt: "2025-01-15" },
  { id: 2, name: "Cap. María Elena Torres", email: "me.torres@edomex.gob.mx", role: "Supervisor", department: "C5 Estado de México", status: "active", lastLogin: "17/04/2026 19:48", loginCount: 287, createdAt: "2025-02-20" },
  { id: 3, name: "Lic. Carlos Mendoza", email: "c.mendoza@edomex.gob.mx", role: "Analista", department: "Unidad de Inteligencia", status: "active", lastLogin: "17/04/2026 18:30", loginCount: 198, createdAt: "2025-03-10" },
  { id: 4, name: "Ing. Patricia Ramírez", email: "p.ramirez@edomex.gob.mx", role: "Operador", department: "Centro de Monitoreo", status: "active", lastLogin: "17/04/2026 20:10", loginCount: 456, createdAt: "2025-01-20" },
  { id: 5, name: "Mtro. Jorge Sánchez", email: "j.sanchez@edomex.gob.mx", role: "Analista", department: "Prevención del Delito", status: "active", lastLogin: "17/04/2026 17:22", loginCount: 145, createdAt: "2025-04-05" },
  { id: 6, name: "Lic. Ana García López", email: "a.garcia@edomex.gob.mx", role: "Consulta", department: "Fiscalía General", status: "inactive", lastLogin: "15/04/2026 10:15", loginCount: 67, createdAt: "2025-05-12" },
  { id: 7, name: "Cap. Fernando Díaz", email: "f.diaz@edomex.gob.mx", role: "Comandante", department: "Policía Estatal", status: "active", lastLogin: "17/04/2026 16:45", loginCount: 312, createdAt: "2025-02-01", identification: { type: "grupo_operativo", value: "GRUPO ALFA-7", lat: 19.2933, lng: -99.6533, lastUpdate: "17/04/2026 20:18" } },
  { id: 8, name: "Ing. Luis Morales", email: "l.morales@edomex.gob.mx", role: "Operador", department: "TI - Infraestructura", status: "suspended", lastLogin: "10/04/2026 09:00", loginCount: 89, createdAt: "2025-06-15" },
  { id: 9, name: "Dra. Sofía Vargas", email: "s.vargas@edomex.gob.mx", role: "Analista", department: "Estadística Criminal", status: "active", lastLogin: "17/04/2026 19:55", loginCount: 234, createdAt: "2025-03-25" },
  { id: 10, name: "Lic. Miguel Ángel Reyes", email: "ma.reyes@edomex.gob.mx", role: "Consulta", department: "Secretaría de Gobierno", status: "active", lastLogin: "17/04/2026 14:30", loginCount: 45, createdAt: "2025-07-01" },
  { id: 11, name: "Ofc. Pedro Martínez Luna", email: "p.martinez@edomex.gob.mx", role: "Policía", department: "Sector Ecatepec Norte", status: "active", lastLogin: "17/04/2026 20:20", loginCount: 78, createdAt: "2025-08-10", identification: { type: "patrulla", value: "P-4521", lat: 19.6010, lng: -99.0500, lastUpdate: "17/04/2026 20:22" } },
  { id: 12, name: "Ofc. Laura Jiménez Ríos", email: "l.jimenez@edomex.gob.mx", role: "Policía", department: "Sector Naucalpan Centro", status: "active", lastLogin: "17/04/2026 20:18", loginCount: 56, createdAt: "2025-09-01", identification: { type: "patrulla", value: "P-3287", lat: 19.4786, lng: -99.2394, lastUpdate: "17/04/2026 20:19" } },
  { id: 13, name: "Ofc. Ricardo Flores Vega", email: "r.flores@edomex.gob.mx", role: "Policía", department: "Sector Toluca Sur", status: "active", lastLogin: "17/04/2026 20:05", loginCount: 92, createdAt: "2025-07-20", identification: { type: "gps", value: "GPS-TLK-0891", lat: 19.2826, lng: -99.6557, lastUpdate: "17/04/2026 20:21" } },
  { id: 14, name: "Cmdte. Alejandro Ruiz Ortiz", email: "a.ruiz@edomex.gob.mx", role: "Comandante", department: "Zona Oriente", status: "active", lastLogin: "17/04/2026 19:30", loginCount: 189, createdAt: "2025-03-15", identification: { type: "grupo_operativo", value: "GRUPO DELTA-3", lat: 19.3560, lng: -98.9820, lastUpdate: "17/04/2026 20:15" } },
];

const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: "Acceso total al sistema. Gestión de usuarios, configuración y todos los módulos.",
  supervisor: "Supervisión operativa. Acceso a módulos tácticos y gestión de operadores.",
  analista: "Análisis de datos e inteligencia. Acceso a predicciones y estadísticas.",
  operador: "Operación en tiempo real. Monitoreo de mapa, alertas e incidentes.",
  consulta: "Solo lectura. Acceso limitado a tableros y dashboards.",
  policia: "Elemento policial en campo. Acceso a mapa y alertas. Georeferenciado por GPS/patrulla.",
  comandante: "Comandante de zona/sector. Supervisión de elementos y operaciones tácticas.",
};

const DEMO_AUDIT_LOGS: AuditLog[] = [
  { id: 1, timestamp: "17/04/2026 20:15:32", user: "Cmdte. Roberto Hernández", action: "LOGIN", module: "Sistema", detail: "Inicio de sesión exitoso", ip: "10.0.1.45", status: "success" },
  { id: 2, timestamp: "17/04/2026 20:12:18", user: "Cap. María Elena Torres", action: "VIEW_MAP", module: "Mapa Geoespacial", detail: "Consulta de mapa con capas activas", ip: "10.0.1.102", status: "success" },
  { id: 3, timestamp: "17/04/2026 20:08:45", user: "Lic. Carlos Mendoza", action: "EXPORT_REPORT", module: "Dashboard", detail: "Exportación de reporte ejecutivo PDF", ip: "10.0.2.33", status: "success" },
  { id: 4, timestamp: "17/04/2026 19:55:10", user: "Ing. Luis Morales", action: "ACCESS_DENIED", module: "Integraciones", detail: "Intento de acceso con cuenta suspendida", ip: "10.0.3.78", status: "failed" },
  { id: 5, timestamp: "17/04/2026 19:42:30", user: "Ing. Patricia Ramírez", action: "CREATE_ALERT", module: "Alertas", detail: "Nueva alerta: Robo a transporte en Ecatepec", ip: "10.0.1.88", status: "success" },
  { id: 6, timestamp: "17/04/2026 19:30:00", user: "Dra. Sofía Vargas", action: "RUN_PREDICTION", module: "Predicciones", detail: "Modelo predictivo ejecutado para Q2 2026", ip: "10.0.2.55", status: "success" },
  { id: 7, timestamp: "17/04/2026 19:15:22", user: "Cap. Fernando Díaz", action: "UPDATE_INCIDENT", module: "Incidentes", detail: "Actualización de estado: INC-2026-0447", ip: "10.0.1.67", status: "success" },
  { id: 8, timestamp: "17/04/2026 18:58:11", user: "Lic. Ana García López", action: "LOGIN_FAILED", module: "Sistema", detail: "Contraseña incorrecta (intento 2/5)", ip: "10.0.3.12", status: "warning" },
  { id: 9, timestamp: "17/04/2026 18:45:00", user: "Mtro. Jorge Sánchez", action: "VIEW_DASHBOARD", module: "Dashboard Ejecutivo", detail: "Consulta de KPIs mensuales", ip: "10.0.2.44", status: "success" },
  { id: 10, timestamp: "17/04/2026 18:30:15", user: "Cmdte. Roberto Hernández", action: "MODIFY_USER", module: "Administración", detail: "Suspensión de usuario: l.morales@edomex.gob.mx", ip: "10.0.1.45", status: "success" },
  { id: 11, timestamp: "17/04/2026 18:15:00", user: "Sistema", action: "AUTO_BACKUP", module: "Sistema", detail: "Respaldo automático de base de datos completado", ip: "127.0.0.1", status: "success" },
  { id: 12, timestamp: "17/04/2026 17:58:30", user: "Lic. Miguel Ángel Reyes", action: "VIEW_REPORT", module: "Tablero", detail: "Consulta de estadísticas mensuales", ip: "10.0.4.22", status: "success" },
];

/**
 * Los 8 módulos reales sobre los que se hace cumplir RBAC server-side
 * (server/_core/infra/permissions.ts, MODULES) — no los 12 "módulos" que
 * mostraba el mock anterior (varios no correspondían a ningún módulo real).
 */
const MODULE_LABELS: Record<string, string> = {
  mapa_geoespacial: "Mapa Geoespacial",
  alertas: "Alertas",
  incidentes: "Incidentes",
  predicciones: "Modelo Predictivo",
  tablero: "Tablero",
  zonas_delictivas: "Zonas Delictivas",
  chatbot: "Asistente IA",
  admin: "Administración",
};

interface RolePerms { canView: boolean; canEdit: boolean; canDelete: boolean; canExport: boolean; }
interface RoleDisplay {
  slug: string;
  name: string;
  color: string;
  userCount: number;
  permissions: Record<string, RolePerms>;
}

/* ─── Sub-tabs ─── */
type SubTab = "usuarios" | "roles" | "auditoria" | "actividad";

const SUB_TABS: { id: SubTab; label: string; icon: React.ReactNode }[] = [
  { id: "usuarios", label: "Usuarios", icon: <Users size={14} /> },
  { id: "roles", label: "Roles y Permisos", icon: <Shield size={14} /> },
  { id: "auditoria", label: "Auditoría", icon: <Activity size={14} /> },
  { id: "actividad", label: "Reportes de Actividad", icon: <BarChart3 size={14} /> },
];

/* ─── Helpers ─── */
const statusColor = (s: string) => {
  switch (s) {
    case "active": case "success": return "var(--px-ok)";
    case "inactive": return "var(--px-text-muted)";
    case "suspended": case "failed": return "var(--px-crit)";
    case "warning": return "var(--px-warn)";
    default: return "var(--px-text-muted)";
  }
};

const statusLabel = (s: string) => {
  switch (s) {
    case "active": return "ACTIVO";
    case "inactive": return "INACTIVO";
    case "suspended": return "SUSPENDIDO";
    case "success": return "EXITOSO";
    case "failed": return "FALLIDO";
    case "warning": return "ADVERTENCIA";
    default: return s.toUpperCase();
  }
};

const idTypeLabel = (t: string) => {
  switch (t) {
    case "patrulla": return "PATRULLA";
    case "grupo_operativo": return "GRUPO OPERATIVO";
    case "gps": return "RASTREO GPS";
    case "red_celular": return "RED CELULAR";
    default: return t.toUpperCase();
  }
};

/* ─── Card Wrapper ─── */
function TacticalCard({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`px-card rounded ${className}`} style={style}>
      {children}
    </div>
  );
}

/* ─── Main Component ─── */
export default function AdminTab() {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("usuarios");
  const [searchQuery, setSearchQuery] = useState("");

  // BD: usuarios reales con fallback a datos demo
  const { data: dbUsers, refetch: refetchUsers } = trpc.usuarios.listar.useQuery();
  const esReal = dbUsers?.origen === "real" && (dbUsers?.data?.length ?? 0) > 0;
  const users: User[] = useMemo(() => {
    if (esReal && dbUsers) {
      return dbUsers.data.map(u => ({
        id: u.id,
        name: u.name || u.email || "Sin nombre",
        email: u.email || "",
        role: ROLE_SLUG_TO_LABEL[u.institutionalRole] || u.institutionalRole,
        department: u.department || "",
        status: u.status,
        lastLogin: u.lastSignedIn ? new Date(u.lastSignedIn).toLocaleString("es-MX") : "—",
        loginCount: 0,
        createdAt: new Date(u.createdAt).toISOString().split("T")[0],
      }));
    }
    return INITIAL_USERS;
  }, [dbUsers, esReal]);

  // Mutations requieren sesión real (protectedProcedure); onError cubre 401/red,
  // pero el server también puede resolver con {success:false} (ej. BD caída) sin lanzar
  // excepción — cada llamada debe revisar ese campo antes de mostrar éxito.
  const onUsuarioMutError = (e: unknown) => {
    const code = e instanceof TRPCClientError ? e.data?.code : undefined;
    toast.error(code === "UNAUTHORIZED" ? "Requiere sesión iniciada" : code === "FORBIDDEN" ? "Tu rol no tiene permiso para esta acción" : "No se pudo completar la acción");
  };
  const okOrUsuario = (data: { success: boolean }, onOk: () => void) => {
    refetchUsers();
    if (data.success) onOk();
    else toast.error("No se pudo completar la acción — BD no disponible");
  };
  const crearUsuarioMut = trpc.usuarios.crear.useMutation({ onError: onUsuarioMutError });
  const actualizarUsuarioMut = trpc.usuarios.actualizar.useMutation({ onError: onUsuarioMutError });
  const eliminarUsuarioMut = trpc.usuarios.eliminar.useMutation({ onError: onUsuarioMutError });
  const resetPasswordMut = trpc.usuarios.resetPassword.useMutation({ onSuccess: () => refetchUsers(), onError: onUsuarioMutError });

  // BD: matriz de permisos por rol real (role_permissions, con fallback a
  // DEFAULT_PERMISSIONS si la tabla no está sembrada) — la misma fuente que
  // consulta requirePermission en el servidor en cada request protegido.
  const { data: rolePermsResp, refetch: refetchRolePerms } = trpc.admin.listRolePermissions.useQuery();
  const rolesEsReal = rolePermsResp?.origen === "real";
  // userCount se deriva de `users` (fuente real cuando hay sesión) en vez de mantenerse
  // a mano en el estado — evita que el contador se desincronice tras un reload.
  const roles: RoleDisplay[] = useMemo(() => {
    const slugs = rolePermsResp?.roles ?? Object.keys(ROLE_SLUG_TO_LABEL);
    return slugs.map(slug => ({
      slug,
      name: ROLE_SLUG_TO_LABEL[slug] || slug,
      color: ROLE_COLORS[slug] || "var(--px-text-muted)",
      userCount: users.filter(u => u.role === (ROLE_SLUG_TO_LABEL[slug] || slug)).length,
      permissions: Object.fromEntries(
        Object.entries(rolePermsResp?.matrix?.[slug] ?? {}).map(([mod, p]) => [mod, { canView: !!p.canView, canEdit: !!p.canEdit, canDelete: !!p.canDelete, canExport: !!p.canExport }])
      ),
    }));
  }, [rolePermsResp, users]);

  const onRolePermError = (e: unknown) => {
    const code = e instanceof TRPCClientError ? e.data?.code : undefined;
    toast.error(code === "UNAUTHORIZED" ? "Requiere sesión iniciada" : code === "FORBIDDEN" ? "Tu rol no tiene permiso para esta acción" : "No se pudo completar la acción");
  };
  const updateRolePermMut = trpc.admin.updateRolePermission.useMutation({ onError: onRolePermError });
  const resetRolePermsMut = trpc.admin.resetRolePermissions.useMutation({ onError: onRolePermError });

  // BD: bitácora de auditoría real con fallback a datos demo
  const { data: dbAuditLog } = trpc.admin.auditLog.useQuery();
  const auditEsReal = dbAuditLog?.origen === "real" && (dbAuditLog?.data?.length ?? 0) > 0;
  const auditLogs: AuditLog[] = useMemo(() => {
    if (auditEsReal && dbAuditLog) {
      return dbAuditLog.data.map(row => ({
        id: row.id,
        timestamp: new Date(row.timestamp).toLocaleString("es-MX"),
        user: `Usuario #${row.userId}`,
        action: row.action,
        module: row.module,
        detail: row.details || "",
        ip: row.ipAddress || "—",
        status: "success" as const,
      }));
    }
    return DEMO_AUDIT_LOGS;
  }, [dbAuditLog, auditEsReal]);

  // BD: actividad real derivada de audit_log (acciones de escritura, no vistas)
  const { data: activityResp } = trpc.admin.activityStats.useQuery();
  const actividadEsReal = activityResp?.origen === "real";

  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [auditFilter, setAuditFilter] = useState<string>("all");

  // Dialog states
  const [showNewUserDialog, setShowNewUserDialog] = useState(false);
  const [showEditUserDialog, setShowEditUserDialog] = useState(false);
  const [showEditPermissionsDialog, setShowEditPermissionsDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingRole, setEditingRole] = useState<RoleDisplay | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");

  // New user form
  const [newUser, setNewUser] = useState({
    name: "", email: "", department: "", cargo: "", role: "Operador", status: "active" as "active" | "inactive",
    idType: "patrulla" as "patrulla" | "grupo_operativo" | "gps" | "red_celular",
    idValue: "", lat: "", lng: "", password: "",
  });

  /* ─── Stats ─── */
  const stats = useMemo(() => {
    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.status === "active").length;
    const inactiveUsers = users.filter(u => u.status === "inactive").length;
    const suspendedUsers = users.filter(u => u.status === "suspended").length;
    const totalLogins = users.reduce((sum, u) => sum + u.loginCount, 0);
    const todayActions = auditLogs.length;
    return { totalUsers, activeUsers, inactiveUsers, suspendedUsers, totalLogins, todayActions };
  }, [users, auditLogs]);

  /* ─── Filtered users ─── */
  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(u =>
      u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q) || u.department.toLowerCase().includes(q)
    );
  }, [searchQuery, users]);

  /* ─── Filtered audit ─── */
  const filteredAudit = useMemo(() => {
    if (auditFilter === "all") return auditLogs;
    return auditLogs.filter(a => a.status === auditFilter);
  }, [auditFilter, auditLogs]);

  /* ─── Add audit log ─── */
  // El registro real ya lo escribe el servidor (logAudit en cada mutación) — aquí
  // solo se invalida la query para refrescar la bitácora con la fila recién creada.
  const utils = trpc.useUtils();
  const addAuditLog = useCallback(() => {
    utils.admin.auditLog.invalidate();
  }, [utils]);

  /* ─── Create User ─── */
  const handleCreateUser = () => {
    if (!newUser.name || !newUser.email) { toast.error("Nombre y correo son obligatorios"); return; }
    if (!newUser.password || newUser.password.length < 8) { toast.error("La contraseña debe tener al menos 8 caracteres"); return; }
    const needsId = newUser.role === "Policía" || newUser.role === "Comandante";
    if (needsId && !newUser.idValue) { toast.error("El campo de identificación es obligatorio para este rol"); return; }

    crearUsuarioMut.mutate({
      name: newUser.name,
      email: newUser.email,
      institutionalRole: (ROLE_LABEL_TO_SLUG[newUser.role] || "operador") as any,
      department: newUser.department,
      password: newUser.password,
    }, {
      onSuccess: d => okOrUsuario(d, () => {
        addAuditLog();
        toast.success(`Usuario "${newUser.name}" registrado exitosamente`);
      }),
    });
    setShowNewUserDialog(false);
    setNewUser({ name: "", email: "", department: "", cargo: "", role: "Operador", status: "active", idType: "patrulla", idValue: "", lat: "", lng: "", password: "" });
  };

  /* ─── Toggle User Status ─── */
  const toggleUserStatus = (user: User) => {
    if (!esReal) { toast.info("Vista de demostración — inicia sesión para modificar usuarios."); return; }
    const newStatus = user.status === "active" ? "suspended" : "active";
    actualizarUsuarioMut.mutate({ id: user.id, status: newStatus }, {
      onSuccess: d => okOrUsuario(d, () => {
        addAuditLog();
        toast.success(`Usuario ${user.name} ${newStatus === "suspended" ? "suspendido" : "activado"}`);
      }),
    });
  };

  /* ─── Delete User ─── */
  const handleDeleteUser = () => {
    if (!deleteTarget) return;
    if (!esReal) { toast.info("Vista de demostración — inicia sesión para modificar usuarios."); setShowDeleteConfirm(false); setDeleteTarget(null); return; }
    eliminarUsuarioMut.mutate({ id: deleteTarget.id }, {
      onSuccess: d => okOrUsuario(d, () => {
        addAuditLog();
        toast.success(`Usuario "${deleteTarget.name}" eliminado`);
      }),
    });
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  };

  /* ─── Edit User ─── */
  const handleEditUser = () => {
    if (!editingUser) return;
    if (!esReal) { toast.info("Vista de demostración — inicia sesión para modificar usuarios."); setShowEditUserDialog(false); setEditingUser(null); return; }
    actualizarUsuarioMut.mutate({
      id: editingUser.id,
      name: editingUser.name,
      department: editingUser.department,
      institutionalRole: (ROLE_LABEL_TO_SLUG[editingUser.role] || "operador") as any,
      status: editingUser.status,
    }, {
      onSuccess: d => okOrUsuario(d, () => {
        addAuditLog();
        toast.success(`Usuario "${editingUser.name}" actualizado`);
      }),
    });
    if (resetPasswordValue.length >= 8) {
      resetPasswordMut.mutate({ id: editingUser.id, password: resetPasswordValue }, {
        onSuccess: d => okOrUsuario(d, () => toast.success("Contraseña actualizada")),
      });
    }
    setShowEditUserDialog(false);
    setEditingUser(null);
    setResetPasswordValue("");
  };

  /* ─── Reset Role Permissions (los roles son un enum fijo del sistema —
     no se puede "duplicar" uno nuevo arbitrario, pero sí restablecerlo a
     los valores por defecto) ─── */
  const handleResetRolePermissions = (role: RoleDisplay) => {
    if (!window.confirm(`¿Restablecer los permisos de "${role.name}" a los valores por defecto del sistema?`)) return;
    resetRolePermsMut.mutate({ role: role.slug }, {
      onSuccess: () => {
        refetchRolePerms();
        addAuditLog();
        toast.success(`Permisos de "${role.name}" restablecidos`);
      },
    });
  };

  /* ─── Save Permissions ─── */
  const handleSavePermissions = () => {
    if (!editingRole) return;
    const modules = Object.keys(MODULE_LABELS);
    Promise.all(modules.map(mod => {
      const perm = editingRole.permissions[mod] || { canView: false, canEdit: false, canDelete: false, canExport: false };
      return updateRolePermMut.mutateAsync({ role: editingRole.slug, module: mod, ...perm });
    })).then(() => {
      refetchRolePerms();
      addAuditLog();
      toast.success(`Permisos del rol "${editingRole.name}" actualizados`);
    }).catch(onRolePermError);
    setShowEditPermissionsDialog(false);
    setEditingRole(null);
  };

  const needsIdentification = newUser.role === "Policía" || newUser.role === "Comandante";

  const inputStyle = { background: "var(--px-surface)", border: "1px solid var(--px-hairline)", color: "var(--px-text)", fontFamily: "var(--px-mono)", fontSize: "var(--px-text-sm)", outline: "none" };
  const labelStyle = { fontFamily: "var(--px-mono)" as const, fontSize: "var(--px-text-xs)", color: "var(--px-text-muted)", letterSpacing: "0.08em" };

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ fontFamily: "var(--px-display)", background: "var(--px-bg)", padding: "var(--px-3)", gap: "var(--px-3)" }}>
      {/* ─── Toolbar ─── */}
      <div className="px-card flex items-center gap-2 flex-wrap" style={{ padding: "var(--px-2) var(--px-4)", flexShrink: 0 }}>
        <Shield size={13} style={{ color: "var(--px-brand)" }} />
        <span style={{ fontFamily: "var(--px-display)", fontSize: "var(--px-text-sm)", fontWeight: 700, color: "var(--px-text)" }}>ADMINISTRACIÓN</span>
        {/* Actividad sigue en mock local (sin fuente de datos real) — Usuarios/Roles/Auditoría ya son reales */}
        <OriginBadge real={activeSubTab === "usuarios" ? esReal : activeSubTab === "auditoria" ? auditEsReal : activeSubTab === "roles" ? rolesEsReal : activeSubTab === "actividad" ? actividadEsReal : false} />
        {/* Antes `hidden sm:flex` ocultaba estos 2 conteos por debajo de 640px — el
            toolbar ya tiene flex-wrap, así que basta con dejarlos siempre visibles
            (degradan a una segunda línea en vez de desaparecer). */}
        <div className="flex items-center gap-3 ml-2 flex-wrap">
          <span style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: "var(--px-ok)" }}><span style={{ fontWeight: 700 }}>{stats.activeUsers}</span> activos</span>
          <span style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: "var(--px-text-faint)" }}>{stats.todayActions} acciones hoy</span>
        </div>
        <button onClick={() => setShowNewUserDialog(true)} className="ml-auto px-btn px-btn-primary px-hit44" style={{ padding: "4px 10px", fontSize: "var(--px-text-xs)" }}>
          <UserPlus size={12} /> Nuevo
        </button>
      </div>

      {/* ─── Sub-tabs ─── */}
      <div className="px-card flex overflow-x-auto scrollbar-tactical" role="tablist" aria-label="Secciones de administración" style={{ flexShrink: 0 }}>
        {SUB_TABS.map(tab => (
          // Antes el label se ocultaba por completo bajo 640px (`hidden sm:inline`),
          // dejando el tab sin nombre accesible visible (ni aria-label de respaldo) —
          // el contenedor ya soporta scroll horizontal, así que el label se deja
          // siempre visible y se apoya en el scroll en vez de esconder información.
          <button key={tab.id} onClick={() => setActiveSubTab(tab.id)} role="tab" aria-selected={activeSubTab === tab.id} aria-controls={`panel-${tab.id}`} id={`tab-${tab.id}`} className="flex items-center transition-all whitespace-nowrap flex-1 justify-center px-hit44" style={{ gap: "var(--px-1)", padding: "var(--px-3)", fontWeight: activeSubTab === tab.id ? 600 : 400, fontSize: "var(--px-text-xs)", color: activeSubTab === tab.id ? "var(--px-brand)" : "var(--px-text-faint)", borderBottom: activeSubTab === tab.id ? "2px solid var(--px-brand)" : "2px solid transparent", background: "none", borderTop: "none", borderLeft: "none", borderRight: "none", cursor: "pointer", minHeight: 40 }}>
            {tab.icon} <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ─── Content ─── */}
      <div className="px-card flex-1 overflow-y-auto scrollbar-tactical" role="tabpanel" id={`panel-${activeSubTab}`} aria-labelledby={`tab-${activeSubTab}`} style={{ padding: "var(--px-4)" }}>

        {/* ═══ USUARIOS ═══ */}
        {activeSubTab === "usuarios" && (
          <div className="space-y-4">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6" style={{ gap: "var(--px-3)" }}>
              {[
                { label: "TOTAL USUARIOS", value: stats.totalUsers, color: "var(--px-brand)", icon: <Users size={16} /> },
                { label: "ACTIVOS", value: stats.activeUsers, color: "var(--px-ok)", icon: <UserCheck size={16} /> },
                { label: "INACTIVOS", value: stats.inactiveUsers, color: "var(--px-text-muted)", icon: <UserX size={16} /> },
                { label: "SUSPENDIDOS", value: stats.suspendedUsers, color: "var(--px-crit)", icon: <ShieldAlert size={16} /> },
                { label: "ROLES DEFINIDOS", value: roles.length, color: "var(--px-warn)", icon: <Shield size={16} /> },
                { label: "LOGINS TOTALES", value: stats.totalLogins.toLocaleString(), color: "var(--px-brand)", icon: <KeyRound size={16} /> },
              ].map((kpi, i) => (
                <TacticalCard key={i} className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span style={{ color: kpi.color }}>{kpi.icon}</span>
                    <span className="px-eyebrow">{kpi.label}</span>
                  </div>
                  <div style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-lg)", fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
                </TacticalCard>
              ))}
            </div>

            {/* Search */}
            <div className="flex items-center" style={{ gap: "var(--px-3)" }}>
              <div className="flex-1 relative">
                <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--px-text-muted)" }} />
                <input type="text" placeholder="Buscar usuario por nombre, email, rol o departamento..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} aria-label="Buscar usuarios" className="w-full pl-8 pr-3 py-2 rounded" style={{ ...inputStyle, minHeight: 44 }} />
              </div>
            </div>

            {/* Users Table */}
            <TacticalCard className="overflow-hidden">
              <div className="overflow-x-auto scrollbar-tactical">
                <table className="w-full" style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-sm)", minWidth: 800 }}>
                  <thead>
                    <tr style={{ background: "color-mix(in srgb, var(--px-brand) 4%, transparent)" }}>
                      {["USUARIO", "ROL", "DEPARTAMENTO", "ESTADO", "IDENTIFICACION", "ULTIMO ACCESO", "ACCIONES"].map(h => (
                        <th key={h} scope="col" className="px-3 py-2 text-left" style={{ color: "var(--px-text-muted)", fontSize: "var(--px-text-xs)", letterSpacing: "0.08em", fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(user => {
                      const roleData = roles.find(r => r.name === user.role);
                      return (
                        <tr key={user.id} style={{ borderBottom: "1px solid var(--px-hairline)" }}>
                          <td className="px-3 py-2.5">
                            <div>
                              <div style={{ color: "var(--px-text)", fontWeight: 600, fontSize: "var(--px-text-sm)" }}>{user.name}</div>
                              <div style={{ color: "var(--px-text-muted)", fontSize: "var(--px-text-xs)" }}>{user.email}</div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="px-2 py-0.5 rounded" style={{ background: `${roleData?.color || "var(--px-text-muted)"}20`, color: roleData?.color || "var(--px-text-muted)", fontSize: "var(--px-text-xs)", fontWeight: 600 }}>
                              {user.role}
                            </span>
                          </td>
                          <td className="px-3 py-2.5" style={{ color: "var(--px-text)", fontSize: "var(--px-text-xs)" }}>{user.department}</td>
                          <td className="px-3 py-2.5">
                            <span className="px-2 py-0.5 rounded" style={{ background: `${statusColor(user.status)}15`, color: statusColor(user.status), fontSize: "var(--px-text-xs)", fontWeight: 600 }}>
                              {statusLabel(user.status)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            {user.identification ? (
                              <div className="flex items-center gap-1">
                                <MapPin size={10} style={{ color: "var(--px-ok)" }} aria-hidden="true" />
                                <span style={{ color: "var(--px-ok)", fontSize: "var(--px-text-xs)", fontWeight: 600 }}>{user.identification.value}</span>
                              </div>
                            ) : (
                              <span style={{ color: "var(--px-text-muted)", fontSize: "var(--px-text-xs)" }}>—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5" style={{ color: "var(--px-text-muted)", fontSize: "var(--px-text-xs)" }}>{user.lastLogin}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex gap-1">
                              <button onClick={() => { setEditingUser({ ...user }); setShowEditUserDialog(true); }} className="p-1 rounded px-hit44" style={{ background: "color-mix(in srgb, var(--px-brand) 8%, transparent)" }} title="Editar" aria-label={`Editar usuario ${user.name}`}><Edit size={11} style={{ color: "var(--px-brand)" }} /></button>
                              <button onClick={() => toggleUserStatus(user)} className="p-1 rounded px-hit44" style={{ background: "color-mix(in srgb, var(--px-brand) 8%, transparent)" }} title={user.status === "active" ? "Suspender" : "Activar"} aria-label={user.status === "active" ? `Suspender usuario ${user.name}` : `Activar usuario ${user.name}`}>
                                {user.status === "active" ? <Lock size={11} style={{ color: "var(--px-warn)" }} /> : <Unlock size={11} style={{ color: "var(--px-ok)" }} />}
                              </button>
                              <button onClick={() => { setDeleteTarget(user); setShowDeleteConfirm(true); }} className="p-1 rounded px-hit44" style={{ background: "color-mix(in srgb, var(--px-crit) 8%, transparent)" }} title="Eliminar" aria-label={`Eliminar usuario ${user.name}`}><Trash2 size={11} style={{ color: "var(--px-crit)" }} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </TacticalCard>
          </div>
        )}

        {/* ═══ ROLES Y PERMISOS ═══ */}
        {activeSubTab === "roles" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1" style={{ gap: "var(--px-3)" }}>
              {roles.map(role => (
                <TacticalCard key={role.slug} className="overflow-hidden">
                  <button onClick={() => setExpandedRole(expandedRole === role.slug ? null : role.slug)} className="w-full flex items-center justify-between" aria-expanded={expandedRole === role.slug} aria-controls={`role-details-${role.slug}`} style={{ padding: "var(--px-3) var(--px-4)", borderBottom: expandedRole === role.slug ? "1px solid var(--px-hairline)" : "none" }}>
                    <div className="flex items-center" style={{ gap: "var(--px-4)" }}>
                      <div className="flex items-center justify-center w-10 h-10 rounded" style={{ background: `${role.color}15`, border: `1px solid ${role.color}30` }}>
                        <ShieldCheck size={18} style={{ color: role.color }} />
                      </div>
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <span style={{ fontWeight: 600, fontSize: "var(--px-text-md)", color: "var(--px-text)" }}>{role.name}</span>
                          <span className="px-2 py-0.5 rounded" style={{ background: `${role.color}20`, color: role.color, fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", fontWeight: 600 }}>
                            {role.slug.toUpperCase()}
                          </span>
                        </div>
                        <div style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: "var(--px-text-muted)" }}>{ROLE_DESCRIPTIONS[role.slug] || ""}</div>
                      </div>
                    </div>
                    <div className="flex items-center" style={{ gap: "var(--px-4)" }}>
                      <div className="text-right">
                        <div className="px-eyebrow">USUARIOS</div>
                        <div style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-lg)", fontWeight: 700, color: role.color }}>{role.userCount}</div>
                      </div>
                      <div className="text-right">
                        <div className="px-eyebrow">PERMISOS</div>
                        <div style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-lg)", fontWeight: 700, color: "var(--px-brand)" }}>
                          {Object.values(role.permissions).filter(p => p.canView || p.canEdit || p.canDelete || p.canExport).length}
                        </div>
                      </div>
                      {expandedRole === role.slug ? <ChevronDown size={16} style={{ color: "var(--px-text-muted)" }} /> : <ChevronRight size={16} style={{ color: "var(--px-text-muted)" }} />}
                    </div>
                  </button>

                  {expandedRole === role.slug && (
                    <div id={`role-details-${role.slug}`} style={{ padding: "var(--px-3) var(--px-4)" }}>
                      <div className="px-eyebrow" style={{ marginBottom: "var(--px-2)" }}>
                        PERMISOS ASIGNADOS
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {Object.entries(MODULE_LABELS).map(([mod, label]) => {
                          const perm = role.permissions[mod] || { canView: false, canEdit: false, canDelete: false, canExport: false };
                          const anyPerm = perm.canView || perm.canEdit || perm.canDelete || perm.canExport;
                          return (
                            <div key={mod} className="flex items-center justify-between px-3 py-2 rounded flex-wrap gap-1" style={{ background: "var(--px-surface)", border: `1px solid ${anyPerm ? "color-mix(in srgb, var(--px-ok) 15%, transparent)" : "color-mix(in srgb, var(--px-crit) 10%, transparent)"}` }}>
                              <span style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: anyPerm ? "var(--px-text)" : "var(--px-text-muted)" }}>{label}</span>
                              <div className="flex gap-1">
                                {([["V", perm.canView, "var(--px-ok)"], ["E", perm.canEdit, "var(--px-brand)"], ["D", perm.canDelete, "var(--px-crit)"], ["X", perm.canExport, "var(--px-warn)"]] as const).map(([letter, on, color]) => (
                                  <span key={letter} title={letter === "V" ? "Ver" : letter === "E" ? "Editar" : letter === "D" ? "Eliminar" : "Exportar"} className="px-1.5 py-0.5 rounded" style={{ background: on ? `color-mix(in srgb, ${color} 15%, transparent)` : "color-mix(in srgb, var(--px-text-muted) 10%, transparent)", color: on ? color : "var(--px-text-muted)", fontSize: "var(--px-text-xs)", fontWeight: 600 }}>
                                    {on ? letter : "—"}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => { setEditingRole({ ...role, permissions: { ...role.permissions } }); setShowEditPermissionsDialog(true); }} className="flex items-center gap-1 px-3 py-1.5 rounded px-hit44" style={{ background: "color-mix(in srgb, var(--px-brand) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--px-brand) 20%, transparent)", color: "var(--px-brand)", fontSize: "var(--px-text-sm)", fontWeight: 600 }}>
                          <Edit size={12} /> EDITAR PERMISOS
                        </button>
                        <button onClick={() => handleResetRolePermissions(role)} className="flex items-center gap-1 px-3 py-1.5 rounded px-hit44" style={{ border: "1px solid var(--px-hairline)", color: "var(--px-text-muted)", fontSize: "var(--px-text-sm)", fontWeight: 600 }}>
                          <RefreshCw size={12} /> RESTABLECER A VALORES PREDETERMINADOS
                        </button>
                      </div>
                    </div>
                  )}
                </TacticalCard>
              ))}
            </div>
          </div>
        )}

        {/* ═══ AUDITORÍA ═══ */}
        {activeSubTab === "auditoria" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar registros de auditoria">
              {[{ id: "all", label: "Todos" }, { id: "success", label: "Exitosos" }, { id: "failed", label: "Fallidos" }, { id: "warning", label: "Advertencias" }].map(f => (
                <button key={f.id} onClick={() => setAuditFilter(f.id)} className="px-3 py-1.5 rounded px-hit44" style={{ background: auditFilter === f.id ? "color-mix(in srgb, var(--px-brand) 15%, transparent)" : "transparent", border: `1px solid ${auditFilter === f.id ? "color-mix(in srgb, var(--px-brand) 40%, transparent)" : "var(--px-hairline)"}`, color: auditFilter === f.id ? "var(--px-brand)" : "var(--px-text-muted)", fontSize: "var(--px-text-sm)", fontWeight: 600 }}>
                  {f.label}
                </button>
              ))}
              <div className="ml-auto">
                <button onClick={() => { const csv = ["Timestamp,Usuario,Acción,Módulo,Detalle,IP,Estado", ...auditLogs.map(l => `${l.timestamp},${l.user},${l.action},${l.module},${l.detail},${l.ip},${l.status}`)].join("\n"); const blob = new Blob([csv], { type: "text/csv" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "auditoria_predix.csv"; a.click(); URL.revokeObjectURL(url); toast.success("Logs de auditoría exportados"); }} className="flex items-center gap-1 px-3 py-1.5 rounded px-hit44" aria-label="Exportar registros de auditoria a CSV" style={{ background: "color-mix(in srgb, var(--px-brand) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--px-brand) 20%, transparent)", color: "var(--px-brand)", fontSize: "var(--px-text-sm)", fontWeight: 600 }}>
                  <Download size={12} /> EXPORTAR
                </button>
              </div>
            </div>
            <TacticalCard className="overflow-hidden">
              <div className="overflow-x-auto scrollbar-tactical">
                <table className="w-full" style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-sm)", minWidth: 800 }}>
                  <thead>
                    <tr style={{ background: "color-mix(in srgb, var(--px-brand) 4%, transparent)" }}>
                      {["TIMESTAMP", "USUARIO", "ACCION", "MODULO", "DETALLE", "IP", "ESTADO"].map(h => (
                        <th key={h} scope="col" className="px-3 py-2 text-left" style={{ color: "var(--px-text-muted)", fontSize: "var(--px-text-xs)", letterSpacing: "0.08em", fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAudit.map(log => (
                      <tr key={log.id} style={{ borderBottom: "1px solid var(--px-hairline)" }}>
                        <td className="px-3 py-2.5" style={{ color: "var(--px-text-muted)", fontSize: "var(--px-text-xs)" }}>{log.timestamp}</td>
                        <td className="px-3 py-2.5" style={{ color: "var(--px-text)" }}>{log.user}</td>
                        <td className="px-3 py-2.5"><span className="px-2 py-0.5 rounded" style={{ background: "color-mix(in srgb, var(--px-brand) 10%, transparent)", color: "var(--px-brand)", fontSize: "var(--px-text-xs)" }}>{log.action}</span></td>
                        <td className="px-3 py-2.5" style={{ color: "var(--px-text)", fontSize: "var(--px-text-xs)" }}>{log.module}</td>
                        <td className="px-3 py-2.5" style={{ color: "var(--px-text-muted)", fontSize: "var(--px-text-xs)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.detail}</td>
                        <td className="px-3 py-2.5" style={{ color: "var(--px-text-muted)" }}>{log.ip}</td>
                        <td className="px-3 py-2.5"><span className="px-2 py-0.5 rounded" style={{ background: `${statusColor(log.status)}15`, color: statusColor(log.status), fontSize: "var(--px-text-xs)", fontWeight: 600 }}>{statusLabel(log.status)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TacticalCard>
          </div>
        )}

        {/* ═══ REPORTES DE ACTIVIDAD ═══ */}
        {activeSubTab === "actividad" && (
          <div className="space-y-4">
            <TacticalCard className="p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="px-section-title">ACCIONES REGISTRADAS POR MODULO</span>
                <div className="flex items-center gap-2">
                  <Calendar size={12} style={{ color: "var(--px-text-muted)" }} />
                  <span className="px-eyebrow">ULTIMOS {activityResp?.periodoDias ?? 30} DIAS</span>
                </div>
              </div>
              <p style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: "var(--px-text-muted)", marginBottom: "var(--px-3)" }}>
                Acciones de escritura registradas en la bitácora de auditoría (crear/editar/eliminar). No mide vistas de página ni duración de sesión — ese dato no existe en el sistema.
              </p>
              {(activityResp?.porModulo?.length ?? 0) === 0 ? (
                <p style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-sm)", color: "var(--px-text-muted)", textAlign: "center", padding: "var(--px-4) 0" }}>
                  Sin acciones registradas en el periodo.
                </p>
              ) : (
                // Fila con 2 columnas de ancho fijo (label 160px flexShrink:0 + 2x60px)
                // + gaps: en viewports angostos (~375px con el padding acumulado de
                // card/tab-panel/página) la suma de anchos fijos ya excede el ancho
                // disponible antes de contar la barra — sin este wrapper, el excedente
                // se recortaba en silencio contra el overflow-hidden del layout raíz
                // (perdiendo la columna de tendencia). Se envuelve en scroll horizontal
                // con un mínimo que preserva la barra legible, en vez de dejarla
                // exprimirse a ~0px.
                <div className="overflow-x-auto scrollbar-tactical">
                  <div className="space-y-2" style={{ minWidth: 420 }}>
                    {activityResp!.porModulo.map((mod) => {
                      const maxAcciones = Math.max(...activityResp!.porModulo.map(m => m.acciones), 1);
                      const barWidth = (mod.acciones / maxAcciones) * 100;
                      return (
                        <div key={mod.module} className="flex items-center" style={{ gap: "var(--px-3)" }}>
                          <div style={{ width: 160, fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: "var(--px-text)", flexShrink: 0 }}>{ACTIVITY_MODULE_LABELS[mod.module] || mod.module}</div>
                          <div className="flex-1 h-6 rounded overflow-hidden" style={{ background: "var(--px-surface)" }}>
                            <div className="h-full rounded flex items-center px-2" style={{ width: `${barWidth}%`, background: "linear-gradient(90deg, color-mix(in srgb, var(--px-brand) 30%, transparent), color-mix(in srgb, var(--px-brand) 15%, transparent))", border: "1px solid color-mix(in srgb, var(--px-brand) 20%, transparent)", transition: "width 0.5s ease" }}>
                              <span style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: "var(--px-brand)", fontWeight: 700 }}>{mod.acciones.toLocaleString()}</span>
                            </div>
                          </div>
                          <div style={{ width: 60, textAlign: "right", flexShrink: 0 }}><span style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: "var(--px-text-muted)" }}>{mod.usuariosUnicos} usr</span></div>
                          <div style={{ width: 60, textAlign: "right", flexShrink: 0 }}><span style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: mod.tendencia > 0 ? "var(--px-ok)" : mod.tendencia < 0 ? "var(--px-crit)" : "var(--px-text-muted)", fontWeight: 600 }}>{mod.tendencia > 0 ? "+" : ""}{mod.tendencia}%</span></div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </TacticalCard>

            <TacticalCard className="p-4">
              <span className="px-section-title" style={{ display: "block", marginBottom: "var(--px-3)" }}>USUARIOS MAS ACTIVOS</span>
              {(activityResp?.usuariosActivos?.length ?? 0) === 0 ? (
                <p style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-sm)", color: "var(--px-text-muted)", textAlign: "center", padding: "var(--px-4) 0" }}>
                  Sin acciones registradas en el periodo.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" style={{ gap: "var(--px-3)" }}>
                  {activityResp!.usuariosActivos.map((u, i) => {
                    const color = (u.rol && ROLE_COLORS[u.rol]) || "#00D4FF";
                    const roleLabel = (u.rol && ROLE_SLUG_TO_LABEL[u.rol]) || u.rol || "—";
                    return (
                      <TacticalCard key={u.userId} className="p-3 text-center">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full mx-auto mb-2" style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
                          <span style={{ fontWeight: 700, fontSize: "var(--px-text-md)", color }}>#{i + 1}</span>
                        </div>
                        <div style={{ fontWeight: 600, fontSize: "var(--px-text-sm)", color: "var(--px-text)" }}>{u.nombre.split(" ").slice(0, 2).join(" ")}</div>
                        <div style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: "var(--px-text-muted)" }}>{roleLabel}</div>
                        <div style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-md)", fontWeight: 700, color: "var(--px-brand)", marginTop: "var(--px-1)" }}>{u.acciones}</div>
                        <div className="px-eyebrow">ACCIONES</div>
                      </TacticalCard>
                    );
                  })}
                </div>
              )}
            </TacticalCard>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* DIALOGS */}
      {/* ═══════════════════════════════════════════════════════════════ */}

      {/* ─── New User Dialog ─── */}
      {showNewUserDialog && (
        <div className="fixed inset-0 flex items-center justify-center z-50 px-overlay" style={{ background: "rgba(0,0,0,0.7)" }} role="dialog" aria-modal="true" aria-labelledby="new-user-dialog-title">
          <TacticalCard className="w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4 px-dialog-enter" style={{ padding: "var(--px-5)" }}>
            <div className="flex items-center justify-between gap-2" style={{ marginBottom: "var(--px-4)" }}>
              <h3 id="new-user-dialog-title" style={{ fontWeight: 700, fontSize: "var(--px-text-lg)", color: "var(--px-brand)", minWidth: 0 }}>REGISTRAR NUEVO USUARIO</h3>
              <button onClick={() => setShowNewUserDialog(false)} className="p-1 rounded px-hit44" style={{ background: "color-mix(in srgb, var(--px-crit) 10%, transparent)", flexShrink: 0 }} aria-label="Cerrar"><X size={16} style={{ color: "var(--px-crit)" }} /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: "var(--px-3)" }}>
              <div>
                <label className="px-label">NOMBRE COMPLETO *</label>
                <input value={newUser.name} onChange={e => setNewUser(p => ({ ...p, name: e.target.value }))} className="px-input mt-1" style={{ minHeight: 44 }} placeholder="Ej: Cap. Juan Pérez" />
              </div>
              <div>
                <label className="px-label">CORREO INSTITUCIONAL *</label>
                <input value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} className="px-input mt-1" style={{ minHeight: 44 }} placeholder="usuario@edomex.gob.mx" />
              </div>
              <div>
                <label className="px-label">DEPARTAMENTO</label>
                <input value={newUser.department} onChange={e => setNewUser(p => ({ ...p, department: e.target.value }))} className="px-input mt-1" style={{ minHeight: 44 }} placeholder="Ej: C5 Estado de México" />
              </div>
              <div>
                <label className="px-label">CARGO</label>
                <input value={newUser.cargo} onChange={e => setNewUser(p => ({ ...p, cargo: e.target.value }))} className="px-input mt-1" style={{ minHeight: 44 }} placeholder="Ej: Jefe de Monitoreo" />
              </div>
              <div>
                <label className="px-label">ROL *</label>
                <select value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))} className="px-input mt-1" style={{ minHeight: 44 }}>
                  {roles.map(r => <option key={r.slug} value={r.name}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label className="px-label">ESTADO INICIAL</label>
                <select value={newUser.status} onChange={e => setNewUser(p => ({ ...p, status: e.target.value as "active" | "inactive" }))} className="px-input mt-1" style={{ minHeight: 44 }}>
                  <option value="active">Activo</option>
                  <option value="inactive">Inactivo</option>
                </select>
              </div>
              <div>
                <label className="px-label">CONTRASEÑA INICIAL *</label>
                <input type="password" value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} className="px-input mt-1" style={{ minHeight: 44 }} placeholder="Mínimo 8 caracteres" />
              </div>
            </div>

            {/* ─── Identification Section (Policía/Comandante) ─── */}
            {needsIdentification && (
              <div className="rounded" style={{ marginTop: "var(--px-4)", padding: "var(--px-3)", background: "color-mix(in srgb, var(--px-brand) 5%, transparent)", border: "1px solid var(--px-hairline)" }}>
                <div className="flex items-center gap-2" style={{ marginBottom: "var(--px-3)" }}>
                  <Navigation size={14} style={{ color: "var(--px-brand)" }} />
                  <span style={{ ...labelStyle, color: "var(--px-brand)", fontSize: "var(--px-text-sm)" }}>IDENTIFICACION Y RASTREO</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: "var(--px-3)" }}>
                  <div>
                    <label className="px-label">TIPO DE IDENTIFICACION *</label>
                    <select value={newUser.idType} onChange={e => setNewUser(p => ({ ...p, idType: e.target.value as any }))} className="px-input mt-1" style={{ minHeight: 44 }}>
                      <option value="patrulla">Patrulla Asignada</option>
                      <option value="grupo_operativo">Grupo Operativo</option>
                      <option value="gps">Rastreo GPS</option>
                      <option value="red_celular">Red Celular</option>
                    </select>
                  </div>
                  <div>
                    <label className="px-label">VALOR / IDENTIFICADOR *</label>
                    <input value={newUser.idValue} onChange={e => setNewUser(p => ({ ...p, idValue: e.target.value }))} className="px-input mt-1" style={{ minHeight: 44 }} placeholder={newUser.idType === "patrulla" ? "Ej: P-4521" : newUser.idType === "grupo_operativo" ? "Ej: GRUPO ALFA-7" : newUser.idType === "gps" ? "Ej: GPS-TLK-0891" : "Ej: CEL-5512345678"} />
                  </div>
                  <div>
                    <label className="px-label">LATITUD (OPCIONAL)</label>
                    <input value={newUser.lat} onChange={e => setNewUser(p => ({ ...p, lat: e.target.value }))} className="px-input mt-1" style={{ minHeight: 44 }} placeholder="Ej: 19.2933" />
                  </div>
                  <div>
                    <label className="px-label">LONGITUD (OPCIONAL)</label>
                    <input value={newUser.lng} onChange={e => setNewUser(p => ({ ...p, lng: e.target.value }))} className="px-input mt-1" style={{ minHeight: 44 }} placeholder="Ej: -99.6533" />
                  </div>
                </div>
                <p style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: "var(--px-text-muted)", marginTop: "var(--px-2)" }}>
                  La georeferencia del elemento será visible en el Mapa Geoespacial en tiempo real.
                </p>
              </div>
            )}

            <div className="flex gap-2" style={{ marginTop: "var(--px-5)" }}>
              <button onClick={() => setShowNewUserDialog(false)} className="flex-1 px-4 py-2 rounded px-hit44" style={{ border: "1px solid var(--px-hairline)", color: "var(--px-text-muted)", fontSize: "var(--px-text-base)", fontWeight: 600 }}>CANCELAR</button>
              <button onClick={handleCreateUser} className="flex-1 px-4 py-2 rounded flex items-center justify-center gap-2 px-hit44" style={{ background: "color-mix(in srgb, var(--px-brand) 15%, transparent)", border: "1px solid color-mix(in srgb, var(--px-brand) 40%, transparent)", color: "var(--px-brand)", fontSize: "var(--px-text-base)", fontWeight: 600 }}>
                <Save size={14} /> REGISTRAR USUARIO
              </button>
            </div>
          </TacticalCard>
        </div>
      )}

      {/* ─── Edit User Dialog ─── */}
      {showEditUserDialog && editingUser && (
        <div className="fixed inset-0 flex items-center justify-center z-50 px-overlay" style={{ background: "rgba(0,0,0,0.7)" }} role="dialog" aria-modal="true" aria-labelledby="edit-user-dialog-title">
          <TacticalCard className="w-full max-w-lg mx-4 px-dialog-enter" style={{ padding: "var(--px-5)" }}>
            <div className="flex items-center justify-between gap-2" style={{ marginBottom: "var(--px-4)" }}>
              <h3 id="edit-user-dialog-title" style={{ fontWeight: 700, fontSize: "var(--px-text-lg)", color: "var(--px-brand)", minWidth: 0 }}>EDITAR USUARIO</h3>
              <button onClick={() => setShowEditUserDialog(false)} className="p-1 rounded px-hit44" style={{ background: "color-mix(in srgb, var(--px-crit) 10%, transparent)", flexShrink: 0 }} aria-label="Cerrar"><X size={16} style={{ color: "var(--px-crit)" }} /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: "var(--px-3)" }}>
              <div>
                <label className="px-label">NOMBRE</label>
                <input value={editingUser.name} onChange={e => setEditingUser({ ...editingUser, name: e.target.value })} className="px-input mt-1" style={{ minHeight: 44 }} />
              </div>
              <div>
                <label className="px-label">EMAIL</label>
                <input value={editingUser.email} onChange={e => setEditingUser({ ...editingUser, email: e.target.value })} className="px-input mt-1" style={{ minHeight: 44 }} />
              </div>
              <div>
                <label className="px-label">DEPARTAMENTO</label>
                <input value={editingUser.department} onChange={e => setEditingUser({ ...editingUser, department: e.target.value })} className="px-input mt-1" style={{ minHeight: 44 }} />
              </div>
              <div>
                <label className="px-label">ROL</label>
                <select value={editingUser.role} onChange={e => setEditingUser({ ...editingUser, role: e.target.value })} className="px-input mt-1" style={{ minHeight: 44 }}>
                  {roles.map(r => <option key={r.slug} value={r.name}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label className="px-label">RESETEAR CONTRASEÑA (OPCIONAL)</label>
                <input type="password" value={resetPasswordValue} onChange={e => setResetPasswordValue(e.target.value)} className="px-input mt-1" style={{ minHeight: 44 }} placeholder="Dejar vacío para no cambiar" />
              </div>
            </div>
            <div className="flex gap-2" style={{ marginTop: "var(--px-5)" }}>
              <button onClick={() => setShowEditUserDialog(false)} className="flex-1 px-4 py-2 rounded px-hit44" style={{ border: "1px solid var(--px-hairline)", color: "var(--px-text-muted)", fontSize: "var(--px-text-base)", fontWeight: 600 }}>CANCELAR</button>
              <button onClick={handleEditUser} className="flex-1 px-4 py-2 rounded flex items-center justify-center gap-2 px-hit44" style={{ background: "color-mix(in srgb, var(--px-brand) 15%, transparent)", border: "1px solid color-mix(in srgb, var(--px-brand) 40%, transparent)", color: "var(--px-brand)", fontSize: "var(--px-text-base)", fontWeight: 600 }}>
                <Save size={14} /> GUARDAR CAMBIOS
              </button>
            </div>
          </TacticalCard>
        </div>
      )}

      {/* ─── Edit Permissions Dialog ─── */}
      {showEditPermissionsDialog && editingRole && (
        <div className="fixed inset-0 flex items-center justify-center z-50 px-overlay" style={{ background: "rgba(0,0,0,0.7)" }} role="dialog" aria-modal="true" aria-labelledby="edit-perms-dialog-title">
          <TacticalCard className="w-full max-w-2xl max-h-[80vh] overflow-y-auto mx-4 px-dialog-enter" style={{ padding: "var(--px-5)" }}>
            <div className="flex items-center justify-between gap-2" style={{ marginBottom: "var(--px-4)" }}>
              <h3 id="edit-perms-dialog-title" style={{ fontWeight: 700, fontSize: "var(--px-text-lg)", color: "var(--px-brand)", minWidth: 0 }}>EDITAR PERMISOS — {editingRole.name.toUpperCase()}</h3>
              <button onClick={() => setShowEditPermissionsDialog(false)} className="p-1 rounded px-hit44" style={{ background: "color-mix(in srgb, var(--px-crit) 10%, transparent)", flexShrink: 0 }} aria-label="Cerrar"><X size={16} style={{ color: "var(--px-crit)" }} /></button>
            </div>
            {/* Matriz V/E/D/X × 8 módulos — sin este overflow-x-auto+scrollbar-tactical
                (faltaba solo el scrollbar-tactical, el overflow-x-auto ya existía) la
                tabla (minWidth 500) desborda el dialog en viewports angostos donde
                max-w-2xl se recorta a ~343px por el mx-4. */}
            <div className="overflow-x-auto scrollbar-tactical">
            <table className="w-full" style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-sm)", minWidth: 500 }}>
              <thead>
                <tr style={{ background: "color-mix(in srgb, var(--px-brand) 4%, transparent)" }}>
                  <th scope="col" className="px-3 py-2 text-left" style={{ color: "var(--px-text-muted)", fontSize: "var(--px-text-xs)" }}>MODULO</th>
                  <th scope="col" className="px-3 py-2 text-center" style={{ color: "var(--px-ok)", fontSize: "var(--px-text-xs)" }}>VER</th>
                  <th scope="col" className="px-3 py-2 text-center" style={{ color: "var(--px-brand)", fontSize: "var(--px-text-xs)" }}>EDITAR</th>
                  <th scope="col" className="px-3 py-2 text-center" style={{ color: "var(--px-crit)", fontSize: "var(--px-text-xs)" }}>ELIMINAR</th>
                  <th scope="col" className="px-3 py-2 text-center" style={{ color: "var(--px-warn)", fontSize: "var(--px-text-xs)" }}>EXPORTAR</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(MODULE_LABELS).map(([mod, label]) => {
                  const perm = editingRole.permissions[mod] || { canView: false, canEdit: false, canDelete: false, canExport: false };
                  const setPerm = (patch: Partial<RolePerms>) => {
                    const newPerms = { ...editingRole.permissions };
                    newPerms[mod] = { ...perm, ...patch };
                    // Sin "ver" no tiene sentido conservar los demás — coherente con cómo se interpreta en el servidor.
                    if (patch.canView === false) newPerms[mod] = { canView: false, canEdit: false, canDelete: false, canExport: false };
                    setEditingRole({ ...editingRole, permissions: newPerms });
                  };
                  return (
                    <tr key={mod} style={{ borderBottom: "1px solid var(--px-hairline)" }}>
                      <td className="px-3 py-2" style={{ color: "var(--px-text)" }}>{label}</td>
                      {/* Checkboxes envueltos en <label> con px-hit44: el <input
                          type=checkbox> real mide 16x16 (w-4 h-4) — muy por debajo
                          de 44px. El <label> (no reemplazado, a diferencia del
                          <input>) sí soporta el ::before de px-hit44 y hereda el
                          toggle del checkbox por comportamiento nativo de label. */}
                      <td className="px-3 py-2 text-center">
                        <label className="inline-flex items-center justify-center px-hit44">
                          <input type="checkbox" checked={perm.canView} aria-label={`Ver ${label}`} onChange={() => setPerm({ canView: !perm.canView })} className="accent-green-500 w-4 h-4" />
                        </label>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <label className="inline-flex items-center justify-center px-hit44">
                          <input type="checkbox" checked={perm.canEdit} disabled={!perm.canView} aria-label={`Editar ${label}`} onChange={() => setPerm({ canEdit: !perm.canEdit })} className="accent-cyan-500 w-4 h-4" />
                        </label>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <label className="inline-flex items-center justify-center px-hit44">
                          <input type="checkbox" checked={perm.canDelete} disabled={!perm.canView} aria-label={`Eliminar en ${label}`} onChange={() => setPerm({ canDelete: !perm.canDelete })} className="accent-red-500 w-4 h-4" />
                        </label>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <label className="inline-flex items-center justify-center px-hit44">
                          <input type="checkbox" checked={perm.canExport} disabled={!perm.canView} aria-label={`Exportar ${label}`} onChange={() => setPerm({ canExport: !perm.canExport })} className="accent-yellow-500 w-4 h-4" />
                        </label>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
            <div className="flex gap-2" style={{ marginTop: "var(--px-5)" }}>
              <button onClick={() => setShowEditPermissionsDialog(false)} className="flex-1 px-4 py-2 rounded px-hit44" style={{ border: "1px solid var(--px-hairline)", color: "var(--px-text-muted)", fontSize: "var(--px-text-base)", fontWeight: 600 }}>CANCELAR</button>
              <button onClick={handleSavePermissions} className="flex-1 px-4 py-2 rounded flex items-center justify-center gap-2 px-hit44" style={{ background: "color-mix(in srgb, var(--px-brand) 15%, transparent)", border: "1px solid color-mix(in srgb, var(--px-brand) 40%, transparent)", color: "var(--px-brand)", fontSize: "var(--px-text-base)", fontWeight: 600 }}>
                <Save size={14} /> GUARDAR PERMISOS
              </button>
            </div>
          </TacticalCard>
        </div>
      )}

      {/* ─── Delete Confirmation Dialog ─── */}
      {showDeleteConfirm && deleteTarget && (
        <div className="fixed inset-0 flex items-center justify-center z-50 px-overlay" style={{ background: "rgba(0,0,0,0.7)" }} role="dialog" aria-modal="true" aria-labelledby="delete-confirm-dialog-title">
          <TacticalCard className="w-full max-w-md mx-4 px-dialog-enter" style={{ padding: "var(--px-5)" }}>
            <div className="flex items-center" style={{ gap: "var(--px-3)", marginBottom: "var(--px-4)" }}>
              <AlertTriangle size={24} style={{ color: "var(--px-crit)" }} aria-hidden="true" />
              <h3 id="delete-confirm-dialog-title" style={{ fontWeight: 700, fontSize: "var(--px-text-lg)", color: "var(--px-crit)" }}>CONFIRMAR ELIMINACION</h3>
            </div>
            <p style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-sm)", color: "var(--px-text)", marginBottom: "var(--px-2)" }}>
              ¿Está seguro de eliminar al usuario <strong style={{ color: "var(--px-crit)" }}>{deleteTarget.name}</strong>?
            </p>
            <p style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: "var(--px-text-muted)" }}>
              Esta acción no se puede deshacer. Se eliminará el acceso y todos los datos asociados.
            </p>
            <div className="flex gap-2" style={{ marginTop: "var(--px-5)" }}>
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 px-4 py-2 rounded px-hit44" style={{ border: "1px solid var(--px-hairline)", color: "var(--px-text-muted)", fontSize: "var(--px-text-base)", fontWeight: 600 }}>CANCELAR</button>
              <button onClick={handleDeleteUser} className="flex-1 px-4 py-2 rounded px-hit44" style={{ background: "color-mix(in srgb, var(--px-crit) 15%, transparent)", border: "1px solid color-mix(in srgb, var(--px-crit) 40%, transparent)", color: "var(--px-crit)", fontSize: "var(--px-text-base)", fontWeight: 600 }}>
                ELIMINAR USUARIO
              </button>
            </div>
          </TacticalCard>
        </div>
      )}
    </div>
  );
}
