import React, { useState, useEffect, useRef } from 'react';
import {
  auth,
  onAuthStateChanged,
  signOut,
  rtdb,
  ref,
  onValue,
  get,
  update,
  onDisconnect,
  set,
  updateProfile,
  type User
} from './firebase';
import type { UserProfile, CallSession, Friendship, UserBlock, RaitraSpace, SocialViewType } from './types';
import { AuthModal } from './components/AuthModal';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { HomeView } from './components/HomeView';
import { SocialSpaceView } from './components/SocialSpaceView';
import { ChatView } from './components/ChatView';
import { FriendsView } from './components/FriendsView';
import { TeamsView } from './components/TeamsView';
import { CallsView } from './components/CallsView';
import { CalendarView } from './components/CalendarView';
import { FilesView } from './components/FilesView';
import { CallModal } from './components/CallModal';
import { IncomingCallModal } from './components/IncomingCallModal';
import { SettingsModal } from './components/SettingsModal';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { AdminPanelModal } from './components/AdminPanelModal';
import { BottomNav } from './components/BottomNav';
import { RaitraLogo } from './components/RaitraLogo';
import { webrtcService } from './utils/webrtc';
import {
  isBlockedEitherWay,
  OFFICIAL_ADMIN_EMAIL,
  OFFICIAL_ADMIN_NAME
} from './utils/moderationService';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [allBlocks, setAllBlocks] = useState<UserBlock[]>([]);
  const [directChatTargetUid, setDirectChatTargetUid] = useState<string | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [activeSpace, setActiveSpace] = useState<RaitraSpace>('message');
  const [socialSubTab, setSocialSubTab] = useState<SocialViewType>('feed');
  const [currentView, setCurrentView] = useState('chat');
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Active call session (Modal)
  const [activeCall, setActiveCall] = useState<{
    type: 'audio' | 'video';
    targetUid: string;
    targetName: string;
    callId?: string;
    isCaller?: boolean;
    startTime?: number;
  } | null>(null);

  // Keep ref of activeCall for asynchronous teardowns
  const activeCallRef = useRef<typeof activeCall>(null);
  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  // Incoming call alert
  const [incomingCall, setIncomingCall] = useState<{
    callId: string;
    callerUid: string;
    callerName: string;
    type: 'audio' | 'video';
  } | null>(null);

  // Helper to persist call details in Realtime Database for caller and callee
  const recordCallHistory = async (params: {
    callId: string;
    partnerUid: string;
    partnerName: string;
    type: 'audio' | 'video';
    direction: 'incoming' | 'outgoing' | 'missed';
    status: 'connected' | 'missed' | 'rejected' | 'ended' | 'busy' | 'cancelled';
    durationSeconds: number;
    timestamp?: number;
  }) => {
    if (!currentUser?.uid) return;
    const now = params.timestamp || Date.now();
    const historyKey = `${params.callId}_${currentUser.uid}`;
    const userHistoryRef = ref(rtdb, `callHistory/${currentUser.uid}/${historyKey}`);

    await set(userHistoryRef, {
      callId: params.callId,
      partnerUid: params.partnerUid,
      partnerName: params.partnerName,
      type: params.type,
      direction: params.direction,
      status: params.status,
      durationSeconds: Math.max(0, Math.round(params.durationSeconds || 0)),
      timestamp: now
    }).catch(console.warn);

    // If partner is a real registered user, record on their history too
    if (
      params.partnerUid &&
      params.partnerUid !== currentUser.uid &&
      !params.partnerUid.includes('preview') &&
      !params.partnerUid.includes('meeting')
    ) {
      const partnerHistoryKey = `${params.callId}_${params.partnerUid}`;
      const partnerHistoryRef = ref(rtdb, `callHistory/${params.partnerUid}/${partnerHistoryKey}`);
      
      let oppositeDirection: 'incoming' | 'outgoing' | 'missed' = 'incoming';
      if (params.direction === 'outgoing') {
        oppositeDirection = params.status === 'rejected' || params.status === 'missed' ? 'missed' : 'incoming';
      } else if (params.direction === 'incoming') {
        oppositeDirection = 'outgoing';
      } else if (params.direction === 'missed') {
        oppositeDirection = 'outgoing';
      }

      await set(partnerHistoryRef, {
        callId: params.callId,
        partnerUid: currentUser.uid,
        partnerName: currentUser.displayName || 'Utilisateur',
        type: params.type,
        direction: oppositeDirection,
        status: params.status,
        durationSeconds: Math.max(0, Math.round(params.durationSeconds || 0)),
        timestamp: now
      }).catch(console.warn);
    }
  };

  // 1. Listen for Auth State Changes & Presence
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      if (user) {
        const userRef = ref(rtdb, `users/${user.uid}`);
        const isSuperAdmin = user.email?.toLowerCase().trim() === OFFICIAL_ADMIN_EMAIL.toLowerCase();

        // Listen for user profile metadata
        const unsubProfile = onValue(userRef, (snapshot) => {
          const val = snapshot.val() || {};
          const role = isSuperAdmin ? 'admin' : (val.role || 'member');
          const finalDisplayName = isSuperAdmin
            ? OFFICIAL_ADMIN_NAME
            : (val.displayName || user.displayName || user.email?.split('@')[0] || 'Utilisateur');

          setCurrentUser({
            uid: user.uid,
            displayName: finalDisplayName,
            email: user.email || '',
            photoURL: val.photoURL || user.photoURL || '',
            role,
            status: 'online',
            userStatus: val.userStatus || 'available',
            statusLabel: isSuperAdmin ? 'Super Administrateur Système' : (val.statusLabel || 'Disponible'),
            lastSeen: Date.now()
          });
        });

        // Set status online on connect & enforce admin metadata if match
        const initialPayload: any = {
          displayName: isSuperAdmin ? OFFICIAL_ADMIN_NAME : (user.displayName || user.email?.split('@')[0] || 'Utilisateur'),
          email: user.email || '',
          status: 'online',
          userStatus: 'available',
          statusLabel: isSuperAdmin ? 'Super Administrateur Système' : 'Disponible',
          lastSeen: Date.now()
        };

        if (isSuperAdmin) {
          initialPayload.role = 'admin';
        }

        update(userRef, initialPayload).catch(console.warn);

        try {
          onDisconnect(userRef).update({
            status: 'offline',
            userStatus: 'offline',
            statusLabel: 'Hors ligne',
            lastSeen: Date.now()
          });
        } catch (e) {
          console.warn('onDisconnect hook skipped:', e);
        }

        // Listen for all blocks
        const blocksRef = ref(rtdb, 'blocks');
        const unsubBlocks = onValue(blocksRef, (snapshot) => {
          const list: UserBlock[] = [];
          if (snapshot.exists()) {
            snapshot.forEach((child) => {
              list.push(child.val());
            });
          }
          setAllBlocks(list);
        });

        // Listen for Incoming Calls
        const activeCallRefFirebase = ref(rtdb, `userActiveCall/${user.uid}`);
        const unsubIncoming = onValue(activeCallRefFirebase, (snapshot) => {
          const callData = snapshot.val();
          if (callData && callData.status === 'ringing') {
            // Vérification anti-blocage immédiate
            if (callData.callerUid) {
              const b1 = `${callData.callerUid}_${user.uid}`;
              const b2 = `${user.uid}_${callData.callerUid}`;
              // Si un blocage existe, rejeter silencieusement
              get(ref(rtdb, `blocks/${b1}`)).then((snap1) => {
                get(ref(rtdb, `blocks/${b2}`)).then((snap2) => {
                  if (snap1.exists() || snap2.exists()) {
                    webrtcService.rejectCall(callData.callId, user.uid);
                    setIncomingCall(null);
                  } else {
                    setIncomingCall({
                      callId: callData.callId,
                      callerUid: callData.callerUid,
                      callerName: callData.callerName,
                      type: callData.type
                    });
                  }
                });
              });
            } else {
              setIncomingCall({
                callId: callData.callId,
                callerUid: callData.callerUid,
                callerName: callData.callerName,
                type: callData.type
              });
            }
          } else {
            setIncomingCall(null);
          }
        });

        // Listen for all users
        const allUsersRef = ref(rtdb, 'users');
        const unsubAllUsers = onValue(allUsersRef, (snapshot) => {
          const list: UserProfile[] = [];
          if (snapshot.exists()) {
            snapshot.forEach((child) => {
              const u = child.val();
              if (child.key && child.key !== user.uid && !child.key.startsWith('demo_')) {
                list.push({
                  uid: child.key,
                  displayName: u.displayName || u.email?.split('@')[0] || 'Utilisateur',
                  email: u.email || '',
                  photoURL: u.photoURL || '',
                  status: u.status || 'offline',
                  userStatus: u.userStatus || 'offline',
                  statusLabel: u.statusLabel || 'Hors ligne',
                  lastSeen: u.lastSeen || 0
                });
              }
            });
          }
          setAllUsers(list);
        });

        // Listen for all friendships
        const friendshipsRef = ref(rtdb, 'friendships');
        const unsubFriendships = onValue(friendshipsRef, (snapshot) => {
          const fList: Friendship[] = [];
          if (snapshot.exists()) {
            snapshot.forEach((child) => {
              const val = child.val();
              if (val && (val.user1Id === user.uid || val.user2Id === user.uid)) {
                fList.push({
                  id: child.key || '',
                  ...val
                });
              }
            });
          }
          setFriendships(fList);
        });

        setLoadingAuth(false);

        return () => {
          unsubProfile();
          unsubIncoming();
          unsubBlocks();
          unsubAllUsers();
          unsubFriendships();
        };
      } else {
        setCurrentUser(null);
        setLoadingAuth(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Handle Logout
  const handleLogout = async () => {
    if (currentUser?.uid) {
      const userRef = ref(rtdb, `users/${currentUser.uid}`);
      await update(userRef, {
        status: 'offline',
        userStatus: 'offline',
        statusLabel: 'Hors ligne',
        lastSeen: Date.now()
      }).catch(console.warn);
    }
    await signOut(auth);
  };

  // Change presence status
  const handleChangeStatus = async (status: 'available' | 'away' | 'dnd' | 'invisible') => {
    if (!currentUser) return;
    const userRef = ref(rtdb, `users/${currentUser.uid}`);
    const labels: Record<string, string> = {
      available: 'Disponible',
      away: 'Absent',
      dnd: 'Ne pas déranger',
      invisible: 'Invisible'
    };
    const mappedStatus = status === 'invisible' ? 'offline' : 'online';
    await update(userRef, {
      userStatus: status === 'invisible' ? 'offline' : status,
      status: mappedStatus,
      statusLabel: labels[status]
    });
  };

  // Start outgoing call
  const handleStartCall = async (type: 'audio' | 'video', targetUid: string, targetName: string) => {
    if (!currentUser) return;
    if (isBlockedEitherWay(currentUser.uid, targetUid, allBlocks)) {
      console.warn('Call blocked: contact restriction is active.');
      return;
    }
    try {
      const callId = await webrtcService.startCall(
        currentUser.uid,
        currentUser.displayName,
        targetUid,
        targetName,
        type
      );
      setActiveCall({
        type,
        targetUid,
        targetName,
        callId,
        isCaller: true,
        startTime: Date.now()
      });
    } catch (err: any) {
      console.warn('Call start issue:', err);
      // Ne pas ouvrir de fallback si bloqué
      if (err?.message?.includes('restriction')) {
        return;
      }
      // Still open test call view for user feedback
      setActiveCall({
        type,
        targetUid,
        targetName,
        callId: `test_call_${Date.now()}`,
        isCaller: true,
        startTime: Date.now()
      });
    }
  };

  // Accept incoming call
  const handleAcceptIncomingCall = async () => {
    if (!incomingCall || !currentUser) return;
    try {
      await webrtcService.answerCall(incomingCall.callId, currentUser.uid, incomingCall.type);
      setActiveCall({
        type: incomingCall.type,
        targetUid: incomingCall.callerUid,
        targetName: incomingCall.callerName,
        callId: incomingCall.callId,
        isCaller: false,
        startTime: Date.now()
      });
      setIncomingCall(null);
    } catch (err) {
      console.warn('Error answering call:', err);
      setIncomingCall(null);
    }
  };

  // Reject incoming call
  const handleRejectIncomingCall = async () => {
    if (!incomingCall || !currentUser) return;
    await webrtcService.rejectCall(incomingCall.callId, currentUser.uid);
    // Save to call history as missed/rejected
    await recordCallHistory({
      callId: incomingCall.callId,
      partnerUid: incomingCall.callerUid,
      partnerName: incomingCall.callerName,
      type: incomingCall.type,
      direction: 'missed',
      status: 'rejected',
      durationSeconds: 0
    });
    setIncomingCall(null);
  };

  // End active call and save history to Realtime Database
  const handleEndCall = (durationSeconds = 0, status = 'ended') => {
    const current = activeCallRef.current || activeCall;
    if (current && currentUser) {
      const callId = current.callId || `call_${Date.now()}`;
      recordCallHistory({
        callId,
        partnerUid: current.targetUid,
        partnerName: current.targetName,
        type: current.type,
        direction: current.isCaller ? 'outgoing' : 'incoming',
        status: (status as any) || 'ended',
        durationSeconds: durationSeconds || 0
      });
    }
    webrtcService.endCall();
    setActiveCall(null);
  };

  // Save Name
  const handleSaveName = async (newName: string) => {
    if (!currentUser || !auth.currentUser) return;
    await updateProfile(auth.currentUser, { displayName: newName });
    await update(ref(rtdb, `users/${currentUser.uid}`), { displayName: newName });
    setCurrentUser((prev) => (prev ? { ...prev, displayName: newName } : null));
  };

  // Count pending received friend requests (excluding blocked users)
  const pendingRequestsCount = currentUser
    ? friendships.filter(
        (f) =>
          f.receiverId === currentUser.uid &&
          f.status === 'pending' &&
          !isBlockedEitherWay(currentUser.uid, f.senderId, allBlocks)
      ).length
    : 0;

  // Compute accepted friends list (excluding blocked users)
  const acceptedFriends = currentUser
    ? allUsers.filter(
        (u) =>
          !isBlockedEitherWay(currentUser.uid, u.uid, allBlocks) &&
          friendships.some(
            (f) =>
              f.status === 'accepted' &&
              ((f.user1Id === currentUser.uid && f.user2Id === u.uid) ||
                (f.user2Id === currentUser.uid && f.user1Id === u.uid))
          )
      )
    : [];

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white select-none">
        <div className="flex flex-col items-center gap-4 animate-in fade-in duration-300">
          <div className="animate-pulse">
            <RaitraLogo size="xl" variant="icon-only" showGlow />
          </div>
          <div className="text-center space-y-1">
            <h1 className="font-extrabold text-base tracking-tight text-white">Raitra Connect</h1>
            <p className="text-xs text-slate-400 font-medium">Chargement de votre espace...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthModal />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 dark:bg-[#181818] font-sans antialiased text-slate-900 dark:text-slate-100">
      {/* Sidebar navigation */}
      <Sidebar
        currentView={currentView}
        onSelectView={(view) => {
          if (view !== 'chat') setDirectChatTargetUid(null);
          setCurrentView(view);
        }}
        currentUser={currentUser}
        pendingRequestsCount={pendingRequestsCount}
        activeSpace={activeSpace}
        onSelectSpace={setActiveSpace}
        socialSubTab={socialSubTab}
        onSelectSocialSubTab={setSocialSubTab}
        onLogout={handleLogout}
        onChangeStatus={handleChangeStatus}
        onOpenSettings={() => setShowSettings(true)}
        onOpenAdminPanel={() => setShowAdminPanel(true)}
        onCreateTeam={() => {
          setActiveSpace('message');
          setCurrentView('teams');
        }}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      {/* Main View Container */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Topbar
          currentView={currentView}
          currentUser={currentUser}
          activeSpace={activeSpace}
          onSelectSpace={setActiveSpace}
          onOpenMobileSidebar={() => setIsMobileOpen(true)}
          onSearchClick={() => setIsSearchOpen(true)}
          onOpenAdminPanel={() => setShowAdminPanel(true)}
          onNotificationsClick={() => {
            if (pendingRequestsCount > 0) {
              setActiveSpace('message');
              setCurrentView('friends');
            } else {
              alert('Vous êtes à jour. Aucune nouvelle notification.');
            }
          }}
        />

        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#1f1f1f]">
          {activeSpace === 'social' ? (
            <SocialSpaceView
              currentUser={currentUser}
              allUsers={allUsers}
              friendships={friendships}
              allBlocks={allBlocks}
              activeSubTab={socialSubTab}
              onSelectSubTab={setSocialSubTab}
              onOpenDirectChat={(targetUid) => {
                setActiveSpace('message');
                setDirectChatTargetUid(targetUid);
                setCurrentView('chat');
              }}
            />
          ) : (
            <>
              {currentView === 'home' && (
                <HomeView
                  currentUser={currentUser}
                  onNavigate={(view) => setCurrentView(view)}
                  onNavigateToSocial={() => setActiveSpace('social')}
                  onStartQuickCall={() =>
                    handleStartCall('video', 'test_preview', 'Salle de test (Caméra & Micro)')
                  }
                />
              )}

              {currentView === 'chat' && (
                <ChatView
                  currentUser={currentUser}
                  initialTargetUid={directChatTargetUid}
                  onNavigateToFriends={() => setCurrentView('friends')}
                  onStartCall={handleStartCall}
                />
              )}

              {currentView === 'friends' && (
                <FriendsView
                  currentUser={currentUser}
                  allUsers={allUsers}
                  friendships={friendships}
                  onOpenDirectChat={(targetUid) => {
                    setDirectChatTargetUid(targetUid);
                    setCurrentView('chat');
                  }}
                  onStartCall={(type, targetUid, targetName) => {
                    handleStartCall(type, targetUid, targetName);
                  }}
                />
              )}

              {currentView === 'teams' && <TeamsView currentUser={currentUser} />}

              {currentView === 'calls' && (
                <CallsView
                  currentUser={currentUser}
                  onStartCall={handleStartCall}
                  onNavigateToChat={(targetUid) => {
                    if (targetUid) setDirectChatTargetUid(targetUid);
                    setCurrentView('chat');
                  }}
                />
              )}

              {currentView === 'calendar' && (
                <CalendarView
                  currentUser={currentUser}
                  onStartMeeting={() =>
                    handleStartCall('video', 'general_meeting', 'Réunion d\'équipe générale')
                  }
                />
              )}

              {currentView === 'files' && <FilesView currentUser={currentUser} />}
            </>
          )}
        </main>

        {/* Mobile Bottom Navigation Bar */}
        <BottomNav
          currentView={currentView}
          onSelectView={(view) => {
            setActiveSpace('message');
            setCurrentView(view);
          }}
          activeSpace={activeSpace}
          onSelectSpace={setActiveSpace}
          socialSubTab={socialSubTab}
          onSelectSocialSubTab={setSocialSubTab}
          onOpenMobileMenu={() => setIsMobileOpen(true)}
          pendingRequestsCount={pendingRequestsCount}
        />
      </div>

      {/* Incoming Call Overlay */}
      {incomingCall && (
        <IncomingCallModal
          callerName={incomingCall.callerName}
          type={incomingCall.type}
          onAccept={handleAcceptIncomingCall}
          onReject={handleRejectIncomingCall}
        />
      )}

      {/* WebRTC In-Call Fullscreen Modal */}
      {activeCall && (
        <CallModal
          partnerName={activeCall.targetName}
          partnerUid={activeCall.targetUid}
          type={activeCall.type}
          callId={activeCall.callId}
          isCaller={activeCall.isCaller}
          onEndCall={handleEndCall}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          currentUser={currentUser}
          onClose={() => setShowSettings(false)}
          onProfileUpdated={(updated) => {
            setCurrentUser((prev) => (prev ? { ...prev, ...updated } : null));
          }}
        />
      )}

      {/* Admin Panel Modal (Super Admin only) */}
      <AdminPanelModal
        isOpen={showAdminPanel}
        onClose={() => setShowAdminPanel(false)}
        currentUser={currentUser}
        onFeedback={(msg, type) => showToast(msg, type)}
      />

      {/* Global Search Modal */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectChat={(targetUid) => {
          setActiveSpace('message');
          if (targetUid) setDirectChatTargetUid(targetUid);
          setCurrentView('chat');
        }}
        onSelectView={(view) => {
          setActiveSpace('message');
          setCurrentView(view);
        }}
        onSelectSpace={setActiveSpace}
        contacts={acceptedFriends}
      />

      {/* Global Notification Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-70 animate-in slide-in-from-bottom-5 fade-in duration-200">
          <div
            className={`px-4 py-2.5 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-2 border ${
              toastMessage.type === 'success'
                ? 'bg-emerald-900/90 text-emerald-100 border-emerald-700 backdrop-blur-md'
                : 'bg-rose-900/90 text-rose-100 border-rose-700 backdrop-blur-md'
            }`}
          >
            <span>{toastMessage.type === 'success' ? '✓' : '⚠️'}</span>
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}
    </div>
  );
}
