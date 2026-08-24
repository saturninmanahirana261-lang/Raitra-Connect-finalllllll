import React, { useState } from 'react';
import {
  ShieldAlert,
  X,
  AlertTriangle,
  Send,
  Loader2,
  CheckCircle,
  FileText
} from 'lucide-react';
import type { UserProfile, ReportCategory } from '../types';
import { reportUser } from '../utils/moderationService';

interface ReportUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  targetUser: {
    uid: string;
    displayName: string;
    email?: string;
  };
  conversationId?: string;
  messageId?: string;
  messageSnippet?: string;
}

const REPORT_CATEGORIES: { id: ReportCategory; label: string; description: string }[] = [
  {
    id: 'harassment',
    label: 'Harcèlement ou intimidation',
    description: 'Comportement ciblé, menaces, insultes ou pression insistante.'
  },
  {
    id: 'spam',
    label: 'Spam ou messages indésirables',
    description: 'Envoi massif de liens promotionnels, répétition abusive de messages.'
  },
  {
    id: 'hate_speech',
    label: 'Propos haineux ou discriminatoires',
    description: 'Discours haineux, racisme, homophobie ou incitation à la violence.'
  },
  {
    id: 'fraud',
    label: 'Fraude ou arnaque',
    description: 'Tentative d\'escroquerie, phishing, demande d\'argent ou coordonnées bancaires.'
  },
  {
    id: 'impersonation',
    label: 'Usurpation d\'identité',
    description: 'Faux profil prétendant être quelqu\'un d\'autre ou un membre du personnel.'
  },
  {
    id: 'inappropriate',
    label: 'Contenu inapproprié',
    description: 'Images violentes, obscènes ou non conformes aux règles de la communauté.'
  },
  {
    id: 'fake_account',
    label: 'Faux compte ou bot',
    description: 'Compte automatisé, inauthentique ou suspect.'
  },
  {
    id: 'other',
    label: 'Autre motif',
    description: 'Tout autre problème nécessitant l\'intervention de l\'équipe de sécurité.'
  }
];

export const ReportUserModal: React.FC<ReportUserModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  targetUser,
  conversationId,
  messageId,
  messageSnippet
}) => {
  const [category, setCategory] = useState<ReportCategory>('harassment');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || description.trim().length < 5) {
      setErrorMsg('Veuillez décrire le problème avec au moins 5 caractères.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await reportUser({
        reporterId: currentUser.uid,
        reporterName: currentUser.displayName,
        reporterEmail: currentUser.email,
        reportedUserId: targetUser.uid,
        reportedUserName: targetUser.displayName,
        reportedUserEmail: targetUser.email,
        category,
        description,
        conversationId,
        messageId,
        messageSnippet
      });

      setSuccessMsg(res.message);
      setTimeout(() => {
        setSuccessMsg(null);
        setDescription('');
        onClose();
      }, 2000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Une erreur est survenue lors de l\'envoi du signalement.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white dark:bg-[#202020] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-[#181818]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Signaler {targetUser.displayName}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Ce signalement restera strictement confidentiel et anonyme.
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

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          {successMsg ? (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
              <CheckCircle className="w-12 h-12 text-emerald-500 animate-bounce" />
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                Signalement reçu avec succès
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
                {successMsg}
              </p>
            </div>
          ) : (
            <>
              {errorMsg && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center gap-2.5 text-xs text-rose-700 dark:text-rose-300">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {messageSnippet && (
                <div className="p-3 bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-500 font-semibold mb-1">
                    <FileText className="w-3.5 h-3.5" /> Message joint en preuve :
                  </div>
                  <p className="italic text-slate-700 dark:text-slate-300 line-clamp-2">
                    "{messageSnippet}"
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Sélectionnez un motif :
                </label>
                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                  {REPORT_CATEGORIES.map((cat) => (
                    <label
                      key={cat.id}
                      className={`flex items-start gap-3 p-2.5 rounded-xl border cursor-pointer transition ${
                        category === cat.id
                          ? 'border-[#6264a7] bg-indigo-50/70 dark:bg-indigo-950/40 text-slate-900 dark:text-white'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="reportCategory"
                        value={cat.id}
                        checked={category === cat.id}
                        onChange={() => setCategory(cat.id)}
                        className="mt-0.5 text-[#6264a7] focus:ring-[#6264a7]"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold">{cat.label}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {cat.description}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Description détaillée du problème :
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Expliquez ce qui s'est passé, les détails pertinents ou le contexte..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6264a7] resize-none"
                  required
                />
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl text-[11px] text-amber-800 dark:text-amber-300 space-y-1">
                <span className="font-bold flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-600" /> Remarque importante :
                </span>
                <p>
                  Les signalements abusifs ou non fondés répétés peuvent faire l'objet de sanctions.
                  Si cet utilisateur vous dérange immédiatement, vous pouvez également le bloquer.
                </p>
              </div>

              {/* Action Buttons */}
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
                  type="submit"
                  disabled={submitting || !description.trim()}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Envoi...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Envoyer le signalement</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
};
