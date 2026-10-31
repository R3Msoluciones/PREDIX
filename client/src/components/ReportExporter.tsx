/**
 * Componente para exportar reportes ejecutivos en PDF
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Download, Loader2, FileText } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface ReportExporterProps {
  variant?: "button" | "card";
  municipio?: string;
}

export default function ReportExporter({ variant = "button", municipio }: ReportExporterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Opciones de reporte
  const [options, setOptions] = useState({
    includeKPIs: true,
    includeTrends: true,
    includeCriminalTypes: true,
    includeCriticalMunicipalities: true,
    includeComparison: true,
  });

  // Mutations
  const generateExecutiveReport = trpc.reports.generateExecutiveReport.useMutation();
  const generateMunicipalityReport = trpc.reports.generateMunicipalityReport.useMutation();

  /**
   * Descargar reporte
   */
  const handleDownloadReport = async () => {
    try {
      setIsLoading(true);

      let result;

      if (municipio) {
        // Reporte de municipio específico
        result = await generateMunicipalityReport.mutateAsync({ municipio });
      } else {
        // Reporte ejecutivo
        result = await generateExecutiveReport.mutateAsync(options);
      }

      if (result.success && result.data) {
        // Convertir base64 a blob
        const binaryString = atob(result.data.pdf);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: "application/pdf" });

        // Crear link de descarga
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = result.data.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        toast.success(`Reporte descargado: ${result.data.filename}`);
        setIsOpen(false);
      } else {
        toast.error("Error al generar el reporte");
      }
    } catch (error) {
      console.error("Error downloading report:", error);
      toast.error("Error al descargar el reporte");
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Cambiar opción de reporte
   */
  const handleOptionChange = (key: keyof typeof options) => {
    setOptions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  if (variant === "card") {
    return (
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            Exportar Reporte
          </CardTitle>
          <CardDescription>
            {municipio
              ? `Generar reporte detallado de ${municipio}`
              : "Descargar reporte ejecutivo en PDF con KPIs y análisis"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="w-full bg-cyan-500 hover:bg-cyan-600 text-black font-semibold">
                <Download className="w-4 h-4 mr-2" />
                Generar Reporte
              </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-md bg-slate-900 border-cyan-500/30">
              <DialogHeader>
                <DialogTitle className="text-cyan-400">
                  {municipio ? `Reporte: ${municipio}` : "Generar Reporte Ejecutivo"}
                </DialogTitle>
                <DialogDescription className="text-slate-300">
                  {municipio
                    ? "Selecciona los datos a incluir en el reporte"
                    : "Personaliza el contenido del reporte ejecutivo"}
                </DialogDescription>
              </DialogHeader>

              {!municipio && (
                <div className="space-y-3 py-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-200">
                      Secciones a incluir:
                    </Label>

                    <div className="space-y-2 pl-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="kpis"
                          checked={options.includeKPIs}
                          onCheckedChange={() => handleOptionChange("includeKPIs")}
                          className="border-cyan-400"
                        />
                        <Label htmlFor="kpis" className="text-sm text-slate-300 cursor-pointer">
                          Indicadores Clave (KPIs)
                        </Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="trends"
                          checked={options.includeTrends}
                          onCheckedChange={() => handleOptionChange("includeTrends")}
                          className="border-cyan-400"
                        />
                        <Label htmlFor="trends" className="text-sm text-slate-300 cursor-pointer">
                          Análisis de Tendencias
                        </Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="crimes"
                          checked={options.includeCriminalTypes}
                          onCheckedChange={() => handleOptionChange("includeCriminalTypes")}
                          className="border-cyan-400"
                        />
                        <Label htmlFor="crimes" className="text-sm text-slate-300 cursor-pointer">
                          Tipos de Delitos
                        </Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="municipalities"
                          checked={options.includeCriticalMunicipalities}
                          onCheckedChange={() =>
                            handleOptionChange("includeCriticalMunicipalities")
                          }
                          className="border-cyan-400"
                        />
                        <Label
                          htmlFor="municipalities"
                          className="text-sm text-slate-300 cursor-pointer"
                        >
                          Municipios Críticos
                        </Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="comparison"
                          checked={options.includeComparison}
                          onCheckedChange={() => handleOptionChange("includeComparison")}
                          className="border-cyan-400"
                        />
                        <Label htmlFor="comparison" className="text-sm text-slate-300 cursor-pointer">
                          Comparativa Mensual
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleDownloadReport}
                  disabled={isLoading}
                  className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-black font-semibold"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generando...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Descargar PDF
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    );
  }

  // Variante botón
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-cyan-500 hover:bg-cyan-600 text-black font-semibold">
          <Download className="w-4 h-4 mr-2" />
          Exportar Reporte
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md bg-slate-900 border-cyan-500/30">
        <DialogHeader>
          <DialogTitle className="text-cyan-400">Generar Reporte Ejecutivo</DialogTitle>
          <DialogDescription className="text-slate-300">
            Personaliza el contenido del reporte PDF
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-200">Secciones a incluir:</Label>

            <div className="space-y-2 pl-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="kpis"
                  checked={options.includeKPIs}
                  onCheckedChange={() => handleOptionChange("includeKPIs")}
                  className="border-cyan-400"
                />
                <Label htmlFor="kpis" className="text-sm text-slate-300 cursor-pointer">
                  Indicadores Clave (KPIs)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="trends"
                  checked={options.includeTrends}
                  onCheckedChange={() => handleOptionChange("includeTrends")}
                  className="border-cyan-400"
                />
                <Label htmlFor="trends" className="text-sm text-slate-300 cursor-pointer">
                  Análisis de Tendencias
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="crimes"
                  checked={options.includeCriminalTypes}
                  onCheckedChange={() => handleOptionChange("includeCriminalTypes")}
                  className="border-cyan-400"
                />
                <Label htmlFor="crimes" className="text-sm text-slate-300 cursor-pointer">
                  Tipos de Delitos
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="municipalities"
                  checked={options.includeCriticalMunicipalities}
                  onCheckedChange={() => handleOptionChange("includeCriticalMunicipalities")}
                  className="border-cyan-400"
                />
                <Label htmlFor="municipalities" className="text-sm text-slate-300 cursor-pointer">
                  Municipios Críticos
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="comparison"
                  checked={options.includeComparison}
                  onCheckedChange={() => handleOptionChange("includeComparison")}
                  className="border-cyan-400"
                />
                <Label htmlFor="comparison" className="text-sm text-slate-300 cursor-pointer">
                  Comparativa Mensual
                </Label>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-4">
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleDownloadReport}
            disabled={isLoading}
            className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-black font-semibold"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Descargar PDF
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
