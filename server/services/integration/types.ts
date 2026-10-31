/**
 * Tipos y interfaces para el módulo de integración
 * Soporta SOAP, REST, XML y estándares gubernamentales
 */

/**
 * Tipos de integración soportados
 */
export type IntegrationType = "REST" | "SOAP" | "XML-RPC" | "SFTP" | "WEBHOOK";

/**
 * Métodos de autenticación
 */
export type AuthMethod = "NONE" | "BASIC" | "OAUTH2" | "API_KEY" | "CERTIFICATE" | "LDAP";

/**
 * Formato de datos
 */
export type DataFormat = "JSON" | "XML" | "CSV" | "BINARY";

/**
 * Configuración de integración
 */
export interface IntegrationConfig {
  id: string;
  name: string;
  description?: string;
  type: IntegrationType;
  endpoint: string;
  authMethod: AuthMethod;
  authConfig: AuthConfig;
  dataFormat: DataFormat;
  transformationRules?: TransformationRule[];
  headers?: Record<string, string>;
  timeout?: number; // en milisegundos
  retryPolicy?: RetryPolicy;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Configuración de autenticación
 */
export interface AuthConfig {
  // BASIC
  username?: string;
  password?: string;

  // OAUTH2
  clientId?: string;
  clientSecret?: string;
  tokenUrl?: string;
  scope?: string;

  // API_KEY
  apiKey?: string;
  apiKeyHeader?: string;

  // CERTIFICATE
  certificatePath?: string;
  keyPath?: string;
  caPath?: string;

  // LDAP
  ldapServer?: string;
  ldapPort?: number;
  ldapBaseDN?: string;
}

/**
 * Regla de transformación de datos
 */
export interface TransformationRule {
  id: string;
  name: string;
  sourceField: string;
  targetField: string;
  transformation: "DIRECT" | "MAP" | "FUNCTION" | "REGEX";
  mappingTable?: Record<string, string>;
  functionCode?: string; // JavaScript function body
  regexPattern?: string;
  regexReplacement?: string;
}

/**
 * Política de reintentos
 */
export interface RetryPolicy {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * Solicitud de integración
 */
export interface IntegrationRequest {
  integrationId: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path?: string;
  data?: any;
  headers?: Record<string, string>;
  timeout?: number;
}

/**
 * Respuesta de integración
 */
export interface IntegrationResponse {
  success: boolean;
  statusCode: number;
  data?: any;
  error?: string;
  rawResponse?: string;
  transformedData?: any;
  executionTimeMs: number;
  timestamp: Date;
}

/**
 * Log de integración
 */
export interface IntegrationLog {
  id: string;
  integrationId: string;
  request: IntegrationRequest;
  response: IntegrationResponse;
  status: "SUCCESS" | "FAILURE" | "RETRY" | "TIMEOUT";
  errorMessage?: string;
  createdAt: Date;
}

/**
 * Configuración SOAP
 */
export interface SoapConfig extends IntegrationConfig {
  type: "SOAP";
  wsdlUrl: string;
  serviceName: string;
  portName: string;
  operationName: string;
  soapVersion: "1.1" | "1.2";
}

/**
 * Configuración REST
 */
export interface RestConfig extends IntegrationConfig {
  type: "REST";
  baseUrl: string;
  apiVersion?: string;
  rateLimit?: {
    requestsPerMinute: number;
    burstSize: number;
  };
}

/**
 * Configuración XML-RPC
 */
export interface XmlRpcConfig extends IntegrationConfig {
  type: "XML-RPC";
  methodName: string;
  parameters?: Record<string, any>;
}

/**
 * Configuración SFTP
 */
export interface SftpConfig extends IntegrationConfig {
  type: "SFTP";
  host: string;
  port: number;
  username: string;
  privateKeyPath?: string;
  remotePath: string;
  filePattern?: string;
}

/**
 * Configuración Webhook
 */
export interface WebhookConfig extends IntegrationConfig {
  type: "WEBHOOK";
  webhookUrl: string;
  events: string[];
  retryOnFailure: boolean;
  maxRetries: number;
}

/**
 * Resultado de validación de integración
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  testResult?: IntegrationResponse;
}

/**
 * Estadísticas de integración
 */
export interface IntegrationStats {
  integrationId: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTimeMs: number;
  lastRequestAt?: Date;
  successRate: number;
}

/**
 * Mapeo de tipos de datos (XML ↔ JSON)
 */
export interface DataTypeMapping {
  xmlType: string;
  jsonType: string;
  converter: (value: any) => any;
  reverseConverter: (value: any) => any;
}

/**
 * Esquema de validación
 */
export interface ValidationSchema {
  type: "JSON_SCHEMA" | "XML_SCHEMA" | "CUSTOM";
  schema: any;
  strict: boolean;
}
