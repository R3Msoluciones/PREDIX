/**
 * useIncidentSearch — Hook para búsqueda y filtrado en tiempo real de incidentes
 * Implementa lógica de filtrado eficiente con múltiples criterios
 */

import { useMemo } from "react";
import type { IncidentFilterState } from "@/components/AdvancedIncidentFilter";

export interface Incident {
  id: string;
  tipo: string;
  municipio: string;
  colonia: string;
  hora: string;
  estado: string;
  prioridad: string;
  lat: number;
  lng: number;
  [key: string]: any;
}

export function useIncidentSearch(incidents: Incident[], filters: IncidentFilterState) {
  const filtered = useMemo(() => {
    return incidents.filter((incident) => {
      // Text search filter
      if (filters.searchText) {
        const searchLower = filters.searchText.toLowerCase();
        const matchesSearch =
          incident.id.toLowerCase().includes(searchLower) ||
          incident.tipo.toLowerCase().includes(searchLower) ||
          incident.municipio.toLowerCase().includes(searchLower) ||
          incident.colonia.toLowerCase().includes(searchLower);

        if (!matchesSearch) return false;
      }

      // Priority filter
      if (filters.priority.length > 0 && !filters.priority.includes(incident.prioridad)) {
        return false;
      }

      // Status filter
      if (filters.status.length > 0 && !filters.status.includes(incident.estado)) {
        return false;
      }

      // Municipality filter
      if (filters.municipios.length > 0 && !filters.municipios.includes(incident.municipio)) {
        return false;
      }

      // Crime type filter (based on incident type)
      if (filters.crimeTypes.length > 0) {
        const matchesCrimeType = filters.crimeTypes.some((crimeType) =>
          incident.tipo.toLowerCase().includes(crimeType.toLowerCase())
        );
        if (!matchesCrimeType) return false;
      }

      return true;
    });
  }, [incidents, filters]);

  // Calculate statistics
  const statistics = useMemo(() => {
    const stats = {
      total: filtered.length,
      byPriority: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
      byMunicipio: {} as Record<string, number>,
    };

    filtered.forEach((incident) => {
      stats.byPriority[incident.prioridad] = (stats.byPriority[incident.prioridad] || 0) + 1;
      stats.byStatus[incident.estado] = (stats.byStatus[incident.estado] || 0) + 1;
      stats.byMunicipio[incident.municipio] = (stats.byMunicipio[incident.municipio] || 0) + 1;
    });

    return stats;
  }, [filtered]);

  // Sort incidents by priority and date
  const sorted = useMemo(() => {
    const priorityOrder: Record<string, number> = {
      crítica: 0,
      alta: 1,
      media: 2,
      baja: 3,
    };

    return [...filtered].sort((a, b) => {
      // First sort by priority
      const aPriority = priorityOrder[a.prioridad] ?? 999;
      const bPriority = priorityOrder[b.prioridad] ?? 999;
      const priorityDiff = aPriority - bPriority;
      if (priorityDiff !== 0) return priorityDiff;

      // Then by ID (assuming newer IDs are higher numbers)
      return b.id.localeCompare(a.id);
    });
  }, [filtered]);

  return {
    filtered: sorted,
    count: filtered.length,
    statistics,
  };
}
