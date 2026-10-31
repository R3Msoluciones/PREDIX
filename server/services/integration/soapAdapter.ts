/**
 * Adaptador SOAP para integraciones con sistemas gubernamentales
 * Soporta SOAP 1.1 y 1.2, autenticación WS-Security
 */

import { SoapConfig, IntegrationRequest, IntegrationResponse } from "./types";
import { logger } from "../../_core/logger";

export class SoapAdapter {
  private config: SoapConfig;
  private wsdlCache: any = null;

  constructor(config: SoapConfig) {
    this.config = config;
  }

  /**
   * Generar envelope SOAP
   */
  private generateSoapEnvelope(operationName: string, parameters: any): string {
    const soapVersion = this.config.soapVersion || "1.1";
    const xmlns =
      soapVersion === "1.1"
        ? "http://schemas.xmlsoap.org/soap/envelope/"
        : "http://www.w3.org/2003/05/soap-envelope";

    const paramXml = this.objectToXml(parameters);

    return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="${xmlns}" xmlns:tns="http://www.gob.mx/servicios">
  <soap:Header>
    ${this.generateSecurityHeader()}
  </soap:Header>
  <soap:Body>
    <tns:${operationName}>
      ${paramXml}
    </tns:${operationName}>
  </soap:Body>
</soap:Envelope>`;
  }

  /**
   * Generar header de seguridad WS-Security
   */
  private generateSecurityHeader(): string {
    const auth = this.config.authConfig;

    if (this.config.authMethod === "NONE") {
      return "";
    }

    if (this.config.authMethod === "BASIC" && auth.username && auth.password) {
      const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString("base64");

      return `<wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
        <wsse:UsernameToken>
          <wsse:Username>${auth.username}</wsse:Username>
          <wsse:Password>${auth.password}</wsse:Password>
        </wsse:UsernameToken>
      </wsse:Security>`;
    }

    return "";
  }

  /**
   * Convertir objeto a XML
   */
  private objectToXml(obj: any, rootName: string = "data"): string {
    if (typeof obj !== "object" || obj === null) {
      return `<${rootName}>${obj}</${rootName}>`;
    }

    let xml = `<${rootName}>`;

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "object" && value !== null) {
        xml += this.objectToXml(value, key);
      } else {
        xml += `<${key}>${this.escapeXml(String(value))}</${key}>`;
      }
    }

    xml += `</${rootName}>`;
    return xml;
  }

  /**
   * Escapar caracteres especiales en XML
   */
  private escapeXml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  /**
   * Parsear respuesta SOAP
   */
  private parseSoapResponse(xmlResponse: string): any {
    try {
      // Extraer contenido del Body
      const bodyMatch = xmlResponse.match(/<soap:Body>([\s\S]*?)<\/soap:Body>/);
      if (!bodyMatch) {
        return null;
      }

      const bodyContent = bodyMatch[1];

      // Convertir XML a objeto JSON
      return this.xmlToObject(bodyContent);
    } catch (error) {
      logger.error("Error parseando respuesta SOAP:", error);
      return null;
    }
  }

  /**
   * Convertir XML a objeto
   */
  private xmlToObject(xml: string): any {
    const result: any = {};

    // Expresión regular para extraer elementos
    const elementRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
    let match;

    while ((match = elementRegex.exec(xml)) !== null) {
      const [, tagName, content] = match;

      if (content.includes("<")) {
        // Elemento anidado
        result[tagName] = this.xmlToObject(content);
      } else {
        // Elemento simple
        result[tagName] = content;
      }
    }

    return result;
  }

  /**
   * Ejecutar operación SOAP
   */
  async execute(request: IntegrationRequest): Promise<IntegrationResponse> {
    const startTime = Date.now();

    try {
      const soapBody = this.generateSoapEnvelope(
        this.config.operationName,
        request.data || {}
      );

      // Simular llamada SOAP (en producción usar librería soap)
      const response = await this.callSoapService(soapBody);

      const parsedData = this.parseSoapResponse(response);

      return {
        success: true,
        statusCode: 200,
        data: parsedData,
        rawResponse: response,
        transformedData: parsedData,
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        error: String(error),
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Llamar servicio SOAP
   */
  private async callSoapService(soapBody: string): Promise<string> {
    // En producción, usar librería 'soap' de npm
    // const client = await soap.createClientAsync(this.config.wsdlUrl);
    // return await client[this.config.serviceName][this.config.operationName](...);

    // Simulación para demostración
    return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <response>
      <status>success</status>
      <message>Operación completada</message>
    </response>
  </soap:Body>
</soap:Envelope>`;
  }

  /**
   * Validar configuración SOAP
   */
  async validate(): Promise<boolean> {
    try {
      // Validar que WSDL es accesible
      if (!this.config.wsdlUrl) {
        return false;
      }

      // En producción, intentar conectar al WSDL
      // const client = await soap.createClientAsync(this.config.wsdlUrl);
      // return !!client;

      return true;
    } catch (error) {
      logger.error("Error validando SOAP:", error);
      return false;
    }
  }

  /**
   * Obtener operaciones disponibles del WSDL
   */
  async getOperations(): Promise<string[]> {
    // En producción, parsear WSDL y retornar operaciones disponibles
    return [this.config.operationName];
  }
}
