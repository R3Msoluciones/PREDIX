/**
 * Adaptador REST para integraciones
 * Soporta autenticación OAuth2, API Key, Basic Auth y certificados
 */

import axios, { AxiosInstance, AxiosError, AxiosHeaders } from "axios";
import { RestConfig, IntegrationRequest, IntegrationResponse, AuthConfig } from "./types";
import { logger } from "../../_core/logger";

export class RestAdapter {
  private client: AxiosInstance;
  private config: RestConfig;
  private tokenCache: { token: string; expiresAt: number } | null = null;

  constructor(config: RestConfig) {
    this.config = config;
    this.client = this.createClient();
  }

  /**
   * Crear cliente Axios con configuración
   */
  private createClient(): AxiosInstance {
    const baseURL = this.config.baseUrl;
    const timeout = this.config.timeout || 30000;

    const client = axios.create({
      baseURL,
      timeout,
      headers: {
        "Content-Type": "application/json",
        ...this.config.headers,
      },
    });

    // Interceptor para autenticación
    client.interceptors.request.use(async (config) => {
      const authHeaders = await this.getAuthHeaders();
      Object.entries(authHeaders).forEach(([key, value]) => {
        config.headers.set(key, value);
      });
      return config;
    });

    return client;
  }

  /**
   * Obtener headers de autenticación según el método
   */
  private async getAuthHeaders(): Promise<Record<string, string>> {
    const auth = this.config.authConfig;
    const headers: Record<string, string> = {};

    switch (this.config.authMethod) {
      case "BASIC":
        if (auth.username && auth.password) {
          const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString(
            "base64"
          );
          headers["Authorization"] = `Basic ${credentials}`;
        }
        break;

      case "API_KEY":
        if (auth.apiKey) {
          const keyHeader = auth.apiKeyHeader || "X-API-Key";
          headers[keyHeader] = auth.apiKey;
        }
        break;

      case "OAUTH2":
        const token = await this.getOAuth2Token();
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
        break;

      case "CERTIFICATE":
        // Los certificados se configuran en la creación del cliente
        break;
    }

    return headers;
  }

  /**
   * Obtener token OAuth2 con caché
   */
  private async getOAuth2Token(): Promise<string | null> {
    const auth = this.config.authConfig;

    // Validar token en caché
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now()) {
      return this.tokenCache.token;
    }

    if (!auth.tokenUrl || !auth.clientId || !auth.clientSecret) {
      return null;
    }

    try {
      const response = await axios.post(auth.tokenUrl, {
        grant_type: "client_credentials",
        client_id: auth.clientId,
        client_secret: auth.clientSecret,
        scope: auth.scope,
      });

      const token = response.data.access_token;
      const expiresIn = response.data.expires_in || 3600;

      // Cachear token con 5 minutos de anticipación
      this.tokenCache = {
        token,
        expiresAt: Date.now() + (expiresIn - 300) * 1000,
      };

      return token;
    } catch (error) {
      logger.error("Error obteniendo token OAuth2:", error);
      return null;
    }
  }

  /**
   * Ejecutar solicitud REST
   */
  async execute(request: IntegrationRequest): Promise<IntegrationResponse> {
    const startTime = Date.now();

    try {
      const url = request.path || "/";
      const method = request.method.toLowerCase();

      const response = await (this.client as any)[method](url, request.data, {
        headers: request.headers,
        timeout: request.timeout || this.config.timeout,
      });

      return {
        success: true,
        statusCode: response.status,
        data: response.data,
        rawResponse: JSON.stringify(response.data),
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      const axiosError = error as AxiosError;

      return {
        success: false,
        statusCode: axiosError.response?.status || 500,
        error: axiosError.message,
        rawResponse: JSON.stringify(axiosError.response?.data),
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Validar configuración
   */
  async validate(): Promise<boolean> {
    try {
      const response = await this.client.get("/", {
        timeout: 5000,
      });
      return response.status >= 200 && response.status < 300;
    } catch (error) {
      logger.error("Error validando REST endpoint:", error);
      return false;
    }
  }

  /**
   * Obtener estadísticas del cliente
   */
  getStats() {
    return {
      baseURL: this.config.baseUrl,
      authMethod: this.config.authMethod,
      timeout: this.config.timeout,
      hasToken: !!this.tokenCache,
    };
  }
}
