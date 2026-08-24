import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  UserPlus,
  UserCheck,
  UserX,
  Search,
  MessageSquare,
  Phone,
  Video,
  Clock,
  Check,
  X,
  Trash2,
  Shield,
  Mail,
  Building,
  MapPin,
  Sparkles,
  AlertCircle,
  Loader2,
  ShieldAlert,
  MoreVertical
} from 'lucide-react';
import { rtdb, ref, onValue } from '../firebase';
import type { UserProfile, Friendship, SocialRelationState, UserBlock } from '../types';
import { useI18n } from '../utils/i18n';
import {
  getFriendshipId,
  getRelationState,
  sendFriendRequest,
  acceptFriendRequest,
  declineOrCancelFriendRequest,
  removeFriend
} from '../utils/friendsService';
import { isBlockedEitherWay } from '../utils/moderationService';
import { ReportUserModal } from './ReportUserModal';
import { BlockConfirmModal } from './BlockConfirmModal';
import { soundManager } from '../utils/sound';

interface FriendsViewProps {
  currentUser: UserProfile;
  allUsers: UserProfile[];
  friendships: Friendship[];
  onOpenDirectChat: (targetUid: string) => void;
  onStartCall: (type: 'audio' | 'video', targetUid: string, targetName: string) => void;
}

export const FriendsView: React.FC<FriendsViewProps> = ({
  currentUser,
  allUsers,
  friendships,
  onOpenDirectChat,
  onStartCall
}) => {
  const { t, lang } = useI18n();
  const [activeTab, setActiveTab] = useState<'friends' | 'received' | 'sent' | 'discover'>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Moderation States
  const [allBlocks, setAllBlocks] = useState<UserBlock[]>([]);
  const [targetModUser, setTargetModUser] = useState<UserProfile | null>(null);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [openCardMenuUid, setOpenCardMenuUid] = useState<string | null>(null);

  // Écoute de tous les blocs en temps réel
  useEffect(() => {
    const blocksRef = ref(rtdb, 'blocks');
    const unsub = onValue(blocksRef, (snapshot) => {
      const list: UserBlock[] = [];
      if (snapshot.exists()) {
        snapshot.forEach((c) => {
          list.push(c.val());
        });
      }
      setAllBlocks(list);
    });
    return () => unsub();
  }, []);

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMessage({ text, type });
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  // 1. Dictionnaire rapide des relations
  const friendshipMap = useMemo(() => {
    const map = new Map<string, Friendship>();
    friendships.forEach((f) => {
      map.set(f.id, f);
    });
    return map;
  }, [friendships]);

  // 2. Amis acceptés (uniquement status === 'accepted' et non bloqués)
  const acceptedFriends = useMemo(() => {
    const friendUids = new Set<string>();
    const fIdMap = new Map<string, string>(); // friendUid -> friendshipId

    friendships.forEach((f) => {
      if (f.status === 'accepted') {
        const otherUid = f.user1Id === currentUser.uid ? f.user2Id : f.user2Id === currentUser.uid ? f.user1Id : null;
        if (otherUid && !isBlockedEitherWay(currentUser.uid, otherUid, allBlocks)) {
          friendUids.add(otherUid);
          fIdMap.set(otherUid, f.id);
        }
      }
    });

    return allUsers
      .filter((u) => u.uid !== currentUser.uid && friendUids.has(u.uid) && !isBlockedEitherWay(currentUser.uid, u.uid, allBlocks))
      .map((u) => ({
        ...u,
        friendshipId: fIdMap.get(u.uid) || ''
      }));
  }, [friendships, allUsers, currentUser.uid, allBlocks]);

  // 3. Demandes reçues en attente (exclut les expéditeurs bloqués réciproquement)
  const receivedRequests = useMemo(() => {
    return friendships
      .filter((f) => f.status === 'pending' && f.receiverId === currentUser.uid && !isBlockedEitherWay(currentUser.uid, f.senderId, allBlocks))
      .map((f) => {
        const senderProfile = allUsers.find((u) => u.uid === f.senderId);
        return {
          friendship: f,
          user: senderProfile || {
            uid: f.senderId,
            displayName: f.senderName || 'Utilisateur',
            email: '',
            status: 'offline' as const,
            userStatus: 'offline' as const
          }
        };
      });
  }, [friendships, allUsers, currentUser.uid, allBlocks]);

  // 4. Demandes envoyées en attente (exclut les destinataires bloqués réciproquement)
  const sentRequests = useMemo(() => {
    return friendships
      .filter((f) => f.status === 'pending' && f.senderId === currentUser.uid && !isBlockedEitherWay(currentUser.uid, f.receiverId, allBlocks))
      .map((f) => {
        const receiverProfile = allUsers.find((u) => u.uid === f.receiverId);
        return {
          friendship: f,
          user: receiverProfile || {
            uid: f.receiverId,
            displayName: f.receiverName || 'Utilisateur',
            email: '',
            status: 'offline' as const,
            userStatus: 'offline' as const
          }
        };
      });
  }, [friendships, allUsers, currentUser.uid, allBlocks]);

  // 5. Utilisateurs découvrables pour la recherche (RÈGLE STRICTE: Invisibilité absolue des utilisateurs bloqués réciproquement)
  const discoverableUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const otherUsers = allUsers.filter(
      (u) => u.uid !== currentUser.uid && !isBlockedEitherWay(currentUser.uid, u.uid, allBlocks)
    );

    if (!q) {
      return otherUsers;
    }

    return otherUsers.filter((u) => {
      const name = (u.displayName || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const dept = (u.department || '').toLowerCase();
      const title = (u.title || '').toLowerCase();
      return name.includes(q) || email.includes(q) || dept.includes(q) || title.includes(q);
    });
  }, [allUsers, currentUser.uid, searchQuery, allBlocks]);

  // Filtrage des amis acceptés selon recherche
  const filteredFriends = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return acceptedFriends;
    return acceptedFriends.filter((u) => {
      const name = (u.displayName || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [acceptedFriends, searchQuery]);

  // Actions
  const handleSendRequest = async (targetUser: UserProfile) => {
    try {
      setLoadingActionId(targetUser.uid);
      const res = await sendFriendRequest(currentUser, targetUser);
      soundManager.playReactionSound();
      showFeedback(res.message, 'success');
    } catch (err: any) {
      showFeedback(err.message || 'Erreur lors de l\'envoi de la demande.', 'error');
    } finally {
      setLoadingActionId(null);
    }
  };

  const handleAcceptRequest = async (friendshipId: string, senderName?: string) => {
    try {
      setLoadingActionId(friendshipId);
      await acceptFriendRequest(friendshipId, currentUser.uid, currentUser);
      soundManager.playReactionSound();
      showFeedback(`Vous êtes maintenant ami avec ${senderName || 'cet utilisateur'} !`, 'success');
    } catch (err: any) {
      showFeedback(err.message || 'Impossible d\'accepter la demande.', 'error');
    } finally {
      setLoadingActionId(null);
    }
  };

  const handleDeclineOrCancel = async (friendshipId: string, isCancel: boolean) => {
    try {
      setLoadingActionId(friendshipId);
      await declineOrCancelFriendRequest(friendshipId, currentUser.uid);
      showFeedback(isCancel ? 'Demande annulée.' : 'Demande refusée.', 'success');
    } catch (err: any) {
      showFeedback(err.message || 'Une erreur est survenue.', 'error');
    } finally {
      setLoadingActionId(null);
    }
  };

  const handleRemoveFriend = async (friendshipId: string, friendName: string) => {
    try {
      setLoadingActionId(friendshipId);
      await removeFriend(friendshipId, currentUser.uid);
      setConfirmDeleteId(null);
      showFeedback(`${friendName} a été retiré de vos amis.`, 'success');
    } catch (err: any) {
      showFeedback(err.message || 'Impossible de retirer cet ami.', 'error');
    } finally {
      setLoadingActionId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden select-none">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-[#6264a7] dark:text-indigo-400 flex items-center justify-center font-bold">
                <Users className="w-4 h-4" />
              </div>
              <h1 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white">
                {lang === 'mg' ? 'Fifandraisana & Mpinamana' : lang === 'en' ? 'Friends & Connections' : 'Amis & Relations'}
              </h1>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1">
              {lang === 'mg'
                ? 'Mitadiava mpiara-miasa, mandefasa fangatahana ary mifandraisa amin’ireo namana nekena.'
                : lang === 'en'
                ? 'Discover colleagues, send connection requests, and interact only with accepted friends.'
                : 'Découvrez des collègues, gérez vos demandes d\'amitié et échangez avec vos contacts validés.'}
            </p>
          </div>

          {/* Feedback banner */}
          {feedbackMessage && (
            <div
              className={`px-3 py-1.5 sm:py-2 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in ${
                feedbackMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
              }`}
            >
              {feedbackMessage.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span>{feedbackMessage.text}</span>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mt-4 sm:mt-5 border-b border-slate-200 dark:border-slate-700/60 overflow-x-auto no-scrollbar">
          {[
            {
              id: 'friends',
              label: lang === 'mg' ? 'Mpinamana' : lang === 'en' ? 'My Friends' : 'Mes Amis',
              icon: UserCheck,
              count: acceptedFriends.length
            },
            {
              id: 'received',
              label: lang === 'mg' ? 'Fangatahana voaray' : lang === 'en' ? 'Received Requests' : 'Demandes Reçues',
              icon: Users,
              count: receivedRequests.length,
              highlight: receivedRequests.length > 0
            },
            {
              id: 'sent',
              label: lang === 'mg' ? 'Fangatahana nalefa' : lang === 'en' ? 'Sent Requests' : 'Demandes Envoyées',
              icon: Clock,
              count: sentRequests.length
            },
            {
              id: 'discover',
              label: lang === 'mg' ? 'Hitady olona' : lang === 'en' ? 'Find Users' : 'Rechercher des utilisateurs',
              icon: UserPlus
            }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition cursor-pointer border-b-2 whitespace-nowrap ${
                  isActive
                    ? 'border-[#6264a7] text-[#6264a7] dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      tab.highlight
                        ? 'bg-rose-500 text-white animate-pulse'
                        : isActive
                        ? 'bg-[#6264a7] text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
        {/* Search Bar */}
        <div className="max-w-md relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === 'discover'
                ? 'Rechercher par nom, email ou département...'
                : 'Filtrer dans la liste...'
            }
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#6264a7] transition shadow-xs"
          />
        </div>

        {/* TAB 1: MES AMIS */}
        {activeTab === 'friends' && (
          <div>
            {filteredFriends.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-8">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-[#6264a7] dark:text-indigo-400 flex items-center justify-center mb-3">
                  <UserCheck className="w-7 h-7" />
                </div>
                <h3 className="font-bold text-sm text-slate-800 dark:text-white">
                  {searchQuery ? 'Aucun ami trouvé pour cette recherche.' : 'Vous n\'avez pas encore d\'amis acceptés.'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
                  Recherchez des utilisateurs dans l'annuaire et envoyez-leur une demande pour démarrer des échanges directs.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('discover')}
                  className="mt-4 px-4 py-2 bg-[#6264a7] hover:bg-[#525494] text-white text-xs font-bold rounded-xl transition cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Trouver des utilisateurs</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredFriends.map((friend) => (
                  <div
                    key={friend.uid}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-xs hover:shadow-md transition flex flex-col justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative">
                        {friend.photoURL ? (
                          <img
                            src={friend.photoURL}
                            alt={friend.displayName}
                            className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#6264a7] to-[#4e508a] text-white font-bold flex items-center justify-center text-base">
                            {(friend.displayName || friend.email || 'A').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span
                          className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-800 ${
                            friend.status === 'online' ? 'bg-emerald-500' : 'bg-slate-400'
                          }`}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-bold text-xs text-slate-800 dark:text-white truncate">
                            {friend.displayName || 'Utilisateur'}
                          </h4>
                          <span className="px-1.5 py-0.2 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 text-[10px] font-bold">
                            Ami
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{friend.email}</p>
                        {friend.department && (
                          <p className="text-[10px] text-indigo-500 font-medium truncate mt-0.5">
                            {friend.department} {friend.title ? `• ${friend.title}` : ''}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions bar */}
                    <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700/60 pt-3 mt-4">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onOpenDirectChat(friend.uid)}
                          title="Envoyer un message"
                          className="px-2.5 py-1.5 bg-[#6264a7]/10 hover:bg-[#6264a7] text-[#6264a7] hover:text-white dark:bg-indigo-950/50 dark:hover:bg-indigo-600 dark:text-indigo-300 dark:hover:text-white text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Chat</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onStartCall('audio', friend.uid, friend.displayName)}
                          title="Appel Audio"
                          className="p-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-[#6264a7] dark:hover:text-indigo-400 rounded-lg transition cursor-pointer"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onStartCall('video', friend.uid, friend.displayName)}
                          title="Appel Vidéo"
                          className="p-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-[#6264a7] dark:hover:text-indigo-400 rounded-lg transition cursor-pointer"
                        >
                          <Video className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {confirmDeleteId === friend.friendshipId ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleRemoveFriend(friend.friendshipId, friend.displayName)}
                            disabled={loadingActionId === friend.friendshipId}
                            className="px-2 py-1 bg-rose-600 text-white text-[10px] font-bold rounded-md hover:bg-rose-700 transition cursor-pointer"
                          >
                            Retirer
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="p-1 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md text-[10px]"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(friend.friendshipId)}
                            title="Retirer de mes amis"
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setOpenCardMenuUid(openCardMenuUid === friend.uid ? null : friend.uid)}
                              title="Options de modération"
                              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>
                            {openCardMenuUid === friend.uid && (
                              <div className="absolute right-0 bottom-full mb-1 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1 z-30 text-xs animate-in zoom-in-95 duration-100">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenCardMenuUid(null);
                                    setTargetModUser(friend);
                                    setIsReportModalOpen(true);
                                  }}
                                  className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                                >
                                  <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                                  <span>Signaler le profil</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenCardMenuUid(null);
                                    setTargetModUser(friend);
                                    setIsBlockModalOpen(true);
                                  }}
                                  className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 cursor-pointer border-t border-slate-100 dark:border-slate-700/60"
                                >
                                  <UserX className="w-3.5 h-3.5" />
                                  <span>Bloquer l'utilisateur</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: DEMANDES REÇUES */}
        {activeTab === 'received' && (
          <div>
            {receivedRequests.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-8">
                <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <h3 className="font-bold text-sm text-slate-800 dark:text-white">Aucune demande en attente</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Les demandes d'amitié que d'autres utilisateurs vous envoient apparaîtront ici.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {receivedRequests.map(({ friendship, user }) => (
                  <div
                    key={friendship.id}
                    className="bg-white dark:bg-slate-800 border-2 border-indigo-200 dark:border-indigo-900/60 rounded-2xl p-4 shadow-sm flex flex-col justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold flex items-center justify-center text-base">
                        {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-xs text-slate-800 dark:text-white truncate">
                          {user.displayName || 'Utilisateur'}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                        <p className="text-[10px] text-indigo-500 font-medium mt-1">
                          Souhaite vous ajouter à ses amis
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60">
                      <button
                        type="button"
                        onClick={() => handleAcceptRequest(friendship.id, user.displayName)}
                        disabled={loadingActionId === friendship.id}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                      >
                        {loadingActionId === friendship.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span>Accepter</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeclineOrCancel(friendship.id, false)}
                        disabled={loadingActionId === friendship.id}
                        className="flex-1 py-2 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 dark:bg-slate-700 dark:hover:bg-rose-950/40 dark:text-slate-200 dark:hover:text-rose-300 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Refuser</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: DEMANDES ENVOYÉES */}
        {activeTab === 'sent' && (
          <div>
            {sentRequests.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-8">
                <Clock className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <h3 className="font-bold text-sm text-slate-800 dark:text-white">Aucune demande envoyée</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Vos demandes en attente de réponse de la part des destinataires s'afficheront ici.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {sentRequests.map(({ friendship, user }) => (
                  <div
                    key={friendship.id}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-xs flex flex-col justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold flex items-center justify-center text-base">
                        {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-xs text-slate-800 dark:text-white truncate">
                          {user.displayName || 'Utilisateur'}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-1">
                          <Clock className="w-3 h-3" />
                          <span>En attente de réponse</span>
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleDeclineOrCancel(friendship.id, true)}
                        disabled={loadingActionId === friendship.id}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 dark:bg-slate-700 dark:hover:bg-rose-950/40 dark:text-slate-300 text-xs font-semibold rounded-xl transition cursor-pointer flex items-center gap-1.5"
                      >
                        {loadingActionId === friendship.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <X className="w-3.5 h-3.5" />
                        )}
                        <span>Annuler la demande</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: RECHERCHER DES UTILISATEURS */}
        {activeTab === 'discover' && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {discoverableUsers.map((target) => {
                const fId = getFriendshipId(currentUser.uid, target.uid);
                const friendship = friendshipMap.get(fId);
                const relation = getRelationState(friendship, currentUser.uid, target.uid);

                return (
                  <div
                    key={target.uid}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-xs flex flex-col justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#6264a7] to-[#4e508a] text-white font-bold flex items-center justify-center text-base">
                        {(target.displayName || target.email || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-xs text-slate-800 dark:text-white truncate">
                          {target.displayName || 'Utilisateur'}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{target.email}</p>
                        {target.department && (
                          <p className="text-[10px] text-indigo-500 font-medium truncate mt-0.5">
                            {target.department}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-2">
                      {relation === 'accepted' ? (
                        <div className="flex items-center justify-between w-full">
                          <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-lg flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            <span>Amis</span>
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onOpenDirectChat(target.uid)}
                              className="px-3 py-1.5 bg-[#6264a7] text-white text-xs font-bold rounded-lg hover:bg-[#525494] transition cursor-pointer"
                            >
                              Discuter
                            </button>
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setOpenCardMenuUid(openCardMenuUid === target.uid ? null : target.uid)}
                                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </button>
                              {openCardMenuUid === target.uid && (
                                <div className="absolute right-0 bottom-full mb-1 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1 z-30 text-xs animate-in zoom-in-95 duration-100">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenCardMenuUid(null);
                                      setTargetModUser(target);
                                      setIsReportModalOpen(true);
                                    }}
                                    className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                                  >
                                    <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                                    <span>Signaler le profil</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenCardMenuUid(null);
                                      setTargetModUser(target);
                                      setIsBlockModalOpen(true);
                                    }}
                                    className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 cursor-pointer border-t border-slate-100 dark:border-slate-700/60"
                                  >
                                    <UserX className="w-3.5 h-3.5" />
                                    <span>Bloquer l'utilisateur</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : relation === 'pending_sent' ? (
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Demande envoyée</span>
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDeclineOrCancel(fId, true)}
                              disabled={loadingActionId === fId}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 dark:bg-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg transition cursor-pointer"
                            >
                              Annuler
                            </button>
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setOpenCardMenuUid(openCardMenuUid === target.uid ? null : target.uid)}
                                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </button>
                              {openCardMenuUid === target.uid && (
                                <div className="absolute right-0 bottom-full mb-1 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1 z-30 text-xs animate-in zoom-in-95 duration-100">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenCardMenuUid(null);
                                      setTargetModUser(target);
                                      setIsReportModalOpen(true);
                                    }}
                                    className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                                  >
                                    <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                                    <span>Signaler le profil</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenCardMenuUid(null);
                                      setTargetModUser(target);
                                      setIsBlockModalOpen(true);
                                    }}
                                    className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 cursor-pointer border-t border-slate-100 dark:border-slate-700/60"
                                  >
                                    <UserX className="w-3.5 h-3.5" />
                                    <span>Bloquer l'utilisateur</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : relation === 'pending_received' ? (
                        <div className="flex items-center justify-between w-full gap-2">
                          <button
                            type="button"
                            onClick={() => handleAcceptRequest(fId, target.displayName)}
                            disabled={loadingActionId === fId}
                            className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Accepter</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeclineOrCancel(fId, false)}
                            disabled={loadingActionId === fId}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 dark:bg-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg transition cursor-pointer"
                          >
                            Refuser
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 w-full">
                          <button
                            type="button"
                            onClick={() => handleSendRequest(target)}
                            disabled={loadingActionId === target.uid}
                            className="flex-1 py-1.5 bg-[#6264a7] hover:bg-[#525494] text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                          >
                            {loadingActionId === target.uid ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <UserPlus className="w-3.5 h-3.5" />
                            )}
                            <span>Ajouter en ami</span>
                          </button>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setOpenCardMenuUid(openCardMenuUid === target.uid ? null : target.uid)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>
                            {openCardMenuUid === target.uid && (
                              <div className="absolute right-0 bottom-full mb-1 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1 z-30 text-xs animate-in zoom-in-95 duration-100">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenCardMenuUid(null);
                                    setTargetModUser(target);
                                    setIsReportModalOpen(true);
                                  }}
                                  className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                                >
                                  <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                                  <span>Signaler le profil</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenCardMenuUid(null);
                                    setTargetModUser(target);
                                    setIsBlockModalOpen(true);
                                  }}
                                  className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 cursor-pointer border-t border-slate-100 dark:border-slate-700/60"
                                >
                                  <UserX className="w-3.5 h-3.5" />
                                  <span>Bloquer l'utilisateur</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* -------------------- BLOCK CONFIRMATION MODAL -------------------- */}
      {targetModUser && (
        <BlockConfirmModal
          isOpen={isBlockModalOpen}
          targetUser={targetModUser}
          onClose={() => {
            setIsBlockModalOpen(false);
            setTargetModUser(null);
          }}
          onConfirmSuccess={() => {
            showFeedback(`${targetModUser.displayName} a été bloqué avec succès.`, 'success');
            setTargetModUser(null);
          }}
          currentUser={currentUser}
        />
      )}

      {/* -------------------- REPORT USER MODAL -------------------- */}
      {targetModUser && (
        <ReportUserModal
          isOpen={isReportModalOpen}
          targetUser={targetModUser}
          onClose={() => {
            setIsReportModalOpen(false);
            setTargetModUser(null);
          }}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};
