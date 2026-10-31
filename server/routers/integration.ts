/**
 * Router tRPC para gestión de integraciones
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/infra/trpc";
import { integrationManager } from "../services/integration/integrationManager";
import {
  IntegrationConfig,
  RestConfig,
  SoapConfig,
  IntegrationRequest,
} from "../services/integration/types";

export const integrationRouter = router({
  /**
   * Registrar nueva integración
   */
  register: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().max(1000).optional(),
        type: z.enum(["REST", "SOAP", "XML-RPC", "SFTP", "WEBHOOK"]),
        endpoint: z.string().url().max(2048),
        authMethod: z.enum(["NONE", "BASIC", "OAUTH2", "API_KEY", "CERTIFICATE", "LDAP"]),
        authConfig: z.record(z.string(), z.unknown()).optional(),
        dataFormat: z.enum(["JSON", "XML", "CSV", "BINARY"]).default("JSON"),
        timeout: z.number().int().positive().max(300000).optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const config: IntegrationConfig = {
          id: `integration_${Date.now()}`,
          name: input.name,
          description: input.description,
          type: input.type as any,
          endpoint: input.endpoint,
          authMethod: input.authMethod as any,
          authConfig: input.authConfig || {},
          dataFormat: input.dataFormat as any,
          timeout: input.timeout,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        integrationManager.registerIntegration(config as any);

        return {
          success: true,
          integrationId: config.id,
          message: `Integración '${input.name}' registrada exitosamente`,
        };
      } catch (error) {
        return {
          success: false,
          error: String(error),
        };
      }
    }),

  /**
   * Ejecutar solicitud de integración
   */
  execute: protectedProcedure
    .input(
      z.object({
        integrationId: z.string(),
        method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]),
        path: z.string().optional(),
        data: z.any().optional(),
        headers: z.any().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const request: IntegrationRequest = {
          integrationId: input.integrationId,
          method: input.method,
          path: input.path,
          data: input.data as any,
          headers: input.headers as Record<string, string> | undefined,
        };

        const response = await integrationManager.execute(request);

        return {
          success: response.success,
          statusCode: response.statusCode,
          data: response.transformedData || response.data,
          error: response.error,
          executionTimeMs: response.executionTimeMs,
        };
      } catch (error) {
        return {
          success: false,
          error: String(error),
        };
      }
    }),

  /**
   * Validar integración
   */
  validate: protectedProcedure
    .input(z.object({ integrationId: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const result = await integrationManager.validate(input.integrationId);

        return {
          isValid: result.isValid,
          errors: result.errors,
          warnings: result.warnings,
          testPassed: result.testResult?.success || false,
        };
      } catch (error) {
        return {
          isValid: false,
          errors: [String(error)],
          warnings: [],
        };
      }
    }),

  /**
   * Obtener estadísticas de integración
   */
  getStats: protectedProcedure
    .input(z.object({ integrationId: z.string() }))
    .query(({ input }) => {
      const stats = integrationManager.getStats(input.integrationId);

      if (!stats) {
        return {
          success: false,
          error: "Integración no encontrada",
        };
      }

      return {
        success: true,
        data: {
          totalRequests: stats.totalRequests,
          successfulRequests: stats.successfulRequests,
          failedRequests: stats.failedRequests,
          successRate: stats.successRate.toFixed(2),
          averageResponseTimeMs: stats.averageResponseTimeMs.toFixed(2),
          lastRequestAt: stats.lastRequestAt,
        },
      };
    }),

  /**
   * Obtener logs de integración
   */
  getLogs: protectedProcedure
    .input(
      z.object({
        integrationId: z.string().optional(),
        limit: z.number().default(50),
      })
    )
    .query(({ input }) => {
      const logs = integrationManager.getLogs(input.integrationId, input.limit);

      return {
        success: true,
        data: logs.map((log) => ({
          id: log.id,
          integrationId: log.integrationId,
          status: log.status,
          statusCode: log.response.statusCode,
          executionTimeMs: log.response.executionTimeMs,
          error: log.errorMessage,
          createdAt: log.createdAt,
        })),
      };
    }),

  /**
   * Convertir JSON a XML
   */
  jsonToXml: protectedProcedure
    .input(
      z.object({
        data: z.any(),
        rootName: z.string().default("root"),
      })
    )
    .query(({ input }) => {
      try {
        const xml = integrationManager.jsonToXml(input.data as any, input.rootName);

        return {
          success: true,
          xml,
        };
      } catch (error) {
        return {
          success: false,
          error: String(error),
        };
      }
    }),

  /**
   * Convertir XML a JSON
   */
  xmlToJson: protectedProcedure
    .input(z.object({ xml: z.string() }))
    .query(({ input }) => {
      try {
        const json = integrationManager.xmlToJson(input.xml) as any;

        return {
          success: true,
          json,
        };
      } catch (error) {
        return {
          success: false,
          error: String(error),
        };
      }
    }),

  /**
   * Formatear XML
   */
  formatXml: protectedProcedure
    .input(
      z.object({
        xml: z.string(),
        indent: z.number().default(2),
      })
    )
    .query(({ input }) => {
      try {
        const formatted = integrationManager.formatXml(input.xml, input.indent);

        return {
          success: true,
          xml: formatted,
        };
      } catch (error) {
        return {
          success: false,
          error: String(error),
        };
      }
    }),

  /**
   * Obtener integraciones registradas
   */
  getRegistered: protectedProcedure.query(() => {
    const integrations = integrationManager.getRegisteredIntegrations();

    return {
      success: true,
      data: integrations,
      count: integrations.length,
    };
  }),

  /**
   * Desregistrar integración
   */
  unregister: protectedProcedure
    .input(z.object({ integrationId: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const success = integrationManager.unregisterIntegration(input.integrationId);

        return {
          success,
          message: success
            ? "Integración desregistrada"
            : "Integración no encontrada",
        };
      } catch (error) {
        return {
          success: false,
          error: String(error),
        };
      }
    }),
});
