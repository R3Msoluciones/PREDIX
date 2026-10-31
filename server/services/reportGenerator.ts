/**
 * Servicio de generación de reportes ejecutivos en PDF
 * Crea reportes con KPIs, gráficos y análisis de seguridad
 */

import PDFDocument from "pdfkit";
import { Readable } from "stream";
import {
  getKPIMetrics,
  getTrendencyData,
  getMonthComparison,
  getCriticalMunicipalities,
  getCrimeTypeStats,
} from "./dashboardStats";

export interface ReportOptions {
  includeKPIs?: boolean;
  includeTrends?: boolean;
  includeCriminalTypes?: boolean;
  includeCriticalMunicipalities?: boolean;
  includeComparison?: boolean;
  title?: string;
  subtitle?: string;
}

/**
 * Generar reporte ejecutivo en PDF
 */
export async function generateExecutiveReport(
  options: ReportOptions = {}
): Promise<Buffer> {
  const {
    includeKPIs = true,
    includeTrends = true,
    includeCriminalTypes = true,
    includeCriticalMunicipalities = true,
    includeComparison = true,
    title = "REPORTE EJECUTIVO DE SEGURIDAD PÚBLICA",
    subtitle = "Estado de México",
  } = options;

  // Obtener datos
  const [kpis, trends, comparison, municipalities, crimeStats] = await Promise.all([
    includeKPIs ? getKPIMetrics() : Promise.resolve(null),
    includeTrends ? getTrendencyData(12) : Promise.resolve([]),
    includeComparison ? getMonthComparison() : Promise.resolve(null),
    includeCriticalMunicipalities ? getCriticalMunicipalities() : Promise.resolve([]),
    includeCriminalTypes ? getCrimeTypeStats() : Promise.resolve(null),
  ]);

  // Crear documento PDF
  const doc = new PDFDocument({
    size: "A4",
    margin: 40,
    bufferPages: true,
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  // Header
  doc
    .fontSize(24)
    .font("Helvetica-Bold")
    .text(title, { align: "center" })
    .fontSize(12)
    .font("Helvetica")
    .text(subtitle, { align: "center" })
    .text(`Fecha: ${new Date().toLocaleDateString("es-MX")}`, { align: "center" })
    .moveDown(1);

  // Línea separadora
  doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke("#00D4FF").moveDown(1);

  // KPIs
  if (includeKPIs && kpis) {
    doc.fontSize(16).font("Helvetica-Bold").text("INDICADORES CLAVE DE RENDIMIENTO", {
      underline: true,
    });

    doc.moveDown(0.5);

    // Grid de KPIs
    const kpiData = [
      { label: "Total Incidentes", value: kpis.totalIncidentes },
      { label: "Total Víctimas", value: kpis.totalVictimas },
      { label: "Homicidios", value: kpis.homicidios },
      { label: "Robos", value: kpis.robos },
      { label: "Lesiones", value: kpis.lesiones },
      { label: "Violencia Sexual", value: kpis.violenciaSexual },
      { label: "Tráfico de Drogas", value: kpis.traficoDeDropas },
      { label: "Otros Delitos", value: kpis.otrosDelitos },
    ];

    const itemsPerRow = 4;
    const itemWidth = (555 - 40) / itemsPerRow;
    const itemHeight = 60;

    kpiData.forEach((item, index) => {
      const row = Math.floor(index / itemsPerRow);
      const col = index % itemsPerRow;
      const x = 40 + col * itemWidth;
      const y = doc.y + row * itemHeight;

      // Rectángulo
      doc
        .rect(x, y, itemWidth - 5, itemHeight - 5)
        .stroke("#00D4FF");

      // Contenido
      doc
        .fontSize(10)
        .font("Helvetica")
        .text(item.label, x + 5, y + 5, { width: itemWidth - 10 })
        .fontSize(14)
        .font("Helvetica-Bold")
        .text(item.value.toString(), x + 5, y + 25, {
          width: itemWidth - 10,
          align: "center",
        });
    });

    doc.moveDown(4);
  }

  // Comparativa Mensual
  if (includeComparison && comparison) {
    doc.fontSize(16).font("Helvetica-Bold").text("COMPARATIVA MENSUAL", {
      underline: true,
    });

    doc.moveDown(0.5);

    const comparisonData = [
      {
        label: "Delitos",
        actual: comparison.mesActual.delitos,
        anterior: comparison.mesPasado.delitos,
        cambio: comparison.porcentajeDelitos,
      },
      {
        label: "Víctimas",
        actual: comparison.mesActual.victimas,
        anterior: comparison.mesPasado.victimas,
        cambio: comparison.porcentajeVictimas,
      },
    ];

    const table = {
      headers: ["Métrica", "Mes Actual", "Mes Anterior", "Cambio %"],
      rows: comparisonData.map((item) => [
        item.label,
        item.actual.toString(),
        item.anterior.toString(),
        `${item.cambio > 0 ? "+" : ""}${item.cambio.toFixed(1)}%`,
      ]),
    };

    drawTable(doc, table, 40, doc.y);
    doc.moveDown(2);
  }

  // Tipos de Delitos
  if (includeCriminalTypes && crimeStats) {
    doc.fontSize(16).font("Helvetica-Bold").text("DISTRIBUCIÓN POR TIPO DE DELITO", {
      underline: true,
    });

    doc.moveDown(0.5);

    const crimeData = [
      { label: "Homicidios", value: crimeStats.homicidios, pct: crimeStats.porcentajes.homicidios },
      { label: "Robos", value: crimeStats.robos, pct: crimeStats.porcentajes.robos },
      { label: "Lesiones", value: crimeStats.lesiones, pct: crimeStats.porcentajes.lesiones },
      {
        label: "Violencia Sexual",
        value: crimeStats.violenciaSexual,
        pct: crimeStats.porcentajes.violenciaSexual,
      },
      {
        label: "Tráfico de Drogas",
        value: crimeStats.traficoDeDropas,
        pct: crimeStats.porcentajes.traficoDeDropas,
      },
      { label: "Otros", value: crimeStats.otrosDelitos, pct: crimeStats.porcentajes.otrosDelitos },
    ];

    const maxWidth = 400;
    crimeData.forEach((crime) => {
      const barWidth = (crime.pct / 100) * maxWidth;
      doc.fontSize(10).font("Helvetica").text(`${crime.label}: ${crime.value}`, 40, doc.y);

      // Barra de progreso
      doc
        .rect(40, doc.y, maxWidth, 15)
        .stroke("#E0E0E0");

      doc
        .rect(40, doc.y, barWidth, 15)
        .fill("#FF3B3B");

      doc.fontSize(9).text(`${crime.pct.toFixed(1)}%`, 45 + barWidth, doc.y + 2);
      doc.moveDown(1.5);
    });

    doc.moveDown(1);
  }

  // Municipios Críticos
  if (includeCriticalMunicipalities && municipalities.length > 0) {
    doc.addPage();

    doc.fontSize(16).font("Helvetica-Bold").text("TOP 10 MUNICIPIOS CRÍTICOS", {
      underline: true,
    });

    doc.moveDown(0.5);

    const municipalityTable = {
      headers: ["Municipio", "Riesgo", "Delitos", "Homicidios", "Víctimas"],
      rows: municipalities.slice(0, 10).map((mun) => [
        mun.municipio,
        mun.riesgo,
        mun.delitos.toString(),
        mun.homicidios.toString(),
        mun.victimas.toString(),
      ]),
    };

    drawTable(doc, municipalityTable, 40, doc.y);
    doc.moveDown(2);
  }

  // Footer
  const pages = doc.bufferedPageRange().count;
  for (let i = 0; i < pages; i++) {
    doc.switchToPage(i);
    doc
      .fontSize(9)
      .font("Helvetica")
      .text(
        `Página ${i + 1} de ${pages} | Generado: ${new Date().toLocaleString("es-MX")}`,
        40,
        doc.page.height - 30,
        { align: "center" }
      );
  }

  return new Promise((resolve, reject) => {
    doc.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    doc.on("error", reject);
    doc.end();
  });
}

/**
 * Dibujar tabla en PDF
 */
function drawTable(
  doc: any,
  table: { headers: string[]; rows: string[][] },
  x: number,
  y: number
) {
  const columnWidth = 100;
  const rowHeight = 25;

  // Headers
  doc.fontSize(11).font("Helvetica-Bold").fillColor("#00D4FF");

  table.headers.forEach((header, i) => {
    doc.text(header, x + i * columnWidth, y, { width: columnWidth - 5, align: "center" });
  });

  // Línea separadora
  doc.moveTo(x, y + rowHeight - 5).lineTo(x + table.headers.length * columnWidth, y + rowHeight - 5).stroke();

  // Rows
  doc.fontSize(10).font("Helvetica").fillColor("#000000");

  table.rows.forEach((row, rowIndex) => {
    const rowY = y + rowHeight + rowIndex * rowHeight;

    row.forEach((cell, colIndex) => {
      doc.text(cell, x + colIndex * columnWidth, rowY, { width: columnWidth - 5, align: "center" });
    });

    // Línea separadora entre filas
    if (rowIndex < table.rows.length - 1) {
      doc.moveTo(x, rowY + rowHeight - 5).lineTo(x + table.headers.length * columnWidth, rowY + rowHeight - 5).stroke("#E0E0E0");
    }
  });

  // Línea final
  doc
    .moveTo(x, y + rowHeight + table.rows.length * rowHeight - 5)
    .lineTo(x + table.headers.length * columnWidth, y + rowHeight + table.rows.length * rowHeight - 5)
    .stroke();

  doc.moveDown(table.rows.length + 2);
}

/**
 * Generar reporte de municipio específico
 */
export async function generateMunicipalityReport(municipio: string): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margin: 40,
    bufferPages: true,
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  // Header
  doc
    .fontSize(20)
    .font("Helvetica-Bold")
    .text(`REPORTE: ${municipio.toUpperCase()}`, { align: "center" })
    .fontSize(12)
    .font("Helvetica")
    .text("Análisis de Seguridad Pública", { align: "center" })
    .text(`Fecha: ${new Date().toLocaleDateString("es-MX")}`, { align: "center" })
    .moveDown(1);

  // Línea separadora
  doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke("#00D4FF").moveDown(1);

  // Contenido básico
  doc
    .fontSize(14)
    .font("Helvetica-Bold")
    .text("Información del Municipio")
    .fontSize(11)
    .font("Helvetica")
    .text(`Municipio: ${municipio}`)
    .text(`Reporte Generado: ${new Date().toLocaleString("es-MX")}`)
    .moveDown(1);

  doc
    .fontSize(12)
    .font("Helvetica-Bold")
    .text("Recomendaciones")
    .fontSize(10)
    .font("Helvetica")
    .text("• Aumentar patrullaje en zonas de alto riesgo")
    .text("• Implementar operativos preventivos")
    .text("• Fortalecer coordinación interinstitucional")
    .moveDown(1);

  return new Promise((resolve, reject) => {
    doc.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    doc.on("error", reject);
    doc.end();
  });
}
