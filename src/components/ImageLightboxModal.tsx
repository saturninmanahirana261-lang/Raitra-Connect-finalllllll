import React from 'react';
import { X, Download, ZoomIn, ExternalLink } from 'lucide-react';

interface ImageLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  imageName?: string;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  imageName = 'Image'
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
        {/* Top Control Bar */}
        <div className="w-full flex items-center justify-between py-2 text-white mb-2">
          <span className="text-xs font-semibold truncate max-w-xs">{imageName}</span>
          <div className="flex items-center gap-2">
            <a
              href={imageUrl}
              download={imageName}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
              title="Télécharger"
            >
              <Download className="w-4 h-4" />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
              title="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Image Display */}
        <div className="rounded-2xl overflow-hidden shadow-2xl border border-white/10 max-h-[80vh] flex items-center justify-center bg-black/40">
          <img
            src={imageUrl}
            alt={imageName}
            className="max-w-full max-h-[80vh] object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>
    </div>
  );
};
