import React, { useState, useEffect } from 'react';
import {
  MessageCircle,
  Share2,
  MoreHorizontal,
  Globe,
  Users,
  Lock,
  Trash2,
  Edit3,
  Flag,
  Send,
  Loader2,
  CornerDownRight,
  Check,
  Link as LinkIcon,
  Bookmark,
  EyeOff,
  ThumbsUp,
  MessageSquare,
  X
} from 'lucide-react';
import type {
  UserProfile,
  SocialPost,
  SocialReactionType,
  SocialComment,
  SocialPostMedia
} from '../types';
import {
  togglePostReaction,
  getUserReactionForPost,
  deleteSocialPost,
  updateSocialPost,
  addSocialComment,
  deleteSocialComment,
  updateSocialComment,
  toggleCommentLike,
  createSocialPost,
  toggleSavePost,
  isPostSaved,
  toggleHidePost,
  sharePostToDirectChat
} from '../utils/socialService';
import { rtdb, ref, onValue } from '../firebase';
import { MediaLightboxModal } from './MediaLightboxModal';

interface SocialPostCardProps {
  post: SocialPost;
  currentUser: UserProfile;
  allUsers?: UserProfile[];
  onOpenReportModal?: (targetId: string, authorName: string) => void;
  onOpenProfile?: (uid: string) => void;
  onHashtagClick?: (hashtag: string) => void;
  onPostUpdated?: () => void;
}

const REACTION_CONFIG: Record<
  SocialReactionType,
  { label: string; emoji: string; color: string }
> = {
  like: { label: "J'aime", emoji: '👍', color: 'text-indigo-600 dark:text-indigo-400' },
  love: { label: "J'adore", emoji: '❤️', color: 'text-rose-500' },
  haha: { label: 'Haha', emoji: '😂', color: 'text-amber-500' },
  wow: { label: 'Wow', emoji: '😮', color: 'text-amber-500' },
  sad: { label: 'Triste', emoji: '😢', color: 'text-amber-500' },
  angry: { label: 'En colère', emoji: '😡', color: 'text-orange-600' }
};

export const SocialPostCard: React.FC<SocialPostCardProps> = ({
  post,
  currentUser,
  allUsers = [],
  onOpenReportModal,
  onOpenProfile,
  onHashtagClick,
  onPostUpdated
}) => {
  const [currentReaction, setCurrentReaction] = useState<SocialReactionType | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<SocialComment[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [replyingToComment, setReplyingToComment] = useState<SocialComment | null>(null);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentContent, setEditingCommentContent] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [selectedChatRecipientUid, setSelectedChatRecipientUid] = useState<string>('');
  const [isSendingToChat, setIsSendingToChat] = useState(false);
  const [isDeletingPost, setIsDeletingPost] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const isAuthor = post.authorUid === currentUser.uid;
  const isSuperAdmin = currentUser.email === 'saturninmanahirana261@gmail.com';

  // Charger la réaction actuelle de l'utilisateur
  useEffect(() => {
    let isMounted = true;
    getUserReactionForPost(post.id, currentUser.uid).then((reaction) => {
      if (isMounted) setCurrentReaction(reaction);
    });
    isPostSaved(currentUser.uid, post.id).then((saved) => {
      if (isMounted) setIsSaved(saved);
    });
    return () => {
      isMounted = false;
    };
  }, [post.id, currentUser.uid]);

  // Écouter les commentaires en temps réel
  useEffect(() => {
    if (!showComments) return;

    const commentsRef = ref(rtdb, `social_comments/${post.id}`);
    const unsubscribe = onValue(commentsRef, (snapshot) => {
      const list: SocialComment[] = [];
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          list.push(child.val() as SocialComment);
        });
      }
      list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      setComments(list);
    });

    return () => unsubscribe();
  }, [showComments, post.id]);

  const handleReact = async (type: SocialReactionType) => {
    setShowReactionPicker(false);
    try {
      const res = await togglePostReaction(
        post.id,
        {
          uid: currentUser.uid,
          displayName: currentUser.displayName,
          photoURL: currentUser.photoURL
        },
        type
      );
      setCurrentReaction(res.activeReaction);
      if (onPostUpdated) onPostUpdated();
    } catch (err) {
      console.error('Erreur réaction:', err);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim() || isSubmittingComment) return;

    setIsSubmittingComment(true);
    try {
      await addSocialComment({
        postId: post.id,
        parentCommentId: replyingToComment?.id,
        authorUid: currentUser.uid,
        authorName: currentUser.displayName,
        authorPhotoURL: currentUser.photoURL,
        content: commentInput
      });

      setCommentInput('');
      setReplyingToComment(null);
      if (onPostUpdated) onPostUpdated();
    } catch (err) {
      console.error('Erreur ajout commentaire:', err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteSocialComment(post.id, commentId);
      if (onPostUpdated) onPostUpdated();
    } catch (err) {
      console.error('Erreur suppression commentaire:', err);
    }
  };

  const handleSaveCommentEdit = async (commentId: string) => {
    if (!editingCommentContent.trim()) return;
    try {
      await updateSocialComment(post.id, commentId, editingCommentContent);
      setEditingCommentId(null);
    } catch (err) {
      console.error('Erreur mise à jour commentaire:', err);
    }
  };

  const handleToggleCommentLike = async (commentId: string) => {
    try {
      await toggleCommentLike(post.id, commentId, {
        uid: currentUser.uid,
        displayName: currentUser.displayName,
        photoURL: currentUser.photoURL
      });
    } catch (err) {
      console.error('Erreur like commentaire:', err);
    }
  };

  const handleDeletePost = async () => {
    if (!window.confirm('Voulez-vous vraiment supprimer définitivement cette publication ?')) return;
    setIsDeletingPost(true);
    try {
      await deleteSocialPost(post.id, currentUser.uid);
      if (onPostUpdated) onPostUpdated();
    } catch (err: any) {
      console.error('Erreur suppression post:', err);
      alert(`Impossible de supprimer la publication : ${err?.message || 'Erreur inconnue'}`);
    } finally {
      setIsDeletingPost(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim() || isSavingEdit) return;
    setIsSavingEdit(true);
    try {
      await updateSocialPost(post.id, editContent, post.visibility);
      setIsEditing(false);
      if (onPostUpdated) onPostUpdated();
    } catch (err) {
      console.error('Erreur modification post:', err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleToggleSave = async () => {
    setShowMenu(false);
    const saved = await toggleSavePost(currentUser.uid, post);
    setIsSaved(saved);
  };

  const handleToggleHide = async () => {
    setShowMenu(false);
    await toggleHidePost(currentUser.uid, post.id);
    setIsHidden(true);
  };

  const handleShareToFeed = async () => {
    setIsSharing(true);
    try {
      await createSocialPost({
        authorUid: currentUser.uid,
        authorName: currentUser.displayName,
        authorEmail: currentUser.email,
        authorPhotoURL: currentUser.photoURL,
        content: 'A partagé une publication',
        visibility: 'public',
        sharedPostId: post.id,
        sharedPost: {
          id: post.id,
          authorName: post.authorName,
          authorPhotoURL: post.authorPhotoURL,
          content: post.content,
          media: post.media,
          createdAt: post.createdAt
        }
      });
      setShowShareModal(false);
      alert('Publication partagée sur votre fil avec succès !');
      if (onPostUpdated) onPostUpdated();
    } catch (err) {
      console.error('Erreur partage:', err);
    } finally {
      setIsSharing(false);
    }
  };

  const handleShareToDirectMessage = async () => {
    if (!selectedChatRecipientUid) return;
    setIsSendingToChat(true);
    try {
      await sharePostToDirectChat(post, selectedChatRecipientUid, {
        uid: currentUser.uid,
        displayName: currentUser.displayName,
        photoURL: currentUser.photoURL
      });
      setShowShareModal(false);
      setSelectedChatRecipientUid('');
      alert('Publication envoyée dans la conversation privée !');
      if (onPostUpdated) onPostUpdated();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSendingToChat(false);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Publication de ${post.authorName} sur Raitra Connect`,
          text: post.content,
          url: window.location.href
        });
        setShowShareModal(false);
      } catch {
        // Ignorer si annulé
      }
    } else {
      handleCopyLink();
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => {
      setCopiedLink(false);
      setShowShareModal(false);
    }, 2000);
  };

  const formatRelativeTime = (timestamp: number) => {
    const diffMs = Date.now() - timestamp;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSec < 60) return "À l'instant";
    if (diffMin < 60) return `il y a ${diffMin} min`;
    if (diffHours < 24) return `il y a ${diffHours} h`;
    if (diffDays < 7) return `il y a ${diffDays} j`;
    return new Date(timestamp).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short'
    });
  };

  // Rendu de texte avec hashtags et mentions interactifs
  const renderFormattedText = (text: string) => {
    const parts = text.split(/(\s+)/);
    return parts.map((part, i) => {
      if (part.startsWith('#') && part.length > 1) {
        return (
          <span
            key={i}
            onClick={() => onHashtagClick && onHashtagClick(part)}
            className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
          >
            {part}
          </span>
        );
      }
      if (part.startsWith('@') && part.length > 1) {
        const username = part.substring(1).toLowerCase();
        const matched = allUsers.find((u) => u.displayName.toLowerCase().includes(username));
        return (
          <span
            key={i}
            onClick={() => matched && onOpenProfile && onOpenProfile(matched.uid)}
            className="text-purple-600 dark:text-purple-400 font-bold hover:underline cursor-pointer"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  if (isHidden) {
    return (
      <div className="p-3.5 bg-slate-100 dark:bg-[#18181b] border border-slate-200 dark:border-slate-800 rounded-3xl text-xs text-slate-500 flex items-center justify-between">
        <span>Publication masquée de votre fil.</span>
        <button
          onClick={() => setIsHidden(false)}
          className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
        >
          Annuler
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#1e1e24] border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-2xs transition hover:shadow-xs flex flex-col gap-3 relative">
      {/* Header : Auteur + Date + Options */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            onClick={() => onOpenProfile && onOpenProfile(post.authorUid)}
            className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm overflow-hidden flex-shrink-0 shadow-xs cursor-pointer hover:opacity-90 transition"
          >
            {post.authorPhotoURL ? (
              <img src={post.authorPhotoURL} alt={post.authorName} className="w-full h-full object-cover" />
            ) : (
              post.authorName?.charAt(0).toUpperCase() || 'U'
            )}
          </div>

          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                onClick={() => onOpenProfile && onOpenProfile(post.authorUid)}
                className="font-bold text-sm text-slate-900 dark:text-white cursor-pointer hover:underline"
              >
                {post.authorName}
              </span>
              {post.pageName && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold">
                  Page
                </span>
              )}
              {isSaved && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 font-bold flex items-center gap-0.5">
                  <Bookmark className="w-2.5 h-2.5 fill-current" /> Enregistré
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
              <span>{formatRelativeTime(post.createdAt)}</span>
              <span>•</span>
              {post.visibility === 'public' && <Globe className="w-3 h-3 text-slate-400" title="Public" />}
              {post.visibility === 'friends' && <Users className="w-3 h-3 text-slate-400" title="Amis" />}
              {post.visibility === 'private' && <Lock className="w-3 h-3 text-slate-400" title="Privé" />}
              {post.isEdited && <span className="text-[10px] italic">(modifié)</span>}
            </div>
          </div>
        </div>

        {/* Options Menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu((prev) => !prev)}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl p-1.5 w-48 z-20 animate-in zoom-in-95 duration-100 flex flex-col gap-0.5">
              <button
                onClick={handleToggleSave}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-700 w-full text-left cursor-pointer"
              >
                <Bookmark className="w-3.5 h-3.5 text-amber-500" />
                <span>{isSaved ? 'Retirer des favoris' : 'Enregistrer le post'}</span>
              </button>

              <button
                onClick={handleToggleHide}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-700 w-full text-left cursor-pointer"
              >
                <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                <span>Masquer cette publication</span>
              </button>

              {isAuthor && (
                <button
                  onClick={() => {
                    setIsEditing(true);
                    setShowMenu(false);
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-700 w-full text-left cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Modifier</span>
                </button>
              )}

              {(isAuthor || isSuperAdmin) && (
                <button
                  onClick={() => {
                    setShowMenu(false);
                    handleDeletePost();
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 w-full text-left cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Supprimer</span>
                </button>
              )}

              {!isAuthor && onOpenReportModal && (
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onOpenReportModal(post.id, post.authorName);
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-700 w-full text-left cursor-pointer"
                >
                  <Flag className="w-3.5 h-3.5 text-amber-500" />
                  <span>Signaler la publication</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Post Text or Edit Form */}
      {isEditing ? (
        <div className="flex flex-col gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={3}
            className="w-full bg-transparent text-xs text-slate-800 dark:text-white resize-none outline-hidden"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 rounded-xl text-xs text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
            >
              Annuler
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={isSavingEdit}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 cursor-pointer"
            >
              {isSavingEdit ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-100 whitespace-pre-line break-words leading-relaxed">
          {renderFormattedText(post.content)}
        </p>
      )}

      {/* Media Gallery */}
      {post.media && post.media.length > 0 && (
        <div
          className={`grid gap-2 rounded-2xl overflow-hidden mt-1 ${
            post.media.length === 1
              ? 'grid-cols-1'
              : post.media.length === 2
              ? 'grid-cols-2'
              : 'grid-cols-2 sm:grid-cols-3'
          }`}
        >
          {post.media.map((item, idx) => (
            <div
              key={idx}
              onClick={() => setLightboxIndex(idx)}
              className="relative aspect-video sm:aspect-square bg-slate-900 overflow-hidden group cursor-pointer"
            >
              {item.type === 'image' ? (
                <img
                  src={item.url}
                  alt="Publication media"
                  className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <video src={item.url} className="w-full h-full object-cover" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Shared Post Container */}
      {post.sharedPost && (
        <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/30 flex flex-col gap-2 mt-1">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px] overflow-hidden">
              {post.sharedPost.authorPhotoURL ? (
                <img src={post.sharedPost.authorPhotoURL} alt="" className="w-full h-full object-cover" />
              ) : (
                post.sharedPost.authorName?.charAt(0).toUpperCase() || 'U'
              )}
            </div>
            <span className="font-semibold text-xs text-slate-800 dark:text-white">
              {post.sharedPost.authorName}
            </span>
          </div>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
            {renderFormattedText(post.sharedPost.content)}
          </p>
        </div>
      )}

      {/* Stats Summary Bar */}
      <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800/60">
        <div className="flex items-center gap-1">
          {post.reactionsCount > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="flex -space-x-1">
                {post.reactionsSummary?.like ? <span>👍</span> : null}
                {post.reactionsSummary?.love ? <span>❤️</span> : null}
                {post.reactionsSummary?.haha ? <span>😂</span> : null}
                {post.reactionsSummary?.wow ? <span>😮</span> : null}
                {post.reactionsSummary?.sad ? <span>😢</span> : null}
                {post.reactionsSummary?.angry ? <span>😡</span> : null}
              </span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">{post.reactionsCount}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {post.commentsCount > 0 && (
            <button
              onClick={() => setShowComments((prev) => !prev)}
              className="hover:underline cursor-pointer"
            >
              {post.commentsCount} commentaire{post.commentsCount > 1 ? 's' : ''}
            </button>
          )}
          {post.sharesCount > 0 && (
            <span>{post.sharesCount} partage{post.sharesCount > 1 ? 's' : ''}</span>
          )}
        </div>
      </div>

      {/* Action Buttons with Floating Reactions Picker */}
      <div className="grid grid-cols-3 gap-1 pt-1 border-t border-slate-100 dark:border-slate-800/60 relative">
        {/* Reaction Button & Popover */}
        <div
          className="relative"
          onMouseEnter={() => setShowReactionPicker(true)}
          onMouseLeave={() => setShowReactionPicker(false)}
        >
          {showReactionPicker && (
            <div className="absolute -top-12 left-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full shadow-2xl px-2 py-1.5 flex items-center gap-1.5 z-30 animate-in slide-in-from-bottom-2 duration-150">
              {(Object.keys(REACTION_CONFIG) as SocialReactionType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleReact(type)}
                  className="hover:scale-135 transition transform active:scale-95 text-lg p-1 cursor-pointer"
                  title={REACTION_CONFIG[type].label}
                >
                  {REACTION_CONFIG[type].emoji}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => handleReact(currentReaction || 'like')}
            className={`w-full py-2 rounded-2xl flex items-center justify-center gap-1.5 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer ${
              currentReaction ? REACTION_CONFIG[currentReaction].color : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <span className="text-base leading-none">
              {currentReaction ? REACTION_CONFIG[currentReaction].emoji : '👍'}
            </span>
            <span>{currentReaction ? REACTION_CONFIG[currentReaction].label : "J'aime"}</span>
          </button>
        </div>

        {/* Comment Button */}
        <button
          onClick={() => setShowComments((prev) => !prev)}
          className="w-full py-2 rounded-2xl flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
        >
          <MessageCircle className="w-4 h-4" />
          <span>Commenter</span>
        </button>

        {/* Share Button */}
        <button
          onClick={() => setShowShareModal(true)}
          className="w-full py-2 rounded-2xl flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
        >
          <Share2 className="w-4 h-4" />
          <span>Partager</span>
        </button>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#1e1e24] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-5 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                Partager cette publication
              </h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={handleShareToFeed}
                disabled={isSharing}
                className="w-full p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-semibold text-xs flex items-center gap-3 transition cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>{isSharing ? 'Partage en cours...' : 'Partager dans mon fil'}</span>
              </button>

              {/* Direct Chat Share Picker */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 flex flex-col gap-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                  Envoyer dans Raitra Message
                </span>
                <select
                  value={selectedChatRecipientUid}
                  onChange={(e) => setSelectedChatRecipientUid(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-white outline-hidden"
                >
                  <option value="">Sélectionner un contact...</option>
                  {allUsers
                    .filter((u) => u.uid !== currentUser.uid)
                    .map((u) => (
                      <option key={u.uid} value={u.uid}>
                        {u.displayName}
                      </option>
                    ))}
                </select>

                {selectedChatRecipientUid && (
                  <button
                    onClick={handleShareToDirectMessage}
                    disabled={isSendingToChat}
                    className="w-full py-1.5 rounded-xl bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700 transition cursor-pointer"
                  >
                    {isSendingToChat ? 'Envoi...' : 'Envoyer maintenant'}
                  </button>
                )}
              </div>

              <button
                onClick={handleNativeShare}
                className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs flex items-center gap-3 transition cursor-pointer"
              >
                <Globe className="w-4 h-4" />
                <span>Partager via Android / Applications</span>
              </button>

              <button
                onClick={handleCopyLink}
                className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs flex items-center justify-between transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <LinkIcon className="w-4 h-4" />
                  <span>Copier le lien</span>
                </div>
                {copiedLink && <Check className="w-4 h-4 text-emerald-500" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comments Section */}
      {showComments && (
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-3">
          {/* Comments List */}
          <div className="flex flex-col gap-2.5 max-h-80 overflow-y-auto pr-1">
            {comments.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-2">
                Soyez le premier à commenter cette publication.
              </p>
            ) : (
              comments.map((c) => {
                const isLikedByMe = c.likes?.[currentUser.uid] || false;
                const isCommentAuthor = c.authorUid === currentUser.uid;
                const isReplying = replyingToComment?.id === c.id;

                return (
                  <div
                    key={c.id}
                    className={`flex flex-col gap-1.5 ${
                      c.parentCommentId ? 'ml-6 border-l-2 border-slate-200 dark:border-slate-700 pl-2.5' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2.5 group">
                      <div
                        onClick={() => onOpenProfile && onOpenProfile(c.authorUid)}
                        className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs overflow-hidden flex-shrink-0 cursor-pointer hover:opacity-90 transition"
                      >
                        {c.authorPhotoURL ? (
                          <img src={c.authorPhotoURL} alt={c.authorName} className="w-full h-full object-cover" />
                        ) : (
                          c.authorName?.charAt(0).toUpperCase() || 'U'
                        )}
                      </div>

                      <div className="flex-1 bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-2.5 border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <span
                            onClick={() => onOpenProfile && onOpenProfile(c.authorUid)}
                            className="font-semibold text-xs text-slate-800 dark:text-white cursor-pointer hover:underline"
                          >
                            {c.authorName}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-400">
                              {formatRelativeTime(c.createdAt)}
                            </span>
                            {isCommentAuthor && (
                              <button
                                onClick={() => {
                                  setEditingCommentId(c.id);
                                  setEditingCommentContent(c.content);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-indigo-600 transition"
                                title="Modifier"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                            )}
                            {(isCommentAuthor || isSuperAdmin) && (
                              <button
                                onClick={() => handleDeleteComment(c.id)}
                                className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-rose-500 transition"
                                title="Supprimer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        {editingCommentId === c.id ? (
                          <div className="flex flex-col gap-1.5 mt-1">
                            <input
                              type="text"
                              value={editingCommentContent}
                              onChange={(e) => setEditingCommentContent(e.target.value)}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1 text-xs text-slate-800 dark:text-white outline-hidden"
                            />
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => setEditingCommentId(null)}
                                className="text-[10px] text-slate-400 hover:text-slate-600"
                              >
                                Annuler
                              </button>
                              <button
                                onClick={() => handleSaveCommentEdit(c.id)}
                                className="text-[10px] font-bold text-indigo-600 hover:underline"
                              >
                                Enregistrer
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-700 dark:text-slate-200 mt-0.5 whitespace-pre-line leading-relaxed">
                            {renderFormattedText(c.content)}
                          </p>
                        )}

                        {/* Comment Actions: Like & Reply */}
                        <div className="flex items-center gap-3 mt-1.5 text-[10px] font-semibold">
                          <button
                            onClick={() => handleToggleCommentLike(c.id)}
                            className={`flex items-center gap-1 cursor-pointer transition ${
                              isLikedByMe ? 'text-indigo-600 font-bold' : 'text-slate-400 hover:text-slate-600'
                            }`}
                          >
                            <ThumbsUp className={`w-3 h-3 ${isLikedByMe ? 'fill-current' : ''}`} />
                            <span>{(c.reactionsCount || 0) > 0 ? c.reactionsCount : "J'aime"}</span>
                          </button>

                          <button
                            onClick={() => {
                              setReplyingToComment(c);
                              setCommentInput(`@${c.authorName} `);
                            }}
                            className="text-slate-400 hover:text-indigo-600 cursor-pointer"
                          >
                            Répondre
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Add Comment Input Form */}
          <form onSubmit={handleAddComment} className="flex flex-col gap-1.5">
            {replyingToComment && (
              <div className="flex items-center justify-between px-2 text-[10px] text-indigo-600 dark:text-indigo-400">
                <span className="flex items-center gap-1">
                  <CornerDownRight className="w-3 h-3" />
                  Réponse à <strong>{replyingToComment.authorName}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setReplyingToComment(null);
                    setCommentInput('');
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs overflow-hidden flex-shrink-0">
                {currentUser.photoURL ? (
                  <img src={currentUser.photoURL} alt={currentUser.displayName} className="w-full h-full object-cover" />
                ) : (
                  currentUser.displayName?.charAt(0).toUpperCase() || 'U'
                )}
              </div>

              <div className="flex-1 flex items-center bg-slate-100 dark:bg-slate-800/80 rounded-2xl px-3 py-1.5 border border-slate-200 dark:border-slate-700/60">
                <input
                  type="text"
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder={replyingToComment ? `Répondre à ${replyingToComment.authorName}...` : "Écrire un commentaire (#hashtag, @nom)..."}
                  className="w-full bg-transparent text-xs text-slate-800 dark:text-white placeholder-slate-400 outline-hidden"
                />
                <button
                  type="submit"
                  disabled={!commentInput.trim() || isSubmittingComment}
                  className="p-1.5 text-indigo-600 disabled:opacity-40 hover:scale-110 transition cursor-pointer"
                >
                  {isSubmittingComment ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Fullscreen Lightbox Modal */}
      {lightboxIndex !== null && post.media && (
        <MediaLightboxModal
          mediaList={post.media}
          initialIndex={lightboxIndex}
          authorName={post.authorName}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
};
