import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Plus,
  Compass,
  Users,
  Building,
  Bell,
  Search,
  Loader2,
  Filter,
  Image as ImageIcon,
  Flame,
  Globe,
  TrendingUp,
  Smile
} from 'lucide-react';
import type {
  UserProfile,
  SocialPost,
  SocialStory,
  SocialPage,
  Friendship,
  UserBlock
} from '../types';
import { SocialPostCard } from './SocialPostCard';
import { SocialStoriesBar } from './SocialStoriesBar';
import { SocialCreatePostModal } from './SocialCreatePostModal';
import { SocialCreateStoryModal } from './SocialCreateStoryModal';
import { SocialStoryViewerModal } from './SocialStoryViewerModal';
import { SocialPagesTab } from './SocialPagesTab';
import { SocialNotificationsPopover } from './SocialNotificationsPopover';
import { ReportUserModal } from './ReportUserModal';
import { isBlockedEitherWay } from '../utils/moderationService';
import {
  rtdb,
  ref,
  onValue
} from '../firebase';

interface SocialViewProps {
  currentUser: UserProfile;
  allUsers: UserProfile[];
  friendships: Friendship[];
  allBlocks: UserBlock[];
  onOpenDirectChat?: (targetUid: string) => void;
}

export const SocialView: React.FC<SocialViewProps> = ({
  currentUser,
  allUsers,
  friendships,
  allBlocks,
  onOpenDirectChat
}) => {
  const [activeTab, setActiveTab] = useState<'feed' | 'friends' | 'pages'>('feed');
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [stories, setStories] = useState<SocialStory[]>([]);
  const [userPages, setUserPages] = useState<SocialPage[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadNotifsCount, setUnreadNotifsCount] = useState(0);

  // Modals
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [storyViewerIndex, setStoryViewerIndex] = useState<number | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ id: string; name: string } | null>(null);

  // Liste des UIDs d'amis acceptés
  const friendUids = friendships
    .filter((f) => f.status === 'accepted')
    .map((f) => (f.user1Id === currentUser.uid ? f.user2Id : f.user1Id));

  // Écouter les publications sociales
  useEffect(() => {
    setIsLoadingPosts(true);
    const postsRef = ref(rtdb, 'social_posts');

    const unsubscribe = onValue(
      postsRef,
      (snapshot) => {
        const list: SocialPost[] = [];
        if (snapshot.exists()) {
          snapshot.forEach((child) => {
            list.push(child.val() as SocialPost);
          });
        }
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setPosts(list);
        setIsLoadingPosts(false);
      },
      (err) => {
        console.error('Erreur chargement posts:', err);
        setIsLoadingPosts(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Écouter les stories actives (non expirées)
  useEffect(() => {
    const storiesRef = ref(rtdb, 'social_stories');

    const unsubscribe = onValue(storiesRef, (snapshot) => {
      const now = Date.now();
      const list: SocialStory[] = [];
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          const story = child.val() as SocialStory;
          if (story.expiresAt && story.expiresAt > now) {
            list.push(story);
          }
        });
      }
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setStories(list);
    });

    return () => unsubscribe();
  }, []);

  // Charger les pages créées ou administrées par l'utilisateur
  useEffect(() => {
    const pagesRef = ref(rtdb, 'social_pages');

    const unsubscribe = onValue(pagesRef, (snapshot) => {
      const list: SocialPage[] = [];
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          const page = child.val() as SocialPage;
          if (page.ownerUid === currentUser.uid || (Array.isArray(page.admins) && page.admins.includes(currentUser.uid))) {
            list.push(page);
          }
        });
      }
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setUserPages(list);
    });

    return () => unsubscribe();
  }, [currentUser.uid]);

  // Écouter le compteur de notifications non lues
  useEffect(() => {
    const notifsRef = ref(rtdb, `social_notifications/${currentUser.uid}`);

    const unsubscribe = onValue(notifsRef, (snapshot) => {
      let unread = 0;
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          if (!child.val().isRead) {
            unread++;
          }
        });
      }
      setUnreadNotifsCount(unread);
    });

    return () => unsubscribe();
  }, [currentUser.uid]);


  // Filtrer les publications selon l'onglet, la recherche et les blocages
  const filteredPosts = posts.filter((post) => {
    // 1. Filtrer les utilisateurs bloqués
    if (isBlockedEitherWay(currentUser.uid, post.authorUid, allBlocks)) {
      return false;
    }

    // 2. Filtre de confidentialité
    if (post.visibility === 'private' && post.authorUid !== currentUser.uid) {
      return false;
    }
    if (
      post.visibility === 'friends' &&
      post.authorUid !== currentUser.uid &&
      !friendUids.includes(post.authorUid)
    ) {
      return false;
    }

    // 3. Filtre selon l'onglet
    if (activeTab === 'friends' && !friendUids.includes(post.authorUid) && post.authorUid !== currentUser.uid) {
      return false;
    }

    // 4. Filtre de recherche textuelle
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchText = post.content.toLowerCase().includes(q);
      const matchAuthor = post.authorName.toLowerCase().includes(q);
      return matchText || matchAuthor;
    }

    return true;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8f9fc] dark:bg-[#121214] overflow-hidden">
      {/* Top Header Bar */}
      <div className="bg-white dark:bg-[#18181b] border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white tracking-tight">
              Actualités & Social
            </h1>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 block -mt-0.5">
              Réseau communautaire Raitra Connect
            </span>
          </div>
        </div>

        {/* Search Bar & Actions */}
        <div className="flex items-center gap-2">
          <div className="relative hidden sm:block w-48 md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher des publications..."
              className="w-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-2xl pl-9 pr-3 py-1.5 text-xs text-slate-800 dark:text-white outline-hidden"
            />
          </div>

          {/* Notifications Button */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications((prev) => !prev)}
              className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-200 transition relative cursor-pointer"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                  {unreadNotifsCount > 9 ? '9+' : unreadNotifsCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <SocialNotificationsPopover
                currentUser={currentUser}
                onClose={() => setShowNotifications(false)}
              />
            )}
          </div>

          {/* Create Post Main Button */}
          <button
            onClick={() => setShowCreatePost(true)}
            className="px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition active:scale-95 flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Publier</span>
          </button>
        </div>
      </div>

      {/* Main Container with 2 Columns */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 flex justify-center gap-6">
        {/* Center Feed Column */}
        <div className="w-full max-w-2xl flex flex-col gap-4">
          {/* Navigation Tabs */}
          <div className="bg-white dark:bg-[#1e1e24] border border-slate-200 dark:border-slate-800 p-1.5 rounded-2xl flex items-center gap-1 shadow-2xs">
            <button
              onClick={() => setActiveTab('feed')}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                activeTab === 'feed'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Pour vous</span>
            </button>

            <button
              onClick={() => setActiveTab('friends')}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                activeTab === 'friends'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Amis</span>
            </button>

            <button
              onClick={() => setActiveTab('pages')}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                activeTab === 'pages'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Building className="w-3.5 h-3.5" />
              <span>Pages</span>
            </button>
          </div>

          {activeTab === 'pages' ? (
            <SocialPagesTab
              currentUser={currentUser}
              onOpenCreatePostWithPage={() => setShowCreatePost(true)}
            />
          ) : (
            <>
              {/* Stories Bar */}
              <div className="bg-white dark:bg-[#1e1e24] border border-slate-200 dark:border-slate-800 rounded-3xl p-3.5 shadow-2xs">
                <SocialStoriesBar
                  stories={stories}
                  currentUser={currentUser}
                  onOpenCreateStory={() => setShowCreateStory(true)}
                  onSelectStory={(index) => setStoryViewerIndex(index)}
                />
              </div>

              {/* Quick Post Prompt Box */}
              <div className="bg-white dark:bg-[#1e1e24] border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-2xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm overflow-hidden flex-shrink-0 shadow-xs">
                  {currentUser.photoURL ? (
                    <img src={currentUser.photoURL} alt={currentUser.displayName} className="w-full h-full object-cover" />
                  ) : (
                    currentUser.displayName?.charAt(0).toUpperCase() || 'U'
                  )}
                </div>

                <div
                  onClick={() => setShowCreatePost(true)}
                  className="flex-1 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-2xl px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400 cursor-pointer transition"
                >
                  Quoi de neuf, {currentUser.displayName?.split(' ')[0]} ?
                </div>

                <button
                  onClick={() => setShowCreatePost(true)}
                  className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition cursor-pointer"
                  title="Ajouter une photo"
                >
                  <ImageIcon className="w-4 h-4" />
                </button>
              </div>

              {/* Posts Feed */}
              {isLoadingPosts ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                  <span className="text-xs">Chargement du fil d'actualités...</span>
                </div>
              ) : filteredPosts.length === 0 ? (
                <div className="bg-white dark:bg-[#1e1e24] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center text-slate-400 dark:text-slate-500">
                  <Compass className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="text-sm font-semibold">Aucune publication pour le moment</p>
                  <p className="text-xs mt-1">Partagez votre première publication avec la communauté !</p>
                  <button
                    onClick={() => setShowCreatePost(true)}
                    className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition cursor-pointer"
                  >
                    Créer une publication
                  </button>
                </div>
              ) : (
                filteredPosts.map((post) => (
                  <SocialPostCard
                    key={post.id}
                    post={post}
                    currentUser={currentUser}
                    onOpenReportModal={(id, name) => setReportTarget({ id, name })}
                  />
                ))
              )}
            </>
          )}
        </div>

        {/* Right Sidebar Column (Desktop Only) */}
        <div className="hidden lg:flex flex-col gap-4 w-72 flex-shrink-0">
          {/* Quick Stats Widget */}
          <div className="bg-white dark:bg-[#1e1e24] border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-2xs flex flex-col gap-3">
            <div className="flex items-center gap-2 text-slate-800 dark:text-white font-bold text-xs">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              <span>Réseau Raitra Connect</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40">
                <span className="font-bold text-base text-indigo-700 dark:text-indigo-300 block">
                  {friendUids.length}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">Ami(e)s</span>
              </div>
              <div className="p-2.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/40">
                <span className="font-bold text-base text-purple-700 dark:text-purple-300 block">
                  {userPages.length}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">Mes Pages</span>
              </div>
            </div>
          </div>

          {/* Suggestions d'amis */}
          <div className="bg-white dark:bg-[#1e1e24] border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-2xs flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800 dark:text-white">
                Membres de la communauté
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {allUsers
                .filter(
                  (u) =>
                    u.uid !== currentUser.uid &&
                    !friendUids.includes(u.uid) &&
                    !isBlockedEitherWay(currentUser.uid, u.uid, allBlocks)
                )
                .slice(0, 4)
                .map((user) => (
                  <div
                    key={user.uid}
                    className="flex items-center justify-between p-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs overflow-hidden flex-shrink-0">
                        {user.photoURL ? (
                          <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
                        ) : (
                          user.displayName?.charAt(0).toUpperCase() || 'U'
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="font-semibold text-xs text-slate-800 dark:text-white block truncate">
                          {user.displayName}
                        </span>
                        <span className="text-[10px] text-slate-400 block truncate">
                          {user.department || user.title || 'Membre'}
                        </span>
                      </div>
                    </div>

                    {onOpenDirectChat && (
                      <button
                        onClick={() => onOpenDirectChat(user.uid)}
                        className="px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 text-[11px] font-semibold transition cursor-pointer flex-shrink-0"
                      >
                        Contacter
                      </button>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Create Post Modal */}
      {showCreatePost && (
        <SocialCreatePostModal
          currentUser={currentUser}
          userPages={userPages}
          onClose={() => setShowCreatePost(false)}
          onPostCreated={() => {
            // rafraîchissement automatique via snapshot
          }}
        />
      )}

      {/* Create Story Modal */}
      {showCreateStory && (
        <SocialCreateStoryModal
          currentUser={currentUser}
          onClose={() => setShowCreateStory(false)}
          onStoryCreated={() => {
            // rafraîchissement automatique via snapshot
          }}
        />
      )}

      {/* Story Viewer Modal */}
      {storyViewerIndex !== null && (
        <SocialStoryViewerModal
          stories={stories}
          initialIndex={storyViewerIndex}
          currentUser={currentUser}
          onClose={() => setStoryViewerIndex(null)}
          onStoryDeleted={() => {
            // rafraîchissement automatique via snapshot
          }}
        />
      )}

      {/* Report Modal */}
      {reportTarget && (
        <ReportUserModal
          targetUser={{
            uid: reportTarget.id,
            displayName: reportTarget.name,
            email: ''
          }}
          currentUser={currentUser}
          onClose={() => setReportTarget(null)}
        />
      )}
    </div>
  );
};
