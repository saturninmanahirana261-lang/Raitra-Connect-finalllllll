import {
  auth,
  rtdb,
  ref,
  push,
  set,
  get,
  update,
  remove,
  onValue
} from '../firebase';
import type {
  SocialPost,
  SocialPostMedia,
  SocialReactionType,
  SocialPostReaction,
  SocialComment,
  SocialStory,
  SocialPage,
  SocialPageFollower,
  SocialNotification,
  SocialVisibility
} from '../types';
import { uploadToCloudinary } from './cloudinaryService';

// ==========================================
// 0. SÉCURITÉ & ASSAINISSEMENT FIREBASE RTDB
// ==========================================

/**
 * Détecte récursivement toutes les clés dont la valeur est `undefined`
 */
export function findUndefinedPaths(obj: any, currentPath = ''): string[] {
  if (obj === undefined) {
    return [currentPath || 'root'];
  }
  if (obj === null || typeof obj !== 'object') {
    return [];
  }
  const paths: string[] = [];
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      paths.push(...findUndefinedPaths(item, `${currentPath}[${index}]`));
    });
  } else {
    for (const [key, value] of Object.entries(obj)) {
      const p = currentPath ? `${currentPath}.${key}` : key;
      if (value === undefined) {
        paths.push(p);
      } else if (typeof value === 'object' && value !== null) {
        paths.push(...findUndefinedPaths(value, p));
      }
    }
  }
  return paths;
}

/**
 * Assainit récursivement un objet en supprimant toutes les clés dont la valeur est `undefined`
 * et en filtrant les `undefined` dans les tableaux.
 */
export function cleanUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => cleanUndefined(item)) as unknown as T;
  }

  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (typeof value === 'object' && value !== null) {
        cleaned[key] = cleanUndefined(value);
      } else {
        cleaned[key] = value;
      }
    }
  }
  return cleaned as T;
}

// ==========================================
// 1. COMPRESSION ET TÉLÉVERSEMENT DE MÉDIAS
// ==========================================

export async function compressImage(file: File, maxWidth = 1920, maxHeight = 1920, quality = 0.82): Promise<Blob> {
  return new Promise((resolve) => {
    // Si c'est un GIF ou autre format animé, on ne compresse pas
    if (file.type === 'image/gif') {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
}

/**
 * Téléverse un média social (image/vidéo) vers Cloudinary avec progression et fallback local.
 */
export async function uploadSocialMedia(
  file: File,
  userId: string,
  folder: 'posts' | 'stories' | 'pages',
  onProgress?: (progress: number) => void
): Promise<string> {
  let uploadBlob: Blob = file;

  if (file.type.startsWith('image/')) {
    try {
      uploadBlob = await compressImage(file);
    } catch {
      uploadBlob = file;
    }
  }

  const cloudinaryFolder =
    folder === 'posts'
      ? 'raitra-connect/social_posts'
      : folder === 'stories'
      ? 'raitra-connect/social_stories'
      : 'raitra-connect/social_pages';

  const result = await uploadToCloudinary(uploadBlob, {
    folder: cloudinaryFolder,
    userId,
    fileName: file.name,
    onProgress
  });

  return result.secureUrl;
}

// ==========================================
// 2. GESTION DES PUBLICATIONS (POSTS)
// ==========================================

export async function createSocialPost(params: {
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
  sharedPostId?: string;
  sharedPost?: SocialPost['sharedPost'];
}): Promise<string> {
  const postRef = push(ref(rtdb, 'social_posts'));
  const postId = postRef.key as string;

  const postData: Record<string, any> = {
    id: postId,
    authorUid: params.authorUid,
    authorName: params.authorName || 'Utilisateur',
    authorEmail: params.authorEmail || '',
    authorPhotoURL: params.authorPhotoURL || '',
    content: (params.content || '').trim(),
    media: params.media || [],
    visibility: params.visibility || 'public',
    reactionsCount: 0,
    reactionsSummary: {
      like: 0,
      love: 0,
      haha: 0,
      wow: 0,
      sad: 0,
      angry: 0
    },
    commentsCount: 0,
    sharesCount: 0,
    createdAt: Date.now()
  };

  if (params.pageId) postData.pageId = params.pageId;
  if (params.pageName) postData.pageName = params.pageName;
  if (params.pageAvatar) postData.pageAvatar = params.pageAvatar;
  if (params.sharedPostId) postData.sharedPostId = params.sharedPostId;
  if (params.sharedPost) postData.sharedPost = cleanUndefined(params.sharedPost);

  const undefinedPaths = findUndefinedPaths(postData);
  if (undefinedPaths.length > 0) {
    console.error('[createSocialPost] Propriétés undefined détectées:', undefinedPaths);
  }

  const safePost = cleanUndefined(postData);
  await set(postRef, safePost);

  // Si c'est un repartage, incrémenter le compteur de partages du post original
  if (params.sharedPostId) {
    try {
      const origPostRef = ref(rtdb, `social_posts/${params.sharedPostId}`);
      const snap = await get(origPostRef);
      if (snap.exists()) {
        const currentShares = snap.val().sharesCount || 0;
        await update(origPostRef, { sharesCount: currentShares + 1 });
      }
    } catch (e) {
      console.warn('Impossible d\'incrémenter le compteur de partage:', e);
    }
  }

  return postId;
}

export async function updateSocialPost(
  postId: string,
  content: string,
  visibility: SocialVisibility
): Promise<void> {
  const postRef = ref(rtdb, `social_posts/${postId}`);
  const updateData: Record<string, any> = {
    content: content.trim(),
    visibility,
    isEdited: true,
    updatedAt: Date.now()
  };
  await update(postRef, cleanUndefined(updateData));
}

export async function deleteSocialPost(postId: string, currentUid?: string): Promise<void> {
  const currentAuthUser = auth.currentUser;
  const callerUid = currentUid || currentAuthUser?.uid;
  const callerEmail = currentAuthUser?.email;

  if (!callerUid) {
    throw new Error("Action refusée : Vous devez être connecté pour supprimer une publication.");
  }

  // 1. Récupérer la publication existante pour valider l'auteur
  const postRef = ref(rtdb, `social_posts/${postId}`);
  const postSnap = await get(postRef);

  if (!postSnap.exists()) {
    console.warn(`[deleteSocialPost] La publication ${postId} est introuvable ou déjà supprimée.`);
    return;
  }

  const postData = postSnap.val() as SocialPost;
  const isSuperAdmin = callerEmail === 'saturninmanahirana261@gmail.com';

  if (postData.authorUid !== callerUid && !isSuperAdmin) {
    throw new Error("Action non autorisée : Vous ne pouvez supprimer que vos propres publications.");
  }

  console.log(`[deleteSocialPost] Suppression de la publication ${postId} (Auteur: ${postData.authorUid}, Demandeur: ${callerUid})`);

  // 2. Suppression de la publication principale dans Firebase RTDB
  await remove(postRef);

  // 3. Suppression en cascade des données associées (commentaires, réactions, sauvegardes, masquages)
  await Promise.allSettled([
    remove(ref(rtdb, `social_comments/${postId}`)),
    remove(ref(rtdb, `social_post_reactions/${postId}`)),
    remove(ref(rtdb, `social_saved_posts/${callerUid}/${postId}`)),
    remove(ref(rtdb, `social_hidden_posts/${callerUid}/${postId}`))
  ]);

  console.log(`[deleteSocialPost] Publication ${postId} et données associées supprimées avec succès.`);
}

// ==========================================
// 3. RÉACTIONS AUX PUBLICATIONS
// ==========================================

export async function togglePostReaction(
  postId: string,
  user: { uid: string; displayName: string; photoURL?: string },
  newReaction: SocialReactionType
): Promise<{ activeReaction: SocialReactionType | null }> {
  const reactionRef = ref(rtdb, `social_post_reactions/${postId}/${user.uid}`);
  const postRef = ref(rtdb, `social_posts/${postId}`);

  const [reactionSnap, postSnap] = await Promise.all([
    get(reactionRef),
    get(postRef)
  ]);

  const existingData = reactionSnap.exists() ? (reactionSnap.val() as SocialPostReaction) : null;
  const postData = postSnap.exists() ? (postSnap.val() as SocialPost) : null;

  const currentSummary = postData?.reactionsSummary || {
    like: 0,
    love: 0,
    haha: 0,
    wow: 0,
    sad: 0,
    angry: 0
  };
  const currentCount = postData?.reactionsCount || 0;

  if (existingData) {
    if (existingData.reaction === newReaction) {
      // Retirer la réaction
      await remove(reactionRef);
      if (postData) {
        const newSummary = {
          ...currentSummary,
          [newReaction]: Math.max(0, (currentSummary[newReaction] || 1) - 1)
        };
        await update(postRef, {
          reactionsCount: Math.max(0, currentCount - 1),
          reactionsSummary: newSummary
        });
      }
      return { activeReaction: null };
    } else {
      // Changer de réaction (ex: de like à love)
      const oldReaction = existingData.reaction;
      await update(reactionRef, {
        reaction: newReaction,
        createdAt: Date.now()
      });
      if (postData) {
        const newSummary = {
          ...currentSummary,
          [oldReaction]: Math.max(0, (currentSummary[oldReaction] || 1) - 1),
          [newReaction]: (currentSummary[newReaction] || 0) + 1
        };
        await update(postRef, {
          reactionsSummary: newSummary
        });
      }
      return { activeReaction: newReaction };
    }
  } else {
    // Ajouter une nouvelle réaction
    const newReactionData: SocialPostReaction = {
      id: `${postId}_${user.uid}`,
      postId,
      uid: user.uid,
      userName: user.displayName,
      userPhotoURL: user.photoURL || '',
      reaction: newReaction,
      createdAt: Date.now()
    };
    await set(reactionRef, cleanUndefined(newReactionData));

    if (postData) {
      const newSummary = {
        ...currentSummary,
        [newReaction]: (currentSummary[newReaction] || 0) + 1
      };
      await update(postRef, {
        reactionsCount: currentCount + 1,
        reactionsSummary: newSummary
      });

      // Notification à l'auteur du post
      if (postData.authorUid !== user.uid) {
        await createSocialNotification({
          recipientUid: postData.authorUid,
          senderUid: user.uid,
          senderName: user.displayName,
          senderPhotoURL: user.photoURL,
          type: 'reaction',
          targetId: postId,
          message: `a réagi avec ${newReaction} à votre publication.`
        }).catch(() => {});
      }
    }

    return { activeReaction: newReaction };
  }
}

export async function getUserReactionForPost(postId: string, uid: string): Promise<SocialReactionType | null> {
  try {
    const snap = await get(ref(rtdb, `social_post_reactions/${postId}/${uid}`));
    if (snap.exists()) {
      return (snap.val() as SocialPostReaction).reaction;
    }
  } catch {
    // Ignorer si indisponible
  }
  return null;
}

// ==========================================
// 4. COMMENTAIRES AUX PUBLICATIONS
// ==========================================

export async function addSocialComment(params: {
  postId: string;
  parentCommentId?: string;
  authorUid: string;
  authorName: string;
  authorPhotoURL?: string;
  content: string;
}): Promise<SocialComment> {
  const commentsListRef = ref(rtdb, `social_comments/${params.postId}`);
  const newCommentRef = push(commentsListRef);
  const commentId = newCommentRef.key as string;

  const commentData: Record<string, any> = {
    id: commentId,
    postId: params.postId,
    authorUid: params.authorUid,
    authorName: params.authorName || 'Utilisateur',
    authorPhotoURL: params.authorPhotoURL || '',
    content: (params.content || '').trim(),
    reactionsCount: 0,
    createdAt: Date.now()
  };

  if (params.parentCommentId) {
    commentData.parentCommentId = params.parentCommentId;
  }

  const safeComment = cleanUndefined(commentData) as SocialComment;
  await set(newCommentRef, safeComment);

  // Incrémenter le compteur de commentaires sur le post
  try {
    const postRef = ref(rtdb, `social_posts/${params.postId}`);
    const postSnap = await get(postRef);
    if (postSnap.exists()) {
      const postData = postSnap.val() as SocialPost;
      const count = postData.commentsCount || 0;
      await update(postRef, { commentsCount: count + 1 });

      if (postData.authorUid !== params.authorUid) {
        await createSocialNotification({
          recipientUid: postData.authorUid,
          senderUid: params.authorUid,
          senderName: params.authorName,
          senderPhotoURL: params.authorPhotoURL,
          type: params.parentCommentId ? 'reply' : 'comment',
          targetId: params.postId,
          message: params.parentCommentId ? 'a répondu à un commentaire.' : 'a commenté votre publication.'
        }).catch(() => {});
      }
    }
  } catch (e) {
    console.warn('Erreur mise à jour compteur commentaire:', e);
  }

  return safeComment;
}

export async function deleteSocialComment(postId: string, commentId: string): Promise<void> {
  await remove(ref(rtdb, `social_comments/${postId}/${commentId}`));

  try {
    const postRef = ref(rtdb, `social_posts/${postId}`);
    const postSnap = await get(postRef);
    if (postSnap.exists()) {
      const count = postSnap.val().commentsCount || 0;
      await update(postRef, { commentsCount: Math.max(0, count - 1) });
    }
  } catch (e) {
    console.warn('Erreur décrémentation commentaire:', e);
  }
}

export async function updateSocialComment(
  postId: string,
  commentId: string,
  newContent: string
): Promise<void> {
  const commentRef = ref(rtdb, `social_comments/${postId}/${commentId}`);
  await update(commentRef, {
    content: newContent.trim(),
    isEdited: true,
    updatedAt: Date.now()
  });
}

export async function toggleCommentLike(
  postId: string,
  commentId: string,
  user: { uid: string; displayName: string; photoURL?: string }
): Promise<boolean> {
  const likeRef = ref(rtdb, `social_comments/${postId}/${commentId}/likes/${user.uid}`);
  const commentRef = ref(rtdb, `social_comments/${postId}/${commentId}`);

  const [likeSnap, commentSnap] = await Promise.all([
    get(likeRef),
    get(commentRef)
  ]);

  if (likeSnap.exists()) {
    await remove(likeRef);
    if (commentSnap.exists()) {
      const current = commentSnap.val().reactionsCount || 1;
      await update(commentRef, { reactionsCount: Math.max(0, current - 1) });
    }
    return false;
  } else {
    await set(likeRef, true);
    if (commentSnap.exists()) {
      const commentData = commentSnap.val();
      const current = commentData.reactionsCount || 0;
      await update(commentRef, { reactionsCount: current + 1 });

      if (commentData.authorUid && commentData.authorUid !== user.uid) {
        await createSocialNotification({
          recipientUid: commentData.authorUid,
          senderUid: user.uid,
          senderName: user.displayName,
          senderPhotoURL: user.photoURL,
          type: 'reaction',
          targetId: postId,
          message: 'a aimé votre commentaire.'
        }).catch(() => {});
      }
    }
    return true;
  }
}

// ==========================================
// 5. STORIES 24 HEURES
// ==========================================

export async function createSocialStory(params: {
  authorUid: string;
  authorName: string;
  authorPhotoURL?: string;
  mediaUrl: string;
  mediaType: 'image' | 'video' | 'text';
  textCaption?: string;
  bgColor?: string;
  visibility?: SocialVisibility;
}): Promise<string> {
  const storyRef = push(ref(rtdb, 'social_stories'));
  const storyId = storyRef.key as string;
  const now = Date.now();
  const expiresAt = now + 24 * 60 * 60 * 1000; // 24h

  // Objet de base avec valeurs garanties (strictement aucune valeur undefined)
  const storyData: Record<string, any> = {
    id: storyId,
    authorUid: params.authorUid,
    authorName: params.authorName || 'Utilisateur',
    authorPhotoURL: params.authorPhotoURL || '',
    mediaUrl: params.mediaUrl || '',
    mediaType: params.mediaType,
    visibility: params.visibility || 'public',
    viewers: [params.authorUid],
    viewersDetails: {
      [params.authorUid]: {
        uid: params.authorUid,
        displayName: params.authorName || 'Auteur',
        photoURL: params.authorPhotoURL || '',
        viewedAt: now
      }
    },
    viewersCount: 1,
    createdAt: now,
    expiresAt
  };

  // Propriétés optionnelles ajoutées UNIQUEMENT si non-vides
  if (params.textCaption && params.textCaption.trim()) {
    storyData.textCaption = params.textCaption.trim();
  }

  if (params.bgColor && params.bgColor.trim()) {
    storyData.bgColor = params.bgColor.trim();
  }

  // Détection de sécurité pré-écriture
  const undefinedPaths = findUndefinedPaths(storyData);
  if (undefinedPaths.length > 0) {
    console.error('[createSocialStory] Propriétés undefined détectées:', undefinedPaths);
  }

  // Assainissement absolu
  const safeStory = cleanUndefined(storyData);
  await set(storyRef, safeStory);
  return storyId;
}

export async function markStoryAsViewed(
  storyId: string,
  viewer: { uid: string; displayName: string; photoURL?: string }
): Promise<void> {
  try {
    const storyRef = ref(rtdb, `social_stories/${storyId}`);
    const snap = await get(storyRef);
    if (snap.exists()) {
      const data = snap.val() as SocialStory;
      const viewers = Array.isArray(data.viewers) ? data.viewers : [];
      if (!viewers.includes(viewer.uid)) {
        const updatedViewers = [...viewers, viewer.uid];
        const viewerDetail = {
          uid: viewer.uid,
          displayName: viewer.displayName || 'Utilisateur',
          photoURL: viewer.photoURL || '',
          viewedAt: Date.now()
        };

        await update(storyRef, {
          viewers: updatedViewers,
          [`viewersDetails/${viewer.uid}`]: viewerDetail,
          viewersCount: updatedViewers.length
        });

        if (data.authorUid !== viewer.uid) {
          await createSocialNotification({
            recipientUid: data.authorUid,
            senderUid: viewer.uid,
            senderName: viewer.displayName,
            senderPhotoURL: viewer.photoURL,
            type: 'story',
            targetId: storyId,
            message: 'a regardé votre story.'
          }).catch(() => {});
        }
      }
    }
  } catch (e) {
    console.warn('Erreur markStoryAsViewed:', e);
  }
}

export async function deleteSocialStory(storyId: string, currentUid?: string): Promise<void> {
  const currentAuthUser = auth.currentUser;
  const callerUid = currentUid || currentAuthUser?.uid;
  const callerEmail = currentAuthUser?.email;

  if (!callerUid) {
    throw new Error("Action refusée : Vous devez être connecté pour supprimer une story.");
  }

  // 1. Récupérer la story existante pour valider l'auteur
  const storyRef = ref(rtdb, `social_stories/${storyId}`);
  const storySnap = await get(storyRef);

  if (!storySnap.exists()) {
    console.warn(`[deleteSocialStory] La story ${storyId} est introuvable ou déjà supprimée.`);
    return;
  }

  const storyData = storySnap.val() as SocialStory;
  const isSuperAdmin = callerEmail === 'saturninmanahirana261@gmail.com';

  if (storyData.authorUid !== callerUid && !isSuperAdmin) {
    throw new Error("Action non autorisée : Vous ne pouvez supprimer que vos propres stories.");
  }

  console.log(`[deleteSocialStory] Suppression de la story ${storyId} (Auteur: ${storyData.authorUid}, Demandeur: ${callerUid})`);

  // 2. Suppression réelle de la story dans Firebase RTDB
  await remove(storyRef);

  console.log(`[deleteSocialStory] Story ${storyId} supprimée avec succès.`);
}

// ==========================================
// 6. ENREGISTREMENT & MASQUAGE DE POSTS
// ==========================================

export async function toggleSavePost(uid: string, post: SocialPost): Promise<boolean> {
  const saveRef = ref(rtdb, `social_saved_posts/${uid}/${post.id}`);
  const snap = await get(saveRef);
  if (snap.exists()) {
    await remove(saveRef);
    return false;
  } else {
    await set(saveRef, {
      postId: post.id,
      postAuthorName: post.authorName,
      postExcerpt: post.content.substring(0, 100),
      savedAt: Date.now()
    });
    return true;
  }
}

export async function isPostSaved(uid: string, postId: string): Promise<boolean> {
  try {
    const snap = await get(ref(rtdb, `social_saved_posts/${uid}/${postId}`));
    return snap.exists();
  } catch {
    return false;
  }
}

export async function toggleHidePost(uid: string, postId: string): Promise<boolean> {
  const hideRef = ref(rtdb, `social_hidden_posts/${uid}/${postId}`);
  const snap = await get(hideRef);
  if (snap.exists()) {
    await remove(hideRef);
    return false;
  } else {
    await set(hideRef, { postId, hiddenAt: Date.now() });
    return true;
  }
}

// ==========================================
// 7. PARTAGE VERS MESSAGE PRIVÉ (CHAT)
// ==========================================

export async function sharePostToDirectChat(
  post: SocialPost,
  targetRecipientUid: string,
  currentUser: { uid: string; displayName: string; photoURL?: string }
): Promise<string> {
  // Générer ou trouver le chatId déterministe
  const sortedUids = [currentUser.uid, targetRecipientUid].sort();
  const chatId = `direct_${sortedUids[0]}_${sortedUids[1]}`;

  const messagesRef = ref(rtdb, `messages/${chatId}`);
  const newMsgRef = push(messagesRef);
  const msgId = newMsgRef.key as string;

  const previewSnippet = post.content ? post.content.substring(0, 120) : (post.media?.length ? '[Média partagé]' : 'Publication');
  const mediaUrl = post.media && post.media.length > 0 ? post.media[0].url : '';

  const messageData = {
    id: msgId,
    chatId,
    senderUid: currentUser.uid,
    senderName: currentUser.displayName,
    senderPhotoURL: currentUser.photoURL || '',
    text: `📢 J'ai partagé une publication de ${post.authorName} :\n"${previewSnippet}"`,
    fileUrl: mediaUrl || '',
    fileName: `Post de ${post.authorName}`,
    fileType: post.media && post.media.length > 0 ? post.media[0].type : '',
    timestamp: Date.now(),
    readBy: { [currentUser.uid]: true }
  };

  await set(newMsgRef, cleanUndefined(messageData));

  // Notifier l'auteur du post d'un partage
  if (post.authorUid !== currentUser.uid) {
    await createSocialNotification({
      recipientUid: post.authorUid,
      senderUid: currentUser.uid,
      senderName: currentUser.displayName,
      senderPhotoURL: currentUser.photoURL,
      type: 'share',
      targetId: post.id,
      message: 'a partagé votre publication dans une conversation.'
    }).catch(() => {});
  }

  // Incrémenter le compteur de partage
  try {
    const postRef = ref(rtdb, `social_posts/${post.id}`);
    const snap = await get(postRef);
    if (snap.exists()) {
      const current = snap.val().sharesCount || 0;
      await update(postRef, { sharesCount: current + 1 });
    }
  } catch {}

  return chatId;
}

// ==========================================
// 8. DÉTECTION ET NOTIFICATION DE MENTIONS
// ==========================================

export async function parseAndNotifyMentions(
  text: string,
  targetId: string,
  sender: { uid: string; displayName: string; photoURL?: string },
  allUsers: { uid: string; displayName: string }[]
): Promise<void> {
  if (!text) return;
  const mentionRegex = /@([a-zA-Z0-9_\u00C0-\u017F\s]+?)(?=[.,!?\s]|$)/g;
  let match;
  const notifiedUids = new Set<string>();

  while ((match = mentionRegex.exec(text)) !== null) {
    const rawName = match[1].trim().toLowerCase();
    if (!rawName) continue;

    const matchedUser = allUsers.find(
      (u) => u.displayName.toLowerCase().includes(rawName) && u.uid !== sender.uid
    );

    if (matchedUser && !notifiedUids.has(matchedUser.uid)) {
      notifiedUids.add(matchedUser.uid);
      await createSocialNotification({
        recipientUid: matchedUser.uid,
        senderUid: sender.uid,
        senderName: sender.displayName,
        senderPhotoURL: sender.photoURL,
        type: 'mention',
        targetId,
        message: 'vous a mentionné dans une publication ou un commentaire.'
      }).catch(() => {});
    }
  }
}


// ==========================================
// 6. PAGES RAITRA CONNECT
// ==========================================

export async function createSocialPage(params: {
  name: string;
  category: string;
  description: string;
  avatarUrl?: string;
  coverUrl?: string;
  website?: string;
  location?: string;
  ownerUid: string;
}): Promise<string> {
  const pageRef = push(ref(rtdb, 'social_pages'));
  const pageId = pageRef.key as string;

  const pageData: Record<string, any> = {
    id: pageId,
    name: params.name.trim(),
    category: params.category || 'Général',
    description: (params.description || '').trim(),
    avatarUrl: params.avatarUrl || '',
    coverUrl: params.coverUrl || '',
    ownerUid: params.ownerUid,
    admins: [params.ownerUid],
    followersCount: 1,
    createdAt: Date.now()
  };

  if (params.website && params.website.trim()) {
    pageData.website = params.website.trim();
  }
  if (params.location && params.location.trim()) {
    pageData.location = params.location.trim();
  }

  const undefinedPaths = findUndefinedPaths(pageData);
  if (undefinedPaths.length > 0) {
    console.error('[createSocialPage] Propriétés undefined détectées:', undefinedPaths);
  }

  const safePage = cleanUndefined(pageData);
  await set(pageRef, safePage);

  // Le créateur suit automatiquement sa propre page
  const followRef = ref(rtdb, `social_page_followers/${pageId}/${params.ownerUid}`);
  const followData: SocialPageFollower = {
    id: `${pageId}_${params.ownerUid}`,
    pageId,
    uid: params.ownerUid,
    userName: params.name,
    createdAt: Date.now()
  };
  await set(followRef, cleanUndefined(followData));

  return pageId;
}

export async function toggleFollowPage(
  pageId: string,
  user: { uid: string; displayName: string; photoURL?: string }
): Promise<boolean> {
  const followRef = ref(rtdb, `social_page_followers/${pageId}/${user.uid}`);
  const pageRef = ref(rtdb, `social_pages/${pageId}`);

  const [followSnap, pageSnap] = await Promise.all([
    get(followRef),
    get(pageRef)
  ]);

  const currentCount = pageSnap.exists() ? pageSnap.val().followersCount || 1 : 1;

  if (followSnap.exists()) {
    // Ne plus suivre
    await remove(followRef);
    await update(pageRef, {
      followersCount: Math.max(0, currentCount - 1)
    });
    return false;
  } else {
    // Suivre
    const newFollow: SocialPageFollower = {
      id: `${pageId}_${user.uid}`,
      pageId,
      uid: user.uid,
      userName: user.displayName,
      userPhotoURL: user.photoURL || '',
      createdAt: Date.now()
    };
    await set(followRef, cleanUndefined(newFollow));
    await update(pageRef, {
      followersCount: currentCount + 1
    });
    return true;
  }
}

export async function isFollowingPage(pageId: string, uid: string): Promise<boolean> {
  try {
    const snap = await get(ref(rtdb, `social_page_followers/${pageId}/${uid}`));
    return snap.exists();
  } catch {
    return false;
  }
}

// ==========================================
// 7. NOTIFICATIONS SOCIALES
// ==========================================

export async function createSocialNotification(params: {
  recipientUid: string;
  senderUid: string;
  senderName: string;
  senderPhotoURL?: string;
  type: SocialNotification['type'];
  targetId: string;
  message: string;
}): Promise<void> {
  if (params.recipientUid === params.senderUid) return;

  const notifRef = push(ref(rtdb, `social_notifications/${params.recipientUid}`));
  const notifId = notifRef.key as string;

  const notifData: Record<string, any> = {
    id: notifId,
    recipientUid: params.recipientUid,
    senderUid: params.senderUid,
    senderName: params.senderName || 'Utilisateur',
    senderPhotoURL: params.senderPhotoURL || '',
    type: params.type,
    targetId: params.targetId,
    message: params.message || '',
    isRead: false,
    createdAt: Date.now()
  };

  const safeNotif = cleanUndefined(notifData);
  await set(notifRef, safeNotif);
}

export async function markNotificationAsRead(recipientUid: string, notifId: string): Promise<void> {
  await update(ref(rtdb, `social_notifications/${recipientUid}/${notifId}`), { isRead: true });
}

export async function markAllNotificationsAsRead(recipientUid: string): Promise<void> {
  try {
    const notifsRef = ref(rtdb, `social_notifications/${recipientUid}`);
    const snap = await get(notifsRef);
    if (snap.exists()) {
      const updates: Record<string, boolean> = {};
      snap.forEach((child) => {
        if (!child.val().isRead) {
          updates[`${child.key}/isRead`] = true;
        }
      });
      if (Object.keys(updates).length > 0) {
        await update(notifsRef, updates);
      }
    }
  } catch (e) {
    console.warn('Erreur markAllNotificationsAsRead:', e);
  }
}
