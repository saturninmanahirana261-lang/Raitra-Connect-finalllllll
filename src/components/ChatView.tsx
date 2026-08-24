import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Send,
  Phone,
  Video,
  MoreVertical,
  Edit2,
  Trash2,
  Check,
  CheckCheck,
  Smile,
  Paperclip,
  MessageSquare,
  Users,
  CornerUpLeft,
  X,
  Copy,
  ChevronDown,
  ChevronLeft,
  Sparkles,
  SearchX,
  Mic,
  Pin,
  Bookmark,
  Languages,
  Wand2,
  Download,
  FileText,
  Image as ImageIcon,
  AtSign,
  BarChart2,
  Globe,
  ShieldOff,
  ShieldAlert,
  EyeOff,
  Eye,
  UserX,
  AlertTriangle
} from 'lucide-react';
import {
  rtdb,
  ref,
  push,
  set,
  update,
  onValue
} from '../firebase';
import type { UserProfile, ChatMessage, ReplyPreview, PollData, UserBlock, HiddenConversation } from '../types';
import { soundManager } from '../utils/sound';
import { AudioNotePlayer } from './AudioNotePlayer';
import { AudioVoiceRecorder } from './AudioVoiceRecorder';
import { ThreadDrawer } from './ThreadDrawer';
import { AiSummaryModal } from './AiSummaryModal';
import { ImageLightboxModal } from './ImageLightboxModal';
import { CreatePollModal } from './CreatePollModal';
import { PollCard } from './PollCard';
import { FormattedText } from './FormattedText';
import { ReportUserModal } from './ReportUserModal';
import { BlockConfirmModal } from './BlockConfirmModal';
import { uploadVoiceNoteToStorage, uploadAttachmentToStorage } from '../utils/audioService';
import { saveChatCache, getChatCache, useNetworkStatus } from '../utils/offlineSync';
import { useI18n } from '../utils/i18n';
import type { Friendship } from '../types';
import { isBlockedEitherWay, hideConversation, unhideConversation } from '../utils/moderationService';

interface ChatViewProps {
  currentUser: UserProfile;
  initialTargetUid?: string | null;
  onNavigateToFriends?: () => void;
  onStartCall: (type: 'audio' | 'video', targetUid: string, targetName: string) => void;
}

const EMOJI_LIST = ['👍', '❤️', '😂', '😮', '👏', '🎉', '🚀', '🔥'];

export const ChatView: React.FC<ChatViewProps> = ({
  currentUser,
  initialTargetUid,
  onNavigateToFriends,
  onStartCall
}) => {
  const { t } = useI18n();
  const { isOnline } = useNetworkStatus();
  const [allRegisteredUsers, setAllRegisteredUsers] = useState<UserProfile[]>([]);
  const [acceptedFriendUids, setAcceptedFriendUids] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUid, setSelectedUid] = useState<string | null>(initialTargetUid || null); // null = Canal Général
  const [mobileChatOpen, setMobileChatOpen] = useState<boolean>(!!initialTargetUid);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [replyingTo, setReplyingTo] = useState<ReplyPreview | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [openEmojiPickerId, setOpenEmojiPickerId] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [showInChatSearch, setShowInChatSearch] = useState(false);
  const [inChatSearchQuery, setInChatSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // New Advanced State
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [activeThreadMessage, setActiveThreadMessage] = useState<ChatMessage | null>(null);
  const [isAiSummaryOpen, setIsAiSummaryOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string } | null>(null);
  const [smartReplies, setSmartReplies] = useState<string[]>([]);
  const [showAiRephraseMenu, setShowAiRephraseMenu] = useState(false);
  const [isRephrasing, setIsRephrasing] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [showCreatePoll, setShowCreatePoll] = useState(false);

  // Moderation, Blocking & Hidden Conversations States
  const [allBlocks, setAllBlocks] = useState<UserBlock[]>([]);
  const [hiddenConversationIds, setHiddenConversationIds] = useState<Set<string>>(new Set());
  const [showHiddenOnly, setShowHiddenOnly] = useState(false);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportingMessage, setReportingMessage] = useState<ChatMessage | null>(null);
  const [showChatOptionsMenu, setShowChatOptionsMenu] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const lastMessageCountRef = useRef<number>(0);

  // Synchronise si initialTargetUid change
  useEffect(() => {
    if (initialTargetUid !== undefined && initialTargetUid !== null) {
      setSelectedUid(initialTargetUid);
      setMobileChatOpen(true);
    }
  }, [initialTargetUid]);

  // Compute conversation ID
  const conversationId = selectedUid
    ? [currentUser.uid, selectedUid].sort().join('_')
    : 'general';

  // 1. Fetch & Listen to Users and Friendships from Firebase RTDB
  useEffect(() => {
    const usersRef = ref(rtdb, 'users');
    const unsubUsers = onValue(usersRef, (snapshot) => {
      const list: UserProfile[] = [];
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          const u = child.val();
          if (child.key && child.key !== currentUser.uid && !child.key.startsWith('demo_')) {
            list.push({
              uid: child.key,
              displayName: u.displayName || u.email?.split('@')[0] || 'Utilisateur',
              email: u.email || '',
              photoURL: u.photoURL || '',
              status: u.status || 'offline',
              userStatus: u.userStatus || (u.status === 'online' ? 'available' : 'offline'),
              statusLabel: u.statusLabel || (u.status === 'online' ? 'Disponible' : 'Hors ligne'),
              lastSeen: u.lastSeen || 0
            });
          }
        });
      }
      setAllRegisteredUsers(list);
    });

    // Listen to Friendships to filter only ACCEPTED friends
    const friendshipsRef = ref(rtdb, 'friendships');
    const unsubFriendships = onValue(friendshipsRef, (snapshot) => {
      const friends = new Set<string>();
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          const f: Friendship = child.val();
          if (f.status === 'accepted') {
            if (f.user1Id === currentUser.uid) {
              friends.add(f.user2Id);
            } else if (f.user2Id === currentUser.uid) {
              friends.add(f.user1Id);
            }
          }
        });
      }
      setAcceptedFriendUids(friends);
    });

    // Listen to All Blocks
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

    // Listen to Hidden Conversations for currentUser
    const hiddenRef = ref(rtdb, `hiddenConversations/${currentUser.uid}`);
    const unsubHidden = onValue(hiddenRef, (snapshot) => {
      const hiddenIds = new Set<string>();
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          const val: HiddenConversation = child.val();
          if (val.conversationId) {
            hiddenIds.add(val.conversationId);
          }
        });
      }
      setHiddenConversationIds(hiddenIds);
    });

    return () => {
      unsubUsers();
      unsubFriendships();
      unsubBlocks();
      unsubHidden();
    };
  }, [currentUser.uid]);

  // Détection de blocage réciproque avec l'interlocuteur sélectionné
  const isSelectedContactBlocked = selectedUid
    ? isBlockedEitherWay(currentUser.uid, selectedUid, allBlocks)
    : false;

  // Filtrage strict des contacts :
  // 1. RÈGLE ABSOLUE : Exclure tout utilisateur bloqué dans un sens ou dans l'autre
  // 2. Filtrer selon statut ami accepté
  // 3. Filtrer selon conversations masquées ou normales
  const contacts = allRegisteredUsers.filter((u) => {
    // Invisibilité réciproque si bloqué
    if (isBlockedEitherWay(currentUser.uid, u.uid, allBlocks)) {
      return false;
    }

    const isFriend = acceptedFriendUids.has(u.uid);
    if (!isFriend && u.uid !== selectedUid) {
      return false;
    }

    const convId = [currentUser.uid, u.uid].sort().join('_');
    const isHidden = hiddenConversationIds.has(convId);

    if (showHiddenOnly) {
      return isHidden;
    }

    return !isHidden || u.uid === selectedUid;
  });

  const channelTitle = selectedUid
    ? (allRegisteredUsers.find((c) => c.uid === selectedUid)?.displayName || 'Contact')
    : 'Canal Général';

  // 2. Fetch & Listen to Messages for the active conversation
  useEffect(() => {
    // Hydrate immediately with cached messages if available
    const cached = getChatCache(conversationId);
    if (cached && cached.length > 0) {
      setMessages(cached);
    } else {
      setMessages([]);
    }

    setReplyingTo(null);
    setEditingMessage(null);
    setOpenMenuId(null);
    setOpenEmojiPickerId(null);
    setActiveThreadMessage(null);

    const messagesRef = ref(rtdb, `messages/${conversationId}`);
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      if (!snapshot.exists()) {
        setMessages([]);
        lastMessageCountRef.current = 0;
        setSmartReplies(['Bonjour à tous ! 👋', 'Des nouvelles du projet ?', 'Disponible si besoin.']);
        return;
      }

      const list: ChatMessage[] = [];
      snapshot.forEach((child) => {
        const val = child.val();
        if (val.deletedFor && val.deletedFor[currentUser.uid]) {
          return;
        }
        list.push({
          id: child.key as string,
          uid: val.uid,
          name: val.name || 'Anonyme',
          email: val.email,
          text: val.text || '',
          timestamp: val.timestamp || Date.now(),
          edited: val.edited || false,
          editedAt: val.editedAt,
          deletedForEveryone: val.deletedForEveryone || false,
          deletedFor: val.deletedFor || {},
          readBy: val.readBy || {},
          reactions: val.reactions || {},
          replyTo: val.replyTo || undefined,
          attachment: val.attachment || undefined,
          audioNote: val.audioNote || undefined,
          poll: val.poll || undefined,
          translation: val.translation || undefined,
          format: val.format || 'markdown',
          isPinned: val.isPinned || false,
          pinnedBy: val.pinnedBy,
          pinnedAt: val.pinnedAt,
          isSaved: val.isSaved || false,
          threadReplyCount: val.threadReplyCount || 0
        });
      });

      list.sort((a, b) => a.timestamp - b.timestamp);

      // Save to local cache for offline persistence
      saveChatCache(conversationId, list);

      // Trigger audio chime if incoming message from another user
      if (list.length > lastMessageCountRef.current && lastMessageCountRef.current > 0) {
        const newest = list[list.length - 1];
        if (newest.uid !== currentUser.uid) {
          soundManager.playMessageChime();
        }
      }
      lastMessageCountRef.current = list.length;

      setMessages(list);

      // Fetch smart replies for the last message
      if (list.length > 0) {
        const lastMsg = list[list.length - 1];
        if (lastMsg.uid !== currentUser.uid && lastMsg.text) {
          fetchSmartReplies(lastMsg.text);
        }
      }

      // Mark messages as read
      list.forEach((msg) => {
        if (msg.uid !== currentUser.uid && (!msg.readBy || !msg.readBy[currentUser.uid])) {
          update(ref(rtdb, `messages/${conversationId}/${msg.id}/readBy`), {
            [currentUser.uid]: true
          }).catch(() => {});
        }
      });
    });

    return () => unsubscribe();
  }, [conversationId, currentUser.uid]);

  // Fetch AI Smart Replies
  const fetchSmartReplies = async (lastText: string) => {
    try {
      const res = await fetch('/api/gemini/smart-replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastMessage: lastText })
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.suggestions)) {
          setSmartReplies(data.suggestions);
        }
      }
    } catch {
      setSmartReplies(['Parfait, c\'est noté !', 'Je m\'en occupe.', 'Merci !']);
    }
  };

  // 3. Listen to Typing Status
  useEffect(() => {
    const typingRef = ref(rtdb, `typing/${conversationId}`);
    const unsubscribe = onValue(typingRef, (snapshot) => {
      if (!snapshot.exists()) {
        setTypingUsers([]);
        return;
      }
      const data = snapshot.val();
      const typers: string[] = [];
      Object.keys(data).forEach((uid) => {
        if (uid !== currentUser.uid && data[uid] === true) {
          const contact = contacts.find((c) => c.uid === uid);
          typers.push(contact ? contact.displayName : 'Quelqu\'un');
        }
      });
      setTypingUsers(typers);
    });

    return () => {
      unsubscribe();
      set(ref(rtdb, `typing/${conversationId}/${currentUser.uid}`), null).catch(() => {});
    };
  }, [conversationId, currentUser.uid, contacts]);

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  useEffect(() => {
    scrollToBottom(false);
  }, [messages.length]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isUp = scrollHeight - scrollTop - clientHeight > 150;
    setShowScrollBottom(isUp);
  };

  // Input change with typing emitter & @ mention detection
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setMessageInput(val);

    // Detect @ mentions
    const lastWord = val.split(' ').pop() || '';
    if (lastWord.startsWith('@')) {
      setMentionQuery(lastWord.slice(1).toLowerCase());
    } else {
      setMentionQuery(null);
    }

    set(ref(rtdb, `typing/${conversationId}/${currentUser.uid}`), true).catch(() => {});

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = window.setTimeout(() => {
      set(ref(rtdb, `typing/${conversationId}/${currentUser.uid}`), null).catch(() => {});
    }, 2000);
  };

  const handleSelectMention = (name: string) => {
    const words = messageInput.split(' ');
    words.pop();
    setMessageInput([...words, `@${name} `].join(' '));
    setMentionQuery(null);
  };

  // Send or Edit Message
  const handleSendMessage = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const text = (customText !== undefined ? customText : messageInput).trim();
    if (!text) return;

    if (text.length > 4000) {
      alert('Le message ne peut pas dépasser 4000 caractères.');
      return;
    }

    set(ref(rtdb, `typing/${conversationId}/${currentUser.uid}`), null).catch(() => {});
    setMentionQuery(null);

    if (editingMessage) {
      await update(ref(rtdb, `messages/${conversationId}/${editingMessage.id}`), {
        text,
        edited: true,
        editedAt: Date.now()
      });
      setEditingMessage(null);
      setMessageInput('');
      return;
    }

    const msgRef = push(ref(rtdb, `messages/${conversationId}`));
    const newMsg: Partial<ChatMessage> = {
      uid: currentUser.uid,
      name: currentUser.displayName,
      email: currentUser.email,
      text,
      timestamp: Date.now(),
      readBy: {
        [currentUser.uid]: true
      }
    };

    if (replyingTo) {
      newMsg.replyTo = replyingTo;
    }

    await set(msgRef, newMsg);
    setMessageInput('');
    setReplyingTo(null);
    scrollToBottom(true);
  };

  // Voice Note Send avec upload Firebase Storage, suivi de progression & fallback sécurisé
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [audioUploadProgress, setAudioUploadProgress] = useState(0);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [fileUploadProgress, setFileUploadProgress] = useState(0);

  const handleSendVoiceNote = async (audioBlob: Blob, mimeType: string, durationSec: number) => {
    setIsRecordingAudio(false);
    if (!audioBlob || durationSec <= 0 || audioBlob.size === 0) {
      console.warn('[VOICE] Refus d\'envoi : Blob invalide ou vide');
      return;
    }

    console.log('[VOICE] message creation started');
    setIsUploadingAudio(true);
    setAudioUploadProgress(5);

    try {
      // 1. Upload vers Firebase Storage avec chemin sécurisé, timeout et suivi
      const uploadResult = await uploadVoiceNoteToStorage(
        audioBlob,
        conversationId,
        currentUser.uid,
        durationSec,
        mimeType,
        (progress) => {
          setAudioUploadProgress(progress);
        }
      );

      console.log('[VOICE] URL obtenue, enregistrement du message dans la base de données...', uploadResult);

      // 2. Enregistrement des métadonnées du message dans Realtime Database
      const msgRef = push(ref(rtdb, `messages/${conversationId}`));
      const newMsg: Partial<ChatMessage> = {
        uid: currentUser.uid,
        name: currentUser.displayName,
        email: currentUser.email,
        text: '🎤 Message vocal',
        timestamp: Date.now(),
        audioNote: {
          url: uploadResult.url,
          duration: durationSec,
          mimeType: mimeType,
          size: audioBlob.size
        },
        readBy: {
          [currentUser.uid]: true
        }
      };

      await set(msgRef, newMsg);
      console.log('[VOICE] message created successfully in database!');
      scrollToBottom(true);
    } catch (err: any) {
      console.error('[VOICE] Erreur critique lors de l\'envoi du message vocal:', err);
      alert(`Impossible d'envoyer le message vocal : ${err?.message || 'Erreur réseau ou serveur indisponible'}`);
    } finally {
      setIsUploadingAudio(false);
      setAudioUploadProgress(0);
      console.log('[VOICE] cleanup completed, UI state reset');
    }
  };

  // File Upload Handler with Firebase Storage and progress support
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Max 25MB limit
    if (file.size > 25 * 1024 * 1024) {
      alert('Le fichier sélectionné dépasse la taille limite autorisée de 25 Mo.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploadingFile(true);
    setFileUploadProgress(10);

    const sizeFormatted = file.size > 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} Mo`
      : `${(file.size / 1024).toFixed(0)} Ko`;

    try {
      // 1. Upload vers Firebase Storage
      const downloadUrl = await uploadAttachmentToStorage(
        file,
        conversationId,
        currentUser.uid,
        (pct) => setFileUploadProgress(pct)
      );

      // 2. Enregistrement des métadonnées
      const msgRef = push(ref(rtdb, `messages/${conversationId}`));
      const newMsg: Partial<ChatMessage> = {
        uid: currentUser.uid,
        name: currentUser.displayName,
        email: currentUser.email,
        text: file.type.startsWith('image/') ? '📷 Image partagée' : `📎 Fichier partagé : ${file.name}`,
        timestamp: Date.now(),
        attachment: {
          name: file.name,
          url: downloadUrl,
          type: file.type,
          size: sizeFormatted
        },
        readBy: {
          [currentUser.uid]: true
        }
      };

      await set(msgRef, newMsg);
      scrollToBottom(true);
    } catch (err: any) {
      console.warn('Upload Storage attachment échoué, bascule sur DataURL local...', err);
      // Fallback base64 si Storage indisponible
      const reader = new FileReader();
      reader.onloadend = async () => {
        if (reader.result) {
          const fileUrl = reader.result as string;
          const msgRef = push(ref(rtdb, `messages/${conversationId}`));
          const newMsg: Partial<ChatMessage> = {
            uid: currentUser.uid,
            name: currentUser.displayName,
            email: currentUser.email,
            text: file.type.startsWith('image/') ? '📷 Image partagée' : `📎 Fichier partagé : ${file.name}`,
            timestamp: Date.now(),
            attachment: {
              name: file.name,
              url: fileUrl,
              type: file.type,
              size: sizeFormatted
            },
            readBy: {
              [currentUser.uid]: true
            }
          };
          await set(msgRef, newMsg);
          scrollToBottom(true);
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setIsUploadingFile(false);
      setFileUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Toggle Pin message
  const handleTogglePin = async (msg: ChatMessage) => {
    setOpenMenuId(null);
    const isNowPinned = !msg.isPinned;
    await update(ref(rtdb, `messages/${conversationId}/${msg.id}`), {
      isPinned: isNowPinned,
      pinnedBy: isNowPinned ? currentUser.displayName : null,
      pinnedAt: isNowPinned ? Date.now() : null
    });
  };

  // Toggle Save / Bookmark
  const handleToggleSave = async (msg: ChatMessage) => {
    setOpenMenuId(null);
    await update(ref(rtdb, `messages/${conversationId}/${msg.id}`), {
      isSaved: !msg.isSaved
    });
  };

  // Create Poll Submission
  const handleCreatePoll = async (pollData: Omit<PollData, 'id' | 'createdAt' | 'createdByUid' | 'createdByName'>) => {
    const msgRef = push(ref(rtdb, `messages/${conversationId}`));
    const newPoll: PollData = {
      id: msgRef.key as string,
      question: pollData.question,
      options: pollData.options,
      allowMultiple: pollData.allowMultiple,
      createdByUid: currentUser.uid,
      createdByName: currentUser.displayName,
      createdAt: Date.now()
    };

    const newMsg: Partial<ChatMessage> = {
      uid: currentUser.uid,
      name: currentUser.displayName,
      email: currentUser.email,
      text: `📊 Sondage : ${pollData.question}`,
      timestamp: Date.now(),
      poll: newPoll,
      readBy: {
        [currentUser.uid]: true
      }
    };

    await set(msgRef, newMsg);
    scrollToBottom(true);
  };

  // Vote on Poll Option
  const handleVotePoll = async (messageId: string, optionId: string) => {
    const msg = messages.find(m => m.id === messageId);
    if (!msg || !msg.poll || msg.poll.isClosed) return;

    const poll = msg.poll;
    const isMultiple = poll.allowMultiple || false;

    const updatedOptions = poll.options.map(opt => {
      let votes = opt.votes ? [...opt.votes] : [];
      const hasVotedThis = votes.includes(currentUser.uid);

      if (opt.id === optionId) {
        if (hasVotedThis) {
          // Toggle off vote
          votes = votes.filter(uid => uid !== currentUser.uid);
        } else {
          votes.push(currentUser.uid);
        }
      } else if (!isMultiple && !hasVotedThis) {
        // If single choice, remove from other options
        votes = votes.filter(uid => uid !== currentUser.uid);
      }

      return {
        ...opt,
        votes
      };
    });

    await update(ref(rtdb, `messages/${conversationId}/${messageId}/poll`), {
      options: updatedOptions
    });
  };

  // Toggle Poll Closed
  const handleToggleClosePoll = async (messageId: string) => {
    const msg = messages.find(m => m.id === messageId);
    if (!msg || !msg.poll) return;

    await update(ref(rtdb, `messages/${conversationId}/${messageId}/poll`), {
      isClosed: !msg.poll.isClosed
    });
  };

  // Translate Message with Gemini
  const handleTranslateMessage = async (msg: ChatMessage, targetLang: string = 'en') => {
    setOpenMenuId(null);
    if (!msg.text) return;

    try {
      const res = await fetch('/api/gemini/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: msg.text, targetLang })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.translatedText) {
          await update(ref(rtdb, `messages/${conversationId}/${msg.id}/translation`), {
            lang: targetLang,
            text: data.translatedText
          });
        }
      }
    } catch (err) {
      console.warn('Translate error:', err);
    }
  };

  // AI Rephrase helper
  const handleAiRephrase = async (mode: string, targetLanguage?: string) => {
    if (!messageInput.trim()) return;
    setIsRephrasing(true);
    setShowAiRephraseMenu(false);

    try {
      const res = await fetch('/api/gemini/rephrase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: messageInput, mode, targetLanguage })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.rephrased) {
          setMessageInput(data.rephrased);
        }
      }
    } catch (err) {
      console.warn('Rephrase error:', err);
    } finally {
      setIsRephrasing(false);
    }
  };

  // Toggle Reaction
  const handleToggleReaction = async (messageId: string, emoji: string) => {
    setOpenEmojiPickerId(null);
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return;

    const currentReactions = msg.reactions || {};
    const usersForEmoji = currentReactions[emoji] || [];
    const hasReacted = usersForEmoji.includes(currentUser.uid);

    let updatedUsers: string[];
    if (hasReacted) {
      updatedUsers = usersForEmoji.filter((u) => u !== currentUser.uid);
    } else {
      updatedUsers = [...usersForEmoji, currentUser.uid];
    }

    const newReactions = { ...currentReactions };
    if (updatedUsers.length === 0) {
      delete newReactions[emoji];
    } else {
      newReactions[emoji] = updatedUsers;
    }

    await update(ref(rtdb, `messages/${conversationId}/${messageId}`), {
      reactions: newReactions
    });
  };

  const handleDeleteForMe = async (messageId: string) => {
    setOpenMenuId(null);
    await update(ref(rtdb, `messages/${conversationId}/${messageId}/deletedFor`), {
      [currentUser.uid]: true
    });
  };

  const handleDeleteForEveryone = async (messageId: string) => {
    setOpenMenuId(null);
    await update(ref(rtdb, `messages/${conversationId}/${messageId}`), {
      deletedForEveryone: true,
      text: 'Ce message a été supprimé.',
      attachment: null,
      audioNote: null
    });
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
    setOpenMenuId(null);
  };

  const handleStartCall = (type: 'audio' | 'video') => {
    if (!selectedUid) return;
    const target = contacts.find((c) => c.uid === selectedUid);
    if (!target) return;
    onStartCall(type, target.uid, target.displayName);
  };

  const filteredContacts = contacts.filter((c) =>
    c.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedContact = selectedUid ? contacts.find((c) => c.uid === selectedUid) : null;
  const pinnedMessages = messages.filter((m) => m.isPinned);

  const displayedMessages = inChatSearchQuery.trim()
    ? messages.filter((m) => m.text.toLowerCase().includes(inChatSearchQuery.toLowerCase()))
    : messages;

  const getStatusBadge = (status: UserProfile['userStatus']) => {
    switch (status) {
      case 'available':
        return 'bg-emerald-500 ring-white dark:ring-slate-900';
      case 'busy':
        return 'bg-rose-500 ring-white dark:ring-slate-900';
      case 'dnd':
        return 'bg-rose-600 ring-white dark:ring-slate-900';
      case 'away':
        return 'bg-amber-500 ring-white dark:ring-slate-900';
      default:
        return 'bg-slate-400 ring-white dark:ring-slate-900';
    }
  };

  const formatDateHeader = (ts: number) => {
    const d = new Date(ts);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    if (isToday) return "Aujourd'hui";
    if (isYesterday) return 'Hier';
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden bg-white dark:bg-[#1f1f1f] select-none">
      {/* -------------------- LEFT PANEL: CONTACTS & CHANNELS -------------------- */}
      <div
        className={`${
          mobileChatOpen ? 'hidden md:flex' : 'flex'
        } w-full md:w-80 border-r border-slate-200 dark:border-slate-800 flex-col bg-slate-50 dark:bg-[#181818] h-full`}
      >
        {/* Header Search & Filter */}
        <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#6264a7]" /> Discussions
            </h2>
            <div className="flex items-center gap-1.5">
              {hiddenConversationIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setShowHiddenOnly(!showHiddenOnly)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition cursor-pointer flex items-center gap-1 ${
                    showHiddenOnly
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 ring-1 ring-amber-400/40'
                      : 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300'
                  }`}
                  title={showHiddenOnly ? 'Afficher les conversations normales' : 'Voir les conversations masquées'}
                >
                  <EyeOff className="w-3 h-3" />
                  <span>{hiddenConversationIds.size} masquée{hiddenConversationIds.size > 1 ? 's' : ''}</span>
                </button>
              )}
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-[#6264a7] dark:text-indigo-400">
                {contacts.length + (showHiddenOnly ? 0 : 1)}
              </span>
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher des contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6264a7]"
            />
          </div>
        </div>

        {/* List of Chats */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {/* General Canal */}
          <button
            type="button"
            onClick={() => {
              setSelectedUid(null);
              setMobileChatOpen(true);
            }}
            className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition cursor-pointer min-h-[44px] ${
              selectedUid === null
                ? 'bg-indigo-50 dark:bg-indigo-950/50 border border-[#6264a7]/30 text-slate-900 dark:text-white'
                : 'hover:bg-slate-200/60 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#6264a7] to-indigo-500 text-white flex items-center justify-center font-bold shadow-sm">
                <Users className="w-5 h-5" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs truncate">Canal Général</span>
                <span className="text-[10px] text-slate-400">Public</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Équipe & canaux ouverts
              </p>
            </div>
          </button>

          <div className="pt-2 pb-1 px-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span>Contacts Directs ({filteredContacts.length})</span>
            {onNavigateToFriends && (
              <button
                type="button"
                onClick={onNavigateToFriends}
                className="text-[#6264a7] dark:text-indigo-400 hover:underline capitalize"
              >
                Gérer
              </button>
            )}
          </div>

          {filteredContacts.length === 0 && (
            <div className="p-3 text-center bg-slate-100/60 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700/60 my-2">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Aucun contact ami pour l'instant.
              </p>
              {onNavigateToFriends && (
                <button
                  type="button"
                  onClick={onNavigateToFriends}
                  className="mt-2 px-2.5 py-1 bg-[#6264a7] text-white text-[10px] font-bold rounded-lg hover:bg-[#525494] transition cursor-pointer"
                >
                  Ajouter des amis
                </button>
              )}
            </div>
          )}

          {filteredContacts.map((contact) => {
            const isSelected = selectedUid === contact.uid;
            return (
              <button
                key={contact.uid}
                type="button"
                onClick={() => {
                  setSelectedUid(contact.uid);
                  setMobileChatOpen(true);
                }}
                className={`w-full flex items-center gap-3 p-2 rounded-xl text-left transition cursor-pointer min-h-[44px] ${
                  isSelected
                    ? 'bg-indigo-50 dark:bg-indigo-950/50 border border-[#6264a7]/30 text-slate-900 dark:text-white'
                    : 'hover:bg-slate-200/60 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="relative flex-shrink-0">
                  <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white flex items-center justify-center font-bold text-xs">
                    {contact.displayName.charAt(0).toUpperCase()}
                  </div>
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ${getStatusBadge(
                      contact.userStatus
                    )}`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs truncate">{contact.displayName}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {contact.statusLabel || contact.email}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* -------------------- RIGHT PANEL: ACTIVE CHAT STAGE -------------------- */}
      <div
        className={`${
          mobileChatOpen ? 'flex' : 'hidden md:flex'
        } flex-1 flex-col h-full bg-white dark:bg-[#1f1f1f] relative min-w-0`}
      >
        {/* Chat Stage Header */}
        <div className="h-14 px-3 sm:px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white/90 dark:bg-[#1f1f1f]/90 backdrop-blur-sm z-10 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-shrink">
            {/* Mobile Back Button */}
            <button
              type="button"
              onClick={() => setMobileChatOpen(false)}
              className="md:hidden p-1.5 -ml-1 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-0.5 text-xs font-bold text-[#6264a7] dark:text-indigo-400 min-h-[38px] flex-shrink-0 cursor-pointer"
              title="Retour aux discussions"
              aria-label="Retour aux discussions"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="relative flex-shrink-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#6264a7] to-indigo-500 text-white flex items-center justify-center font-bold text-xs">
                {selectedContact ? selectedContact.displayName.charAt(0).toUpperCase() : <Users className="w-4 h-4" />}
              </div>
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ${
                  selectedContact ? getStatusBadge(selectedContact.userStatus) : 'bg-emerald-500 ring-white dark:ring-slate-900'
                }`}
              />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-2 truncate">
                {channelTitle}
              </h3>
              <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {selectedContact
                  ? selectedContact.statusLabel || selectedContact.email
                  : `${contacts.length + 1} membres connectés`}
              </p>
            </div>
          </div>

          {/* Action Bar (AI Summarize, Audio, Video, Search, Moderation Menu) */}
          <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
            {/* Gemini Summary Button */}
            <button
              type="button"
              onClick={() => setIsAiSummaryOpen(true)}
              className="px-2 sm:px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 hover:from-indigo-500/20 hover:to-purple-500/20 text-[#6264a7] dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50 flex items-center gap-1.5 text-xs font-semibold transition cursor-pointer shadow-xs min-h-[36px]"
              title="Résumer la discussion avec l'IA"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
              <span className="hidden sm:inline">Résumer avec l'IA</span>
            </button>

            <button
              type="button"
              onClick={() => setShowInChatSearch(!showInChatSearch)}
              className={`p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer ${
                showInChatSearch ? 'bg-indigo-50 dark:bg-indigo-950 text-[#6264a7]' : ''
              }`}
              title="Rechercher dans ce chat"
            >
              <Search className="w-4 h-4" />
            </button>

            {selectedContact && !isSelectedContactBlocked && (
              <>
                <button
                  type="button"
                  onClick={() => handleStartCall('audio')}
                  className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 transition cursor-pointer"
                  title="Appel Audio WebRTC"
                >
                  <Phone className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleStartCall('video')}
                  className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 transition cursor-pointer"
                  title="Appel Vidéo WebRTC"
                >
                  <Video className="w-4 h-4" />
                </button>
              </>
            )}

            {/* Conversation Options Menu (Masquer, Signaler, Bloquer) */}
            {selectedContact && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowChatOptionsMenu(!showChatOptionsMenu)}
                  className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  title="Options de conversation"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {showChatOptionsMenu && (
                  <div className="absolute right-0 top-full mt-1.5 w-52 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl py-1.5 z-40 animate-in zoom-in-95 duration-100 text-xs">
                    {/* Masquer conversation */}
                    <button
                      type="button"
                      onClick={async () => {
                        setShowChatOptionsMenu(false);
                        const convId = [currentUser.uid, selectedContact.uid].sort().join('_');
                        if (hiddenConversationIds.has(convId)) {
                          await unhideConversation(currentUser.uid, convId);
                        } else {
                          await hideConversation(currentUser.uid, convId);
                        }
                      }}
                      className="w-full px-3.5 py-2 text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                      {hiddenConversationIds.has([currentUser.uid, selectedContact.uid].sort().join('_')) ? (
                        <>
                          <Eye className="w-4 h-4 text-indigo-500" />
                          <span>Réafficher la discussion</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-4 h-4 text-slate-500" />
                          <span>Masquer la discussion</span>
                        </>
                      )}
                    </button>

                    {/* Signaler */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowChatOptionsMenu(false);
                        setReportingMessage(null);
                        setIsReportModalOpen(true);
                      }}
                      className="w-full px-3.5 py-2 text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                      <ShieldAlert className="w-4 h-4 text-amber-500" />
                      <span>Signaler l'utilisateur</span>
                    </button>

                    <div className="my-1 border-t border-slate-100 dark:border-slate-700" />

                    {/* Bloquer */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowChatOptionsMenu(false);
                        setIsBlockModalOpen(true);
                      }}
                      className="w-full px-3.5 py-2 text-left flex items-center gap-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-semibold cursor-pointer"
                    >
                      <UserX className="w-4 h-4" />
                      <span>Bloquer {selectedContact.displayName}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Pinned Messages Bar */}
        {pinnedMessages.length > 0 && (
          <div className="px-4 py-1.5 bg-amber-50/70 dark:bg-amber-950/30 border-b border-amber-200/50 dark:border-amber-900/40 flex items-center justify-between text-xs text-amber-900 dark:text-amber-300">
            <div className="flex items-center gap-2 truncate">
              <Pin className="w-3.5 h-3.5 fill-current text-amber-600 flex-shrink-0" />
              <span className="font-semibold text-[11px]">Message épinglé :</span>
              <span className="truncate text-[11px] opacity-90">{pinnedMessages[pinnedMessages.length - 1].text}</span>
            </div>
            <span className="text-[10px] opacity-70 font-mono flex-shrink-0">{pinnedMessages.length} épinglé{pinnedMessages.length > 1 ? 's' : ''}</span>
          </div>
        )}

        {/* In-Chat Search Bar */}
        {showInChatSearch && (
          <div className="px-4 py-2 bg-indigo-50/70 dark:bg-indigo-950/40 border-b border-indigo-100 dark:border-indigo-900/40 flex items-center gap-2 animate-in slide-in-from-top duration-200">
            <Search className="w-3.5 h-3.5 text-indigo-500" />
            <input
              type="text"
              placeholder="Rechercher un mot-clé dans les messages..."
              value={inChatSearchQuery}
              onChange={(e) => setInChatSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
              autoFocus
            />
            {inChatSearchQuery && (
              <button
                type="button"
                onClick={() => setInChatSearchQuery('')}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Messages Feed */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          {displayedMessages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center p-6 space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-slate-800 text-[#6264a7] flex items-center justify-center shadow-inner">
                {inChatSearchQuery ? <SearchX className="w-8 h-8" /> : <Sparkles className="w-8 h-8" />}
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  {inChatSearchQuery ? 'Aucun résultat' : 'Commencez la conversation'}
                </h4>
                <p className="text-xs text-slate-400 max-w-xs mt-1">
                  {inChatSearchQuery
                    ? `Aucun message ne correspond à "${inChatSearchQuery}"`
                    : 'Envoyez un message, une note vocale ou partagez un document avec l\'équipe.'}
                </p>
              </div>
            </div>
          )}

          {displayedMessages.map((msg, index) => {
            const isMe = msg.uid === currentUser.uid;
            const prevMsg = displayedMessages[index - 1];
            const isNewDay =
              !prevMsg ||
              new Date(prevMsg.timestamp).toDateString() !== new Date(msg.timestamp).toDateString();

            const isDeleted = msg.deletedForEveryone;

            return (
              <React.Fragment key={msg.id}>
                {/* Date separator */}
                {isNewDay && (
                  <div className="flex items-center justify-center my-3">
                    <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-semibold shadow-xs">
                      {formatDateHeader(msg.timestamp)}
                    </span>
                  </div>
                )}

                {/* Message Bubble Container */}
                <div
                  className={`group relative flex gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'} items-end`}
                >
                  {/* Sender Avatar */}
                  {!isMe && (
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-[#6264a7] dark:text-indigo-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
                      {msg.name.charAt(0).toUpperCase()}
                    </div>
                  )}

                  {/* Message Content Box */}
                  <div className={`max-w-[82%] sm:max-w-[70%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    {/* Sender Name in Group Chat */}
                    {!isMe && !selectedUid && (
                      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1 ml-1">
                        {msg.name}
                      </span>
                    )}

                    {/* Reply Quoted Preview */}
                    {msg.replyTo && (
                      <div
                        className={`mb-1 px-3 py-1.5 rounded-lg text-[11px] border-l-3 max-w-full truncate ${
                          isMe
                            ? 'bg-indigo-700/60 border-white text-indigo-100'
                            : 'bg-slate-100 dark:bg-slate-800 border-[#6264a7] text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <span className="font-bold mr-1">{msg.replyTo.name}:</span>
                        <span className="italic">{msg.replyTo.text}</span>
                      </div>
                    )}

                    {/* Audio Note Player */}
                    {msg.audioNote && !isDeleted && (
                      <div className="mb-1">
                        <AudioNotePlayer
                          url={msg.audioNote.url}
                          duration={msg.audioNote.duration}
                          isMe={isMe}
                        />
                      </div>
                    )}

                    {/* File Attachment */}
                    {msg.attachment && !isDeleted && (
                      <div className="mb-1">
                        {msg.attachment.type.startsWith('image/') ? (
                          <div
                            onClick={() => setLightboxImage({ url: msg.attachment!.url, name: msg.attachment!.name })}
                            className="rounded-2xl overflow-hidden max-w-xs border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer hover:opacity-95 transition"
                          >
                            <img
                              src={msg.attachment.url}
                              alt={msg.attachment.name}
                              className="max-h-60 w-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                            <div className="p-2 bg-slate-900/80 text-white text-[11px] flex items-center justify-between">
                              <span className="truncate">{msg.attachment.name}</span>
                              <span className="text-[10px] opacity-75">{msg.attachment.size}</span>
                            </div>
                          </div>
                        ) : (
                          <a
                            href={msg.attachment.url}
                            download={msg.attachment.name}
                            className={`flex items-center gap-3 p-3 rounded-2xl border shadow-sm transition max-w-xs ${
                              isMe
                                ? 'bg-indigo-700/80 border-indigo-500 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold truncate">{msg.attachment.name}</p>
                              <p className="text-[10px] opacity-75">{msg.attachment.size}</p>
                            </div>
                            <Download className="w-4 h-4 opacity-80" />
                          </a>
                        )}
                      </div>
                    )}

                    {/* Poll Card Display */}
                    {msg.poll && (
                      <div className="w-full">
                        <PollCard
                          poll={msg.poll}
                          currentUserUid={currentUser.uid}
                          onVote={(optionId) => handleVotePoll(msg.id, optionId)}
                          onToggleClose={() => handleToggleClosePoll(msg.id)}
                          isCreator={msg.poll.createdByUid === currentUser.uid}
                        />
                      </div>
                    )}

                    {/* Standard Text Bubble */}
                    {msg.text && (!msg.audioNote || msg.text !== '🎤 Message vocal') && !msg.poll && (
                      <div
                        className={`relative px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-sm transition ${
                          isMe
                            ? 'bg-[#6264a7] text-white rounded-br-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-bl-xs'
                        } ${isDeleted ? 'italic opacity-70 text-xs' : ''}`}
                      >
                        {isDeleted ? (
                          <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                        ) : (
                          <FormattedText text={msg.text} />
                        )}

                        {/* Translation banner if exists */}
                        {msg.translation && (
                          <div className="mt-2 pt-2 border-t border-white/20 text-xs">
                            <div className="flex items-center gap-1 opacity-75 font-semibold text-[10px] mb-0.5">
                              <Globe className="w-3 h-3" /> Traduction ({msg.translation.lang}) :
                            </div>
                            <p className="italic">{msg.translation.text}</p>
                          </div>
                        )}

                        {/* Meta */}
                        <div
                          className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                            isMe ? 'text-indigo-200' : 'text-slate-400'
                          }`}
                        >
                          {msg.isPinned && <Pin className="w-3 h-3 fill-current text-amber-300" />}
                          {msg.isSaved && <Bookmark className="w-3 h-3 fill-current text-indigo-300" />}
                          {msg.edited && !isDeleted && <span>(modifié)</span>}
                          <span>
                            {new Date(msg.timestamp).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                          {isMe && (
                            <span title={msg.readBy && Object.keys(msg.readBy).length > 1 ? 'Lu' : 'Envoyé'}>
                              {msg.readBy && Object.keys(msg.readBy).length > 1 ? (
                                <CheckCheck className="w-3.5 h-3.5 text-indigo-100" />
                              ) : (
                                <Check className="w-3.5 h-3.5 text-indigo-300" />
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Thread indicator */}
                    {msg.threadReplyCount && msg.threadReplyCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => setActiveThreadMessage(msg)}
                        className="mt-1 flex items-center gap-1.5 text-xs text-[#6264a7] dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>{msg.threadReplyCount} réponse{msg.threadReplyCount > 1 ? 's' : ''}</span>
                      </button>
                    ) : null}

                    {/* Reactions Display */}
                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.entries(msg.reactions).map(([emoji, userList]) => {
                          const users = Array.isArray(userList) ? userList : [];
                          const hasReacted = users.includes(currentUser.uid);
                          return (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => handleToggleReaction(msg.id, emoji)}
                              className={`px-1.5 py-0.5 rounded-full text-xs flex items-center gap-1 border transition cursor-pointer ${
                                hasReacted
                                  ? 'bg-indigo-100 dark:bg-indigo-950 border-indigo-400 text-[#6264a7]'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              <span>{emoji}</span>
                              <span className="text-[10px] font-bold">{users.length}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Message Action Menu */}
                  {!isDeleted && (
                    <div
                      className={`opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-md rounded-lg p-0.5 z-20 ${
                        isMe ? 'order-first' : 'order-last'
                      }`}
                    >
                      {/* Emoji Reaction */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenEmojiPickerId(openEmojiPickerId === msg.id ? null : msg.id)
                          }
                          className="p-1 rounded text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                          title="Réagir"
                        >
                          <Smile className="w-3.5 h-3.5" />
                        </button>

                        {openEmojiPickerId === msg.id && (
                          <div className="absolute bottom-full mb-1 left-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1.5 shadow-xl flex items-center gap-1 z-30 animate-in zoom-in-90 duration-150">
                            {EMOJI_LIST.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => handleToggleReaction(msg.id, emoji)}
                                className="text-base p-1 hover:scale-125 transition cursor-pointer"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Reply in thread */}
                      <button
                        type="button"
                        onClick={() => setActiveThreadMessage(msg)}
                        className="p-1 rounded text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                        title="Répondre dans le fil"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>

                      {/* Reply quote */}
                      <button
                        type="button"
                        onClick={() =>
                          setReplyingTo({
                            id: msg.id,
                            name: msg.name,
                            text: msg.text
                          })
                        }
                        className="p-1 rounded text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                        title="Citer"
                      >
                        <CornerUpLeft className="w-3.5 h-3.5" />
                      </button>

                      {/* Copy */}
                      <button
                        type="button"
                        onClick={() => handleCopyText(msg.id, msg.text)}
                        className="p-1 rounded text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                        title="Copier"
                      >
                        {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>

                      {/* More Menu */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setOpenMenuId(openMenuId === msg.id ? null : msg.id)}
                          className="p-1 rounded text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>

                        {openMenuId === msg.id && (
                          <div className="absolute right-0 bottom-full mb-1 w-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1 z-30 animate-in zoom-in-95 duration-100 text-xs">
                            <button
                              type="button"
                              onClick={() => handleTogglePin(msg)}
                              className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                            >
                              <Pin className="w-3.5 h-3.5" /> {msg.isPinned ? 'Désépingler' : 'Épingler'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleSave(msg)}
                              className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                            >
                              <Bookmark className="w-3.5 h-3.5" /> {msg.isSaved ? 'Retirer des favoris' : 'Enregistrer'}
                            </button>
                            {msg.text && !msg.poll && (
                              <button
                                type="button"
                                onClick={() => handleTranslateMessage(msg, 'en')}
                                className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 cursor-pointer"
                              >
                                <Globe className="w-3.5 h-3.5" /> Traduire le message
                              </button>
                            )}
                            {isMe && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingMessage(msg);
                                  setMessageInput(msg.text);
                                  setOpenMenuId(null);
                                }}
                                className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" /> Modifier
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteForMe(msg.id)}
                              className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Supprimer (pour moi)
                            </button>
                            {isMe && (
                              <button
                                type="button"
                                onClick={() => handleDeleteForEveryone(msg.id)}
                                className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Supprimer (pour tous)
                              </button>
                            )}
                            {!isMe && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  setReportingMessage(msg);
                                  setIsReportModalOpen(true);
                                }}
                                className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-600 dark:text-amber-400 cursor-pointer border-t border-slate-100 dark:border-slate-700"
                              >
                                <ShieldAlert className="w-3.5 h-3.5" /> Signaler ce message
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </React.Fragment>
            );
          })}

          <div ref={messagesEndRef} />
        </div>

        {/* Floating Scroll-to-bottom button */}
        {showScrollBottom && (
          <button
            type="button"
            onClick={() => scrollToBottom(true)}
            className="absolute bottom-24 right-6 p-2 rounded-full bg-[#6264a7] hover:bg-indigo-700 text-white shadow-lg transition active:scale-95 z-20 cursor-pointer"
            title="Aller en bas"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        )}

        {/* Smart Quick Reply Chips */}
        {smartReplies.length > 0 && !isRecordingAudio && !isSelectedContactBlocked && (
          <div className="px-4 py-1.5 bg-slate-50 dark:bg-[#181818] border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="text-[10px] text-slate-400 flex items-center gap-1 font-semibold flex-shrink-0">
              <Sparkles className="w-3 h-3 text-[#6264a7]" /> Suggestions :
            </span>
            {smartReplies.map((reply, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSendMessage(undefined, reply)}
                className="text-xs px-3 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#6264a7] hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-slate-700 dark:text-slate-300 font-medium transition cursor-pointer flex-shrink-0 shadow-2xs"
              >
                {reply}
              </button>
            ))}
          </div>
        )}

        {/* Typing indicator */}
        {typingUsers.length > 0 && !isSelectedContactBlocked && (
          <div className="px-4 py-1 text-[11px] text-[#6264a7] dark:text-indigo-400 italic flex items-center gap-1.5 animate-pulse bg-white/50 dark:bg-[#1f1f1f]/50">
            <span className="w-2 h-2 rounded-full bg-[#6264a7] animate-ping" />
            <span>
              {typingUsers.join(', ')} {typingUsers.length > 1 ? 'sont en train d\'écrire...' : 'est en train d\'écrire...'}
            </span>
          </div>
        )}

        {/* Replying Banner */}
        {replyingTo && !isSelectedContactBlocked && (
          <div className="px-4 py-2 bg-indigo-50 dark:bg-indigo-950/60 border-t border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 truncate">
              <CornerUpLeft className="w-3.5 h-3.5 text-[#6264a7]" />
              <span className="text-slate-600 dark:text-slate-400">Répondre à <strong className="text-slate-800 dark:text-white">{replyingTo.name}</strong>:</span>
              <span className="italic truncate text-slate-500 max-w-xs">{replyingTo.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Editing Banner */}
        {editingMessage && !isSelectedContactBlocked && (
          <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/50 border-t border-amber-200 dark:border-amber-900/50 flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
            <div className="flex items-center gap-2">
              <Edit2 className="w-3.5 h-3.5" />
              <span>Modification du message</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingMessage(null);
                setMessageInput('');
              }}
              className="p-1 text-amber-600 hover:text-amber-800 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Mentions Autocomplete Popover */}
        {mentionQuery !== null && !isSelectedContactBlocked && (
          <div className="absolute bottom-16 left-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl p-2 w-64 z-30 animate-in zoom-in-95 duration-100">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1 flex items-center gap-1">
              <AtSign className="w-3 h-3 text-[#6264a7]" /> Mentionner un membre
            </div>
            {contacts
              .filter((c) => c.displayName.toLowerCase().includes(mentionQuery))
              .slice(0, 4)
              .map((c) => (
                <button
                  key={c.uid}
                  type="button"
                  onClick={() => handleSelectMention(c.displayName)}
                  className="w-full flex items-center gap-2 p-2 rounded-xl text-left hover:bg-indigo-50 dark:hover:bg-slate-700 text-xs text-slate-800 dark:text-white transition cursor-pointer"
                >
                  <div className="w-6 h-6 rounded-lg bg-[#6264a7] text-white flex items-center justify-center font-bold text-[10px]">
                    {c.displayName.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-semibold">{c.displayName}</span>
                </button>
              ))}
          </div>
        )}

        {/* Input Bar or Voice Recorder or Blocked State Indicator */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#181818]">
          {isUploadingAudio && (
            <div className="mb-2 px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-900/60 flex flex-col gap-1.5 text-xs text-indigo-800 dark:text-indigo-200 animate-in fade-in duration-150">
              <div className="flex items-center justify-between font-medium">
                <span className="flex items-center gap-2">
                  <Mic className="w-3.5 h-3.5 text-indigo-600 animate-bounce" />
                  <span>Envoi du message vocal vers le serveur sécurisé...</span>
                </span>
                <span className="font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                  {audioUploadProgress > 0 ? `${audioUploadProgress} %` : 'Préparation...'}
                </span>
              </div>
              <div className="w-full bg-indigo-200/60 dark:bg-indigo-900/60 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-600 h-full rounded-full transition-all duration-200"
                  style={{ width: `${Math.max(5, audioUploadProgress)}%` }}
                />
              </div>
            </div>
          )}

          {isUploadingFile && (
            <div className="mb-2 px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-900/60 flex flex-col gap-1.5 text-xs text-indigo-800 dark:text-indigo-200 animate-in fade-in duration-150">
              <div className="flex items-center justify-between font-medium">
                <span className="flex items-center gap-2">
                  <Paperclip className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
                  <span>Téléversement de la pièce jointe...</span>
                </span>
                <span className="font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                  {fileUploadProgress > 0 ? `${fileUploadProgress} %` : 'Préparation...'}
                </span>
              </div>
              <div className="w-full bg-indigo-200/60 dark:bg-indigo-900/60 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-600 h-full rounded-full transition-all duration-200"
                  style={{ width: `${Math.max(5, fileUploadProgress)}%` }}
                />
              </div>
            </div>
          )}

          {isSelectedContactBlocked ? (
            <div className="p-3.5 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-2xl text-center text-xs text-slate-600 dark:text-slate-300 font-medium flex items-center justify-center gap-2 shadow-2xs">
              <ShieldOff className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              <span>Cette conversation n'est plus disponible.</span>
            </div>
          ) : isRecordingAudio ? (
            <AudioVoiceRecorder
              onSendAudio={handleSendVoiceNote}
              onCancel={() => setIsRecordingAudio(false)}
            />
          ) : (
            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
              {/* File Attachment Button */}
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2.5 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                title="Joindre un fichier ou une image"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              {/* Instant Poll Button */}
              <button
                type="button"
                onClick={() => setShowCreatePoll(true)}
                className="p-2.5 rounded-xl text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800 transition cursor-pointer"
                title="Créer un sondage instantané"
              >
                <BarChart2 className="w-4 h-4" />
              </button>

              {/* Message Input with AI Rephrase trigger */}
              <div className="flex-1 relative flex items-center bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-[#6264a7] focus-within:border-transparent transition">
                <input
                  type="text"
                  placeholder={editingMessage ? 'Modifier votre message...' : 'Écrivez votre message... (tapez @ pour mentionner)'}
                  value={messageInput}
                  onChange={handleInputChange}
                  className="flex-1 bg-transparent text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none pr-7"
                />

                {/* AI Rephrase trigger inside input */}
                {messageInput.trim().length > 3 && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowAiRephraseMenu(!showAiRephraseMenu)}
                      className="p-1 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-700 transition cursor-pointer"
                      title="Améliorer le message avec l'IA"
                    >
                      <Wand2 className={`w-3.5 h-3.5 ${isRephrasing ? 'animate-spin' : ''}`} />
                    </button>

                    {showAiRephraseMenu && (
                      <div className="absolute right-0 bottom-full mb-2 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl py-1.5 z-30 text-xs animate-in zoom-in-95 duration-100">
                        <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-[#6264a7]" /> Améliorer avec Gemini
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAiRephrase('professional')}
                          className="w-full px-3 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                        >
                          🎩 Rendre très professionnel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAiRephrase('concise')}
                          className="w-full px-3 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                        >
                          ⚡ Synthétique & direct
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAiRephrase('friendly')}
                          className="w-full px-3 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                        >
                          🤝 Chaleureux & positif
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAiRephrase('bullet')}
                          className="w-full px-3 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                        >
                          📋 Formater en liste à puces
                        </button>
                        <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
                        <button
                          type="button"
                          onClick={() => handleAiRephrase('translate', 'anglais')}
                          className="w-full px-3 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 cursor-pointer flex items-center gap-1.5"
                        >
                          <Languages className="w-3.5 h-3.5" /> Traduire en Anglais
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Voice Record Button */}
              {!messageInput.trim() ? (
                <button
                  type="button"
                  onClick={() => setIsRecordingAudio(true)}
                  className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-600 dark:text-slate-300 hover:text-rose-600 transition cursor-pointer shadow-xs"
                  title="Enregistrer un message vocal"
                >
                  <Mic className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!messageInput.trim()}
                  className="p-2.5 rounded-xl bg-[#6264a7] hover:bg-indigo-700 disabled:opacity-40 text-white transition active:scale-95 cursor-pointer shadow-md"
                  title="Envoyer"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </form>
          )}
        </div>
      </div>

      {/* -------------------- THREAD SIDE DRAWER -------------------- */}
      <ThreadDrawer
        isOpen={!!activeThreadMessage}
        onClose={() => setActiveThreadMessage(null)}
        parentMessage={activeThreadMessage}
        conversationId={conversationId}
        currentUser={currentUser}
      />

      {/* -------------------- AI SUMMARY MODAL -------------------- */}
      <AiSummaryModal
        isOpen={isAiSummaryOpen}
        onClose={() => setIsAiSummaryOpen(false)}
        messages={messages}
        channelName={channelTitle}
      />

      {/* -------------------- IMAGE LIGHTBOX -------------------- */}
      <ImageLightboxModal
        isOpen={!!lightboxImage}
        onClose={() => setLightboxImage(null)}
        imageUrl={lightboxImage?.url || ''}
        imageName={lightboxImage?.name}
      />

      {/* -------------------- CREATE POLL MODAL -------------------- */}
      <CreatePollModal
        isOpen={showCreatePoll}
        onClose={() => setShowCreatePoll(false)}
        onSubmit={handleCreatePoll}
      />

      {/* -------------------- BLOCK CONFIRMATION MODAL -------------------- */}
      {selectedContact && (
        <BlockConfirmModal
          isOpen={isBlockModalOpen}
          targetUser={selectedContact}
          onClose={() => setIsBlockModalOpen(false)}
          onConfirmSuccess={() => {
            setSelectedUid(null); // Switch to Canal Général after blocking
          }}
          currentUser={currentUser}
        />
      )}

      {/* -------------------- REPORT USER / MESSAGE MODAL -------------------- */}
      {selectedContact && (
        <ReportUserModal
          isOpen={isReportModalOpen}
          targetUser={selectedContact}
          reportedMessage={reportingMessage || undefined}
          conversationId={conversationId}
          onClose={() => {
            setIsReportModalOpen(false);
            setReportingMessage(null);
          }}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};
