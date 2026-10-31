/**
 * Página de Integración
 * Gestión de conexiones con sistemas externos (REST, SOAP, XML)
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  Plus,
  CheckCircle,
  XCircle,
  RefreshCw,
  Code2,
  Zap,
  FileJson,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function Integracion() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState("overview");
  const [formData, setFormData] = useState({
    name: "",
    type: "REST",
    endpoint: "",
    authMethod: "NONE",
  });

  // Queries
  const { data: registeredIntegrations } = trpc.integration.getRegistered.useQuery();

  // Mutations
  const registerMutation = trpc.integration.register.useMutation();
  const validateMutation = trpc.integration.validate.useMutation();

  /**
   * Registrar nueva integración
   */
  const handleRegister = async () => {
    if (!formData.name || !formData.endpoint) {
      toast.error("Complete los campos requeridos");
      return;
    }

    try {
      const result = await registerMutation.mutateAsync({
        name: formData.name,
        type: formData.type as any,
        endpoint: formData.endpoint,
        authMethod: formData.authMethod as any,
      });

      if (result.success) {
        toast.success(result.message);
        setFormData({ name: "", type: "REST", endpoint: "", authMethod: "NONE" });
        setIsOpen(false);
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error("Error registrando integración");
    }
  };

  /**
   * Validar integración
   */
  const handleValidate = async (integrationId: string) => {
    try {
      const result = await validateMutation.mutateAsync({ integrationId });

      if (result.isValid) {
        toast.success("Integración validada correctamente");
      } else {
        toast.error(`Validación fallida: ${result.errors.join(", ")}`);
      }
    } catch (error) {
      toast.error("Error validando integración");
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Módulo de Integración</h1>
          <p className="text-muted-foreground">
            Conecta PREDIX con sistemas externos (REST, SOAP, XML)
          </p>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="bg-cyan-500 hover:bg-cyan-600 text-black font-semibold">
              <Plus className="w-4 h-4 mr-2" />
              Nueva Integración
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-md bg-slate-900 border-cyan-500/30">
            <DialogHeader>
              <DialogTitle className="text-cyan-400">Registrar Integración</DialogTitle>
              <DialogDescription className="text-slate-300">
                Configura una nueva conexión con un sistema externo
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-slate-200">Nombre</Label>
                <Input
                  placeholder="Ej: Sistema de Denuncias"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-200">Tipo de Integración</Label>
                <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    <SelectItem value="REST">REST API</SelectItem>
                    <SelectItem value="SOAP">SOAP Web Service</SelectItem>
                    <SelectItem value="XML-RPC">XML-RPC</SelectItem>
                    <SelectItem value="WEBHOOK">Webhook</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-200">Endpoint/URL</Label>
                <Input
                  placeholder="https://api.ejemplo.gob.mx/v1"
                  value={formData.endpoint}
                  onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-200">Método de Autenticación</Label>
                <Select value={formData.authMethod} onValueChange={(value) => setFormData({ ...formData, authMethod: value })}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    <SelectItem value="NONE">Sin Autenticación</SelectItem>
                    <SelectItem value="BASIC">Basic Auth</SelectItem>
                    <SelectItem value="API_KEY">API Key</SelectItem>
                    <SelectItem value="OAUTH2">OAuth 2.0</SelectItem>
                    <SelectItem value="CERTIFICATE">Certificado</SelectItem>
                  </SelectContent>
                </Select>
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
                onClick={handleRegister}
                disabled={registerMutation.isPending}
                className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-black font-semibold"
              >
                {registerMutation.isPending ? "Registrando..." : "Registrar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4 bg-slate-800 border-slate-700">
          <TabsTrigger value="overview" className="data-[state=active]:bg-cyan-500">
            <Zap className="w-4 h-4 mr-2" />
            Resumen
          </TabsTrigger>
          <TabsTrigger value="integrations" className="data-[state=active]:bg-cyan-500">
            <Code2 className="w-4 h-4 mr-2" />
            Integraciones
          </TabsTrigger>
          <TabsTrigger value="converter" className="data-[state=active]:bg-cyan-500">
            <FileJson className="w-4 h-4 mr-2" />
            Convertidor
          </TabsTrigger>
          <TabsTrigger value="docs" className="data-[state=active]:bg-cyan-500">
            <AlertCircle className="w-4 h-4 mr-2" />
            Documentación
          </TabsTrigger>
        </TabsList>

        {/* Tab: Resumen */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-300">
                  Integraciones Activas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-cyan-400">
                  {registeredIntegrations?.data?.length || 0}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-300">
                  Tipos Soportados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-cyan-400">5</div>
                <p className="text-xs text-slate-400 mt-1">REST, SOAP, XML-RPC, SFTP, Webhook</p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-300">
                  Métodos Auth
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-cyan-400">6</div>
                <p className="text-xs text-slate-400 mt-1">Basic, OAuth2, API Key, Cert...</p>
              </CardContent>
            </Card>
          </div>

          <Alert className="border-cyan-500/30 bg-cyan-500/10">
            <Zap className="h-4 w-4 text-cyan-400" />
            <AlertDescription className="text-slate-300">
              El módulo de integración permite conectar PREDIX con sistemas gubernamentales
              usando estándares como REST, SOAP y XML, con soporte para múltiples métodos de
              autenticación.
            </AlertDescription>
          </Alert>
        </TabsContent>

        {/* Tab: Integraciones */}
        <TabsContent value="integrations" className="space-y-4">
          {registeredIntegrations?.data && registeredIntegrations.data.length > 0 ? (
            <div className="space-y-3">
              {registeredIntegrations.data.map((integrationId) => (
                <Card key={integrationId} className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-slate-200">{integrationId}</CardTitle>
                        <CardDescription className="text-slate-400">
                          Integración registrada
                        </CardDescription>
                      </div>
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Activa
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleValidate(integrationId)}
                        className="border-slate-600 text-slate-300 hover:bg-slate-800"
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Validar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-slate-600 text-slate-300 hover:bg-slate-800"
                      >
                        <Code2 className="w-3 h-3 mr-1" />
                        Probar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-card border-border">
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                  <p className="text-slate-400">No hay integraciones registradas</p>
                  <Button
                    onClick={() => setIsOpen(true)}
                    className="mt-4 bg-cyan-500 hover:bg-cyan-600 text-black"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Crear Primera Integración
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Convertidor */}
        <TabsContent value="converter" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-slate-200">Convertidor XML ↔ JSON</CardTitle>
              <CardDescription className="text-slate-400">
                Convierte entre formatos XML y JSON
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-slate-800 p-4 rounded border border-slate-700">
                <p className="text-slate-300 text-sm">
                  Funcionalidad de conversión disponible a través de las APIs tRPC:
                </p>
                <ul className="mt-3 space-y-2 text-xs text-slate-400">
                  <li>
                    <code className="bg-slate-900 px-2 py-1 rounded">
                      trpc.integration.jsonToXml
                    </code>
                  </li>
                  <li>
                    <code className="bg-slate-900 px-2 py-1 rounded">
                      trpc.integration.xmlToJson
                    </code>
                  </li>
                  <li>
                    <code className="bg-slate-900 px-2 py-1 rounded">
                      trpc.integration.formatXml
                    </code>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Documentación */}
        <TabsContent value="docs" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-slate-200">Documentación Técnica</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-slate-200 mb-2">Tipos de Integración</h3>
                <ul className="space-y-2 text-sm text-slate-400">
                  <li>
                    <strong className="text-slate-300">REST:</strong> APIs HTTP/HTTPS con JSON
                  </li>
                  <li>
                    <strong className="text-slate-300">SOAP:</strong> Web Services con XML
                  </li>
                  <li>
                    <strong className="text-slate-300">XML-RPC:</strong> Llamadas RPC basadas en XML
                  </li>
                  <li>
                    <strong className="text-slate-300">SFTP:</strong> Transferencia de archivos
                  </li>
                  <li>
                    <strong className="text-slate-300">Webhook:</strong> Notificaciones push
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-slate-200 mb-2">Métodos de Autenticación</h3>
                <ul className="space-y-2 text-sm text-slate-400">
                  <li>
                    <strong className="text-slate-300">NONE:</strong> Sin autenticación
                  </li>
                  <li>
                    <strong className="text-slate-300">BASIC:</strong> Usuario y contraseña
                  </li>
                  <li>
                    <strong className="text-slate-300">API_KEY:</strong> Clave de API
                  </li>
                  <li>
                    <strong className="text-slate-300">OAUTH2:</strong> OAuth 2.0
                  </li>
                  <li>
                    <strong className="text-slate-300">CERTIFICATE:</strong> Certificados X.509
                  </li>
                  <li>
                    <strong className="text-slate-300">LDAP:</strong> Directorio LDAP
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
