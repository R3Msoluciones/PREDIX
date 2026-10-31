/**
 * ImageGallery — Galería de miniaturas de imágenes
 * Muestra miniaturas de imágenes con vista previa al hacer clic
 */

import { useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface ImageItem {
  id: number;
  fileName: string;
  s3Url: string;
  fileSize: number;
  uploadedAt: Date | string;
  mimeType?: string | null;
}

interface ImageGalleryProps {
  images: ImageItem[];
  onImageClick?: (image: ImageItem) => void;
}

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

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
};

export function ImageThumbnail({ image, onClick }: { image: ImageItem; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="relative group cursor-pointer overflow-hidden rounded-lg bg-slate-900 border border-cyan-500/20 hover:border-cyan-500/50 transition-all"
    >
      <img
        src={image.s3Url}
        alt={image.fileName}
        className="w-full h-32 object-cover group-hover:scale-110 transition-transform duration-300"
        onError={(e) => {
          (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23334155' width='100' height='100'/%3E%3Ctext x='50' y='50' font-size='12' fill='%238BA3C7' text-anchor='middle' dy='.3em'%3EError%3C/text%3E%3C/svg%3E";
        }}
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
        <div className="text-white text-xs font-semibold">VER</div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <p className="text-xs text-gray-200 truncate">{image.fileName}</p>
        <p className="text-xs text-gray-400">{formatFileSize(image.fileSize)}</p>
      </div>
    </div>
  );
}

export function ImagePreviewModal({
  image,
  allImages,
  isOpen,
  onClose,
}: {
  image: ImageItem | null;
  allImages: ImageItem[];
  isOpen: boolean;
  onClose: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(
    image ? allImages.findIndex((img) => img.id === image.id) : 0
  );

  if (!isOpen || !image) return null;

  const currentImage = allImages[currentIndex];

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? allImages.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === allImages.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full h-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-cyan-500/20 bg-slate-950/95">
          <div className="flex-1">
            <h2 className="text-cyan-400 font-semibold text-sm truncate">{currentImage.fileName}</h2>
            <p className="text-xs text-gray-400 mt-1">
              {formatFileSize(currentImage.fileSize)} • {formatDate(currentImage.uploadedAt)}
            </p>
          </div>
          <div className="text-xs text-gray-400 mx-4">
            {currentIndex + 1} de {allImages.length}
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="p-2 hover:bg-red-500/20 rounded transition-colors text-red-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Image Container */}
        <div className="flex-1 flex items-center justify-center bg-black/50 relative overflow-hidden">
          <img
            src={currentImage.s3Url}
            alt={currentImage.fileName}
            className="max-w-full max-h-full object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%23334155' width='200' height='200'/%3E%3Ctext x='100' y='100' font-size='16' fill='%238BA3C7' text-anchor='middle' dy='.3em'%3EError al cargar%3C/text%3E%3C/svg%3E";
            }}
          />

          {/* Navigation Arrows */}
          {allImages.length > 1 && (
            <>
              <button
                onClick={handlePrevious}
                aria-label="Anterior"
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-cyan-500/20 hover:bg-cyan-500/40 rounded-full transition-colors text-cyan-400"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={handleNext}
                aria-label="Siguiente"
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-cyan-500/20 hover:bg-cyan-500/40 rounded-full transition-colors text-cyan-400"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-cyan-500/20 bg-slate-950/95 text-xs text-gray-400">
          <p>Usa las flechas para navegar entre imágenes o presiona ESC para cerrar</p>
        </div>
      </div>
    </div>
  );
}

export default function ImageGallery({ images, onImageClick }: ImageGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<ImageItem | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const handleThumbnailClick = (image: ImageItem) => {
    setSelectedImage(image);
    setIsPreviewOpen(true);
    onImageClick?.(image);
  };

  if (images.length === 0) {
    return (
      <div className="py-8 text-center text-gray-400">
        <p className="text-sm">No hay imágenes para mostrar</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-cyan-400">GALERÍA DE IMÁGENES ({images.length})</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {images.map((image) => (
            <ImageThumbnail
              key={image.id}
              image={image}
              onClick={() => handleThumbnailClick(image)}
            />
          ))}
        </div>
      </div>

      <ImagePreviewModal
        image={selectedImage}
        allImages={images}
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
      />
    </>
  );
}
