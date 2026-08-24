import React, { useState, useEffect, useRef } from 'react';
import { X, Send, CornerUpLeft, MessageSquare } from 'lucide-react';
import { rtdb, ref, push, set, onValue, update } from '../firebase';
import type { ChatMessage, UserProfile } from '../types';
import { AudioNotePlayer } from './AudioNotePlayer';

interface ThreadDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  parentMessage: ChatMessage | null;
  conversationId: string;
  currentUser: UserProfile;
}

export const ThreadDrawer: React.FC<ThreadDrawerProps> = ({
  isOpen,
  onClose,
  parentMessage,
  conversationId,
  currentUser
}) => {
  const [threadMessages, setThreadMessages] = useState<ChatMessage[]>([]);
  const [replyInput, setReplyInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !parentMessage) return;

    const threadRef = ref(rtdb, `threads/${conversationId}/${parentMessage.id}`);
    const unsub = onValue(threadRef, (snapshot) => {
      if (!snapshot.exists()) {
        setThreadMessages([]);
        return;
      }
      const list: ChatMessage[] = [];
      snapshot.forEach((child) => {
        const val = child.val();
        list.push({
          id: child.key as string,
          uid: val.uid,
          name: val.name || 'Membre',
          text: val.text,
          timestamp: val.timestamp || Date.now()
        });
      });
      list.sort((a, b) => a.timestamp - b.timestamp);
      setThreadMessages(list);
    });

    return () => unsub();
  }, [isOpen, parentMessage, conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadMessages.length]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = replyInput.trim();
    if (!text || !parentMessage) return;

    const threadRef = push(ref(rtdb, `threads/${conversationId}/${parentMessage.id}`));
    const newReply = {
      uid: currentUser.uid,
      name: currentUser.displayName,
      text,
      timestamp: Date.now()
    };

    await set(threadRef, newReply);

    // Update parent message reply count in conversation
    const newCount = threadMessages.length + 1;
    await update(ref(rtdb, `messages/${conversationId}/${parentMessage.id}`), {
      threadReplyCount: newCount,
      lastReplyTimestamp: Date.now()
    }).catch(console.warn);

    setReplyInput('');
  };

  if (!isOpen || !parentMessage) return null;

  return (
    <div className="w-full md:w-96 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1c1c1c] flex flex-col h-full z-20 shadow-2xl animate-in slide-in-from-right duration-200">
      {/* Thread Header */}
      <div className="h-14 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-[#181818]">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[#6264a7]" />
          <div>
            <h4 className="text-xs font-bold text-slate-800 dark:text-white">Fil de discussion</h4>
            <p className="text-[10px] text-slate-500">{threadMessages.length} réponse{threadMessages.length > 1 ? 's' : ''}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Parent Message Preview */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-indigo-50/40 dark:bg-indigo-950/20">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
            {parentMessage.name.charAt(0).toUpperCase()}
          </div>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{parentMessage.name}</span>
          <span className="text-[10px] text-slate-400">
            {new Date(parentMessage.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <p className="text-xs text-slate-700 dark:text-slate-300 pl-8">{parentMessage.text}</p>
        {parentMessage.audioNote && (
          <div className="mt-2 pl-8">
            <AudioNotePlayer
              url={parentMessage.audioNote.url}
              duration={parentMessage.audioNote.duration}
              isMe={parentMessage.uid === currentUser.uid}
            />
          </div>
        )}
      </div>

      {/* Thread Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {threadMessages.length === 0 && (
          <div className="text-center py-8 text-slate-400 text-xs">
            <CornerUpLeft className="w-6 h-6 mx-auto mb-2 opacity-50" />
            <span>Aucune réponse pour le moment. Soyez le premier à répondre !</span>
          </div>
        )}

        {threadMessages.map((reply) => {
          const isMe = reply.uid === currentUser.uid;
          return (
            <div key={reply.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  {isMe ? 'Vous' : reply.name}
                </span>
                <span className="text-[9px] text-slate-400">
                  {new Date(reply.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div
                className={`px-3 py-2 rounded-xl text-xs max-w-[85%] leading-relaxed ${
                  isMe
                    ? 'bg-[#6264a7] text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                }`}
              >
                {reply.text}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Thread Input Form */}
      <form onSubmit={handleSendReply} className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#181818] flex items-center gap-2">
        <input
          type="text"
          placeholder="Répondre dans le fil..."
          value={replyInput}
          onChange={(e) => setReplyInput(e.target.value)}
          className="flex-1 px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6264a7]"
        />
        <button
          type="submit"
          disabled={!replyInput.trim()}
          className="p-2 rounded-xl bg-[#6264a7] hover:bg-indigo-700 disabled:opacity-40 text-white transition cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
