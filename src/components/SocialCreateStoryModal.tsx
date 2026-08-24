import React, { useState, useRef } from 'react';
import {
  X,
  Image as ImageIcon,
  Type,
  Loader2,
  Globe,
  Users,
  Lock
} from 'lucide-react';
import type { UserProfile, SocialVisibility } from '../types';
import { createSocialStory, uploadSocialMedia } from '../utils/socialService';

interface SocialCreateStoryModalProps {
  currentUser: UserProfile;
  onClose: () => void;
  onStoryCreated: () => void;
}

const BG_GRADIENTS = [
  'from-indigo-600 to-purple-600',
  'from-rose-500 to-amber-500',
  'from-emerald-500 to-teal-700',
  'from-blue-600 to-cyan-500',
  'from-violet-600 to-pink-500',
  'from-slate-900 to-slate-700'
];

export const SocialCreateStoryModal: React.FC<SocialCreateStoryModalProps> = ({
  currentUser,
  onClose,
  onStoryCreated
}) => {
  const [mode, setMode] = useState<'media' | 'text'>('media');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [textContent, setTextContent] = useState('');
  const [selectedBg, setSelectedBg] = useState(BG_GRADIENTS[0]);
  const [visibility, setVisibility] = useState<SocialVisibility>('public');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('video/') && file.size > 30 * 1024 * 1024) {
      alert('La vidéo de Story ne doit pas dépasser 30 Mo.');
      return;
    }

    setSelectedFile(file);
    setMediaPreview(URL.createObjectURL(file));
    setMediaType(file.type.startsWith('video/') ? 'video' : 'image');
    setMode('media');
  };

  const handlePublish = async () => {
    if (mode === 'media' && !selectedFile) {
      alert('Veuillez sélectionner une image ou une vidéo.');
      return;
    }
    if (mode === 'text' && !textContent.trim()) {
      alert('Veuillez écrire un texte pour votre story.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      let finalMediaUrl = '';

      if (mode === 'media' && selectedFile) {
        finalMediaUrl = await uploadSocialMedia(
          selectedFile,
          currentUser.uid,
          'stories',
          (pct) => setUploadProgress(pct)
        );

        if (!finalMediaUrl) {
          throw new Error('Le téléversement Cloudinary n\'a pas retourné d\'URL valide.');
        }
      }

      setUploadProgress(100);

      // Préparation propre des paramètres (sans aucune valeur undefined)
      const storyParams: Parameters<typeof createSocialStory>[0] = {
        authorUid: currentUser.uid,
        authorName: currentUser.displayName || 'Utilisateur',
        authorPhotoURL: currentUser.photoURL || '',
        mediaUrl: finalMediaUrl,
        mediaType: mode === 'text' ? 'text' : mediaType,
        visibility
      };

      if (textContent.trim()) {
        storyParams.textCaption = textContent.trim();
      }

      if (mode === 'text' && selectedBg) {
        storyParams.bgColor = selectedBg;
      }

      await createSocialStory(storyParams);

      onStoryCreated();
      onClose();
    } catch (err: any) {
      console.error('Erreur story:', err);
      alert(`Erreur création story : ${err?.message || 'Veuillez réessayer'}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#1e1e24] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-5 shadow-2xl flex flex-col gap-4 max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h2 className="text-base font-bold text-slate-800 dark:text-white">
            Créer une Story (24h)
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector */}
        <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl">
          <button
            type="button"
            onClick={() => setMode('media')}
            className={`py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition ${
              mode === 'media'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Photo / Vidéo</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('text')}
            className={`py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition ${
              mode === 'text'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Type className="w-4 h-4" />
            <span>Texte & Dégradé</span>
          </button>
        </div>

        {/* Preview Area */}
        <div className="w-full aspect-[9/13] rounded-3xl overflow-hidden relative shadow-inner flex items-center justify-center bg-slate-900">
          {mode === 'media' ? (
            mediaPreview ? (
              <div className="relative w-full h-full">
                {mediaType === 'image' ? (
                  <img src={mediaPreview} alt="Story" className="w-full h-full object-cover" />
                ) : (
                  <video src={mediaPreview} controls className="w-full h-full object-cover" />
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-3 right-3 px-3 py-1.5 rounded-xl bg-black/60 hover:bg-black/80 text-white text-[11px] font-medium backdrop-blur-xs transition shadow-md"
                >
                  Changer le média
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center gap-3 p-6 text-center text-slate-400 cursor-pointer hover:text-white transition"
              >
                <div className="w-16 h-16 rounded-3xl bg-slate-800 flex items-center justify-center text-indigo-400 shadow-md">
                  <ImageIcon className="w-8 h-8" />
                </div>
                <span className="text-xs font-medium">Touchez pour choisir une photo ou vidéo</span>
              </div>
            )
          ) : (
            <div
              className={`w-full h-full bg-gradient-to-br ${selectedBg} p-6 flex items-center justify-center text-center`}
            >
              <textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Écrivez votre message..."
                rows={4}
                className="w-full bg-transparent text-white font-bold text-xl placeholder-white/60 resize-none text-center outline-hidden"
              />
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* Media Mode Optional Caption */}
        {mode === 'media' && mediaPreview && (
          <div>
            <input
              type="text"
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="Ajouter une légende... (optionnel)"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-white placeholder-slate-400 outline-hidden focus:border-indigo-500 transition"
            />
          </div>
        )}

        {/* Text Mode Gradient Selector */}
        {mode === 'text' && (
          <div className="flex items-center justify-center gap-2">
            {BG_GRADIENTS.map((bg) => (
              <button
                key={bg}
                type="button"
                onClick={() => setSelectedBg(bg)}
                className={`w-7 h-7 rounded-full bg-gradient-to-br ${bg} transition transform ${
                  selectedBg === bg ? 'scale-125 ring-2 ring-indigo-500' : 'hover:scale-110'
                }`}
              />
            ))}
          </div>
        )}

        {/* Story Visibility */}
        <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 px-1">
          <span>Visibilité de la story :</span>
          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            {visibility === 'public' && <Globe className="w-3 h-3 text-indigo-500" />}
            {visibility === 'friends' && <Users className="w-3 h-3 text-emerald-500" />}
            {visibility === 'private' && <Lock className="w-3 h-3 text-amber-500" />}
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as SocialVisibility)}
              className="bg-transparent text-xs outline-hidden"
            >
              <option value="public">Public</option>
              <option value="friends">Amis</option>
              <option value="private">Privé</option>
            </select>
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={handlePublish}
          disabled={isUploading || (mode === 'media' && !selectedFile) || (mode === 'text' && !textContent.trim())}
          className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Publication ({uploadProgress}%)...</span>
            </>
          ) : (
            <span>Partager dans ma Story</span>
          )}
        </button>
      </div>
    </div>
  );
};
