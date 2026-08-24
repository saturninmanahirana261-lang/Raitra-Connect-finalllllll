import React, { useState, useEffect, useRef } from 'react';
import {
  Building,
  Plus,
  Users,
  Globe,
  MapPin,
  Check,
  Loader2,
  X,
  ShieldCheck,
  Camera,
  Upload
} from 'lucide-react';
import type { SocialPage, UserProfile } from '../types';
import {
  createSocialPage,
  toggleFollowPage,
  isFollowingPage,
  uploadSocialMedia
} from '../utils/socialService';
import { rtdb, ref, onValue } from '../firebase';

interface SocialPagesTabProps {
  currentUser: UserProfile;
  onOpenCreatePostWithPage?: (page: SocialPage) => void;
}

const PAGE_CATEGORIES = [
  'Entreprise & Commerce',
  'Communauté & Association',
  'Artiste & Créateur',
  'Technologie & Logiciels',
  'Éducation & Formation',
  'Sport & Loisirs',
  'Autre'
];

export const SocialPagesTab: React.FC<SocialPagesTabProps> = ({
  currentUser,
  onOpenCreatePostWithPage
}) => {
  const [pages, setPages] = useState<SocialPage[]>([]);
  const [followedPages, setFollowedPages] = useState<Record<string, boolean>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState(PAGE_CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [location, setLocation] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');

  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const pagesRef = ref(rtdb, 'social_pages');
    const unsubscribe = onValue(pagesRef, (snapshot) => {
      const list: SocialPage[] = [];
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          list.push(child.val() as SocialPage);
        });
      }
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setPages(list);
    });

    return () => unsubscribe();
  }, []);

  // Vérifier les abonnements
  useEffect(() => {
    pages.forEach((page) => {
      isFollowingPage(page.id, currentUser.uid).then((isFollowing) => {
        setFollowedPages((prev) => ({ ...prev, [page.id]: isFollowing }));
      });
    });
  }, [pages, currentUser.uid]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleToggleFollow = async (pageId: string) => {
    try {
      const newState = await toggleFollowPage(pageId, {
        uid: currentUser.uid,
        displayName: currentUser.displayName,
        photoURL: currentUser.photoURL
      });
      setFollowedPages((prev) => ({ ...prev, [pageId]: newState }));
    } catch (e) {
      console.error('Erreur follow page:', e);
    }
  };

  const handleCreatePage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isCreating) return;

    setIsCreating(true);
    setUploadProgress(0);
    try {
      let avatarUrl = '';
      if (avatarFile) {
        avatarUrl = await uploadSocialMedia(
          avatarFile,
          currentUser.uid,
          'pages',
          (pct) => setUploadProgress(pct)
        );
      }

      await createSocialPage({
        name,
        category,
        description,
        avatarUrl,
        website,
        location,
        ownerUid: currentUser.uid
      });

      setName('');
      setDescription('');
      setWebsite('');
      setLocation('');
      setAvatarFile(null);
      setAvatarPreview('');
      setShowCreateModal(false);
      alert('Page Raitra Connect créée avec succès !');
    } catch (err: any) {
      console.error('Erreur création page:', err);
      alert(`Erreur : ${err?.message || 'Vérifiez votre connexion'}`);
    } finally {
      setIsCreating(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Banner with Create Page Action */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-6 text-white shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold">Pages Raitra Connect</h2>
          <p className="text-xs text-indigo-100 mt-1 max-w-md">
            Découvrez des communautés, des organisations, des entreprises et des créateurs, ou créez votre propre Page officielle.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2.5 rounded-2xl bg-white text-indigo-700 hover:bg-indigo-50 font-bold text-xs shadow-md transition active:scale-95 flex items-center gap-2 cursor-pointer flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Créer une Page</span>
        </button>
      </div>

      {/* Pages Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {pages.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400 dark:text-slate-500 bg-white dark:bg-[#1e1e24] border border-slate-200 dark:border-slate-800 rounded-3xl p-6">
            <Building className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-sm font-semibold">Aucune page pour le moment</p>
            <p className="text-xs mt-1">Soyez le premier à créer une page officielle sur Raitra Connect !</p>
          </div>
        ) : (
          pages.map((page) => {
            const isOwner = page.ownerUid === currentUser.uid;
            const isFollowing = followedPages[page.id] ?? false;

            return (
              <div
                key={page.id}
                className="bg-white dark:bg-[#1e1e24] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs flex flex-col justify-between gap-4"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center font-bold text-base overflow-hidden shadow-sm flex-shrink-0">
                    {page.avatarUrl ? (
                      <img src={page.avatarUrl} alt={page.name} className="w-full h-full object-cover" />
                    ) : (
                      page.name.charAt(0).toUpperCase()
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                        {page.name}
                      </h3>
                      <ShieldCheck className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                    </div>

                    <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 block">
                      {page.category}
                    </span>

                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">
                      {page.description || 'Aucune description fournie.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800/60 text-xs text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    <span>{page.followersCount || 1} abonné{(page.followersCount || 1) > 1 ? 's' : ''}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isOwner ? (
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold text-xs">
                          Propriétaire
                        </span>
                        {onOpenCreatePostWithPage && (
                          <button
                            type="button"
                            onClick={() => onOpenCreatePostWithPage(page)}
                            className="px-3 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition cursor-pointer shadow-xs"
                          >
                            Publier
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => handleToggleFollow(page.id)}
                        className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition active:scale-95 cursor-pointer ${
                          isFollowing
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                        }`}
                      >
                        {isFollowing ? 'Abonné' : "S'abonner"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal de création de Page */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#1e1e24] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-5 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                Créer une Page Raitra Connect
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePage} className="flex flex-col gap-3">
              {/* Photo / Logo de la page */}
              <div className="flex items-center gap-3 py-1">
                <div className="relative w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-6 h-6 text-slate-400" />
                  )}
                </div>
                <div>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{avatarPreview ? 'Changer le logo' : 'Ajouter un logo'}</span>
                  </button>
                  <p className="text-[10px] text-slate-400 mt-1">Format recommandé : carré (PNG, JPG)</p>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">
                  Nom de la Page *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Raitra Tech Studio, Club Photo..."
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">
                  Catégorie
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white outline-hidden"
                >
                  {PAGE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Présentez brièvement la mission ou les activités..."
                  rows={3}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white resize-none outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">
                    Site web
                  </label>
                  <input
                    type="text"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">
                    Localisation
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Ville, Pays"
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white outline-hidden"
                  />
                </div>
              </div>

              {isCreating && uploadProgress > 0 && (
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!name.trim() || isCreating}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {isCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Créer la Page</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
