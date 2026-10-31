// ============================================================
// edomexCentroids.ts — Coordenadas (lat/lng, grados decimales) de la CABECERA
// municipal de los 125 municipios del Estado de México, indexadas por clave
// INEGI (cve_muni), para georreferenciar la incidencia real en el mapa.
//
// GENERADO por scripts/gen-centroides.mjs desde municipios_mexico.md (tabla
// oficial INEGI en formato sexagesimal empacado → convertido a decimal).
// NO editar a mano: re-generar con el script.
// ============================================================

export interface MunicipioCentroide {
  cveMuni: string;
  nombre: string;
  lat: number;
  lng: number;
}

export const EDOMEX_CENTROIDES: MunicipioCentroide[] = [
  {
    "cveMuni": "15001",
    "nombre": "Acambay de Ruíz Castañeda",
    "lat": 19.95623,
    "lng": -99.84403
  },
  {
    "cveMuni": "15002",
    "nombre": "Acolman",
    "lat": 19.63551,
    "lng": -98.91191
  },
  {
    "cveMuni": "15003",
    "nombre": "Aculco",
    "lat": 20.09939,
    "lng": -99.82799
  },
  {
    "cveMuni": "15004",
    "nombre": "Almoloya de Alquisiras",
    "lat": 18.86723,
    "lng": -99.8938
  },
  {
    "cveMuni": "15005",
    "nombre": "Almoloya de Juárez",
    "lat": 19.36929,
    "lng": -99.75855
  },
  {
    "cveMuni": "15006",
    "nombre": "Almoloya del Río",
    "lat": 19.15939,
    "lng": -99.48884
  },
  {
    "cveMuni": "15007",
    "nombre": "Amanalco",
    "lat": 19.25238,
    "lng": -100.01998
  },
  {
    "cveMuni": "15008",
    "nombre": "Amatepec",
    "lat": 18.68349,
    "lng": -100.18605
  },
  {
    "cveMuni": "15009",
    "nombre": "Amecameca",
    "lat": 19.12868,
    "lng": -98.76981
  },
  {
    "cveMuni": "15010",
    "nombre": "Apaxco",
    "lat": 19.97532,
    "lng": -99.17416
  },
  {
    "cveMuni": "15011",
    "nombre": "Atenco",
    "lat": 19.55934,
    "lng": -98.91335
  },
  {
    "cveMuni": "15012",
    "nombre": "Atizapán",
    "lat": 19.17676,
    "lng": -99.48794
  },
  {
    "cveMuni": "15013",
    "nombre": "Atizapán de Zaragoza",
    "lat": 19.54317,
    "lng": -99.23504
  },
  {
    "cveMuni": "15014",
    "nombre": "Atlacomulco",
    "lat": 19.80003,
    "lng": -99.87425
  },
  {
    "cveMuni": "15015",
    "nombre": "Atlautla",
    "lat": 19.03086,
    "lng": -98.78267
  },
  {
    "cveMuni": "15016",
    "nombre": "Axapusco",
    "lat": 19.72446,
    "lng": -98.75833
  },
  {
    "cveMuni": "15017",
    "nombre": "Ayapango",
    "lat": 19.12722,
    "lng": -98.80251
  },
  {
    "cveMuni": "15018",
    "nombre": "Calimaya",
    "lat": 19.16322,
    "lng": -99.61867
  },
  {
    "cveMuni": "15019",
    "nombre": "Capulhuac",
    "lat": 19.19312,
    "lng": -99.46441
  },
  {
    "cveMuni": "15020",
    "nombre": "Coacalco de Berriozábal",
    "lat": 19.6293,
    "lng": -99.10438
  },
  {
    "cveMuni": "15021",
    "nombre": "Coatepec Harinas",
    "lat": 18.92571,
    "lng": -99.76852
  },
  {
    "cveMuni": "15022",
    "nombre": "Cocotitlán",
    "lat": 19.23086,
    "lng": -98.86195
  },
  {
    "cveMuni": "15023",
    "nombre": "Coyotepec",
    "lat": 19.77551,
    "lng": -99.20798
  },
  {
    "cveMuni": "15024",
    "nombre": "Cuautitlán",
    "lat": 19.66506,
    "lng": -99.17863
  },
  {
    "cveMuni": "15025",
    "nombre": "Chalco",
    "lat": 19.26113,
    "lng": -98.89565
  },
  {
    "cveMuni": "15026",
    "nombre": "Chapa de Mota",
    "lat": 19.81347,
    "lng": -99.52599
  },
  {
    "cveMuni": "15027",
    "nombre": "Chapultepec",
    "lat": 19.20116,
    "lng": -99.56187
  },
  {
    "cveMuni": "15028",
    "nombre": "Chiautla",
    "lat": 19.54865,
    "lng": -98.88135
  },
  {
    "cveMuni": "15029",
    "nombre": "Chicoloapan",
    "lat": 19.41677,
    "lng": -98.90201
  },
  {
    "cveMuni": "15030",
    "nombre": "Chiconcuac",
    "lat": 19.55272,
    "lng": -98.89531
  },
  {
    "cveMuni": "15031",
    "nombre": "Chimalhuacán",
    "lat": 19.41691,
    "lng": -98.9453
  },
  {
    "cveMuni": "15032",
    "nombre": "Donato Guerra",
    "lat": 19.30853,
    "lng": -100.14416
  },
  {
    "cveMuni": "15033",
    "nombre": "Ecatepec de Morelos",
    "lat": 19.59907,
    "lng": -99.04916
  },
  {
    "cveMuni": "15034",
    "nombre": "Ecatzingo",
    "lat": 18.95872,
    "lng": -98.7526
  },
  {
    "cveMuni": "15035",
    "nombre": "Huehuetoca",
    "lat": 19.83362,
    "lng": -99.20414
  },
  {
    "cveMuni": "15036",
    "nombre": "Hueypoxtla",
    "lat": 19.90704,
    "lng": -99.07837
  },
  {
    "cveMuni": "15037",
    "nombre": "Huixquilucan",
    "lat": 19.36018,
    "lng": -99.35169
  },
  {
    "cveMuni": "15038",
    "nombre": "Isidro Fabela",
    "lat": 19.55559,
    "lng": -99.41738
  },
  {
    "cveMuni": "15039",
    "nombre": "Ixtapaluca",
    "lat": 19.3131,
    "lng": -98.88425
  },
  {
    "cveMuni": "15040",
    "nombre": "Ixtapan de la Sal",
    "lat": 18.84461,
    "lng": -99.67582
  },
  {
    "cveMuni": "15041",
    "nombre": "Ixtapan del Oro",
    "lat": 19.26226,
    "lng": -100.26422
  },
  {
    "cveMuni": "15042",
    "nombre": "Ixtlahuaca",
    "lat": 19.56981,
    "lng": -99.76927
  },
  {
    "cveMuni": "15043",
    "nombre": "Xalatlaco",
    "lat": 19.18439,
    "lng": -99.41374
  },
  {
    "cveMuni": "15044",
    "nombre": "Jaltenco",
    "lat": 19.75222,
    "lng": -99.09403
  },
  {
    "cveMuni": "15045",
    "nombre": "Jilotepec",
    "lat": 19.95283,
    "lng": -99.53283
  },
  {
    "cveMuni": "15046",
    "nombre": "Jilotzingo",
    "lat": 19.53892,
    "lng": -99.39713
  },
  {
    "cveMuni": "15047",
    "nombre": "Jiquipilco",
    "lat": 19.5576,
    "lng": -99.6086
  },
  {
    "cveMuni": "15048",
    "nombre": "Jocotitlán",
    "lat": 19.71182,
    "lng": -99.7858
  },
  {
    "cveMuni": "15049",
    "nombre": "Joquicingo",
    "lat": 19.04923,
    "lng": -99.53182
  },
  {
    "cveMuni": "15050",
    "nombre": "Juchitepec",
    "lat": 19.10191,
    "lng": -98.88092
  },
  {
    "cveMuni": "15051",
    "nombre": "Lerma",
    "lat": 19.28537,
    "lng": -99.51182
  },
  {
    "cveMuni": "15052",
    "nombre": "Malinalco",
    "lat": 18.95234,
    "lng": -99.49757
  },
  {
    "cveMuni": "15053",
    "nombre": "Melchor Ocampo",
    "lat": 19.71041,
    "lng": -99.14346
  },
  {
    "cveMuni": "15054",
    "nombre": "Metepec",
    "lat": 19.25242,
    "lng": -99.60449
  },
  {
    "cveMuni": "15055",
    "nombre": "Mexicaltzingo",
    "lat": 19.21111,
    "lng": -99.58685
  },
  {
    "cveMuni": "15056",
    "nombre": "Morelos",
    "lat": 19.78698,
    "lng": -99.66777
  },
  {
    "cveMuni": "15057",
    "nombre": "Naucalpan de Juárez",
    "lat": 19.4788,
    "lng": -99.23322
  },
  {
    "cveMuni": "15058",
    "nombre": "Nezahualcóyotl",
    "lat": 19.40876,
    "lng": -99.0182
  },
  {
    "cveMuni": "15059",
    "nombre": "Nextlalpan",
    "lat": 19.73987,
    "lng": -99.08034
  },
  {
    "cveMuni": "15060",
    "nombre": "Nicolás Romero",
    "lat": 19.62572,
    "lng": -99.3159
  },
  {
    "cveMuni": "15061",
    "nombre": "Nopaltepec",
    "lat": 19.7788,
    "lng": -98.70954
  },
  {
    "cveMuni": "15062",
    "nombre": "Ocoyoacac",
    "lat": 19.26928,
    "lng": -99.4557
  },
  {
    "cveMuni": "15063",
    "nombre": "Ocuilan",
    "lat": 18.97909,
    "lng": -99.41694
  },
  {
    "cveMuni": "15064",
    "nombre": "El Oro",
    "lat": 19.80214,
    "lng": -100.13066
  },
  {
    "cveMuni": "15065",
    "nombre": "Otumba",
    "lat": 19.69985,
    "lng": -98.75769
  },
  {
    "cveMuni": "15066",
    "nombre": "Otzoloapan",
    "lat": 19.11741,
    "lng": -100.29771
  },
  {
    "cveMuni": "15067",
    "nombre": "Otzolotepec",
    "lat": 19.41621,
    "lng": -99.55859
  },
  {
    "cveMuni": "15068",
    "nombre": "Ozumba",
    "lat": 19.03918,
    "lng": -98.79539
  },
  {
    "cveMuni": "15069",
    "nombre": "Papalotla",
    "lat": 19.56338,
    "lng": -98.85821
  },
  {
    "cveMuni": "15070",
    "nombre": "La Paz",
    "lat": 19.35839,
    "lng": -98.9766
  },
  {
    "cveMuni": "15071",
    "nombre": "Polotitlán",
    "lat": 20.22381,
    "lng": -99.81475
  },
  {
    "cveMuni": "15072",
    "nombre": "Rayón",
    "lat": 19.14801,
    "lng": -99.58174
  },
  {
    "cveMuni": "15073",
    "nombre": "San Antonio la Isla",
    "lat": 19.1641,
    "lng": -99.56934
  },
  {
    "cveMuni": "15074",
    "nombre": "San Felipe del Progreso",
    "lat": 19.71392,
    "lng": -99.95329
  },
  {
    "cveMuni": "15075",
    "nombre": "San Martín de las Pirámides",
    "lat": 19.70484,
    "lng": -98.83452
  },
  {
    "cveMuni": "15076",
    "nombre": "San Mateo Atenco",
    "lat": 19.26417,
    "lng": -99.52972
  },
  {
    "cveMuni": "15077",
    "nombre": "San Simón de Guerrero",
    "lat": 19.02309,
    "lng": -100.00728
  },
  {
    "cveMuni": "15078",
    "nombre": "Santo Tomás",
    "lat": 19.18297,
    "lng": -100.25978
  },
  {
    "cveMuni": "15079",
    "nombre": "Soyaniquilpan de Juárez",
    "lat": 20.01389,
    "lng": -99.5279
  },
  {
    "cveMuni": "15080",
    "nombre": "Sultepec",
    "lat": 18.85855,
    "lng": -99.96643
  },
  {
    "cveMuni": "15081",
    "nombre": "Tecámac",
    "lat": 19.71021,
    "lng": -98.96714
  },
  {
    "cveMuni": "15082",
    "nombre": "Tejupilco",
    "lat": 18.9057,
    "lng": -100.1534
  },
  {
    "cveMuni": "15083",
    "nombre": "Temamatla",
    "lat": 19.20274,
    "lng": -98.8699
  },
  {
    "cveMuni": "15084",
    "nombre": "Temascalapa",
    "lat": 19.82786,
    "lng": -98.90083
  },
  {
    "cveMuni": "15085",
    "nombre": "Temascalcingo",
    "lat": 19.91591,
    "lng": -100.00408
  },
  {
    "cveMuni": "15086",
    "nombre": "Temascaltepec",
    "lat": 19.04307,
    "lng": -100.04136
  },
  {
    "cveMuni": "15087",
    "nombre": "Temoaya",
    "lat": 19.47001,
    "lng": -99.59491
  },
  {
    "cveMuni": "15088",
    "nombre": "Tenancingo",
    "lat": 18.96183,
    "lng": -99.59384
  },
  {
    "cveMuni": "15089",
    "nombre": "Tenango del Aire",
    "lat": 19.157,
    "lng": -98.8613
  },
  {
    "cveMuni": "15090",
    "nombre": "Tenango del Valle",
    "lat": 19.10376,
    "lng": -99.59158
  },
  {
    "cveMuni": "15091",
    "nombre": "Teoloyucan",
    "lat": 19.74547,
    "lng": -99.18307
  },
  {
    "cveMuni": "15092",
    "nombre": "Teotihuacán",
    "lat": 19.68548,
    "lng": -98.86863
  },
  {
    "cveMuni": "15093",
    "nombre": "Tepetlaoxtoc",
    "lat": 19.57337,
    "lng": -98.81972
  },
  {
    "cveMuni": "15094",
    "nombre": "Tepetlixpa",
    "lat": 19.02952,
    "lng": -98.81971
  },
  {
    "cveMuni": "15095",
    "nombre": "Tepotzotlán",
    "lat": 19.71378,
    "lng": -99.22351
  },
  {
    "cveMuni": "15096",
    "nombre": "Tequixquiac",
    "lat": 19.91028,
    "lng": -99.14891
  },
  {
    "cveMuni": "15097",
    "nombre": "Texcaltitlán",
    "lat": 18.93039,
    "lng": -99.93928
  },
  {
    "cveMuni": "15098",
    "nombre": "Texcalyacac",
    "lat": 19.13223,
    "lng": -99.50307
  },
  {
    "cveMuni": "15099",
    "nombre": "Texcoco",
    "lat": 19.51344,
    "lng": -98.88148
  },
  {
    "cveMuni": "15100",
    "nombre": "Tezoyuca",
    "lat": 19.59031,
    "lng": -98.9085
  },
  {
    "cveMuni": "15101",
    "nombre": "Tianguistenco",
    "lat": 19.18121,
    "lng": -99.46744
  },
  {
    "cveMuni": "15102",
    "nombre": "Timilpan",
    "lat": 19.87617,
    "lng": -99.73378
  },
  {
    "cveMuni": "15103",
    "nombre": "Tlalmanalco",
    "lat": 19.2059,
    "lng": -98.80255
  },
  {
    "cveMuni": "15104",
    "nombre": "Tlalnepantla de Baz",
    "lat": 19.53852,
    "lng": -99.1952
  },
  {
    "cveMuni": "15105",
    "nombre": "Tlatlaya",
    "lat": 18.61784,
    "lng": -100.20783
  },
  {
    "cveMuni": "15106",
    "nombre": "Toluca",
    "lat": 19.29349,
    "lng": -99.65732
  },
  {
    "cveMuni": "15107",
    "nombre": "Tonatico",
    "lat": 18.80202,
    "lng": -99.67093
  },
  {
    "cveMuni": "15108",
    "nombre": "Tultepec",
    "lat": 19.68555,
    "lng": -99.12861
  },
  {
    "cveMuni": "15109",
    "nombre": "Tultitlán",
    "lat": 19.64751,
    "lng": -99.16919
  },
  {
    "cveMuni": "15110",
    "nombre": "Valle de Bravo",
    "lat": 19.19439,
    "lng": -100.13161
  },
  {
    "cveMuni": "15111",
    "nombre": "Villa de Allende",
    "lat": 19.37342,
    "lng": -100.14936
  },
  {
    "cveMuni": "15112",
    "nombre": "Villa del Carbón",
    "lat": 19.72759,
    "lng": -99.46308
  },
  {
    "cveMuni": "15113",
    "nombre": "Villa Guerrero",
    "lat": 18.96171,
    "lng": -99.642
  },
  {
    "cveMuni": "15114",
    "nombre": "Villa Victoria",
    "lat": 19.44188,
    "lng": -99.99505
  },
  {
    "cveMuni": "15115",
    "nombre": "Xonacatlán",
    "lat": 19.40442,
    "lng": -99.5304
  },
  {
    "cveMuni": "15116",
    "nombre": "Zacazonapan",
    "lat": 19.07446,
    "lng": -100.25612
  },
  {
    "cveMuni": "15117",
    "nombre": "Zacualpan",
    "lat": 18.71867,
    "lng": -99.77562
  },
  {
    "cveMuni": "15118",
    "nombre": "Zinacantepec",
    "lat": 19.28491,
    "lng": -99.73504
  },
  {
    "cveMuni": "15119",
    "nombre": "Zumpahuacán",
    "lat": 18.84093,
    "lng": -99.5856
  },
  {
    "cveMuni": "15120",
    "nombre": "Zumpango",
    "lat": 19.79712,
    "lng": -99.10063
  },
  {
    "cveMuni": "15121",
    "nombre": "Cuautitlán Izcalli",
    "lat": 19.657,
    "lng": -99.20929
  },
  {
    "cveMuni": "15122",
    "nombre": "Valle de Chalco Solidaridad",
    "lat": 19.27877,
    "lng": -98.94345
  },
  {
    "cveMuni": "15123",
    "nombre": "Luvianos",
    "lat": 18.92048,
    "lng": -100.29945
  },
  {
    "cveMuni": "15124",
    "nombre": "San José del Rincón",
    "lat": 19.66104,
    "lng": -100.15194
  },
  {
    "cveMuni": "15125",
    "nombre": "Tonanitla",
    "lat": 19.68816,
    "lng": -99.05436
  }
];

/** Índice por clave INEGI para join O(1) con la incidencia. */
export const CENTROIDE_POR_CVE: Record<string, MunicipioCentroide> = Object.fromEntries(
  EDOMEX_CENTROIDES.map((m) => [m.cveMuni, m]),
);

/** Índice por nombre para lookup desde routers que manejan nombres (predicciones, etc.). */
export const CENTROIDE_POR_NOMBRE: Record<string, MunicipioCentroide> = Object.fromEntries(
  EDOMEX_CENTROIDES.map((m) => [m.nombre, m]),
);
