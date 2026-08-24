import React, { useState } from 'react';
import { Search, X, MessageSquare, Users, Hash, Calendar, Phone, Compass, Sparkles } from 'lucide-react';
import type { UserProfile } from '../types';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectChat: (uid: string | null) => void;
  onSelectView: (view: string) => void;
  onSelectSpace?: (space: 'message' | 'social') => void;
  contacts: UserProfile[];
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectChat,
  onSelectView,
  onSelectSpace,
  contacts
}) => {
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  const filteredContacts = contacts.filter(
    (c) =>
      c.displayName.toLowerCase().includes(query.toLowerCase()) ||
      c.email.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-start justify-center pt-20 p-4 animate-in fade-in duration-150 select-none">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Search Input */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <Search className="w-5 h-5 text-[#6264a7]" />
          <input
            type="text"
            placeholder="Rechercher des contacts, canaux, ou naviguer..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden"
            autoFocus
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto p-3 space-y-3">
          {/* Quick Navigations */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 mb-1">
              Espaces & Modules Raitra
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (onSelectSpace) onSelectSpace('message');
                  onSelectView('chat');
                  onSelectChat(null);
                  onClose();
                }}
                className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
              >
                <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-[#6264a7] flex items-center justify-center">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <span>Raitra Message</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onSelectSpace) onSelectSpace('social');
                  onClose();
                }}
                className="flex items-center gap-2.5 p-2.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/40 hover:bg-indigo-100/70 dark:hover:bg-indigo-900/60 text-left text-xs font-bold text-indigo-700 dark:text-indigo-300 transition cursor-pointer border border-indigo-200 dark:border-indigo-800/60"
              >
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <span>Raitra Social</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onSelectSpace) onSelectSpace('message');
                  onSelectView('calls');
                  onClose();
                }}
                className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
              >
                <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
                  <Phone className="w-4 h-4" />
                </div>
                <span>Appels</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onSelectSpace) onSelectSpace('message');
                  onSelectView('teams');
                  onClose();
                }}
                className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
              >
                <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <span>Équipes</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onSelectSpace) onSelectSpace('message');
                  onSelectView('calendar');
                  onClose();
                }}
                className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
              >
                <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950 text-purple-600 flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
                <span>Calendrier</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onSelectSpace) onSelectSpace('message');
                  onSelectView('files');
                  onClose();
                }}
                className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
              >
                <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-600 flex items-center justify-center">
                  <Hash className="w-4 h-4" />
                </div>
                <span>Fichiers</span>
              </button>
            </div>
          </div>

          {/* Contacts Section */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 mb-1">
              Contacts ({filteredContacts.length})
            </div>
            {filteredContacts.length === 0 ? (
              <p className="text-xs text-slate-400 px-3 py-2 italic">Aucun contact trouvé</p>
            ) : (
              <div className="space-y-1">
                {filteredContacts.map((contact) => (
                  <button
                    key={contact.uid}
                    type="button"
                    onClick={() => {
                      onSelectView('chat');
                      onSelectChat(contact.uid);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-[#6264a7] text-white flex items-center justify-center font-bold text-xs">
                        {contact.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {contact.displayName}
                        </div>
                        <div className="text-[11px] text-slate-400">{contact.email}</div>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-medium">
                      Ouvrir chat
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
