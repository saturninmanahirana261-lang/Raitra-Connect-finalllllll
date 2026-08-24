import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import type { SocialPostMedia } from '../types';

interface MediaLightboxModalProps {
  mediaList: SocialPostMedia[];
  initialIndex?: number;
  authorName?: string;
  onClose: () => void;
}

export const MediaLightboxModal: React.FC<MediaLightboxModalProps> = ({
  mediaList,
  initialIndex = 0,
  authorName = 'Publication',
  onClose
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoomLevel, setZoomLevel] = useState(1);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, mediaList.length]);

  const currentMedia = mediaList[currentIndex];

  const handleNext = () => {
    setZoomLevel(1);
    setCurrentIndex((prev) => (prev + 1) % mediaList.length);
  };

  const handlePrev = () => {
    setZoomLevel(1);
    setCurrentIndex((prev) => (prev - 1 + mediaList.length) % mediaList.length);
  };

  const handleZoomIn = () => setZoomLevel((z) => Math.min(z + 0.3, 3));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(z - 0.3, 0.7));

  if (!currentMedia) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between backdrop-blur-md select-none animate-in fade-in duration-200">
      {/* Top Header Controls */}
      <div className="p-4 flex items-center justify-between text-white bg-gradient-to-b from-black/80 to-transparent z-10">
        <div>
          <h4 className="text-sm font-bold">{authorName}</h4>
          <span className="text-xs text-white/60">
            {currentIndex + 1} / {mediaList.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {currentMedia.type === 'image' && (
            <>
              <button
                onClick={handleZoomIn}
                className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition"
                title="Zoomer"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={handleZoomOut}
                className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition"
                title="Dézoomer"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
            </>
          )}

          <a
            href={currentMedia.url}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition"
            title="Télécharger"
          >
            <Download className="w-4 h-4" />
          </a>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Display Area */}
      <div className="flex-1 relative flex items-center justify-center p-2 sm:p-6 overflow-hidden">
        {mediaList.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 hover:bg-black/80 text-white z-10 transition hover:scale-110"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 hover:bg-black/80 text-white z-10 transition hover:scale-110"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}

        {currentMedia.type === 'image' ? (
          <img
            src={currentMedia.url}
            alt=""
            style={{ transform: `scale(${zoomLevel})` }}
            className="max-h-[82vh] max-w-[90vw] object-contain transition duration-200"
          />
        ) : (
          <video
            src={currentMedia.url}
            controls
            autoPlay
            className="max-h-[82vh] max-w-[90vw] object-contain rounded-xl"
          />
        )}
      </div>

      {/* Bottom Thumbnails */}
      {mediaList.length > 1 && (
        <div className="p-3 flex items-center justify-center gap-2 bg-gradient-to-t from-black/80 to-transparent z-10 overflow-x-auto">
          {mediaList.map((item, idx) => (
            <div
              key={idx}
              onClick={() => {
                setZoomLevel(1);
                setCurrentIndex(idx);
              }}
              className={`w-12 h-12 rounded-xl overflow-hidden cursor-pointer border-2 transition ${
                idx === currentIndex
                  ? 'border-indigo-500 scale-105 opacity-100'
                  : 'border-transparent opacity-50 hover:opacity-80'
              }`}
            >
              {item.type === 'image' ? (
                <img src={item.url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-slate-800 flex items-center justify-center text-[10px] text-white">
                  Vidéo
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
