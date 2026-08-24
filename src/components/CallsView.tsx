import React, { useState, useEffect } from 'react';
import {
  Phone,
  Video,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Clock,
  Trash2,
  Search,
  MessageSquare,
  UserCheck,
  Calendar,
  Sparkles,
  PhoneCall
} from 'lucide-react';
import { rtdb, ref, onValue, remove, set, push } from '../firebase';
import type { UserProfile, CallHistoryItem, Friendship } from '../types';

interface CallsViewProps {
  currentUser: UserProfile;
  onStartCall: (type: 'audio' | 'video', targetUid: string, targetName: string) => void;
  onNavigateToChat?: (userUid?: string) => void;
}

export const CallsView: React.FC<CallsViewProps> = ({
  currentUser,
  onStartCall,
  onNavigateToChat
}) => {
  const [callHistory, setCallHistory] = useState<CallHistoryItem[]>([]);
  const [contacts, setContacts] = useState<UserProfile[]>([]);
  const [filter, setFilter] = useState<'all' | 'missed' | 'incoming' | 'outgoing'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [quickCallQuery, setQuickCallQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // 1. Fetch Call History from RTDB
  useEffect(() => {
    if (!currentUser?.uid) return;
    const historyRef = ref(rtdb, `callHistory/${currentUser.uid}`);
    const unsubscribe = onValue(historyRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const list: CallHistoryItem[] = Object.keys(data).map((key) => ({
          id: key,
          ...data[key]
        }));
        // Sort newest first
        list.sort((a, b) => b.timestamp - a.timestamp);
        setCallHistory(list);
      } else {
        setCallHistory([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser?.uid]);

  // 2. Fetch Contacts for Quick Call — ONLY ACCEPTED FRIENDS
  useEffect(() => {
    if (!currentUser?.uid) return;
    let allUsersMap: Record<string, UserProfile> = {};
    let acceptedFriendUids = new Set<string>();

    const updateFilteredFriends = () => {
      const list = Object.keys(allUsersMap)
        .filter((uid) => uid !== currentUser.uid && acceptedFriendUids.has(uid))
        .map((uid) => allUsersMap[uid]);
      setContacts(list);
    };

    const usersRef = ref(rtdb, 'users');
    const unsubUsers = onValue(usersRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        allUsersMap = {};
        Object.keys(data).forEach((uid) => {
          allUsersMap[uid] = { uid, ...data[uid] };
        });
        updateFilteredFriends();
      }
    });

    const friendshipsRef = ref(rtdb, 'friendships');
    const unsubFriendships = onValue(friendshipsRef, (snapshot) => {
      acceptedFriendUids = new Set<string>();
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          const f: Friendship = child.val();
          if (f.status === 'accepted') {
            if (f.user1Id === currentUser.uid) acceptedFriendUids.add(f.user2Id);
            if (f.user2Id === currentUser.uid) acceptedFriendUids.add(f.user1Id);
          }
        });
      }
      updateFilteredFriends();
    });

    return () => {
      unsubUsers();
      unsubFriendships();
    };
  }, [currentUser?.uid]);

  // Delete specific history record
  const handleDeleteItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await remove(ref(rtdb, `callHistory/${currentUser.uid}/${id}`));
    } catch (err) {
      console.warn('Error deleting history item:', err);
    }
  };

  // Clear all history
  const handleClearAll = async () => {
    if (!window.confirm('Voulez-vous vraiment effacer tout votre historique d\'appels ?')) {
      return;
    }
    try {
      await remove(ref(rtdb, `callHistory/${currentUser.uid}`));
    } catch (err) {
      console.warn('Error clearing history:', err);
    }
  };

  // Filter calls
  const filteredCalls = callHistory.filter((item) => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'missed' && (item.direction === 'missed' || item.status === 'missed' || item.status === 'rejected')) ||
      (filter === 'incoming' && item.direction === 'incoming' && item.status !== 'missed') ||
      (filter === 'outgoing' && item.direction === 'outgoing');

    const matchesSearch =
      item.partnerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.type.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  // Filtered contacts for quick dialer
  const filteredContacts = contacts.filter((c) =>
    c.displayName?.toLowerCase().includes(quickCallQuery.toLowerCase()) ||
    c.email?.toLowerCase().includes(quickCallQuery.toLowerCase())
  );

  // Statistics
  const totalCalls = callHistory.length;
  const missedCount = callHistory.filter(
    (c) => c.direction === 'missed' || c.status === 'missed' || c.status === 'rejected'
  ).length;
  const totalSeconds = callHistory.reduce((acc, curr) => acc + (curr.durationSeconds || 0), 0);

  const formatTotalTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const hours = Math.floor(mins / 60);
    if (hours > 0) {
      return `${hours}h ${mins % 60}m`;
    }
    return `${mins}m ${seconds % 60}s`;
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds <= 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatCallDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) {
      return `Aujourd'hui à ${timeStr}`;
    }

    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return `Hier à ${timeStr}`;
    }

    return `${date.toLocaleDateString([], { day: '2-digit', month: 'short' })} à ${timeStr}`;
  };

  return (
    <div className="h-full flex flex-col lg:flex-row overflow-hidden bg-slate-50 dark:bg-[#1f1f1f] text-slate-800 dark:text-slate-200">
      {/* Main Call History List */}
      <div className="flex-1 flex flex-col min-w-0 h-full border-r border-slate-200 dark:border-white/10">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-[#252525] flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                <PhoneCall className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  Historique des Appels
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-semibold">
                    {totalCalls}
                  </span>
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Visualisez vos appels récents, manqués et sortants
                </p>
              </div>
            </div>

            {callHistory.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                title="Effacer tout l'historique"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Effacer tout</span>
              </button>
            )}
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1e1e1e] border border-slate-200/80 dark:border-white/5 flex items-center justify-between">
              <div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Total Appels</div>
                <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5">{totalCalls}</div>
              </div>
              <Phone className="w-4 h-4 text-indigo-500" />
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1e1e1e] border border-slate-200/80 dark:border-white/5 flex items-center justify-between">
              <div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Appels Manqués</div>
                <div className={`text-base font-bold mt-0.5 ${missedCount > 0 ? 'text-rose-500' : 'text-slate-900 dark:text-white'}`}>
                  {missedCount}
                </div>
              </div>
              <PhoneMissed className={`w-4 h-4 ${missedCount > 0 ? 'text-rose-500' : 'text-slate-400'}`} />
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1e1e1e] border border-slate-200/80 dark:border-white/5 flex items-center justify-between">
              <div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Temps Total</div>
                <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5">{formatTotalTime(totalSeconds)}</div>
              </div>
              <Clock className="w-4 h-4 text-emerald-500" />
            </div>
          </div>

          {/* Filter Pills & Search */}
          <div className="flex flex-col sm:flex-row items-center gap-3 justify-between">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-[#1a1a1a] rounded-xl w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  filter === 'all'
                    ? 'bg-white dark:bg-[#2b2b2b] text-indigo-600 dark:text-indigo-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Tous ({totalCalls})
              </button>
              <button
                type="button"
                onClick={() => setFilter('missed')}
                className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  filter === 'missed'
                    ? 'bg-white dark:bg-[#2b2b2b] text-rose-600 dark:text-rose-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Manqués ({missedCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter('incoming')}
                className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  filter === 'incoming'
                    ? 'bg-white dark:bg-[#2b2b2b] text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Entrants
              </button>
              <button
                type="button"
                onClick={() => setFilter('outgoing')}
                className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  filter === 'outgoing'
                    ? 'bg-white dark:bg-[#2b2b2b] text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Sortants
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher un contact..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-100 dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* History List Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-16 rounded-2xl bg-white dark:bg-[#252525] border border-slate-200/80 dark:border-white/5 animate-pulse"
                />
              ))}
            </div>
          ) : filteredCalls.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-white dark:bg-[#252525] rounded-2xl border border-slate-200/80 dark:border-white/5">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 flex items-center justify-center mb-3">
                <Phone className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Aucun appel dans l'historique</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                {searchQuery
                  ? "Aucun résultat ne correspond à votre recherche."
                  : "Vos appels passés, entrants et manqués s'afficheront ici automatiquement."}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredCalls.map((item) => {
                const isMissed =
                  item.direction === 'missed' ||
                  item.status === 'missed' ||
                  item.status === 'rejected';
                const isOutgoing = item.direction === 'outgoing';
                const isVideo = item.type === 'video';

                return (
                  <div
                    key={item.id}
                    className={`group flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#252525] border transition hover:shadow-md ${
                      isMissed
                        ? 'border-rose-200 dark:border-rose-900/30 hover:border-rose-300 dark:hover:border-rose-800'
                        : 'border-slate-200/80 dark:border-white/5 hover:border-indigo-200 dark:hover:border-indigo-500/30'
                    }`}
                  >
                    {/* Left: Direction icon + Avatar + Contact Details */}
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Direction indicator badge */}
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          isMissed
                            ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400'
                            : isOutgoing
                            ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
                            : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                        }`}
                        title={isMissed ? 'Appel manqué' : isOutgoing ? 'Appel sortant' : 'Appel entrant'}
                      >
                        {isMissed ? (
                          <PhoneMissed className="w-4 h-4" />
                        ) : isOutgoing ? (
                          <PhoneOutgoing className="w-4 h-4" />
                        ) : (
                          <PhoneIncoming className="w-4 h-4" />
                        )}
                      </div>

                      {/* Contact Info */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-semibold truncate ${
                              isMissed
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {item.partnerName || 'Contact'}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#1e1e1e] text-slate-600 dark:text-slate-400 font-medium flex items-center gap-1">
                            {isVideo ? <Video className="w-3 h-3 text-indigo-500" /> : <Phone className="w-3 h-3 text-indigo-500" />}
                            {isVideo ? 'Vidéo' : 'Audio'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          <span>{formatCallDate(item.timestamp)}</span>
                          <span>•</span>
                          <span className={isMissed ? 'text-rose-500 font-medium' : ''}>
                            {isMissed
                              ? 'Appel sans réponse'
                              : `Durée : ${formatDuration(item.durationSeconds)}`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Quick Action Buttons */}
                    <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => onStartCall('audio', item.partnerUid, item.partnerName)}
                        className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-100 dark:bg-[#1e1e1e] hover:bg-emerald-50 dark:hover:bg-emerald-500/20 text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition cursor-pointer text-xs font-semibold flex items-center gap-1.5"
                        title="Rappeler en audio"
                      >
                        <Phone className="w-4 h-4 text-emerald-500" />
                        <span className="hidden md:inline">Audio</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onStartCall('video', item.partnerUid, item.partnerName)}
                        className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-100 dark:bg-[#1e1e1e] hover:bg-indigo-50 dark:hover:bg-indigo-500/20 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer text-xs font-semibold flex items-center gap-1.5"
                        title="Rappeler en vidéo"
                      >
                        <Video className="w-4 h-4 text-indigo-500" />
                        <span className="hidden md:inline">Vidéo</span>
                      </button>

                      {onNavigateToChat && (
                        <button
                          type="button"
                          onClick={() => onNavigateToChat(item.partnerUid)}
                          className="p-2 rounded-xl bg-slate-100 dark:bg-[#1e1e1e] hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                          title="Envoyer un message"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={(e) => handleDeleteItem(item.id, e)}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition cursor-pointer opacity-0 group-hover:opacity-100"
                        title="Supprimer de l'historique"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Side: Quick Dial & Contacts panel */}
      <div className="w-full lg:w-80 p-4 sm:p-6 bg-white dark:bg-[#232323] flex flex-col gap-4 overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-indigo-500" />
            Appel Rapide
          </h2>
          <span className="text-xs text-slate-400 font-medium">
            {contacts.length} contacts
          </span>
        </div>

        {/* Quick Contact Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Composer ou chercher..."
            value={quickCallQuery}
            onChange={(e) => setQuickCallQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-100 dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Contact List for Instant Calling */}
        <div className="space-y-2">
          {filteredContacts.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">Aucun contact trouvé</p>
          ) : (
            filteredContacts.map((contact) => {
              const isOnline = contact.status === 'online' || contact.userStatus === 'available';
              return (
                <div
                  key={contact.uid}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-[#1f1f1f] transition border border-transparent hover:border-slate-200 dark:hover:border-white/5"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative">
                      {contact.photoURL ? (
                        <img
                          src={contact.photoURL}
                          alt={contact.displayName}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                          {contact.displayName?.charAt(0).toUpperCase() || 'U'}
                        </div>
                      )}
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-[#232323] ${
                          isOnline ? 'bg-emerald-500' : 'bg-slate-400'
                        }`}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {contact.displayName}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {contact.title || contact.department || contact.email}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onStartCall('audio', contact.uid, contact.displayName)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/20 transition cursor-pointer"
                      title="Appeler en audio"
                    >
                      <Phone className="w-3.5 h-3.5 text-emerald-500" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onStartCall('video', contact.uid, contact.displayName)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 transition cursor-pointer"
                      title="Appeler en vidéo"
                    >
                      <Video className="w-3.5 h-3.5 text-indigo-500" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
