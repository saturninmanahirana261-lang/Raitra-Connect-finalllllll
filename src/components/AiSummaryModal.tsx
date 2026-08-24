import React, { useState } from 'react';
import { Sparkles, X, Copy, Check, RefreshCw, FileText, CheckSquare } from 'lucide-react';
import type { ChatMessage } from '../types';

interface AiSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  channelName: string;
}

export const AiSummaryModal: React.FC<AiSummaryModalProps> = ({
  isOpen,
  onClose,
  messages,
  channelName
}) => {
  const [summary, setSummary] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateSummary = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const payload = {
        channelName,
        messages: messages.slice(-50).map((m) => ({
          name: m.name,
          text: m.text,
          timestamp: m.timestamp
        }))
      };

      const res = await fetch('/api/gemini/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error('Erreur lors de la communication avec l\'IA');
      }

      const data = await res.json();
      setSummary(data.summary || 'Aucun résumé disponible.');
    } catch (err: any) {
      setError(err.message || 'Impossible de générer le résumé');
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    if (isOpen) {
      generateSummary();
    }
  }, [isOpen]);

  const handleCopy = () => {
    if (!summary) return;
    navigator.clipboard.writeText(summary);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-indigo-50/50 via-purple-50/30 to-white dark:from-indigo-950/40 dark:via-slate-900 dark:to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                Résumé Intelligent IA
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 font-semibold uppercase tracking-wider">
                  Gemini 3.7 Flash
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Synthèse exécutive et points d'action pour {channelName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-4 text-center">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
                <Sparkles className="w-5 h-5 text-indigo-600 absolute inset-0 m-auto animate-pulse" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-800 dark:text-white">
                  Analyse des messages par Gemini...
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Extraction des décisions clés, dates et actions à mener
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs">
              <p className="font-semibold mb-1">Erreur de génération</p>
              <p>{error}</p>
              <button
                type="button"
                onClick={generateSummary}
                className="mt-3 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 cursor-pointer"
              >
                Réessayer
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <span>Synthèse Exécutive</span>
                </div>
                <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">
                  {summary}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex items-center justify-between">
          <div className="text-[11px] text-slate-400">
            Basé sur les {Math.min(messages.length, 50)} derniers messages
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={generateSummary}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Actualiser</span>
            </button>

            <button
              type="button"
              onClick={handleCopy}
              disabled={!summary || isLoading}
              className="px-4 py-2 rounded-xl bg-[#6264a7] hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md transition cursor-pointer"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{isCopied ? 'Copié !' : 'Copier le résumé'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
