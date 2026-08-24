import React, { useState, useRef } from 'react';
import {
  X,
  Image as ImageIcon,
  Video,
  Smile,
  Globe,
  Users,
  Lock,
  Loader2,
  Trash2,
  Building
} from 'lucide-react';
import type { UserProfile, SocialVisibility, SocialPostMedia, SocialPage } from '../types';
import { createSocialPost, uploadSocialMedia } from '../utils/socialService';

interface SocialCreatePostModalProps {
  currentUser: UserProfile;
  userPages?: SocialPage[];
  onClose: () => void;
  onPostCreated: () => void;
}

const COMMON_EMOJIS = ['😀', '😍', '🔥', '🎉', '👏', '🚀', '💯', '✨', '🙌', '💡', '❤️', '👍'];

export const SocialCreatePostModal: React.FC<SocialCreatePostModalProps> = ({
  currentUser,
  userPages = [],
  onClose,
  onPostCreated
}) => {
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<SocialVisibility>('public');
  const [selectedPageId, setSelectedPageId] = useState<string>('personal');
  const [mediaFiles, setMediaFiles] = useState<{ file: File; preview: string; type: 'image' | 'video' }[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  const selectedPage = userPages.find((p) => p.id === selectedPageId);

  const handleAddImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = Array.from(e.target.files || []);
    if (!files.length) return;

    const newMedia = files.map((file: File) => ({
      file,
      preview: URL.createObjectURL(file),
      type: 'image' as const
    }));

    setMediaFiles((prev) => [...prev, ...newMedia]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      alert('La vidéo ne doit pas dépasser 50 Mo.');
      if (videoInputRef.current) videoInputRef.current.value = '';
      return;
    }

    setMediaFiles((prev) => [
      ...prev,
      {
        file,
        preview: URL.createObjectURL(file),
        type: 'video' as const
      }
    ]);
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const removeMedia = (index: number) => {
    setMediaFiles((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[index].preview);
      next.splice(index, 1);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && mediaFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const uploadedMedia: SocialPostMedia[] = [];

      for (let i = 0; i < mediaFiles.length; i++) {
        const item = mediaFiles[i];
        const downloadUrl = await uploadSocialMedia(
          item.file,
          currentUser.uid,
          'posts',
          (pct) => {
            const fileContribution = pct / mediaFiles.length;
            const currentOverall = Math.min(100, Math.round((i / mediaFiles.length) * 100 + fileContribution));
            setUploadProgress(currentOverall);
          }
        );
        uploadedMedia.push({
          url: downloadUrl,
          type: item.type,
          name: item.file.name,
          size: item.file.size
        });
      }

      setUploadProgress(100);

      await createSocialPost({
        authorUid: currentUser.uid,
        authorName: selectedPage ? selectedPage.name : currentUser.displayName,
        authorEmail: currentUser.email,
        authorPhotoURL: selectedPage ? selectedPage.avatarUrl : currentUser.photoURL,
        content,
        media: uploadedMedia,
        visibility,
        pageId: selectedPage?.id,
        pageName: selectedPage?.name,
        pageAvatar: selectedPage?.avatarUrl
      });

      onPostCreated();
      onClose();
    } catch (err: any) {
      console.error('Erreur publication:', err);
      alert(`Erreur lors de la publication : ${err?.message || 'Vérifiez votre connexion'}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const authorName = selectedPage ? selectedPage.name : currentUser.displayName;
  const authorAvatar = selectedPage ? selectedPage.avatarUrl : currentUser.photoURL;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#1e1e24] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-base font-bold text-slate-800 dark:text-white">
            Créer une publication
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {/* Author Selector (Personal or Page) */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-base overflow-hidden flex-shrink-0 shadow-sm">
              {authorAvatar ? (
                <img src={authorAvatar} alt={authorName} className="w-full h-full object-cover" />
              ) : (
                authorName?.charAt(0).toUpperCase() || 'U'
              )}
            </div>

            <div className="flex-1 flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-slate-800 dark:text-white">
                  {authorName}
                </span>

                {userPages.length > 0 && (
                  <select
                    value={selectedPageId}
                    onChange={(e) => setSelectedPageId(e.target.value)}
                    className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg px-2 py-0.5 border border-slate-200 dark:border-slate-700 outline-hidden"
                  >
                    <option value="personal">Profil personnel</option>
                    {userPages.map((page) => (
                      <option key={page.id} value={page.id}>
                        {page.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Visibility selector */}
              <div className="flex items-center gap-1.5">
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs border border-slate-200 dark:border-slate-700">
                  {visibility === 'public' && <Globe className="w-3 h-3 text-indigo-500" />}
                  {visibility === 'friends' && <Users className="w-3 h-3 text-emerald-500" />}
                  {visibility === 'private' && <Lock className="w-3 h-3 text-amber-500" />}
                  <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value as SocialVisibility)}
                    className="bg-transparent text-xs outline-hidden cursor-pointer"
                  >
                    <option value="public">Public</option>
                    <option value="friends">Amis uniquement</option>
                    <option value="private">Privé (Moi uniquement)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Text Area */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`Quoi de neuf, ${currentUser.displayName?.split(' ')[0]} ?`}
            rows={4}
            className="w-full bg-transparent text-sm text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 resize-none outline-hidden p-1 min-h-[100px]"
            autoFocus
          />

          {/* Media Previews */}
          {mediaFiles.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              {mediaFiles.map((item, idx) => (
                <div key={idx} className="relative rounded-2xl overflow-hidden bg-slate-900 group aspect-video">
                  {item.type === 'image' ? (
                    <img src={item.preview} alt="Media" className="w-full h-full object-cover" />
                  ) : (
                    <video src={item.preview} className="w-full h-full object-cover" controls />
                  )}
                  <button
                    type="button"
                    onClick={() => removeMedia(idx)}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-rose-600 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Emoji Quick Picker */}
          {showEmojiPicker && (
            <div className="flex flex-wrap gap-2 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-100">
              {COMMON_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    setContent((prev) => prev + emoji);
                    setShowEmojiPicker(false);
                  }}
                  className="w-8 h-8 flex items-center justify-center text-lg hover:scale-125 transition active:scale-95"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {/* Upload progress banner */}
          {isUploading && (
            <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-900/60 flex flex-col gap-1.5 text-xs text-indigo-800 dark:text-indigo-200">
              <div className="flex items-center justify-between font-medium">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                  <span>Publication en cours...</span>
                </span>
                <span className="font-mono">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-indigo-200 dark:bg-indigo-900 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-600 h-full rounded-full transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Action Toolbar */}
          <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleAddImages}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 transition"
                title="Ajouter des photos"
              >
                <ImageIcon className="w-5 h-5" />
              </button>

              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                onChange={handleAddVideo}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 transition"
                title="Ajouter une vidéo"
              >
                <Video className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={() => setShowEmojiPicker((prev) => !prev)}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 transition"
                title="Insérer un emoji"
              >
                <Smile className="w-5 h-5" />
              </button>
            </div>

            <button
              type="submit"
              disabled={isUploading || (!content.trim() && mediaFiles.length === 0)}
              className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold shadow-md transition active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Envoi...</span>
                </>
              ) : (
                <span>Publier</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
