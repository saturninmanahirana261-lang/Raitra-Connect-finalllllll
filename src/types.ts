export type PresenceStatus = 'available' | 'busy' | 'dnd' | 'away' | 'offline';
export type UserRole = 'owner' | 'admin' | 'member' | 'guest';

export type RaitraSpace = 'message' | 'social';
export type MessageViewType = 'home' | 'chat' | 'friends' | 'teams' | 'calls' | 'calendar' | 'files';
export type SocialViewType = 'feed' | 'stories' | 'publications' | 'pages' | 'friends' | 'notifications' | 'search';

export type FriendshipStatus = 'pending' | 'accepted' | 'declined' | 'blocked';
export type SocialRelationState = 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'declined' | 'blocked';

export interface Friendship {
  id: string; // Deterministic: [uid1, uid2].sort().join('_')
  users: string[]; // [uid1, uid2].sort()
  user1Id: string;
  user2Id: string;
  senderId: string;
  senderName?: string;
  receiverId: string;
  receiverName?: string;
  status: FriendshipStatus;
  createdAt: number;
  updatedAt: number;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  username?: string;
  email: string;
  photoURL?: string;
  role?: UserRole;
  title?: string;
  department?: string;
  phone?: string;
  location?: string;
  status: 'online' | 'offline';
  userStatus: PresenceStatus;
  statusMessage?: string;
  statusLabel?: string;
  createdAt?: number;
  lastSeen?: number;
  isFavorite?: boolean;
}

export interface MessageReaction {
  [emoji: string]: string[]; // emoji -> array of userIds
}

export interface ReplyPreview {
  id: string;
  name: string;
  text: string;
}

export interface PollOption {
  id: string;
  text: string;
  votes: string[]; // user UIDs
}

export interface PollData {
  id: string;
  question: string;
  options: PollOption[];
  createdByUid: string;
  createdByName: string;
  createdAt: number;
  isClosed?: boolean;
  allowMultiple?: boolean;
}

export interface ChatMessage {
  id: string;
  uid: string;
  name: string;
  email?: string;
  text: string;
  timestamp: number;
  edited?: boolean;
  editedAt?: number;
  deletedForEveryone?: boolean;
  deletedFor?: Record<string, boolean>;
  readBy?: Record<string, boolean>;
  deliveredTo?: Record<string, boolean>;
  reactions?: MessageReaction;
  replyTo?: ReplyPreview;
  format?: 'plain' | 'markdown' | 'code';
  poll?: PollData;
  translation?: {
    lang: string;
    text: string;
  };
  attachment?: {
    name: string;
    url: string;
    type: string;
    size: string;
  };
  audioNote?: {
    url: string;
    duration: number; // in seconds
    mimeType?: string;
    size?: number;
  };
  isPinned?: boolean;
  pinnedBy?: string;
  pinnedAt?: number;
  isSaved?: boolean;
  mentions?: string[];
  threadParentId?: string;
  threadReplyCount?: number;
  lastReplyTimestamp?: number;
}

export interface MeetingActionItem {
  id: string;
  task: string;
  assigneeName?: string;
  assigneeUid?: string;
  done: boolean;
  dueDate?: string;
}

export interface MeetingEvent {
  id: string;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  time?: string;
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  channelId?: string;
  organizerUid: string;
  organizerName: string;
  participantsCount?: number;
  attendees?: string[]; // uids or emails
  roomId?: string;
  meetingType?: 'video' | 'audio';
  isRecurring?: boolean;
  isLive?: boolean;
  actionItems?: MeetingActionItem[];
  meetingSummary?: string;
  createdAt?: number;
}

export interface WhiteboardStroke {
  id: string;
  type: 'pencil' | 'eraser' | 'line' | 'rect' | 'circle' | 'text' | 'arrow';
  points: { x: number; y: number }[];
  color: string;
  width: number;
  text?: string;
  userId?: string;
  timestamp?: number;
}

export interface SharedFolderItem {
  id: string;
  name: string;
  parentId?: string | null;
  teamId?: string;
  creatorUid: string;
  creatorName: string;
  createdAt: number;
  color?: string;
}

export interface SharedFileItem {
  id: string;
  name: string;
  url?: string;
  type: string;
  size: string;
  authorName?: string;
  authorUid?: string;
  uploadedByUid?: string;
  uploadedByName?: string;
  channelId?: string;
  chatId?: string;
  folderId?: string | null;
  teamId?: string;
  date?: string;
  timestamp: number;
  createdAt?: number;
  category?: 'image' | 'document' | 'audio' | 'archive' | 'sheet' | 'code' | 'other';
}

export interface ContactRequest {
  id: string;
  fromUid: string;
  fromName: string;
  fromEmail: string;
  toUid: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: number;
}

export interface CallSession {
  id: string;
  callerUid: string;
  callerName: string;
  calleeUid: string;
  calleeName: string;
  type: 'audio' | 'video';
  status: 'ringing' | 'connected' | 'rejected' | 'ended' | 'busy' | 'cancelled';
  createdAt: number;
  connectedAt?: number;
  endedAt?: number;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  callerCandidates?: Record<string, RTCIceCandidateInit>;
  calleeCandidates?: Record<string, RTCIceCandidateInit>;
}

export interface CallHistoryItem {
  id: string;
  callId: string;
  partnerUid: string;
  partnerName: string;
  partnerPhotoURL?: string;
  type: 'audio' | 'video';
  direction: 'incoming' | 'outgoing' | 'missed';
  status: 'connected' | 'missed' | 'rejected' | 'ended' | 'busy' | 'cancelled';
  durationSeconds: number;
  timestamp: number;
}

export interface TeamMember {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
  joinedAt: number;
}

export interface TeamChannel {
  id: string;
  name: string;
  description: string;
  icon?: string;
  membersCount: number;
  isPrivate?: boolean;
  allowedMemberUids?: string[];
}

export interface NotificationItem {
  id: string;
  type: 'message' | 'call' | 'contact' | 'system' | 'poll' | 'meeting';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  actionUrl?: string;
}

// -------------------- MODÉRATION, BLOCAGE ET CONFIDENTIALITÉ --------------------

export interface UserBlock {
  id: string; // block_{blockerId}_{blockedUserId}
  blockerId: string;
  blockedUserId: string;
  blockedUserName?: string;
  blockedUserEmail?: string;
  reason?: string;
  createdAt: number;
}

export type ReportCategory =
  | 'spam'
  | 'harassment'
  | 'hate_speech'
  | 'fake_account'
  | 'fraud'
  | 'inappropriate'
  | 'impersonation'
  | 'other';

export type ReportStatus = 'PENDING' | 'REVIEWED' | 'RESOLVED' | 'DISMISSED';

export interface UserReport {
  id: string;
  reporterId: string;
  reporterName?: string;
  reporterEmail?: string;
  reportedUserId: string;
  reportedUserName?: string;
  reportedUserEmail?: string;
  category: ReportCategory;
  description: string;
  conversationId?: string;
  messageId?: string;
  messageSnippet?: string;
  createdAt: number;
  status: ReportStatus;
}

export interface HiddenConversation {
  id: string; // {userId}_{conversationId}
  userId: string;
  conversationId: string;
  hiddenAt: number;
}

// -------------------- MODULE SOCIAL RAITRA CONNECT (ACTUALITÉS) --------------------

export type SocialReactionType = 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry';

export interface SocialPostReactionSummary {
  like: number;
  love: number;
  haha: number;
  wow: number;
  sad: number;
  angry: number;
}

export type SocialVisibility = 'public' | 'friends' | 'private';

export interface SocialPostMedia {
  url: string;
  type: 'image' | 'video';
  thumbnailUrl?: string;
  name?: string;
  size?: number;
}

export interface SocialPost {
  id: string;
  authorUid: string;
  authorName: string;
  authorEmail?: string;
  authorPhotoURL?: string;
  content: string;
  media?: SocialPostMedia[];
  visibility: SocialVisibility;
  pageId?: string;
  pageName?: string;
  pageAvatar?: string;
  reactionsCount: number;
  reactionsSummary: SocialPostReactionSummary;
  commentsCount: number;
  sharesCount: number;
  sharedPostId?: string;
  sharedPost?: {
    id: string;
    authorName: string;
    authorPhotoURL?: string;
    content: string;
    media?: SocialPostMedia[];
    createdAt: number;
  };
  createdAt: number;
  updatedAt?: number;
  isEdited?: boolean;
}

export interface SocialPostReaction {
  id: string; // `${postId}_${uid}`
  postId: string;
  uid: string;
  userName: string;
  userPhotoURL?: string;
  reaction: SocialReactionType;
  createdAt: number;
}

export interface SocialComment {
  id: string;
  postId: string;
  parentCommentId?: string; // pour les réponses aux commentaires
  authorUid: string;
  authorName: string;
  authorPhotoURL?: string;
  content: string;
  reactionsCount?: number;
  likes?: Record<string, boolean>; // UIDs ayant aimé ce commentaire
  isEdited?: boolean;
  createdAt: number;
}

export interface StoryViewerDetail {
  uid: string;
  displayName: string;
  photoURL?: string;
  viewedAt: number;
}

export interface SocialStory {
  id: string;
  authorUid: string;
  authorName: string;
  authorPhotoURL?: string;
  mediaUrl: string;
  mediaType: 'image' | 'video' | 'text';
  textCaption?: string;
  bgColor?: string;
  visibility: SocialVisibility;
  viewers: string[]; // liste des UIDs ayant vu la story
  viewersDetails?: Record<string, StoryViewerDetail>; // détails des spectateurs
  viewersCount: number;
  createdAt: number;
  expiresAt: number; // createdAt + 24 heures (86400000 ms)
}

export type PageRole = 'owner' | 'admin' | 'editor' | 'moderator';

export interface SocialPage {
  id: string;
  name: string;
  category: string;
  description: string;
  avatarUrl?: string;
  coverUrl?: string;
  website?: string;
  location?: string;
  ownerUid: string;
  admins: string[]; // UIDs
  editors?: string[]; // UIDs
  moderators?: string[]; // UIDs
  followersCount: number;
  createdAt: number;
  updatedAt?: number;
}

export interface SocialPageFollower {
  id: string; // `${pageId}_${uid}`
  pageId: string;
  uid: string;
  userName: string;
  userPhotoURL?: string;
  createdAt: number;
}

export interface SocialNotification {
  id: string;
  recipientUid: string;
  senderUid: string;
  senderName: string;
  senderPhotoURL?: string;
  type: 'reaction' | 'comment' | 'reply' | 'share' | 'page_post' | 'story' | 'follow' | 'mention' | 'friend_request' | 'friend_accept';
  targetId: string; // postId, pageId, storyId, etc.
  message: string;
  isRead: boolean;
  createdAt: number;
}


