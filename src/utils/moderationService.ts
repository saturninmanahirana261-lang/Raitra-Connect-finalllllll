import {
  rtdb,
  ref,
  set,
  get,
  update,
  remove
} from '../firebase';
import type { UserBlock, UserReport, HiddenConversation, UserProfile } from '../types';
import { getFriendshipId } from './friendsService';

/**
 * Identifiant déterministe pour une relation de blocage A -> B
 */
export function getBlockId(blockerId: string, blockedUserId: string): string {
  return `block_${blockerId}_${blockedUserId}`;
}

/**
 * Vérifie si une relation de blocage existe dans un sens ou dans l'autre (invisibilité réciproque)
 */
export function isBlockedEitherWay(
  uidA: string,
  uidB: string,
  allBlocks: UserBlock[]
): boolean {
  if (!uidA || !uidB) return false;
  return allBlocks.some(
    (b) =>
      (b.blockerId === uidA && b.blockedUserId === uidB) ||
      (b.blockerId === uidB && b.blockedUserId === uidA)
  );
}

/**
 * Récupère l'ensemble des UIDs qu'un utilisateur ne doit JAMAIS voir (ceux qu'il a bloqués + ceux qui l'ont bloqué)
 */
export function getAllExcludedUserIds(
  currentUid: string,
  allBlocks: UserBlock[]
): Set<string> {
  const excluded = new Set<string>();
  if (!currentUid || !allBlocks) return excluded;

  for (const b of allBlocks) {
    if (b.blockerId === currentUid) {
      excluded.add(b.blockedUserId);
    } else if (b.blockedUserId === currentUid) {
      excluded.add(b.blockerId);
    }
  }

  return excluded;
}

/**
 * Bloque un utilisateur cible de manière irrévocable sur toutes les fonctions sociales.
 * Supprime immédiatement l'amitié, les demandes en attente, et coupe toute communication.
 */
export async function blockUser(
  currentUid: string,
  targetUser: { uid: string; displayName?: string; email?: string },
  reason?: string
): Promise<void> {
  if (currentUid === targetUser.uid) {
    throw new Error('Vous ne pouvez pas vous bloquer vous-même.');
  }

  const now = Date.now();
  const blockId = getBlockId(currentUid, targetUser.uid);

  const blockPayload: UserBlock = {
    id: blockId,
    blockerId: currentUid,
    blockedUserId: targetUser.uid,
    blockedUserName: targetUser.displayName || 'Utilisateur',
    blockedUserEmail: targetUser.email || '',
    reason: reason || 'Bloqué par l\'utilisateur',
    createdAt: now
  };

  // 1. Enregistrement dans Realtime Database
  const blockRef = ref(rtdb, `blocks/${blockId}`);
  await set(blockRef, blockPayload);

  // 2. RUPTURE IMMÉDIATE DE L'AMITIÉ : suppression de tout document de relation existant
  const friendshipId = getFriendshipId(currentUid, targetUser.uid);
  try {
    const friendshipRef = ref(rtdb, `friendships/${friendshipId}`);
    await remove(friendshipRef);
  } catch (e) {
    console.warn('Erreur suppression amitié lors du blocage:', e);
  }

  // 3. Nettoyage des appels actifs potentiels
  try {
    const activeCallRef = ref(rtdb, `userActiveCall/${targetUser.uid}`);
    const callSnap = await get(activeCallRef);
    if (callSnap.exists() && callSnap.val()?.callerUid === currentUid) {
      await remove(activeCallRef);
    }
  } catch {}
}

/**
 * Débloque un utilisateur.
 * RÈGLE FONDAMENTALE : Les deux utilisateurs restent NON AMIS (aucune restauration automatique).
 */
export async function unblockUser(
  currentUid: string,
  targetUid: string
): Promise<void> {
  const blockId = getBlockId(currentUid, targetUid);

  // Suppression dans Realtime Database
  const blockRef = ref(rtdb, `blocks/${blockId}`);
  await remove(blockRef);
}


/**
 * Signale un utilisateur ou un message abusif aux modérateurs avec protection anti-spam.
 */
const lastReportTimestamps: Record<string, number> = {};

export async function reportUser(payload: {
  reporterId: string;
  reporterName?: string;
  reporterEmail?: string;
  reportedUserId: string;
  reportedUserName?: string;
  reportedUserEmail?: string;
  category: UserReport['category'];
  description: string;
  conversationId?: string;
  messageId?: string;
  messageSnippet?: string;
}): Promise<{ success: boolean; message: string }> {
  const { reporterId, reportedUserId, category, description } = payload;

  if (!reporterId || !reportedUserId) {
    throw new Error('Informations de signalement incomplètes.');
  }

  if (reporterId === reportedUserId) {
    throw new Error('Vous ne pouvez pas vous signaler vous-même.');
  }

  if (!description || description.trim().length < 5) {
    throw new Error('Veuillez fournir une brève description du problème (minimum 5 caractères).');
  }

  // Anti-Spam : pas plus d'un signalement toutes les 15 secondes par utilisateur
  const now = Date.now();
  const lastTime = lastReportTimestamps[reporterId] || 0;
  if (now - lastTime < 15000) {
    throw new Error('Veuillez patienter quelques secondes avant d\'envoyer un nouveau signalement.');
  }
  lastReportTimestamps[reporterId] = now;

  const reportId = `report_${now}_${Math.random().toString(36).substr(2, 6)}`;
  const reportData: UserReport = {
    id: reportId,
    reporterId,
    reporterName: payload.reporterName || 'Utilisateur',
    reporterEmail: payload.reporterEmail || '',
    reportedUserId,
    reportedUserName: payload.reportedUserName || 'Utilisateur signalé',
    reportedUserEmail: payload.reportedUserEmail || '',
    category,
    description: description.trim(),
    conversationId: payload.conversationId,
    messageId: payload.messageId,
    messageSnippet: payload.messageSnippet,
    createdAt: now,
    status: 'PENDING'
  };

  // Enregistrement dans Realtime Database sous reports/
  const rtdbReportRef = ref(rtdb, `reports/${reportId}`);
  await set(rtdbReportRef, reportData);

  // 3. Déclenchement automatique de la notification Email Administrateur (Backend Sécurisé)
  try {
    fetch('/api/reports/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reportData)
    }).catch((e) => console.warn('Notification email admin background error:', e));
  } catch (e) {
    console.warn('Email dispatch hook failed:', e);
  }

  return {
    success: true,
    message: 'Votre signalement a été transmis à l\'équipe de modération. Merci de votre contribution.'
  };
}

/**
 * Constante et vérification du compte Super Administrateur
 */
export const OFFICIAL_ADMIN_EMAIL = 'saturninmanahirana261@gmail.com';
export const OFFICIAL_ADMIN_NAME = 'Ramitombohasina Raitra Saturnin';

export function isOfficialAdmin(user?: { email?: string; role?: string } | null): boolean {
  if (!user) return false;
  return (
    user.email?.toLowerCase().trim() === OFFICIAL_ADMIN_EMAIL.toLowerCase() ||
    user.role === 'admin' ||
    user.role === 'owner'
  );
}

/**
 * Met à jour le statut d'un signalement (Réservé à l'administrateur)
 */
export async function updateReportStatus(
  reportId: string,
  newStatus: UserReport['status'],
  adminUid: string
): Promise<void> {
  const rtdbRef = ref(rtdb, `reports/${reportId}`);
  await update(rtdbRef, {
    status: newStatus,
    updatedAt: Date.now(),
    reviewedBy: adminUid
  });
}

/**
 * Supprime un signalement résolu (Réservé à l'administrateur)
 */
export async function deleteReportAsAdmin(reportId: string): Promise<void> {
  const rtdbRef = ref(rtdb, `reports/${reportId}`);
  await remove(rtdbRef);
}


/**
 * Masque une conversation pour l'utilisateur connecté uniquement (MASQUER ≠ BLOQUER).
 */
export async function hideConversation(
  userId: string,
  conversationId: string
): Promise<void> {
  const hiddenId = `${userId}_${conversationId}`;
  const hiddenRef = ref(rtdb, `hiddenConversations/${userId}/${conversationId}`);
  const payload: HiddenConversation = {
    id: hiddenId,
    userId,
    conversationId,
    hiddenAt: Date.now()
  };
  await set(hiddenRef, payload);
}

/**
 * Restaure une conversation masquée.
 */
export async function unhideConversation(
  userId: string,
  conversationId: string
): Promise<void> {
  const hiddenRef = ref(rtdb, `hiddenConversations/${userId}/${conversationId}`);
  await remove(hiddenRef);
}

/**
 * Nettoyage intégral et réinitialisation de production de l'application Raitra Connect.
 * - Supprime tous les comptes de test, messages, conversations, amitiés, blocs, signalements.
 * - Préserve / initialise uniquement le compte administrateur officiel :
 *   Nom : Ramitombohasina Raitra Saturnin
 *   Email : saturninmanahirana261@gmail.com
 *   Rôle : admin
 */
export async function purgeAllDataForProduction(currentAdminUser?: UserProfile | null): Promise<{
  success: boolean;
  message: string;
  purgedItems: string[];
}> {
  const purgedItems: string[] = [];

  try {
    // 1. Purge des amitiés
    await remove(ref(rtdb, 'friendships'));
    purgedItems.push('Relations et demandes d\'amitiés (friendships)');

    // 2. Purge des blocages
    await remove(ref(rtdb, 'blocks'));
    purgedItems.push('Blocages d\'utilisateurs (blocks)');

    // 3. Purge des signalements
    await remove(ref(rtdb, 'reports'));
    purgedItems.push('Signalements de test (reports)');

    // 4. Purge des conversations et messages
    await remove(ref(rtdb, 'messages'));
    await remove(ref(rtdb, 'direct_messages'));
    await remove(ref(rtdb, 'chats'));
    await remove(ref(rtdb, 'hiddenConversations'));
    purgedItems.push('Messages et conversations (direct_messages, messages)');

    // 5. Purge de la présence, typing et appels
    await remove(ref(rtdb, 'presence'));
    await remove(ref(rtdb, 'typing'));
    await remove(ref(rtdb, 'calls'));
    await remove(ref(rtdb, 'userActiveCall'));
    await remove(ref(rtdb, 'callHistory'));
    purgedItems.push('Sessions d\'appels et états de présence');

    // 6. Purge des réunions et fichiers temporaires
    await remove(ref(rtdb, 'meetings'));
    await remove(ref(rtdb, 'whiteboards'));
    await remove(ref(rtdb, 'shared_files'));
    await remove(ref(rtdb, 'notifications'));
    purgedItems.push('Réunions, tableaux blancs et fichiers partagés');

    // 7. Nettoyage des utilisateurs dans RTDB (suppression de tous les comptes sauf le super admin)
    const usersSnap = await get(ref(rtdb, 'users'));
    let adminFound = false;

    if (usersSnap.exists()) {
      const usersData = usersSnap.val();
      for (const [uid, uVal] of Object.entries<any>(usersData)) {
        const uEmail = (uVal?.email || '').toLowerCase().trim();
        if (uEmail === OFFICIAL_ADMIN_EMAIL.toLowerCase() || uid === currentAdminUser?.uid) {
          adminFound = true;
          // Maintien & consolidation du compte Super Administrateur
          await set(ref(rtdb, `users/${uid}`), {
            uid,
            displayName: OFFICIAL_NAME,
            email: OFFICIAL_ADMIN_EMAIL,
            role: 'admin',
            status: 'online',
            userStatus: 'available',
            statusLabel: 'Super Administrateur Système',
            lastSeen: Date.now(),
            createdAt: uVal?.createdAt || Date.now()
          });
        } else {
          await remove(ref(rtdb, `users/${uid}`));
        }
      }
    }

    // Si le compte admin est connecté lors du reset, l'initialiser dans RTDB
    if (currentAdminUser?.uid && !adminFound) {
      await set(ref(rtdb, `users/${currentAdminUser.uid}`), {
        uid: currentAdminUser.uid,
        displayName: OFFICIAL_NAME,
        email: OFFICIAL_ADMIN_EMAIL,
        role: 'admin',
        status: 'online',
        userStatus: 'available',
        statusLabel: 'Super Administrateur Système',
        lastSeen: Date.now(),
        createdAt: Date.now()
      });
    }

    purgedItems.push('Profils et comptes utilisateurs de test');

    return {
      success: true,
      message: 'Base de données réinitialisée avec succès pour la production. Seul le compte Administrateur est actif.',
      purgedItems
    };
  } catch (err: any) {
    console.error('Erreur purge données:', err);
    throw new Error(`Échec de la réinitialisation : ${err?.message || 'Erreur inconnue'}`);
  }
}

export const OFFICIAL_NAME = 'Ramitombohasina Raitra Saturnin';

