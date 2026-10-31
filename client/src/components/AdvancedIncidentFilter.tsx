/**
 * AdvancedIncidentFilter — Filtros inline (PREDIX v2)
 * Pills para opciones pocas, combobox con teclado para opciones muchas
 */

import { useState, useMemo, useRef } from "react";
import { Search, X } from "lucide-react";

export interface IncidentFilterState {
  searchText: string;
  priority: string[];
  status: string[];
  municipios: string[];
  crimeTypes: string[];
}

interface Props {
  onFilterChange: (filters: IncidentFilterState) => void;
  municipios?: string[];
  crimeTypes?: string[];
  initialFilters?: Partial<IncidentFilterState>;
}

const PRIORITIES = [
  { id: "crítica", label: "Crítica", color: "var(--px-crit)" },
  { id: "alta", label: "Alta", color: "var(--px-warn)" },
  { id: "media", label: "Media", color: "var(--px-brand)" },
  { id: "baja", label: "Baja", color: "var(--px-ok)" },
];

const STATUSES = [
  { id: "En proceso", label: "Proceso", color: "var(--px-warn)" },
  { id: "Cerrado", label: "Cerrado", color: "var(--px-ok)" },
  { id: "Investigación", label: "Investig.", color: "var(--px-brand)" },
];

const DEFAULT_MUNIS = ["Toluca", "Ecatepec", "Tlalnepantla", "Naucalpan", "Nezahualcóyotl", "Chimalhuacán", "Ixtapaluca", "Atizapán", "Huixquilucan", "Cuautitlán"];
const DEFAULT_CRIMES = ["Homicidios", "Robos", "Lesiones", "Violencia Sexual", "Tráfico de Drogas", "Otros Delitos"];

function Pill({ label, color, active, onClick }: { label: string; color: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="transition-all" style={{
      fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", padding: "4px 10px",
      borderRadius: 999, cursor: "pointer", whiteSpace: "nowrap",
      background: active ? `color-mix(in srgb, ${color} 18%, transparent)` : "transparent",
      border: `1px solid ${active ? `color-mix(in srgb, ${color} 40%, transparent)` : "var(--px-hairline)"}`,
      color: active ? color : "var(--px-text-faint)",
    }}>
      {label}
    </button>
  );
}

function Combobox({ label, options, selected, onToggle, color = "var(--px-brand)" }: {
  label: string; options: string[]; selected: string[]; onToggle: (v: string) => void; color?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => {
    const available = options.filter(o => !selected.includes(o));
    return query ? available.filter(o => o.toLowerCase().includes(query.toLowerCase())) : available;
  }, [options, selected, query]);

  return (
    <div className="flex-1 min-w-0" ref={ref}>
      <div className="px-eyebrow" style={{ marginBottom: 4 }}>{label}</div>
      {/* Input con búsqueda */}
      <div className="flex items-center gap-1.5 px-input" style={{ display: "flex", padding: "4px 8px", position: "relative" }}>
        <Search size={11} style={{ color: "var(--px-text-faint)", flexShrink: 0 }} />
        <input type="text" placeholder={`Buscar ${label.toLowerCase()}...`}
          value={query} onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          style={{ background: "transparent", border: "none", outline: "none", fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: "var(--px-text)", width: "100%" }} />
        {query && <button onClick={() => setQuery("")} style={{ color: "var(--px-text-faint)", cursor: "pointer", flexShrink: 0 }}><X size={11} /></button>}
      </div>
      {/* Dropdown */}
      {open && filtered.length > 0 && (
        <div className="scrollbar-tactical" style={{
          position: "absolute", zIndex: 20, marginTop: 4, width: ref.current?.offsetWidth,
          maxHeight: 160, overflowY: "auto", background: "var(--px-surface)",
          border: "1px solid var(--px-hairline)", borderRadius: "var(--px-r-sm)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        }}>
          {filtered.slice(0, 20).map(opt => (
            <div key={opt} className="cursor-pointer transition-all" style={{ padding: "6px 10px", fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: "var(--px-text-muted)" }}
              onMouseDown={e => { e.preventDefault(); onToggle(opt); setQuery(""); }}>
              {opt}
            </div>
          ))}
          {filtered.length > 20 && (
            <div style={{ padding: "4px 10px", fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: "var(--px-text-faint)" }}>
              +{filtered.length - 20} más — escribe para filtrar
            </div>
          )}
        </div>
      )}
      {/* Chips seleccionados */}
      {selected.length > 0 && (
        <div className="flex gap-1 flex-wrap mt-1">
          {selected.map(v => (
            <span key={v} className="flex items-center gap-1 cursor-pointer transition-all" style={{
              fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", padding: "2px 8px",
              borderRadius: 999, background: `color-mix(in srgb, ${color} 18%, transparent)`,
              border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`, color,
            }} onClick={() => onToggle(v)}>
              {v} <X size={9} />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdvancedIncidentFilter({ onFilterChange, municipios = DEFAULT_MUNIS, crimeTypes = DEFAULT_CRIMES, initialFilters = {} }: Props) {
  const [filters, setFilters] = useState<IncidentFilterState>({
    searchText: initialFilters.searchText || "",
    priority: initialFilters.priority || [],
    status: initialFilters.status || [],
    municipios: initialFilters.municipios || [],
    crimeTypes: initialFilters.crimeTypes || [],
  });

  const activeCount = useMemo(() =>
    (filters.searchText ? 1 : 0) + filters.priority.length + filters.status.length + filters.municipios.length + filters.crimeTypes.length
  , [filters]);

  const update = (patch: Partial<IncidentFilterState>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    onFilterChange(next);
  };

  const toggle = (key: keyof IncidentFilterState, value: string) => {
    const arr = filters[key] as string[];
    update({ [key]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] });
  };

  const clear = () => update({ searchText: "", priority: [], status: [], municipios: [], crimeTypes: [] });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--px-3)" }}>
      {/* Búsqueda global + limpiar */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 flex-1 px-input" style={{ display: "flex" }}>
          <Search size={13} style={{ color: "var(--px-text-faint)", flexShrink: 0 }} />
          <input type="text" placeholder="Buscar por ID, tipo, municipio..."
            aria-label="Buscar incidentes" value={filters.searchText}
            onChange={e => update({ searchText: e.target.value })}
            style={{ background: "transparent", border: "none", outline: "none", fontFamily: "var(--px-mono)", fontSize: "var(--px-text-sm)", color: "var(--px-text)", width: "100%" }} />
          {filters.searchText && <button onClick={() => update({ searchText: "" })} style={{ color: "var(--px-text-faint)", cursor: "pointer" }}><X size={13} /></button>}
        </div>
        {activeCount > 0 && (
          <button onClick={clear} style={{ fontFamily: "var(--px-mono)", fontSize: "var(--px-text-xs)", color: "var(--px-warn)", cursor: "pointer", background: "none", border: "none", whiteSpace: "nowrap" }}>
            Limpiar ({activeCount})
          </button>
        )}
      </div>

      {/* Fila 1: pills (prioridad + estado) */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div>
          <div className="px-eyebrow" style={{ marginBottom: 4 }}>Prioridad</div>
          <div className="flex gap-1 flex-wrap">
            {PRIORITIES.map(p => <Pill key={p.id} label={p.label} color={p.color} active={filters.priority.includes(p.id)} onClick={() => toggle("priority", p.id)} />)}
          </div>
        </div>
        <div>
          <div className="px-eyebrow" style={{ marginBottom: 4 }}>Estado</div>
          <div className="flex gap-1 flex-wrap">
            {STATUSES.map(s => <Pill key={s.id} label={s.label} color={s.color} active={filters.status.includes(s.id)} onClick={() => toggle("status", s.id)} />)}
          </div>
        </div>
      </div>

      {/* Fila 2: combobox con teclado (municipio + tipo) */}
      <div className="flex flex-col sm:flex-row gap-3 relative">
        <Combobox label="Municipio" options={municipios} selected={filters.municipios} onToggle={v => toggle("municipios", v)} />
        <Combobox label="Tipo de delito" options={crimeTypes} selected={filters.crimeTypes} onToggle={v => toggle("crimeTypes", v)} color="var(--px-warn)" />
      </div>
    </div>
  );
}
