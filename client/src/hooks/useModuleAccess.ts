/**
 * useModuleAccess — Hook para verificar acceso a módulos
 * Verifica permisos del usuario para cada módulo
 */

import { trpc } from "@/lib/trpc";

export interface ModulePermissions {
  canView: number;
  canEdit: number;
  canDelete: number;
  canExport: number;
}

export function useModuleAccess(module: string) {
  const { data: permissions, isLoading } = trpc.auth.getModulePermissions.useQuery(
    { module },
    { retry: false }
  );

  const { data: canAccess } = trpc.auth.canAccessModule.useQuery(
    { module },
    { retry: false }
  );

  return {
    permissions: permissions || { canView: 0, canEdit: 0, canDelete: 0, canExport: 0 },
    canView: permissions?.canView === 1,
    canEdit: permissions?.canEdit === 1,
    canDelete: permissions?.canDelete === 1,
    canExport: permissions?.canExport === 1,
    canAccess: canAccess ?? false,
    isLoading,
  };
}

export function useAccessibleModules() {
  const { data: modules, isLoading } = trpc.auth.getAccessibleModules.useQuery(undefined, {
    retry: false,
  });

  return {
    modules: modules || [],
    isLoading,
  };
}

export function useUserProfile() {
  const { data: profile, isLoading } = trpc.auth.getUserProfile.useQuery(undefined, {
    retry: false,
  });

  return {
    profile,
    isLoading,
    role: profile?.institutionalRole,
    name: profile?.name,
    institution: profile?.institution,
    department: profile?.department,
  };
}
