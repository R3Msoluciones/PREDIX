/**
 * Gestor principal de integraciones
 * Coordina adaptadores, transformaciones y validaciones
 */

import {
  IntegrationConfig,
  IntegrationRequest,
  IntegrationResponse,
  IntegrationLog,
  ValidationResult,
  IntegrationStats,
  RestConfig,
  SoapConfig,
} from "./types";
import { RestAdapter } from "./restAdapter";
import { SoapAdapter } from "./soapAdapter";
import { DataTransformer } from "./dataTransformer";

export class IntegrationManager {
  private adapters: Map<string, RestAdapter | SoapAdapter> = new Map();
  private logs: IntegrationLog[] = [];
  private stats: Map<string, IntegrationStats> = new Map();

  /**
   * Registrar integración
   */
  registerIntegration(config: IntegrationConfig): void {
    let adapter: RestAdapter | SoapAdapter;

    if (config.type === "REST") {
      adapter = new RestAdapter(config as RestConfig);
    } else if (config.type === "SOAP") {
      adapter = new SoapAdapter(config as SoapConfig);
    } else {
      throw new Error(`Tipo de integración no soportado: ${config.type}`);
    }

    this.adapters.set(config.id, adapter);

    // Inicializar estadísticas
    this.stats.set(config.id, {
      integrationId: config.id,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTimeMs: 0,
      successRate: 0,
    });
  }

  /**
   * Ejecutar solicitud de integración
   */
  async execute(request: IntegrationRequest): Promise<IntegrationResponse> {
    const adapter = this.adapters.get(request.integrationId);

    if (!adapter) {
      throw new Error(`Integración no encontrada: ${request.integrationId}`);
    }

    try {
      // Ejecutar solicitud
      let response = await (adapter as any).execute(request);

      // Aplicar transformaciones si existen
      const config = this.getConfig(request.integrationId);
      if (config?.transformationRules && response.data) {
        response.transformedData = DataTransformer.applyTransformations(
          response.data,
          config.transformationRules
        );
      }

      // Registrar log
      this.logRequest(request, response);

      // Actualizar estadísticas
      this.updateStats(request.integrationId, response);

      return response;
    } catch (error) {
      const errorResponse: IntegrationResponse = {
        success: false,
        statusCode: 500,
        error: String(error),
        executionTimeMs: 0,
        timestamp: new Date(),
      };

      this.logRequest(request, errorResponse);
      this.updateStats(request.integrationId, errorResponse);

      return errorResponse;
    }
  }

  /**
   * Validar integración
   */
  async validate(integrationId: string): Promise<ValidationResult> {
    const adapter = this.adapters.get(integrationId);

    if (!adapter) {
      return {
        isValid: false,
        errors: [`Integración no encontrada: ${integrationId}`],
        warnings: [],
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validar conectividad
      const isValid = await (adapter as any).validate();

      if (!isValid) {
        errors.push("No se pudo conectar al endpoint");
      }

      // Realizar test request
      const testRequest: IntegrationRequest = {
        integrationId,
        method: "GET",
      };

      const testResult = await this.execute(testRequest);

      if (!testResult.success) {
        errors.push(`Test fallido: ${testResult.error}`);
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        testResult,
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [String(error)],
        warnings: [],
      };
    }
  }

  /**
   * Obtener estadísticas
   */
  getStats(integrationId: string): IntegrationStats | null {
    return this.stats.get(integrationId) || null;
  }

  /**
   * Obtener logs
   */
  getLogs(integrationId?: string, limit: number = 100): IntegrationLog[] {
    let logs = this.logs;

    if (integrationId) {
      logs = logs.filter((log) => log.integrationId === integrationId);
    }

    return logs.slice(-limit);
  }

  /**
   * Limpiar logs antiguos
   */
  clearOldLogs(daysOld: number = 30): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const initialLength = this.logs.length;
    this.logs = this.logs.filter((log) => log.createdAt > cutoffDate);

    return initialLength - this.logs.length;
  }

  /**
   * Registrar solicitud
   */
  private logRequest(request: IntegrationRequest, response: IntegrationResponse): void {
    const log: IntegrationLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      integrationId: request.integrationId,
      request,
      response,
      status: response.success ? "SUCCESS" : "FAILURE",
      errorMessage: response.error,
      createdAt: new Date(),
    };

    this.logs.push(log);

    // Mantener máximo 10000 logs en memoria
    if (this.logs.length > 10000) {
      this.logs = this.logs.slice(-5000);
    }
  }

  /**
   * Actualizar estadísticas
   */
  private updateStats(integrationId: string, response: IntegrationResponse): void {
    const stats = this.stats.get(integrationId);

    if (!stats) {
      return;
    }

    stats.totalRequests++;
    stats.lastRequestAt = new Date();

    if (response.success) {
      stats.successfulRequests++;
    } else {
      stats.failedRequests++;
    }

    // Calcular promedio de tiempo
    stats.averageResponseTimeMs =
      (stats.averageResponseTimeMs * (stats.totalRequests - 1) +
        response.executionTimeMs) /
      stats.totalRequests;

    stats.successRate = (stats.successfulRequests / stats.totalRequests) * 100;
  }

  /**
   * Obtener configuración de integración
   */
  private getConfig(integrationId: string): IntegrationConfig | null {
    // En producción, obtener de base de datos
    return null;
  }

  /**
   * Convertir JSON a XML
   */
  jsonToXml(data: any, rootName?: string): string {
    return DataTransformer.jsonToXml(data, rootName);
  }

  /**
   * Convertir XML a JSON
   */
  xmlToJson(xmlString: string): any {
    return DataTransformer.xmlToJson(xmlString);
  }

  /**
   * Formatear XML
   */
  formatXml(xmlString: string, indent?: number): string {
    return DataTransformer.formatXml(xmlString, indent);
  }

  /**
   * Desregistrar integración
   */
  unregisterIntegration(integrationId: string): boolean {
    return this.adapters.delete(integrationId);
  }

  /**
   * Obtener todas las integraciones registradas
   */
  getRegisteredIntegrations(): string[] {
    return Array.from(this.adapters.keys());
  }
}

// Exportar instancia singleton
export const integrationManager = new IntegrationManager();
