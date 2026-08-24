import React, { useState, useEffect } from 'react';
import {
  Compass,
  BookOpen,
  Edit3,
  Building,
  Users,
  Bell,
  Search,
  Plus,
  Flame,
  Globe,
  Sparkles,
  Loader2,
  TrendingUp,
  Image as ImageIcon,
  CheckCheck,
  UserPlus,
  UserCheck,
  UserX,
  MessageSquare,
  Bookmark,
  Check
} from 'lucide-react';
import type {
  UserProfile,
  SocialPost,
  SocialStory,
  SocialPage,
  SocialNotification,
  Friendship,
  UserBlock,
  SocialViewType
} from '../types';
import { SocialPostCard } from './SocialPostCard';
import { SocialStoriesBar } from './SocialStoriesBar';
import { SocialCreatePostModal } from './SocialCreatePostModal';
import { SocialCreateStoryModal } from './SocialCreateStoryModal';
import { SocialStoryViewerModal } from './SocialStoryViewerModal';
import { SocialPagesTab } from './SocialPagesTab';
import { SocialProfileModal } from './SocialProfileModal';
import { ReportUserModal } from './ReportUserModal';
import { isBlockedEitherWay } from '../utils/moderationService';
import {
  markNotificationAsRead,
  markAllNotificationsAsRead
} from '../utils/socialService';
import {
  rtdb,
  ref,
  onValue,
  set,
  remove,
  get
} from '../firebase';

interface SocialSpaceViewProps {
  currentUser: UserProfile;
  allUsers: UserProfile[];
  friendships: Friendship[];
  allBlocks: UserBlock[];
  initialSubTab?: SocialViewType;
  onOpenDirectChat?: (targetUid: string) => void;
  onNavigateToMessageSpace?: () => void;
}

export const SocialSpaceView: React.FC<SocialSpaceViewProps> = ({
  currentUser,
  allUsers,
  friendships,
  allBlocks,
  initialSubTab = 'feed',
  onOpenDirectChat,
  onNavigateToMessageSpace
}) => {
  const [subTab, setSubTab] = useState<SocialViewType>(initialSubTab);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [stories, setStories] = useState<SocialStory[]>([]);
  const [userPages, setUserPages] = useState<SocialPage[]>([]);
  const [notifications, setNotifications] = useState<SocialNotification[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeHashtag, setActiveHashtag] = useState<string | null>(null);

  // Modals
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [storyViewerIndex, setStoryViewerIndex] = useState<number | null>(null);
  const [selectedProfileUser, setSelectedProfileUser] = useState<UserProfile | null>(null);
  const [reportTarget, setReportTarget] = useState<{ id: string; name: string } | null>(null);

  // Demandes d'amis en temps réel depuis RTDB
  const [liveFriendships, setLiveFriendships] = useState<Record<string, any>>({});

  useEffect(() => {
    const friendshipsRef = ref(rtdb, 'friendships');
    const unsub = onValue(friendshipsRef, (snapshot) => {
      if (snapshot.exists()) {
        setLiveFriendships(snapshot.val());
      } else {
        setLiveFriendships({});
      }
    });
    return () => unsub();
  }, []);

  // Déterminer amis et demandes
  const getFriendshipData = () => {
    const friendUids: string[] = [];
    const receivedRequests: string[] = [];
    const sentRequests: string[] = [];

    Object.values(liveFriendships).forEach((f: any) => {
      if (!f) return;
      if (f.status === 'accepted') {
        if (f.user1Uid === currentUser.uid || f.user1Id === currentUser.uid) {
          friendUids.push(f.user2Uid || f.user2Id);
        } else if (f.user2Uid === currentUser.uid || f.user2Id === currentUser.uid) {
          friendUids.push(f.user1Uid || f.user1Id);
        }
      } else if (f.status === 'pending') {
        if (f.receiverUid === currentUser.uid || f.targetUid === currentUser.uid) {
          receivedRequests.push(f.senderUid);
        } else if (f.senderUid === currentUser.uid) {
          sentRequests.push(f.receiverUid || f.targetUid);
        }
      }
    });

    return {
      friendUids: Array.from(new Set(friendUids)),
      receivedRequests: Array.from(new Set(receivedRequests)),
      sentRequests: Array.from(new Set(sentRequests))
    };
  };

  const { friendUids, receivedRequests, sentRequests } = getFriendshipData();

  // Écouter les posts en temps réel
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

  // Écouter les stories (non expirées)
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

  // Écouter les pages de l'utilisateur
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

  // Écouter les notifications sociales
  useEffect(() => {
    const notifsRef = ref(rtdb, `social_notifications/${currentUser.uid}`);

    const unsubscribe = onValue(notifsRef, (snapshot) => {
      const list: SocialNotification[] = [];
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          list.push(child.val() as SocialNotification);
        });
      }
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setNotifications(list);
    });

    return () => unsubscribe();
  }, [currentUser.uid]);

  const unreadNotifsCount = notifications.filter((n) => !n.isRead).length;

  // Actions d'amitié rapides
  const handleAcceptRequest = async (senderUid: string) => {
    const key1 = `${currentUser.uid}_${senderUid}`;
    const key2 = `${senderUid}_${currentUser.uid}`;
    await set(ref(rtdb, `friendships/${key1}`), {
      id: key1,
      user1Uid: currentUser.uid,
      user2Uid: senderUid,
      status: 'accepted',
      acceptedAt: Date.now()
    });
    await remove(ref(rtdb, `friendships/${key2}`)).catch(() => {});
  };

  const handleDeclineRequest = async (senderUid: string) => {
    const key1 = `${currentUser.uid}_${senderUid}`;
    const key2 = `${senderUid}_${currentUser.uid}`;
    await remove(ref(rtdb, `friendships/${key1}`));
    await remove(ref(rtdb, `friendships/${key2}`));
  };

  const handleSendFriendRequest = async (targetUid: string) => {
    const key = `${currentUser.uid}_${targetUid}`;
    await set(ref(rtdb, `friendships/${key}`), {
      id: key,
      senderUid: currentUser.uid,
      receiverUid: targetUid,
      user1Uid: currentUser.uid,
      user2Uid: targetUid,
      status: 'pending',
      createdAt: Date.now()
    });
  };

  // Filtrer les posts selon l'onglet courant et hashtags
  const getFilteredPosts = () => {
    return posts.filter((post) => {
      // 1. Filtrer bloqués
      if (isBlockedEitherWay(currentUser.uid, post.authorUid, allBlocks)) return false;

      // 2. Visibilité
      if (post.visibility === 'private' && post.authorUid !== currentUser.uid) return false;
      if (
        post.visibility === 'friends' &&
        post.authorUid !== currentUser.uid &&
        !friendUids.includes(post.authorUid)
      ) {
        return false;
      }

      // 3. Filtre de sous-onglet
      if (subTab === 'publications' && post.authorUid !== currentUser.uid) {
        return false;
      }

      // 4. Filtre par hashtag actif
      if (activeHashtag) {
        if (!post.content.toLowerCase().includes(activeHashtag.toLowerCase())) {
          return false;
        }
      }

      // 5. Filtre de recherche textuelle
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          post.content.toLowerCase().includes(q) ||
          post.authorName.toLowerCase().includes(q)
        );
      }

      return true;
    });
  };

  const filteredPosts = getFilteredPosts();

  const handleOpenUserProfile = (uid: string) => {
    const found = allUsers.find((u) => u.uid === uid);
    if (found) {
      setSelectedProfileUser(found);
    } else if (uid === currentUser.uid) {
      setSelectedProfileUser(currentUser);
    }
  };

  const handleHashtagClick = (hashtag: string) => {
    setActiveHashtag(hashtag);
    setSearchQuery(hashtag);
    setSubTab('search');
  };

  const socialNavItems: { id: SocialViewType; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }[] = [
    { id: 'feed', label: 'Actualités', icon: Compass },
    { id: 'stories', label: 'Stories', icon: BookOpen, badge: stories.length > 0 ? stories.length : undefined },
    { id: 'publications', label: 'Mes Posts', icon: Edit3 },
    { id: 'pages', label: 'Pages', icon: Building, badge: userPages.length > 0 ? userPages.length : undefined },
    { id: 'friends', label: 'Amis', icon: Users, badge: receivedRequests.length > 0 ? receivedRequests.length : undefined },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadNotifsCount > 0 ? unreadNotifsCount : undefined },
    { id: 'search', label: 'Recherche', icon: Search }
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8f9fc] dark:bg-[#121214] overflow-hidden select-none">
      {/* Sub Header / Social Navigation Bar */}
      <div className="bg-white dark:bg-[#18181b] border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3 flex-shrink-0">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto scrollbar-none py-0.5">
          {socialNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = subTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSubTab(item.id);
                  if (item.id !== 'search') {
                    setActiveHashtag(null);
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer relative flex-shrink-0 ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm scale-100'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                      isActive
                        ? 'bg-white text-indigo-700'
                        : 'bg-rose-500 text-white animate-pulse'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Create Post Action Button */}
        <button
          type="button"
          onClick={() => setShowCreatePost(true)}
          className="px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition active:scale-95 flex items-center gap-2 cursor-pointer flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Créer</span>
        </button>
      </div>

      {/* Main Content Body */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 flex justify-center gap-6">
        <div className="w-full max-w-2xl flex flex-col gap-4">
          {/* =======================================================
              SECTION 1: ACTUALITÉS (FEED)
             ======================================================= */}
          {subTab === 'feed' && (
            <>
              {/* Stories Carousel */}
              <div className="bg-white dark:bg-[#1e1e24] border border-slate-200 dark:border-slate-800 rounded-3xl p-3.5 shadow-2xs">
                <SocialStoriesBar
                  stories={stories}
                  currentUser={currentUser}
                  onOpenCreateStory={() => setShowCreateStory(true)}
                  onSelectStory={(index) => setStoryViewerIndex(index)}
                />
              </div>

              {/* Quick Publish Prompt Box */}
              <div className="bg-white dark:bg-[#1e1e24] border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-2xs flex items-center gap-3">
                <div
                  onClick={() => handleOpenUserProfile(currentUser.uid)}
                  className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm overflow-hidden flex-shrink-0 shadow-xs cursor-pointer"
                >
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
                  Quoi de neuf, {currentUser.displayName?.split(' ')[0]} ? Partagez avec la communauté...
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
                  <span className="text-xs">Chargement des actualités...</span>
                </div>
              ) : filteredPosts.length === 0 ? (
                <div className="bg-white dark:bg-[#1e1e24] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center text-slate-400 dark:text-slate-500">
                  <Compass className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="text-sm font-semibold">Aucune publication pour le moment</p>
                  <p className="text-xs mt-1">Partagez votre première publication avec vos contacts Raitra !</p>
                  <button
                    onClick={() => setShowCreatePost(true)}
                    className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition cursor-pointer"
                  >
                    Publier maintenant
                  </button>
                </div>
              ) : (
                filteredPosts.map((post) => (
                  <SocialPostCard
                    key={post.id}
                    post={post}
                    currentUser={currentUser}
                    allUsers={allUsers}
                    onOpenProfile={handleOpenUserProfile}
                    onHashtagClick={handleHashtagClick}
                    onOpenReportModal={(id, name) => setReportTarget({ id, name })}
                  />
                ))
              )}
            </>
          )}

          {/* =======================================================
              SECTION 2: STORIES DÉDIÉ
             ======================================================= */}
          {subTab === 'stories' && (
            <div className="flex flex-col gap-4">
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-3xl p-6 text-white shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold">Stories Raitra (24h)</h2>
                  <p className="text-xs text-indigo-100 mt-1 max-w-md">
                    Partagez des photos, vidéos ou pensées éphémères qui disparaissent automatiquement après 24 heures.
                  </p>
                </div>
                <button
                  onClick={() => setShowCreateStory(true)}
                  className="px-4 py-2.5 rounded-2xl bg-white text-indigo-700 hover:bg-indigo-50 font-bold text-xs shadow-md transition active:scale-95 flex items-center gap-2 cursor-pointer flex-shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Ajouter une Story</span>
                </button>
              </div>

              {stories.length === 0 ? (
                <div className="bg-white dark:bg-[#1e1e24] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center text-slate-400 dark:text-slate-500">
                  <BookOpen className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="text-sm font-semibold">Aucune story active</p>
                  <p className="text-xs mt-1">Créez votre première story visible 24 heures par vos amis !</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {stories.map((story, idx) => (
                    <div
                      key={story.id}
                      onClick={() => setStoryViewerIndex(idx)}
                      className="aspect-[9/14] rounded-3xl overflow-hidden relative cursor-pointer group shadow-xs hover:shadow-md transition"
                    >
                      {story.mediaType === 'image' && (
                        <img src={story.mediaUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                      )}
                      {story.mediaType === 'video' && (
                        <video src={story.mediaUrl} className="w-full h-full object-cover" />
                      )}
                      {story.mediaType === 'text' && (
                        <div className={`w-full h-full bg-gradient-to-br ${story.bgColor || 'from-indigo-600 to-purple-600'} p-4 flex items-center justify-center text-center text-white font-bold text-xs`}>
                          {story.textCaption}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30 p-3 flex flex-col justify-between">
                        <span className="font-semibold text-xs text-white drop-shadow-md truncate">
                          {story.authorName}
                        </span>
                        <span className="text-[10px] text-white/80">
                          {story.viewersCount || 1} vue{(story.viewersCount || 1) > 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* =======================================================
              SECTION 3: PUBLICATIONS (MES POSTS)
             ======================================================= */}
          {subTab === 'publications' && (
            <div className="flex flex-col gap-4">
              <div className="bg-white dark:bg-[#1e1e24] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-2xs flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-800 dark:text-white">Mes Publications</h2>
                  <p className="text-xs text-slate-400">Gérez l'ensemble de vos publications personnelles et statistiques.</p>
                </div>
                <button
                  onClick={() => setShowCreatePost(true)}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700 transition cursor-pointer"
                >
                  Nouvelle publication
                </button>
              </div>

              {filteredPosts.length === 0 ? (
                <div className="bg-white dark:bg-[#1e1e24] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center text-slate-400">
                  <Edit3 className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="text-sm font-semibold">Vous n'avez pas encore publié</p>
                  <p className="text-xs mt-1">Vos publications apparaîtront ici.</p>
                </div>
              ) : (
                filteredPosts.map((post) => (
                  <SocialPostCard
                    key={post.id}
                    post={post}
                    currentUser={currentUser}
                    allUsers={allUsers}
                    onOpenProfile={handleOpenUserProfile}
                    onHashtagClick={handleHashtagClick}
                    onOpenReportModal={(id, name) => setReportTarget({ id, name })}
                  />
                ))
              )}
            </div>
          )}

          {/* =======================================================
              SECTION 4: PAGES
             ======================================================= */}
          {subTab === 'pages' && (
            <SocialPagesTab
              currentUser={currentUser}
              onOpenCreatePostWithPage={() => setShowCreatePost(true)}
            />
          )}

          {/* =======================================================
              SECTION 5: AMIS & RELATIONS EN DIRECT
             ======================================================= */}
          {subTab === 'friends' && (
            <div className="flex flex-col gap-5">
              {/* Demandes reçues */}
              {receivedRequests.length > 0 && (
                <div className="bg-white dark:bg-[#1e1e24] border border-indigo-200 dark:border-indigo-900/50 rounded-3xl p-5 shadow-2xs flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-2">
                      <UserPlus className="w-4 h-4" />
                      Demandes d'amis reçues ({receivedRequests.length})
                    </h3>
                  </div>

                  <div className="flex flex-col gap-2">
                    {receivedRequests.map((uid) => {
                      const user = allUsers.find((u) => u.uid === uid);
                      if (!user) return null;
                      return (
                        <div
                          key={uid}
                          className="flex items-center justify-between p-3 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40"
                        >
                          <div
                            onClick={() => handleOpenUserProfile(uid)}
                            className="flex items-center gap-3 cursor-pointer"
                          >
                            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm overflow-hidden">
                              {user.photoURL ? (
                                <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                              ) : (
                                user.displayName.charAt(0).toUpperCase()
                              )}
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-slate-800 dark:text-white">
                                {user.displayName}
                              </h4>
                              <span className="text-[10px] text-slate-400">
                                {user.department || user.title || 'Membre Raitra'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleAcceptRequest(uid)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition cursor-pointer"
                            >
                              Accepter
                            </button>
                            <button
                              onClick={() => handleDeclineRequest(uid)}
                              className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-300 transition cursor-pointer"
                            >
                              Refuser
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Mes Amis */}
              <div className="bg-white dark:bg-[#1e1e24] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-2xs flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-slate-800 dark:text-white">Mes Ami(e)s</h2>
                    <p className="text-xs text-slate-400 mt-0.5">{friendUids.length} ami(e)s connecté(e)s</p>
                  </div>
                </div>

                {friendUids.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">
                    Vous n'avez pas encore d'amis ajoutés. Consultez les suggestions ci-dessous !
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {friendUids.map((uid) => {
                      const user = allUsers.find((u) => u.uid === uid);
                      if (!user) return null;
                      return (
                        <div
                          key={uid}
                          className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-3 flex items-center justify-between gap-2 shadow-2xs"
                        >
                          <div
                            onClick={() => handleOpenUserProfile(uid)}
                            className="flex items-center gap-2.5 min-w-0 cursor-pointer"
                          >
                            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs overflow-hidden flex-shrink-0">
                              {user.photoURL ? (
                                <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                              ) : (
                                user.displayName.charAt(0).toUpperCase()
                              )}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-bold text-xs text-slate-800 dark:text-white truncate">
                                {user.displayName}
                              </h4>
                              <span className="text-[10px] text-slate-400 block truncate">
                                {user.department || user.title || 'Ami'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {onOpenDirectChat && (
                              <button
                                onClick={() => onOpenDirectChat(uid)}
                                className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition cursor-pointer"
                                title="Message privé"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Suggestions & Tous les Membres */}
              <div className="bg-white dark:bg-[#1e1e24] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-2xs flex flex-col gap-4">
                <h2 className="text-sm font-bold text-slate-800 dark:text-white">Suggestions de Membres</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {allUsers
                    .filter((u) => u.uid !== currentUser.uid && !friendUids.includes(u.uid) && !isBlockedEitherWay(currentUser.uid, u.uid, allBlocks))
                    .map((user) => {
                      const isPendingSent = sentRequests.includes(user.uid);
                      const isPendingReceived = receivedRequests.includes(user.uid);

                      return (
                        <div
                          key={user.uid}
                          className="bg-white dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-2xs"
                        >
                          <div
                            onClick={() => handleOpenUserProfile(user.uid)}
                            className="flex items-center gap-3 min-w-0 cursor-pointer"
                          >
                            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm overflow-hidden flex-shrink-0">
                              {user.photoURL ? (
                                <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
                              ) : (
                                user.displayName?.charAt(0).toUpperCase() || 'U'
                              )}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-bold text-xs text-slate-800 dark:text-white truncate">
                                {user.displayName}
                              </h4>
                              <span className="text-[10px] text-slate-400 block truncate">
                                {user.department || user.title || 'Membre Raitra'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {isPendingSent ? (
                              <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-500 font-semibold flex items-center gap-1">
                                <Check className="w-3 h-3 text-amber-500" /> Envoyée
                              </span>
                            ) : isPendingReceived ? (
                              <button
                                onClick={() => handleAcceptRequest(user.uid)}
                                className="px-2.5 py-1 rounded-xl bg-emerald-600 text-white text-[10px] font-bold hover:bg-emerald-700 transition cursor-pointer"
                              >
                                Accepter
                              </button>
                            ) : (
                              <button
                                onClick={() => handleSendFriendRequest(user.uid)}
                                className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition cursor-pointer flex items-center gap-1"
                              >
                                <UserPlus className="w-3 h-3" />
                                <span>Ajouter</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}

          {/* =======================================================
              SECTION 6: NOTIFICATIONS SOCIALES
             ======================================================= */}
          {subTab === 'notifications' && (
            <div className="flex flex-col gap-4">
              <div className="bg-white dark:bg-[#1e1e24] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-2xs flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-800 dark:text-white">Centre de Notifications</h2>
                  <p className="text-xs text-slate-400">Réactions, commentaires, partages, mentions et amis.</p>
                </div>
                {unreadNotifsCount > 0 && (
                  <button
                    onClick={() => markAllNotificationsAsRead(currentUser.uid)}
                    className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-semibold hover:bg-indigo-100 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Tout marquer lu</span>
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <div className="bg-white dark:bg-[#1e1e24] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center text-slate-400">
                  <Bell className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="text-sm font-semibold">Aucune notification pour le moment</p>
                  <p className="text-xs mt-1">Vous serez notifié dès qu'un membre interagit avec vous.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => {
                        markNotificationAsRead(currentUser.uid, notif.id);
                        if (notif.senderUid) handleOpenUserProfile(notif.senderUid);
                      }}
                      className={`p-3.5 rounded-2xl border transition flex items-start gap-3 cursor-pointer ${
                        notif.isRead
                          ? 'bg-white dark:bg-[#1e1e24] border-slate-200 dark:border-slate-800'
                          : 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900/50 shadow-2xs'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs overflow-hidden flex-shrink-0">
                        {notif.senderPhotoURL ? (
                          <img src={notif.senderPhotoURL} alt="" className="w-full h-full object-cover" />
                        ) : (
                          notif.senderName.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-800 dark:text-slate-200 leading-snug">
                          <strong>{notif.senderName}</strong> {notif.message}
                        </p>
                        <span className="text-[10px] text-slate-400 mt-1 block">
                          {new Date(notif.createdAt).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* =======================================================
              SECTION 7: RECHERCHE SOCIALE & HASHTAGS
             ======================================================= */}
          {subTab === 'search' && (
            <div className="flex flex-col gap-4">
              <div className="bg-white dark:bg-[#1e1e24] border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-2xs flex flex-col gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (!e.target.value.startsWith('#')) {
                        setActiveHashtag(null);
                      }
                    }}
                    placeholder="Rechercher des publications, #hashtags, membres..."
                    className="w-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-800 dark:text-white outline-hidden"
                    autoFocus
                  />
                </div>

                {activeHashtag && (
                  <div className="flex items-center gap-2 text-xs text-indigo-600 font-bold px-1">
                    <span>Filtre par hashtag : {activeHashtag}</span>
                    <button
                      onClick={() => {
                        setActiveHashtag(null);
                        setSearchQuery('');
                      }}
                      className="text-[10px] text-slate-400 hover:text-rose-500 underline cursor-pointer"
                    >
                      Effacer
                    </button>
                  </div>
                )}
              </div>

              {filteredPosts.length === 0 ? (
                <div className="bg-white dark:bg-[#1e1e24] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center text-slate-400">
                  <Search className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="text-sm font-semibold">Aucun résultat trouvé</p>
                  <p className="text-xs mt-1">Essayez d'autres mots-clés ou un autre hashtag.</p>
                </div>
              ) : (
                filteredPosts.map((post) => (
                  <SocialPostCard
                    key={post.id}
                    post={post}
                    currentUser={currentUser}
                    allUsers={allUsers}
                    onOpenProfile={handleOpenUserProfile}
                    onHashtagClick={handleHashtagClick}
                    onOpenReportModal={(id, name) => setReportTarget({ id, name })}
                  />
                ))
              )}
            </div>
          )}
        </div>

        {/* Right Sidebar Widget (Desktop Only) */}
        <div className="hidden lg:flex flex-col gap-4 w-72 flex-shrink-0">
          <div className="bg-white dark:bg-[#1e1e24] border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-2xs flex flex-col gap-3">
            <div className="flex items-center gap-2 text-slate-800 dark:text-white font-bold text-xs">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              <span>Réseau Raitra Social</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center">
              <div
                onClick={() => setSubTab('friends')}
                className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 cursor-pointer hover:bg-indigo-100 transition"
              >
                <span className="font-bold text-base text-indigo-700 dark:text-indigo-300 block">
                  {friendUids.length}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">Ami(e)s</span>
              </div>
              <div
                onClick={() => setSubTab('pages')}
                className="p-2.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/40 cursor-pointer hover:bg-purple-100 transition"
              >
                <span className="font-bold text-base text-purple-700 dark:text-purple-300 block">
                  {userPages.length}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">Mes Pages</span>
              </div>
            </div>
          </div>

          {/* Switch to Raitra Message Card */}
          {onNavigateToMessageSpace && (
            <div
              onClick={onNavigateToMessageSpace}
              className="bg-gradient-to-br from-[#6264a7] to-[#404169] text-white rounded-3xl p-4 shadow-md cursor-pointer hover:shadow-lg transition group"
            >
              <span className="text-[10px] uppercase font-bold tracking-wider opacity-80 block">
                Espace Communication
              </span>
              <h4 className="font-extrabold text-sm mt-0.5 group-hover:translate-x-1 transition">
                Accéder à RAITRA MESSAGE →
              </h4>
              <p className="text-[11px] text-indigo-100 mt-1">
                Conversations privées, appels WebRTC, canaux d'équipes et fichiers.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showCreatePost && (
        <SocialCreatePostModal
          currentUser={currentUser}
          userPages={userPages}
          onClose={() => setShowCreatePost(false)}
          onPostCreated={() => {}}
        />
      )}

      {showCreateStory && (
        <SocialCreateStoryModal
          currentUser={currentUser}
          onClose={() => setShowCreateStory(false)}
          onStoryCreated={() => {}}
        />
      )}

      {storyViewerIndex !== null && (
        <SocialStoryViewerModal
          stories={stories}
          initialIndex={storyViewerIndex}
          currentUser={currentUser}
          onClose={() => setStoryViewerIndex(null)}
          onStoryDeleted={() => {}}
        />
      )}

      {selectedProfileUser && (
        <SocialProfileModal
          user={selectedProfileUser}
          currentUser={currentUser}
          onClose={() => setSelectedProfileUser(null)}
          onOpenDirectChat={onOpenDirectChat}
          onOpenReportModal={(uid, name) => setReportTarget({ id: uid, name })}
        />
      )}

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
