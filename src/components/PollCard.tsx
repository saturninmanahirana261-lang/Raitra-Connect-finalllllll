import React from 'react';
import { Check, CheckCircle2, Circle, BarChart2 } from 'lucide-react';
import type { PollData } from '../types';

interface PollCardProps {
  poll: PollData;
  currentUserUid: string;
  onVote: (optionId: string) => void;
  onToggleClose?: () => void;
  isCreator?: boolean;
}

export const PollCard: React.FC<PollCardProps> = ({
  poll,
  currentUserUid,
  onVote,
  onToggleClose,
  isCreator
}) => {
  const totalVotes = poll.options.reduce((acc, opt) => acc + (opt.votes ? opt.votes.length : 0), 0);

  return (
    <div className="bg-[#1e1d24] border border-white/10 rounded-xl p-4 my-2 text-white max-w-lg shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <BarChart2 className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white leading-snug">{poll.question}</h4>
            <p className="text-[11px] text-slate-400">
              Par {poll.createdByName} • {totalVotes} vote{totalVotes > 1 ? 's' : ''}
              {poll.isClosed ? ' • Clôturé' : poll.allowMultiple ? ' • Choix multiples' : ' • Choix unique'}
            </p>
          </div>
        </div>

        {isCreator && onToggleClose && (
          <button
            onClick={onToggleClose}
            className="text-[11px] font-medium text-slate-400 hover:text-white px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition-colors"
          >
            {poll.isClosed ? 'Rouvrir' : 'Clôturer'}
          </button>
        )}
      </div>

      <div className="space-y-2">
        {poll.options.map((opt) => {
          const votesCount = opt.votes ? opt.votes.length : 0;
          const percentage = totalVotes > 0 ? Math.round((votesCount / totalVotes) * 100) : 0;
          const hasVoted = opt.votes && opt.votes.includes(currentUserUid);

          return (
            <button
              key={opt.id}
              disabled={poll.isClosed}
              onClick={() => onVote(opt.id)}
              className={`w-full relative overflow-hidden text-left p-2.5 rounded-lg border transition-all ${
                hasVoted
                  ? 'border-indigo-500/60 bg-indigo-500/10'
                  : 'border-white/10 bg-[#16151b] hover:border-white/20'
              } ${poll.isClosed ? 'opacity-80 cursor-default' : 'cursor-pointer'}`}
            >
              {/* Progress fill bar */}
              <div
                className={`absolute inset-y-0 left-0 transition-all duration-300 ${
                  hasVoted ? 'bg-indigo-600/25' : 'bg-white/5'
                }`}
                style={{ width: `${percentage}%` }}
              />

              <div className="relative flex items-center justify-between z-10">
                <div className="flex items-center gap-2 pr-4">
                  {hasVoted ? (
                    <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-500 shrink-0" />
                  )}
                  <span className={`text-xs font-medium ${hasVoted ? 'text-indigo-200 font-semibold' : 'text-slate-200'}`}>
                    {opt.text}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 text-xs">
                  <span className="font-semibold text-slate-300">{percentage}%</span>
                  <span className="text-[10px] text-slate-500">({votesCount})</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
