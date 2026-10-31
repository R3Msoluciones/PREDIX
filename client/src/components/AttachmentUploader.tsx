/**
 * AttachmentUploader — Componente para cargar archivos adjuntos
 * Soporta fotos, reportes y otros documentos
 */

import { useState } from "react";
import { Upload, X, File, FileImage, AlertCircle, Loader } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

interface AttachmentUploaderProps {
  incidentId: string;
  onUploadSuccess?: () => void;
}

const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith("image/")) {
    return <FileImage className="w-4 h-4" />;
  }
  return <File className="w-4 h-4" />;
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
};

export default function AttachmentUploader({ incidentId, onUploadSuccess }: AttachmentUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [description, setDescription] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const uploadMutation = trpc.incidencia.uploadAttachment.useMutation();
  const { isAuthenticated } = useAuth();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    addFiles(files);
  };

  const addFiles = (files: File[]) => {
    // Validate file size (max 10MB per file)
    const validFiles = files.filter((file) => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} excede el límite de 10MB`);
        return false;
      }
      return true;
    });

    setSelectedFiles((prev) => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error("Selecciona al menos un archivo");
      return;
    }

    setIsUploading(true);

    try {
      for (const file of selectedFiles) {
        // Convert file to base64
        const reader = new FileReader();
        await new Promise((resolve, reject) => {
          reader.onload = async () => {
            try {
              const base64 = (reader.result as string).split(",")[1];
              await uploadMutation.mutateAsync({
                incidentId,
                fileName: file.name,
                fileData: base64,
                mimeType: file.type,
                description: description || undefined,
              });
              resolve(null);
            } catch (error) {
              reject(error);
            }
          };
          reader.onerror = () => reject(new Error("Error al leer el archivo"));
          reader.readAsDataURL(file);
        });
      }

      toast.success(`${selectedFiles.length} archivo(s) cargado(s) exitosamente`);
      setSelectedFiles([]);
      setDescription("");
      onUploadSuccess?.();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Error al cargar archivos";
      toast.error(errorMsg);
    } finally {
      setIsUploading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="py-8 text-center text-gray-400">
        <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Inicia sesión para cargar archivos</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Drag and drop area */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 transition-colors ${
          isDragging
            ? "border-cyan-400 bg-cyan-500/10"
            : "border-cyan-500/30 bg-slate-900/30 hover:border-cyan-500/50"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center gap-3">
          <Upload className="w-8 h-8 text-cyan-400" />
          <div className="text-center">
            <p className="text-sm font-medium text-gray-200">Arrastra archivos aquí o haz clic para seleccionar</p>
            <p className="text-xs text-gray-400 mt-1">Máximo 10MB por archivo (fotos, PDF, reportes)</p>
          </div>
          <input
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            id="file-input"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
          />
          <label htmlFor="file-input" className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm rounded cursor-pointer transition-colors">
            Seleccionar Archivos
          </label>
        </div>
      </div>

      {/* Selected files list */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-cyan-400">Archivos Seleccionados ({selectedFiles.length})</h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {selectedFiles.map((file, index) => (
              <div key={index} className="flex items-center justify-between bg-slate-900/50 border border-cyan-500/20 rounded p-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {getFileIcon(file.type)}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-200 truncate">{file.name}</p>
                    <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="ml-2 p-1 hover:bg-red-500/20 rounded transition-colors"
                  title="Eliminar"
                >
                  <X className="w-4 h-4 text-red-400" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Description field */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Descripción (opcional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ej: Foto del lugar de los hechos, Reporte de pericia..."
          className="w-full px-3 py-2 bg-slate-900/50 border border-cyan-500/20 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-400"
          rows={3}
        />
      </div>

      {/* Upload button */}
      {selectedFiles.length > 0 && (
        <button
          onClick={handleUpload}
          disabled={isUploading}
          className="w-full px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 text-white text-sm font-medium rounded transition-colors flex items-center justify-center gap-2"
        >
          {isUploading ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Cargando...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Cargar {selectedFiles.length} archivo{selectedFiles.length !== 1 ? "s" : ""}
            </>
          )}
        </button>
      )}

      {/* Info message */}
      <div className="flex gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded text-xs text-blue-300">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <p>Los archivos se almacenan de forma local en el servidor y se asocian permanentemente a este incidente.</p>
      </div>
    </div>
  );
}
