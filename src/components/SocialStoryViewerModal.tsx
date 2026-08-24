import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  Trash2,
  Lock,
  Users,
  Globe,
  Clock
} from 'lucide-react';
import type { SocialStory, UserProfile, StoryViewerDetail } from '../types';
import { markStoryAsViewed, deleteSocialStory } from '../utils/socialService';

interface SocialStoryViewerModalProps {
  stories: SocialStory[];
  initialIndex?: number;
  currentUser: UserProfile;
  onClose: () => void;
  onStoryDeleted?: () => void;
}

export const SocialStoryViewerModal: React.FC<SocialStoryViewerModalProps> = ({
  stories,
  initialIndex = 0,
  currentUser,
  onClose,
  onStoryDeleted
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showViewersModal, setShowViewersModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const currentStory = stories[currentIndex];
  const isAuthor = currentStory && currentStory.authorUid === currentUser.uid;
  const isSuperAdmin = currentUser.email === 'saturninmanahirana261@gmail.com';

  const timerRef = useRef<any>(null);

  // Marquer comme vue dès qu'on affiche la story
  useEffect(() => {
    if (currentStory) {
      markStoryAsViewed(currentStory.id, {
        uid: currentUser.uid,
        displayName: currentUser.displayName,
        photoURL: currentUser.photoURL
      });
      setProgress(0);
    }
  }, [currentIndex, currentStory?.id, currentUser.uid]);

  // Défilement automatique (5 secondes par story)
  useEffect(() => {
    if (isPaused || showViewersModal || isDeleting) return;

    const interval = 50; // mise à jour toutes les 50ms
    const totalDuration = 5000;
    const step = (interval / totalDuration) * 100;

    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          handleNext();
          return 0;
        }
        return prev + step;
      });
    }, interval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentIndex, isPaused, showViewersModal, isDeleting, stories.length]);

  const handleNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setProgress(0);
    }
  };

  const handleDelete = async () => {
    if (!currentStory || isDeleting) return;
    if (!window.confirm('Voulez-vous vraiment supprimer cette story ?')) return;

    setIsDeleting(true);
    try {
      await deleteSocialStory(currentStory.id, currentUser.uid);
      if (onStoryDeleted) onStoryDeleted();
      if (stories.length <= 1) {
        onClose();
      } else {
        handleNext();
      }
    } catch (e: any) {
      console.error('Erreur suppression story:', e);
      alert(`Impossible de supprimer la story : ${e?.message || 'Erreur inconnue'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!currentStory) return null;

  const viewersList: StoryViewerDetail[] = Object.values(currentStory.viewersDetails || {});

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-md animate-in fade-in duration-150 select-none">
      <div
        className="relative w-full max-w-sm aspect-[9/16] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between"
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* Top Progress Bars */}
        <div className="absolute top-3 inset-x-3 z-30 flex items-center gap-1.5">
          {stories.map((s, idx) => (
            <div
              key={s.id}
              className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden"
            >
              <div
                className="h-full bg-white transition-all duration-75"
                style={{
                  width:
                    idx < currentIndex
                      ? '100%'
                      : idx === currentIndex
                      ? `${progress}%`
                      : '0%'
                }}
              />
            </div>
          ))}
        </div>

        {/* Top Header : Auteur + Options */}
        <div className="absolute top-7 inset-x-3 z-30 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-xs overflow-hidden shadow-md">
              {currentStory.authorPhotoURL ? (
                <img src={currentStory.authorPhotoURL} alt={currentStory.authorName} className="w-full h-full object-cover" />
              ) : (
                currentStory.authorName.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <span className="font-bold text-xs drop-shadow-md block">
                {currentStory.authorName}
              </span>
              <div className="flex items-center gap-1 text-[10px] text-white/80">
                {currentStory.visibility === 'public' && <Globe className="w-2.5 h-2.5" />}
                {currentStory.visibility === 'friends' && <Users className="w-2.5 h-2.5" />}
                {currentStory.visibility === 'private' && <Lock className="w-2.5 h-2.5" />}
                <span>Story 24h</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {(isAuthor || isSuperAdmin) && (
              <button
                onClick={handleDelete}
                className="p-2 rounded-full bg-black/40 hover:bg-rose-600 text-white transition cursor-pointer"
                title="Supprimer la story"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-full bg-black/40 hover:bg-black/70 text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Story Content */}
        <div className="w-full h-full flex items-center justify-center relative">
          {currentStory.mediaType === 'image' && (
            <img
              src={currentStory.mediaUrl}
              alt="Story"
              className="w-full h-full object-cover"
            />
          )}

          {currentStory.mediaType === 'video' && (
            <video
              src={currentStory.mediaUrl}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          )}

          {currentStory.mediaType === 'text' && (
            <div
              className={`w-full h-full bg-gradient-to-br ${
                currentStory.bgColor || 'from-indigo-600 to-purple-600'
              } p-8 flex items-center justify-center text-center`}
            >
              <p className="text-white font-extrabold text-xl sm:text-2xl drop-shadow-md leading-relaxed">
                {currentStory.textCaption}
              </p>
            </div>
          )}

          {/* Caption overlay for media stories if present */}
          {currentStory.mediaType !== 'text' && currentStory.textCaption && (
            <div className="absolute bottom-16 inset-x-4 z-25 bg-black/60 backdrop-blur-xs px-4 py-2.5 rounded-2xl text-center text-white text-xs font-medium shadow-lg pointer-events-none">
              <p>{currentStory.textCaption}</p>
            </div>
          )}

          {/* Navigation Click Zones */}
          <div
            onClick={handlePrev}
            className="absolute left-0 inset-y-0 w-1/3 z-20 cursor-pointer"
          />
          <div
            onClick={handleNext}
            className="absolute right-0 inset-y-0 w-1/3 z-20 cursor-pointer"
          />
        </div>

        {/* Bottom Bar: Viewers for Author */}
        {isAuthor && (
          <div
            onClick={() => setShowViewersModal(true)}
            className="absolute bottom-4 inset-x-4 z-30 flex items-center justify-between bg-black/60 backdrop-blur-md p-2.5 rounded-2xl text-white text-xs cursor-pointer hover:bg-black/80 transition"
          >
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-indigo-400" />
              <span className="font-semibold">
                {currentStory.viewersCount || 1} vue{(currentStory.viewersCount || 1) > 1 ? 's' : ''}
              </span>
            </div>
            <span className="text-[10px] text-white/60">Voir qui a vu</span>
          </div>
        )}

        {/* Viewers Drawer Modal */}
        {showViewersModal && (
          <div className="absolute inset-0 bg-black/85 z-40 flex flex-col justify-end animate-in fade-in duration-150">
            <div className="bg-[#18181b] border-t border-slate-700 rounded-t-3xl p-4 max-h-[60%] flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-indigo-400" />
                  Spectateurs de la Story ({viewersList.length})
                </span>
                <button
                  onClick={() => setShowViewersModal(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
                {viewersList.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">
                    Aucun spectateur enregistré.
                  </p>
                ) : (
                  viewersList.map((viewer) => (
                    <div key={viewer.uid} className="flex items-center justify-between p-2 rounded-xl bg-slate-800/60">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs overflow-hidden">
                          {viewer.photoURL ? (
                            <img src={viewer.photoURL} alt="" className="w-full h-full object-cover" />
                          ) : (
                            viewer.displayName.charAt(0).toUpperCase()
                          )}
                        </div>
                        <span className="text-xs text-white font-medium">
                          {viewer.displayName} {viewer.uid === currentUser.uid ? '(Vous)' : ''}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {new Date(viewer.viewedAt).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
