import React, { useState } from 'react';
import { BarChart2, Plus, Trash2, X, Check } from 'lucide-react';
import type { PollData } from '../types';

interface CreatePollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (poll: Omit<PollData, 'id' | 'createdAt' | 'createdByUid' | 'createdByName'>) => void;
}

export const CreatePollModal: React.FC<CreatePollModalProps> = ({
  isOpen,
  onClose,
  onSubmit
}) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [allowMultiple, setAllowMultiple] = useState(false);

  if (!isOpen) return null;

  const handleAddOption = () => {
    if (options.length < 6) {
      setOptions([...options, '']);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (index: number, val: string) => {
    const updated = [...options];
    updated[index] = val;
    setOptions(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    const validOptions = options.map(o => o.trim()).filter(Boolean);
    if (validOptions.length < 2) return;

    onSubmit({
      question: question.trim(),
      options: validOptions.map((opt, idx) => ({
        id: `opt_${Date.now()}_${idx}`,
        text: opt,
        votes: []
      })),
      allowMultiple
    });

    setQuestion('');
    setOptions(['', '']);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#24232c] border border-white/10 text-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <BarChart2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold">Créer un sondage instantané</h3>
              <p className="text-xs text-slate-400">Recueillez les avis de l'équipe en temps réel</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Question du sondage *
            </label>
            <input
              type="text"
              required
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ex: Quel jour convient le mieux pour le sprint review ?"
              className="w-full bg-[#18171d] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Options de réponse (2 à 6)
            </label>
            <div className="space-y-2">
              {options.map((opt, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 w-4 text-center">{index + 1}.</span>
                  <input
                    type="text"
                    required
                    value={opt}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    placeholder={`Option ${index + 1}`}
                    className="flex-1 bg-[#18171d] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(index)}
                      className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {options.length < 6 && (
              <button
                type="button"
                onClick={handleAddOption}
                className="mt-2.5 flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium px-2 py-1 rounded-lg hover:bg-indigo-500/10 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Ajouter une option
              </button>
            )}
          </div>

          <div className="pt-2 border-t border-white/10 flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allowMultiple}
                onChange={(e) => setAllowMultiple(e.target.checked)}
                className="rounded border-white/20 bg-[#18171d] text-indigo-600 focus:ring-0"
              />
              Autoriser les choix multiples
            </label>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:bg-white/5 rounded-xl transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={!question.trim() || options.filter(o => o.trim()).length < 2}
              className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
            >
              <Check className="w-4 h-4" />
              Publier le sondage
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
