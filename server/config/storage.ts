// Almacenamiento local de adjuntos — reemplaza el proxy de storage del
// scaffold "Manus" (BUILT_IN_FORGE_API_URL/KEY), retirado del proyecto.
// Requisito legal del cliente: los datos deben residir en servidores
// físicos propios (On-Premise), nunca en cloud de terceros.

import { promises as fs } from "fs";
import path from "path";
import { ENV } from "../_core/infra/env";

function resolveUploadsDir(): string {
  return path.resolve(ENV.uploadsDir);
}

/**
 * Resuelve relKey dentro de UPLOADS_DIR y lanza si el resultado escapa del
 * directorio (ej. relKey con "../../"). fileName/incidentId vienen de input
 * de usuario — sin este chequeo, un ".." bien puesto permite escribir, leer
 * o borrar cualquier archivo del sistema (path traversal).
 *
 * Rechaza rutas absolutas explícitamente ANTES de resolver: path.resolve(base, x)
 * descarta `base` por completo si `x` ya es absoluto — en Windows eso incluye
 * letras de unidad ("C:\...") y rutas UNC ("\\server\share"), que un simple
 * `replace(/^\/+/, "")` (solo quita "/" al inicio) no detecta ni neutraliza.
 */
function containPath(relKey: string): string {
  if (path.win32.isAbsolute(relKey) || path.posix.isAbsolute(relKey)) {
    throw new Error(`Invalid path: "${relKey}" must be relative`);
  }
  const uploadsDir = resolveUploadsDir();
  const resolved = path.resolve(uploadsDir, relKey);
  const boundary = uploadsDir.endsWith(path.sep) ? uploadsDir : uploadsDir + path.sep;
  if (resolved !== uploadsDir && !resolved.startsWith(boundary)) {
    throw new Error(`Invalid path: "${relKey}" escapes the uploads directory`);
  }
  return resolved;
}

export function resolveAttachmentPath(relKey: string): string {
  return containPath(relKey);
}

export async function storagePut(
  relKey: string,
  data: Buffer,
  _contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const fullPath = containPath(relKey);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, data);
  return { key: relKey, url: `/api/attachments/file/${relKey}` };
}

export async function storageDelete(relKey: string): Promise<void> {
  const fullPath = containPath(relKey);
  await fs.unlink(fullPath).catch(() => {
    // No lanza si el archivo ya no existe — borrar algo que no está no es un error.
  });
}
