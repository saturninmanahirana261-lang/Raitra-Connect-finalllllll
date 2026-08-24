import React, { useState } from 'react';
import { ShieldOff, X, AlertTriangle, Loader2, UserX } from 'lucide-react';
import { blockUser } from '../utils/moderationService';

interface BlockConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUid: string;
  targetUser: {
    uid: string;
    displayName: string;
    email?: string;
  };
  onBlockedSuccess?: () => void;
}

export const BlockConfirmModal: React.FC<BlockConfirmModalProps> = ({
  isOpen,
  onClose,
  currentUid,
  targetUser,
  onBlockedSuccess
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleBlock = async () => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await blockUser(currentUid, targetUser, reason);
      if (onBlockedSuccess) onBlockedSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Une erreur est survenue lors du blocage.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white dark:bg-[#202020] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-rose-50/50 dark:bg-rose-950/20">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <UserX className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Bloquer {targetUser.displayName} ?
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Action immédiate et réciproque
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2 text-xs text-slate-600 dark:text-slate-300">
            <div className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
              <ShieldOff className="w-4 h-4 text-rose-500" />
              Conséquences du blocage :
            </div>
            <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
              <li>Vous ne pourrez plus vous envoyer de messages ni vous appeler.</li>
              <li>Toute relation d'amitié ou demande en attente sera immédiatement annulée.</li>
              <li>Vous deviendrez mutuellement invisibles dans les recherches et annuaires.</li>
              <li>Aucune notification "Vous avez été bloqué" ne sera révélée.</li>
            </ul>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Raison (optionnel) :
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Comportement inapproprié, spam..."
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          {/* Footer actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleBlock}
              disabled={submitting}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Blocage en cours...</span>
                </>
              ) : (
                <>
                  <UserX className="w-3.5 h-3.5" />
                  <span>Confirmer le blocage</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
