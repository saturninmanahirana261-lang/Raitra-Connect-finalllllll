import React, { useState, useEffect } from 'react';
import {
  X,
  UserPlus,
  UserCheck,
  UserX,
  MessageSquare,
  ShieldAlert,
  Calendar,
  Briefcase,
  Building,
  Image as ImageIcon,
  BookOpen,
  Grid,
  Check,
  Loader2
} from 'lucide-react';
import type { UserProfile, SocialPost, SocialStory } from '../types';
import { rtdb, ref, onValue, get, set, remove } from '../firebase';
import { SocialPostCard } from './SocialPostCard';
import { MediaLightboxModal } from './MediaLightboxModal';

interface SocialProfileModalProps {
  user: UserProfile;
  currentUser: UserProfile;
  onClose: () => void;
  onOpenDirectChat?: (uid: string) => void;
  onOpenReportModal?: (uid: string, name: string) => void;
}

export const SocialProfileModal: React.FC<SocialProfileModalProps> = ({
  user,
  currentUser,
  onClose,
  onOpenDirectChat,
  onOpenReportModal
}) => {
  const [activeTab, setActiveTab] = useState<'posts' | 'photos' | 'about'>('posts');
  const [userPosts, setUserPosts] = useState<SocialPost[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [friendshipStatus, setFriendshipStatus] = useState<'none' | 'pending_sent' | 'pending_received' | 'friends'>('none');
  const [friendsCount, setFriendsCount] = useState<number>(0);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [lightboxMedia, setLightboxMedia] = useState<{ url: string; type: 'image' | 'video'; name: string }[] | null>(null);

  const isSelf = user.uid === currentUser.uid;

  // Charger les publications de cet utilisateur
  useEffect(() => {
    const postsRef = ref(rtdb, 'social_posts');
    const unsubscribe = onValue(postsRef, (snapshot) => {
      const list: SocialPost[] = [];
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          const post = child.val() as SocialPost;
          if (post.authorUid === user.uid) {
            // Filtrage visibilité
            if (post.visibility === 'public') {
              list.push(post);
            } else if (post.visibility === 'friends' && (isSelf || friendshipStatus === 'friends')) {
              list.push(post);
            } else if (post.visibility === 'private' && isSelf) {
              list.push(post);
            }
          }
        });
      }
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setUserPosts(list);
      setIsLoadingPosts(false);
    });

    return () => unsubscribe();
  }, [user.uid, isSelf, friendshipStatus]);

  // Écouter le statut d'amitié
  useEffect(() => {
    if (isSelf) return;

    const friendshipKey1 = `${currentUser.uid}_${user.uid}`;
    const friendshipKey2 = `${user.uid}_${currentUser.uid}`;

    const ref1 = ref(rtdb, `friendships/${friendshipKey1}`);
    const ref2 = ref(rtdb, `friendships/${friendshipKey2}`);

    const unsub1 = onValue(ref1, (snap1) => {
      if (snap1.exists()) {
        const data = snap1.val();
        if (data.status === 'accepted') {
          setFriendshipStatus('friends');
        } else if (data.status === 'pending') {
          setFriendshipStatus(data.senderUid === currentUser.uid ? 'pending_sent' : 'pending_received');
        }
      } else {
        // Vérifier clé 2
        get(ref2).then((snap2) => {
          if (snap2.exists()) {
            const data2 = snap2.val();
            if (data2.status === 'accepted') {
              setFriendshipStatus('friends');
            } else if (data2.status === 'pending') {
              setFriendshipStatus(data2.senderUid === currentUser.uid ? 'pending_sent' : 'pending_received');
            }
          } else {
            setFriendshipStatus('none');
          }
        });
      }
    });

    return () => unsub1();
  }, [user.uid, currentUser.uid, isSelf]);

  // Compter les amis de cet utilisateur
  useEffect(() => {
    const friendsRef = ref(rtdb, 'friendships');
    const unsub = onValue(friendsRef, (snapshot) => {
      let count = 0;
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          const val = child.val();
          if (val.status === 'accepted' && (val.user1Uid === user.uid || val.user2Uid === user.uid || child.key?.includes(user.uid))) {
            count++;
          }
        });
      }
      setFriendsCount(count);
    });

    return () => unsub();
  }, [user.uid]);

  // Actions d'amitié
  const handleSendFriendRequest = async () => {
    setIsActionLoading(true);
    try {
      const friendshipKey = `${currentUser.uid}_${user.uid}`;
      await set(ref(rtdb, `friendships/${friendshipKey}`), {
        id: friendshipKey,
        senderUid: currentUser.uid,
        receiverUid: user.uid,
        user1Uid: currentUser.uid,
        user2Uid: user.uid,
        status: 'pending',
        createdAt: Date.now()
      });

      // Notification
      const notifRef = ref(rtdb, `social_notifications/${user.uid}/${Date.now()}`);
      await set(notifRef, {
        id: `${Date.now()}`,
        recipientUid: user.uid,
        senderUid: currentUser.uid,
        senderName: currentUser.displayName,
        senderPhotoURL: currentUser.photoURL || '',
        type: 'friend_request',
        targetId: currentUser.uid,
        message: "vous a envoyé une demande d'ami.",
        isRead: false,
        createdAt: Date.now()
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleAcceptFriendRequest = async () => {
    setIsActionLoading(true);
    try {
      const friendshipKey1 = `${currentUser.uid}_${user.uid}`;
      const friendshipKey2 = `${user.uid}_${currentUser.uid}`;

      await set(ref(rtdb, `friendships/${friendshipKey1}`), {
        id: friendshipKey1,
        user1Uid: currentUser.uid,
        user2Uid: user.uid,
        status: 'accepted',
        acceptedAt: Date.now()
      });

      // Nettoyer clé 2 au cas où
      await remove(ref(rtdb, `friendships/${friendshipKey2}`)).catch(() => {});

      // Notification acceptation
      const notifRef = ref(rtdb, `social_notifications/${user.uid}/${Date.now()}`);
      await set(notifRef, {
        id: `${Date.now()}`,
        recipientUid: user.uid,
        senderUid: currentUser.uid,
        senderName: currentUser.displayName,
        senderPhotoURL: currentUser.photoURL || '',
        type: 'friend_accept',
        targetId: currentUser.uid,
        message: "a accepté votre demande d'ami.",
        isRead: false,
        createdAt: Date.now()
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRemoveFriend = async () => {
    if (!window.confirm(`Retirer ${user.displayName} de vos amis ?`)) return;
    setIsActionLoading(true);
    try {
      const friendshipKey1 = `${currentUser.uid}_${user.uid}`;
      const friendshipKey2 = `${user.uid}_${currentUser.uid}`;
      await remove(ref(rtdb, `friendships/${friendshipKey1}`));
      await remove(ref(rtdb, `friendships/${friendshipKey2}`));
      setFriendshipStatus('none');
    } catch (e) {
      console.error(e);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Récupérer toutes les photos publiées
  const allPhotos = userPosts.flatMap((p) => p.media || []).filter((m) => m.type === 'image');

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-2 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Bar */}
        <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
            Profil Raitra Social
          </span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto">
          {/* Cover & Avatar Header */}
          <div className="relative">
            {/* Banner */}
            <div className="h-36 sm:h-44 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 w-full overflow-hidden relative">
              <div className="absolute inset-0 bg-black/20" />
            </div>

            {/* Profile Avatar & Actions */}
            <div className="px-5 sm:px-6 pb-4 pt-0 relative flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3 -mt-12 sm:-mt-14">
              <div className="flex items-end gap-3.5">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-indigo-600 border-4 border-white dark:border-[#18181b] text-white flex items-center justify-center font-extrabold text-3xl overflow-hidden shadow-xl flex-shrink-0">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
                  ) : (
                    user.displayName?.charAt(0).toUpperCase() || 'U'
                  )}
                </div>

                <div className="mb-1">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                    {user.displayName}
                  </h2>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">
                    {user.title || user.department || 'Membre Raitra Connect'}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0 flex-wrap">
                {!isSelf && (
                  <>
                    {friendshipStatus === 'none' && (
                      <button
                        onClick={handleSendFriendRequest}
                        disabled={isActionLoading}
                        className="px-3.5 py-2 rounded-2xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition flex items-center gap-1.5 shadow-sm active:scale-95"
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>Ajouter en ami</span>
                      </button>
                    )}

                    {friendshipStatus === 'pending_sent' && (
                      <button
                        onClick={handleRemoveFriend}
                        disabled={isActionLoading}
                        className="px-3.5 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 transition flex items-center gap-1.5"
                      >
                        <Check className="w-4 h-4 text-amber-500" />
                        <span>Demande envoyée</span>
                      </button>
                    )}

                    {friendshipStatus === 'pending_received' && (
                      <button
                        onClick={handleAcceptFriendRequest}
                        disabled={isActionLoading}
                        className="px-3.5 py-2 rounded-2xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition flex items-center gap-1.5 shadow-sm"
                      >
                        <UserCheck className="w-4 h-4" />
                        <span>Accepter la demande</span>
                      </button>
                    )}

                    {friendshipStatus === 'friends' && (
                      <button
                        onClick={handleRemoveFriend}
                        disabled={isActionLoading}
                        className="px-3.5 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 transition flex items-center gap-1.5"
                      >
                        <UserCheck className="w-4 h-4 text-indigo-600" />
                        <span>Amis ✓</span>
                      </button>
                    )}

                    {onOpenDirectChat && (
                      <button
                        onClick={() => {
                          onClose();
                          onOpenDirectChat(user.uid);
                        }}
                        className="px-3.5 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition flex items-center gap-1.5"
                      >
                        <MessageSquare className="w-4 h-4 text-indigo-600" />
                        <span>Message</span>
                      </button>
                    )}

                    {onOpenReportModal && (
                      <button
                        onClick={() => {
                          onClose();
                          onOpenReportModal(user.uid, user.displayName);
                        }}
                        className="p-2 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-amber-500 transition"
                        title="Signaler le profil"
                      >
                        <ShieldAlert className="w-4 h-4" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="px-5 sm:px-6 py-2 border-y border-slate-100 dark:border-slate-800 flex items-center gap-6 text-xs text-slate-600 dark:text-slate-400">
              <div>
                <strong className="text-slate-900 dark:text-white">{userPosts.length}</strong> publication{userPosts.length > 1 ? 's' : ''}
              </div>
              <div>
                <strong className="text-slate-900 dark:text-white">{friendsCount}</strong> ami{friendsCount > 1 ? 's' : ''}
              </div>
              <div>
                <strong className="text-slate-900 dark:text-white">{allPhotos.length}</strong> photo{allPhotos.length > 1 ? 's' : ''}
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="px-5 sm:px-6 pt-3 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setActiveTab('posts')}
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition ${
                  activeTab === 'posts'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Publications ({userPosts.length})
              </button>

              <button
                onClick={() => setActiveTab('photos')}
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition ${
                  activeTab === 'photos'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Photos ({allPhotos.length})
              </button>

              <button
                onClick={() => setActiveTab('about')}
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition ${
                  activeTab === 'about'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                À propos
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-4 sm:p-6 bg-slate-50 dark:bg-[#141416] min-h-[250px]">
            {/* 1. Posts Tab */}
            {activeTab === 'posts' && (
              <div className="flex flex-col gap-4">
                {isLoadingPosts ? (
                  <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                    <span className="text-xs">Chargement des publications...</span>
                  </div>
                ) : userPosts.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-xs">
                    Aucune publication visible pour le moment.
                  </div>
                ) : (
                  userPosts.map((post) => (
                    <SocialPostCard
                      key={post.id}
                      post={post}
                      currentUser={currentUser}
                      onOpenReportModal={onOpenReportModal}
                    />
                  ))
                )}
              </div>
            )}

            {/* 2. Photos Tab */}
            {activeTab === 'photos' && (
              <div>
                {allPhotos.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-xs">
                    Aucune photo partagée.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {allPhotos.map((photo, idx) => (
                      <div
                        key={idx}
                        onClick={() =>
                          setLightboxMedia(
                            allPhotos.map((p) => ({ url: p.url, type: 'image', name: 'Photo' }))
                          )
                        }
                        className="aspect-square rounded-2xl overflow-hidden bg-slate-900 cursor-pointer group shadow-sm"
                      >
                        <img
                          src={photo.url}
                          alt=""
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 3. About Tab */}
            {activeTab === 'about' && (
              <div className="bg-white dark:bg-[#1e1e24] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-2xs flex flex-col gap-4">
                <div>
                  <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Bio</h4>
                  <p className="text-sm text-slate-800 dark:text-slate-200 mt-1">
                    {user.statusMessage || user.department || "Aucune biographie renseignée pour l'instant."}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-indigo-600" />
                    <span>Département : {user.department || 'Non spécifié'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-indigo-600" />
                    <span>Titre : {user.title || 'Collaborateur'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-600" />
                    <span>Membre actif sur Raitra Connect</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {lightboxMedia && (
        <MediaLightboxModal
          mediaList={lightboxMedia}
          onClose={() => setLightboxMedia(null)}
        />
      )}
    </div>
  );
};
