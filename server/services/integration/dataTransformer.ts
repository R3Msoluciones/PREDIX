/**
 * Servicio de transformación XML ↔ JSON
 * Maneja conversión de datos entre formatos
 */

import { TransformationRule, DataTypeMapping } from "./types";
import { logger } from "../../_core/logger";

export class DataTransformer {
  /**
   * Mapeos de tipos de datos
   */
  private static readonly TYPE_MAPPINGS: Record<string, DataTypeMapping> = {
    string: {
      xmlType: "xs:string",
      jsonType: "string",
      converter: (v) => String(v),
      reverseConverter: (v) => String(v),
    },
    integer: {
      xmlType: "xs:integer",
      jsonType: "number",
      converter: (v) => parseInt(v, 10),
      reverseConverter: (v) => String(v),
    },
    boolean: {
      xmlType: "xs:boolean",
      jsonType: "boolean",
      converter: (v) => v === "true" || v === "1",
      reverseConverter: (v) => (v ? "true" : "false"),
    },
    date: {
      xmlType: "xs:date",
      jsonType: "string",
      converter: (v) => new Date(v).toISOString().split("T")[0],
      reverseConverter: (v) => new Date(v).toISOString(),
    },
    datetime: {
      xmlType: "xs:dateTime",
      jsonType: "string",
      converter: (v) => new Date(v).toISOString(),
      reverseConverter: (v) => new Date(v).toISOString(),
    },
  };

  /**
   * Convertir JSON a XML
   */
  static jsonToXml(data: any, rootName: string = "root"): string {
    const xmlDeclaration = '<?xml version="1.0" encoding="UTF-8"?>';
    const content = this.objectToXmlElement(data, rootName);
    return xmlDeclaration + "\n" + content;
  }

  /**
   * Convertir objeto a elemento XML
   */
  private static objectToXmlElement(obj: any, elementName: string): string {
    if (obj === null || obj === undefined) {
      return `<${elementName}/>`;
    }

    if (typeof obj !== "object") {
      return `<${elementName}>${this.escapeXml(String(obj))}</${elementName}>`;
    }

    if (Array.isArray(obj)) {
      return obj
        .map((item) => this.objectToXmlElement(item, elementName))
        .join("\n");
    }

    let xml = `<${elementName}>`;

    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = this.sanitizeXmlTag(key);
      xml += "\n  " + this.objectToXmlElement(value, sanitizedKey);
    }

    xml += `\n</${elementName}>`;
    return xml;
  }

  /**
   * Convertir XML a JSON
   */
  static xmlToJson(xmlString: string): any {
    try {
      // Remover declaración XML
      xmlString = xmlString.replace(/<\?xml[^?]*\?>/, "");

      // Extraer raíz
      const rootMatch = xmlString.match(/<(\w+)[^>]*>([\s\S]*)<\/\1>/);
      if (!rootMatch) {
        return null;
      }

      const [, rootName, content] = rootMatch;
      return {
        [rootName]: this.parseXmlContent(content),
      };
    } catch (error) {
      logger.error("Error parseando XML:", error);
      return null;
    }
  }

  /**
   * Parsear contenido XML
   */
  private static parseXmlContent(content: string): any {
    const result: any = {};
    const elementRegex = /<(\w+)(?:\s[^>]*)?>([^<]*(?:<[^/][^>]*>[^<]*)*)<\/\1>/g;

    let match;
    while ((match = elementRegex.exec(content)) !== null) {
      const [, tagName, tagContent] = match;

      const value = tagContent.includes("<")
        ? this.parseXmlContent(tagContent)
        : this.unescapeXml(tagContent);

      if (result[tagName]) {
        // Convertir a array si ya existe
        if (!Array.isArray(result[tagName])) {
          result[tagName] = [result[tagName]];
        }
        result[tagName].push(value);
      } else {
        result[tagName] = value;
      }
    }

    return Object.keys(result).length > 0 ? result : null;
  }

  /**
   * Aplicar reglas de transformación
   */
  static applyTransformations(data: any, rules: TransformationRule[]): any {
    const result = JSON.parse(JSON.stringify(data));

    for (const rule of rules) {
      const sourceValue = this.getNestedValue(result, rule.sourceField);

      if (sourceValue === undefined) {
        continue;
      }

      let transformedValue = sourceValue;

      switch (rule.transformation) {
        case "DIRECT":
          transformedValue = sourceValue;
          break;

        case "MAP":
          if (rule.mappingTable && rule.mappingTable[sourceValue]) {
            transformedValue = rule.mappingTable[sourceValue];
          }
          break;

        case "FUNCTION":
          if (rule.functionCode) {
            try {
              const func = new Function("value", rule.functionCode);
              transformedValue = func(sourceValue);
            } catch (error) {
              logger.error("Error ejecutando función de transformación:", error);
            }
          }
          break;

        case "REGEX":
          if (rule.regexPattern && rule.regexReplacement) {
            const regex = new RegExp(rule.regexPattern, "g");
            transformedValue = String(sourceValue).replace(
              regex,
              rule.regexReplacement
            );
          }
          break;
      }

      this.setNestedValue(result, rule.targetField, transformedValue);
    }

    return result;
  }

  /**
   * Obtener valor anidado
   */
  private static getNestedValue(obj: any, path: string): any {
    const keys = path.split(".");
    let value = obj;

    for (const key of keys) {
      if (value && typeof value === "object") {
        value = value[key];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Establecer valor anidado
   */
  private static setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split(".");
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!current[key]) {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * Escapar caracteres XML
   */
  private static escapeXml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  /**
   * Desescapar caracteres XML
   */
  private static unescapeXml(str: string): string {
    return str
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  }

  /**
   * Sanitizar nombre de etiqueta XML
   */
  private static sanitizeXmlTag(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .replace(/^[0-9]/, "_$&");
  }

  /**
   * Validar XML
   */
  static isValidXml(xmlString: string): boolean {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlString, "application/xml");
      return !doc.getElementsByTagName("parsererror").length;
    } catch {
      return false;
    }
  }

  /**
   * Validar JSON
   */
  static isValidJson(jsonString: string): boolean {
    try {
      JSON.parse(jsonString);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Formatear XML
   */
  static formatXml(xmlString: string, indent: number = 2): string {
    let formatted = "";
    let indentLevel = 0;
    const indentStr = " ".repeat(indent);

    const regex = /(<[^>]+>)|([^<>]+)/g;
    let match;

    while ((match = regex.exec(xmlString)) !== null) {
      const [full, tag, text] = match;

      if (tag) {
        if (tag.startsWith("</")) {
          indentLevel--;
          formatted += "\n" + indentStr.repeat(indentLevel) + tag;
        } else if (tag.endsWith("/>")) {
          formatted += "\n" + indentStr.repeat(indentLevel) + tag;
        } else {
          formatted += "\n" + indentStr.repeat(indentLevel) + tag;
          if (!tag.startsWith("<?")) {
            indentLevel++;
          }
        }
      } else if (text && text.trim()) {
        formatted += text.trim();
      }
    }

    return formatted.trim();
  }
}
