// Gestionnaire de statut réseau et file d'attente hors-ligne (Offline-First)
import { useState, useEffect } from 'react';

export interface OfflineQueueItem {
  id: string;
  type: 'message' | 'poll_vote' | 'task';
  payload: any;
  createdAt: number;
}

const QUEUE_STORAGE_KEY = 'raitra_offline_queue';
const CACHE_CHATS_KEY = 'raitra_cached_chats';

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

export function useNetworkStatus() {
  const [online, setOnline] = useState<boolean>(isOnline());

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline: online };
}

// Mise en cache locale des messages pour accès instantané / offline
export function saveChatCache(conversationId: string, messages: any[]) {
  try {
    const existing = JSON.parse(localStorage.getItem(CACHE_CHATS_KEY) || '{}');
    existing[conversationId] = {
      messages: messages.slice(-50), // Garder les 50 derniers messages
      timestamp: Date.now()
    };
    localStorage.setItem(CACHE_CHATS_KEY, JSON.stringify(existing));
  } catch (e) {
    console.warn('Cache local plein ou inaccessible:', e);
  }
}

export function getChatCache(conversationId: string): any[] {
  try {
    const existing = JSON.parse(localStorage.getItem(CACHE_CHATS_KEY) || '{}');
    return existing[conversationId]?.messages || [];
  } catch {
    return [];
  }
}

// Enregistrement dans la file d'attente d'envoi hors ligne
export function enqueueOfflineAction(item: Omit<OfflineQueueItem, 'id' | 'createdAt'>) {
  try {
    const queue: OfflineQueueItem[] = JSON.parse(localStorage.getItem(QUEUE_STORAGE_KEY) || '[]');
    const newItem: OfflineQueueItem = {
      ...item,
      id: `queue_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      createdAt: Date.now()
    };
    queue.push(newItem);
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.warn('Erreur lors de l\'ajout à la file hors-ligne:', e);
  }
}

export function getOfflineQueue(): OfflineQueueItem[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function clearOfflineQueue() {
  localStorage.removeItem(QUEUE_STORAGE_KEY);
}
