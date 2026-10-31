/**
 * AttachmentList — Componente para visualizar archivos adjuntos
 * Muestra lista de archivos con opciones de descargar y eliminar
 */

import { useState, useEffect } from "react";
import { Download, Trash2, FileImage, File, Loader, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import ImageGallery from "./ImageGallery";
import { useAuth } from "@/_core/hooks/useAuth";

interface Attachment {
  id: number;
  incidentId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  s3Url: string;
  uploadedAt: Date;
  description?: string | null;
  mimeType?: string | null;
}

interface AttachmentListProps {
  incidentId: string;
  onRefresh?: () => void;
}

const getFileIcon = (mimeType?: string | null) => {
  if (mimeType?.startsWith("image/")) {
    return <FileImage className="w-4 h-4 text-cyan-400" />;
  }
  return <File className="w-4 h-4 text-gray-400" />;
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
};

const formatDate = (date: Date | string): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function AttachmentList({ incidentId, onRefresh }: AttachmentListProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'gallery' | 'list'>('gallery');
  const { isAuthenticated, loading: authLoading } = useAuth();

  const { data: attachmentsData, isLoading: isQueryLoading } = trpc.incidencia.getAttachments.useQuery(
    { incidentId },
    { enabled: !!incidentId && isAuthenticated }
  );

  const deleteMutation = trpc.incidencia.deleteAttachment.useMutation();

  useEffect(() => {
    if (attachmentsData) {
      setAttachments(attachmentsData as Attachment[]);
      setIsLoading(false);
    }
  }, [attachmentsData]);

  const handleDownload = (attachment: Attachment) => {
    // Create a temporary link and trigger download
    const link = document.createElement("a");
    link.href = attachment.s3Url;
    link.download = attachment.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Descargando ${attachment.fileName}`);
  };

  const handleDelete = async (attachmentId: number) => {
    if (!window.confirm("¿Estás seguro de que deseas eliminar este archivo?")) {
      return;
    }

    setDeletingId(attachmentId);
    try {
      await deleteMutation.mutateAsync({ attachmentId });
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      toast.success("Archivo eliminado");
      onRefresh?.();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Error al eliminar";
      toast.error(errorMsg);
    } finally {
      setDeletingId(null);
    }
  };

  if (!authLoading && !isAuthenticated) {
    return (
      <div className="py-8 text-center text-gray-400">
        <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Inicia sesión para ver los archivos adjuntos</p>
      </div>
    );
  }

  if (isLoading || isQueryLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader className="w-5 h-5 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (attachments.length === 0) {
    return (
      <div className="py-8 text-center text-gray-400">
        <File className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No hay archivos adjuntos</p>
      </div>
    );
  }

  // Separar imágenes de otros archivos
  const imageAttachments = attachments.filter((a) => a.mimeType?.startsWith("image/"));
  const otherAttachments = attachments.filter((a) => !a.mimeType?.startsWith("image/"));
  const hasImages = imageAttachments.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-cyan-400">ARCHIVOS ADJUNTOS ({attachments.length})</h3>
        {hasImages && (
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('gallery')}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                viewMode === 'gallery'
                  ? 'bg-cyan-500/30 text-cyan-400 border border-cyan-500/50'
                  : 'bg-slate-700/30 text-gray-400 border border-slate-600/30 hover:border-slate-500/50'
              }`}
            >
              Galería
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                viewMode === 'list'
                  ? 'bg-cyan-500/30 text-cyan-400 border border-cyan-500/50'
                  : 'bg-slate-700/30 text-gray-400 border border-slate-600/30 hover:border-slate-500/50'
              }`}
            >
              Lista
            </button>
          </div>
        )}
      </div>

      {/* Gallery View */}
      {viewMode === 'gallery' && hasImages && (
        <div className="mb-6">
          <ImageGallery
            images={imageAttachments.map((a) => ({
              id: a.id,
              fileName: a.fileName,
              s3Url: a.s3Url,
              fileSize: a.fileSize,
              uploadedAt: a.uploadedAt,
              mimeType: a.mimeType,
            }))}
          />
        </div>
      )}

      {/* List View */}
      {(viewMode === 'list' || !hasImages) && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {attachments.map((attachment) => (
          <div key={attachment.id} className="bg-slate-900/50 border border-cyan-500/20 rounded-lg p-3 hover:border-cyan-500/40 transition-colors">
            <div className="flex items-start gap-3">
              {/* File icon */}
              <div className="mt-1">{getFileIcon(attachment.mimeType)}</div>

              {/* File info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-200 truncate">{attachment.fileName}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatFileSize(attachment.fileSize)} • {formatDate(attachment.uploadedAt)}
                    </p>
                  </div>
                </div>

                {/* Description */}
                {attachment.description && (
                  <p className="text-xs text-gray-400 mt-2 italic">{attachment.description}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => handleDownload(attachment)}
                  className="p-2 hover:bg-cyan-500/20 rounded transition-colors"
                  title="Descargar"
                >
                  <Download className="w-4 h-4 text-cyan-400" />
                </button>
                <button
                  onClick={() => handleDelete(attachment.id)}
                  disabled={deletingId === attachment.id}
                  className="p-2 hover:bg-red-500/20 rounded transition-colors disabled:opacity-50"
                  title="Eliminar"
                >
                  {deletingId === attachment.id ? (
                    <Loader className="w-4 h-4 text-red-400 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 text-red-400" />
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
        </div>
      )}

      {/* Info message */}
      <div className="flex gap-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded text-xs text-blue-300 mt-3">
        <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
        <p>Los archivos se almacenan de forma local en el servidor y son accesibles solo para este incidente, con sesión iniciada.</p>
      </div>
    </div>
  );
}
