import {
  rtdb,
  ref,
  set,
  get,
  update,
  remove
} from '../firebase';
import type { Friendship, FriendshipStatus, SocialRelationState, UserProfile } from '../types';

/**
 * Calcule l'identifiant déterministe et unique entre deux utilisateurs.
 * Exemple: getFriendshipId("uidB", "uidA") => "uidA_uidB"
 * Cela garantit qu'il n'existera jamais deux documents distincts pour une même paire d'utilisateurs.
 */
export function getFriendshipId(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join('_');
}

/**
 * Détermine le statut social de relation entre l'utilisateur connecté et une cible.
 */
export function getRelationState(
  friendship: Friendship | null | undefined,
  currentUid: string,
  targetUid: string
): SocialRelationState {
  if (!friendship || !friendship.status) {
    return 'none';
  }

  if (friendship.status === 'accepted') {
    return 'accepted';
  }

  if (friendship.status === 'blocked') {
    return 'blocked';
  }

  if (friendship.status === 'pending') {
    if (friendship.senderId === currentUid) {
      return 'pending_sent';
    }
    if (friendship.receiverId === currentUid) {
      return 'pending_received';
    }
  }

  return 'none';
}

/**
 * Envoie une demande d'ami à un utilisateur cible.
 * Gère automatiquement le cas où l'autre personne a déjà envoyé une demande (conversion en accepted).
 */
export async function sendFriendRequest(
  currentUser: { uid: string; displayName?: string; email?: string; photoURL?: string },
  targetUser: { uid: string; displayName?: string; email?: string; photoURL?: string }
): Promise<{ success: boolean; status: FriendshipStatus; message: string }> {
  if (currentUser.uid === targetUser.uid) {
    throw new Error('Vous ne pouvez pas vous ajouter vous-même en ami.');
  }

  // Vérification de blocage réciproque
  const blockCheck1 = await get(ref(rtdb, `blocks/block_${currentUser.uid}_${targetUser.uid}`));
  const blockCheck2 = await get(ref(rtdb, `blocks/block_${targetUser.uid}_${currentUser.uid}`));
  if (blockCheck1.exists() || blockCheck2.exists()) {
    throw new Error('Cet utilisateur n\'est pas disponible pour cette action.');
  }

  const friendshipId = getFriendshipId(currentUser.uid, targetUser.uid);
  const friendshipRef = ref(rtdb, `friendships/${friendshipId}`);
  const snapshot = await get(friendshipRef);

  const [user1Id, user2Id] = [currentUser.uid, targetUser.uid].sort();
  const now = Date.now();

  if (snapshot.exists()) {
    const existing: Friendship = snapshot.val();

    if (existing.status === 'accepted') {
      return { success: true, status: 'accepted', message: 'Vous êtes déjà amis.' };
    }

    if (existing.status === 'blocked') {
      throw new Error('Action impossible avec cet utilisateur.');
    }

    // Si l'autre utilisateur nous avait déjà envoyé une demande : AUTO-ACCEPTATION COHÉRENTE
    if (existing.status === 'pending' && existing.senderId === targetUser.uid) {
      const updatePayload: Partial<Friendship> = {
        status: 'accepted',
        updatedAt: now
      };
      await update(friendshipRef, updatePayload);

      // Notification pour les deux
      await createNotification(targetUser.uid, {
        type: 'friend_request_accepted',
        title: 'Demande d\'ami acceptée',
        message: `${currentUser.displayName || 'Un utilisateur'} a accepté votre demande d'ami.`,
        fromUid: currentUser.uid,
        fromName: currentUser.displayName || 'Utilisateur',
        createdAt: now
      });

      return { success: true, status: 'accepted', message: 'Demande mutuelle ! Vous êtes maintenant amis.' };
    }

    // Si on avait déjà envoyé la demande
    if (existing.status === 'pending' && existing.senderId === currentUser.uid) {
      return { success: true, status: 'pending', message: 'Demande déjà envoyée en attente.' };
    }
  }

  // Création d'une nouvelle demande
  const newFriendship: Friendship = {
    id: friendshipId,
    users: [user1Id, user2Id],
    user1Id,
    user2Id,
    senderId: currentUser.uid,
    senderName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Utilisateur',
    receiverId: targetUser.uid,
    receiverName: targetUser.displayName || targetUser.email?.split('@')[0] || 'Utilisateur',
    status: 'pending',
    createdAt: now,
    updatedAt: now
  };

  await set(friendshipRef, newFriendship);

  // Notification pour le destinataire
  await createNotification(targetUser.uid, {
    type: 'friend_request_received',
    title: 'Nouvelle demande d\'ami',
    message: `${currentUser.displayName || 'Un utilisateur'} vous a envoyé une demande d'ami.`,
    fromUid: currentUser.uid,
    fromName: currentUser.displayName || 'Utilisateur',
    createdAt: now
  });

  return { success: true, status: 'pending', message: 'Demande d\'ami envoyée avec succès.' };
}

/**
 * Accepte une demande d'ami reçue.
 */
export async function acceptFriendRequest(
  friendshipId: string,
  currentUid: string,
  currentUserProfile?: { displayName?: string }
): Promise<void> {
  const friendshipRef = ref(rtdb, `friendships/${friendshipId}`);
  const snapshot = await get(friendshipRef);

  if (!snapshot.exists()) {
    throw new Error('Cette demande n\'existe plus.');
  }

  const friendship: Friendship = snapshot.val();

  // Règle de sécurité : seul le destinataire peut accepter
  if (friendship.receiverId !== currentUid) {
    throw new Error('Vous n\'êtes pas autorisé à accepter cette demande.');
  }

  // Vérification de blocage
  const blockCheck1 = await get(ref(rtdb, `blocks/block_${currentUid}_${friendship.senderId}`));
  const blockCheck2 = await get(ref(rtdb, `blocks/block_${friendship.senderId}_${currentUid}`));
  if (blockCheck1.exists() || blockCheck2.exists()) {
    throw new Error('Action impossible.');
  }

  const now = Date.now();
  await update(friendshipRef, {
    status: 'accepted',
    updatedAt: now
  });

  // Notifier l'expéditeur initial que sa demande a été acceptée
  await createNotification(friendship.senderId, {
    type: 'friend_request_accepted',
    title: 'Demande d\'ami acceptée',
    message: `${currentUserProfile?.displayName || friendship.receiverName || 'Votre contact'} a accepté votre demande d'ami.`,
    fromUid: currentUid,
    fromName: currentUserProfile?.displayName || 'Ami',
    createdAt: now
  });
}

/**
 * Refuse ou annule une demande d'ami.
 */
export async function declineOrCancelFriendRequest(
  friendshipId: string,
  currentUid: string
): Promise<void> {
  const friendshipRef = ref(rtdb, `friendships/${friendshipId}`);
  const snapshot = await get(friendshipRef);

  if (!snapshot.exists()) return;

  const friendship: Friendship = snapshot.val();

  // Règle de sécurité : seul un des deux utilisateurs concernés peut annuler/refuser
  if (friendship.senderId !== currentUid && friendship.receiverId !== currentUid) {
    throw new Error('Opération non autorisée.');
  }

  await remove(friendshipRef);
}

/**
 * Supprime un ami de sa liste d'amis (suppression mutuelle et bidirectionnelle).
 */
export async function removeFriend(friendshipId: string, currentUid: string): Promise<void> {
  const friendshipRef = ref(rtdb, `friendships/${friendshipId}`);
  const snapshot = await get(friendshipRef);

  if (!snapshot.exists()) return;

  const friendship: Friendship = snapshot.val();

  if (friendship.user1Id !== currentUid && friendship.user2Id !== currentUid) {
    throw new Error('Opération non autorisée sur cette relation.');
  }

  await remove(friendshipRef);
}

/**
 * Création d'une notification utilisateur dans Realtime Database.
 */
async function createNotification(
  targetUid: string,
  payload: {
    type: string;
    title: string;
    message: string;
    fromUid?: string;
    fromName?: string;
    createdAt: number;
  }
) {
  try {
    const notifKey = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const notifRef = ref(rtdb, `notifications/${targetUid}/${notifKey}`);
    await set(notifRef, {
      id: notifKey,
      ...payload,
      read: false
    });
  } catch (err) {
    console.warn('Erreur notification:', err);
  }
}
