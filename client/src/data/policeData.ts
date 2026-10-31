// ============================================================
// POLICE DATA — Datos de elementos policiales y comandantes
// Georeferenciados para el Mapa Geoespacial
// ============================================================

export interface PoliceElement {
  id: number;
  name: string;
  role: "Policía" | "Comandante";
  department: string;
  status: "active" | "inactive" | "suspended";
  identification: {
    type: "patrulla" | "grupo_operativo" | "gps" | "red_celular";
    value: string;
    lat: number;
    lng: number;
    lastUpdate: string;
  };
}

export const POLICE_ELEMENTS: PoliceElement[] = [
  {
    id: 7,
    name: "Cap. Fernando Díaz",
    role: "Comandante",
    department: "Policía Estatal",
    status: "active",
    identification: { type: "grupo_operativo", value: "GRUPO ALFA-7", lat: 19.2933, lng: -99.6533, lastUpdate: "17/04/2026 20:18" },
  },
  {
    id: 11,
    name: "Ofc. Pedro Martínez Luna",
    role: "Policía",
    department: "Sector Ecatepec Norte",
    status: "active",
    identification: { type: "patrulla", value: "P-4521", lat: 19.6010, lng: -99.0500, lastUpdate: "17/04/2026 20:22" },
  },
  {
    id: 12,
    name: "Ofc. Laura Jiménez Ríos",
    role: "Policía",
    department: "Sector Naucalpan Centro",
    status: "active",
    identification: { type: "patrulla", value: "P-3287", lat: 19.4786, lng: -99.2394, lastUpdate: "17/04/2026 20:19" },
  },
  {
    id: 13,
    name: "Ofc. Ricardo Flores Vega",
    role: "Policía",
    department: "Sector Toluca Sur",
    status: "active",
    identification: { type: "gps", value: "GPS-TLK-0891", lat: 19.2826, lng: -99.6557, lastUpdate: "17/04/2026 20:21" },
  },
  {
    id: 14,
    name: "Cmdte. Alejandro Ruiz Ortiz",
    role: "Comandante",
    department: "Zona Oriente",
    status: "active",
    identification: { type: "grupo_operativo", value: "GRUPO DELTA-3", lat: 19.3560, lng: -98.9820, lastUpdate: "17/04/2026 20:15" },
  },
  // Additional simulated elements for coverage
  {
    id: 15,
    name: "Ofc. Daniel López Herrera",
    role: "Policía",
    department: "Sector Nezahualcóyotl",
    status: "active",
    identification: { type: "patrulla", value: "P-5102", lat: 19.4003, lng: -99.0145, lastUpdate: "17/04/2026 20:20" },
  },
  {
    id: 16,
    name: "Ofc. Gabriela Soto Méndez",
    role: "Policía",
    department: "Sector Tlalnepantla",
    status: "active",
    identification: { type: "gps", value: "GPS-TLN-0234", lat: 19.5370, lng: -99.2040, lastUpdate: "17/04/2026 20:17" },
  },
  {
    id: 17,
    name: "Cmdte. Héctor Navarro Cruz",
    role: "Comandante",
    department: "Zona Norte",
    status: "active",
    identification: { type: "grupo_operativo", value: "GRUPO BRAVO-1", lat: 19.5950, lng: -99.0600, lastUpdate: "17/04/2026 20:16" },
  },
  {
    id: 18,
    name: "Ofc. Andrea Castillo Pérez",
    role: "Policía",
    department: "Sector Cuautitlán Izcalli",
    status: "active",
    identification: { type: "patrulla", value: "P-6788", lat: 19.6500, lng: -99.2100, lastUpdate: "17/04/2026 20:14" },
  },
  {
    id: 19,
    name: "Ofc. Martín Aguilar Ramos",
    role: "Policía",
    department: "Sector Ixtapaluca",
    status: "active",
    identification: { type: "red_celular", value: "CEL-IXT-4455", lat: 19.3180, lng: -98.8820, lastUpdate: "17/04/2026 20:13" },
  },
  {
    id: 20,
    name: "Cmdte. Verónica Estrada Solís",
    role: "Comandante",
    department: "Zona Sur",
    status: "active",
    identification: { type: "grupo_operativo", value: "GRUPO CHARLIE-5", lat: 19.2600, lng: -99.5800, lastUpdate: "17/04/2026 20:12" },
  },
  {
    id: 21,
    name: "Ofc. José Ramón Gutiérrez",
    role: "Policía",
    department: "Sector Chimalhuacán",
    status: "active",
    identification: { type: "patrulla", value: "P-7234", lat: 19.4300, lng: -98.9500, lastUpdate: "17/04/2026 20:11" },
  },
];

export function getPoliceByRole(role: "Policía" | "Comandante"): PoliceElement[] {
  return POLICE_ELEMENTS.filter(e => e.role === role && e.status === "active");
}

export function getAllActivePolice(): PoliceElement[] {
  return POLICE_ELEMENTS.filter(e => e.status === "active");
}
