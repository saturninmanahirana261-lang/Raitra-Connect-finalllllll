import React, { useState, useEffect } from 'react';
import {
  Bell,
  CheckCheck,
  Heart,
  MessageCircle,
  Share2,
  Users,
  Sparkles,
  X
} from 'lucide-react';
import type { SocialNotification, UserProfile } from '../types';
import {
  markNotificationAsRead,
  markAllNotificationsAsRead
} from '../utils/socialService';
import { rtdb, ref, onValue } from '../firebase';

interface SocialNotificationsPopoverProps {
  currentUser: UserProfile;
  onClose: () => void;
}

export const SocialNotificationsPopover: React.FC<SocialNotificationsPopoverProps> = ({
  currentUser,
  onClose
}) => {
  const [notifications, setNotifications] = useState<SocialNotification[]>([]);

  useEffect(() => {
    const notifsRef = ref(rtdb, `social_notifications/${currentUser.uid}`);
    const unsubscribe = onValue(notifsRef, (snapshot) => {
      const list: SocialNotification[] = [];
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          list.push(child.val() as SocialNotification);
        });
      }
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setNotifications(list);
    });

    return () => unsubscribe();
  }, [currentUser.uid]);

  const handleMarkAll = async () => {
    try {
      await markAllNotificationsAsRead(currentUser.uid);
    } catch (e) {
      console.error('Erreur markAllNotificationsAsRead:', e);
    }
  };

  const getIcon = (type: SocialNotification['type']) => {
    switch (type) {
      case 'reaction':
        return <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />;
      case 'comment':
      case 'reply':
        return <MessageCircle className="w-3.5 h-3.5 text-indigo-500 fill-indigo-500" />;
      case 'share':
        return <Share2 className="w-3.5 h-3.5 text-emerald-500" />;
      case 'follow':
        return <Users className="w-3.5 h-3.5 text-purple-500" />;
      default:
        return <Sparkles className="w-3.5 h-3.5 text-amber-500" />;
    }
  };

  return (
    <div className="absolute right-0 top-12 bg-white dark:bg-[#1e1e24] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-80 sm:w-96 z-40 p-4 flex flex-col gap-3 animate-in zoom-in-95 duration-150">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-indigo-600" />
          <span className="font-bold text-sm text-slate-800 dark:text-white">
            Notifications
          </span>
        </div>

        <div className="flex items-center gap-2">
          {notifications.some((n) => !n.isRead) && (
            <button
              onClick={handleMarkAll}
              className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <CheckCheck className="w-3 h-3" />
              <span>Tout marquer lu</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
        {notifications.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            Aucune notification récente.
          </div>
        ) : (
          notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => markNotificationAsRead(currentUser.uid, notif.id)}
              className={`flex items-start gap-3 p-2.5 rounded-2xl transition cursor-pointer ${
                notif.isRead
                  ? 'hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-600 dark:text-slate-400'
                  : 'bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-slate-900 dark:text-white'
              }`}
            >
              <div className="relative">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs overflow-hidden">
                  {notif.senderPhotoURL ? (
                    <img src={notif.senderPhotoURL} alt="" className="w-full h-full object-cover" />
                  ) : (
                    notif.senderName.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center shadow-xs">
                  {getIcon(notif.type)}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs leading-snug">
                  <strong className="font-semibold text-slate-900 dark:text-white">
                    {notif.senderName}
                  </strong>{' '}
                  {notif.message}
                </p>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  {new Date(notif.createdAt).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
