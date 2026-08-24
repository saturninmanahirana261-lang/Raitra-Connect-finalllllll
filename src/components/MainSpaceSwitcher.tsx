import React from 'react';
import { MessageSquare, Compass, Sparkles } from 'lucide-react';
import type { RaitraSpace } from '../types';

interface MainSpaceSwitcherProps {
  activeSpace: RaitraSpace;
  onSelectSpace: (space: RaitraSpace) => void;
  unreadMessagesCount?: number;
  unreadSocialCount?: number;
  variant?: 'topbar' | 'sidebar' | 'banner';
}

export const MainSpaceSwitcher: React.FC<MainSpaceSwitcherProps> = ({
  activeSpace,
  onSelectSpace,
  unreadMessagesCount = 0,
  unreadSocialCount = 0,
  variant = 'topbar'
}) => {
  if (variant === 'sidebar') {
    return (
      <div className="p-2 bg-black/20 rounded-2xl border border-white/10 flex flex-col gap-1 select-none">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 pt-1">
          Espaces Raitra
        </span>

        <button
          type="button"
          onClick={() => onSelectSpace('message')}
          className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeSpace === 'message'
              ? 'bg-gradient-to-r from-[#6264a7] to-[#4f518c] text-white shadow-md'
              : 'text-slate-300 hover:bg-white/10 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <MessageSquare className="w-4 h-4" />
            <span>RAITRA MESSAGE</span>
          </div>
          {unreadMessagesCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-extrabold">
              {unreadMessagesCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onSelectSpace('social')}
          className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeSpace === 'social'
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
              : 'text-slate-300 hover:bg-white/10 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Compass className="w-4 h-4" />
            <span>RAITRA SOCIAL</span>
          </div>
          {unreadSocialCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-extrabold">
              {unreadSocialCount}
            </span>
          )}
        </button>
      </div>
    );
  }

  // Topbar or Banner variant (dual pill tabs)
  return (
    <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-2xs select-none">
      <button
        type="button"
        onClick={() => onSelectSpace('message')}
        className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-bold tracking-tight transition-all duration-150 cursor-pointer min-h-[36px] ${
          activeSpace === 'message'
            ? 'bg-[#6264a7] text-white shadow-md scale-100'
            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-700/50'
        }`}
        title="Accéder à la messagerie et communication"
      >
        <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
        <span className="whitespace-nowrap">RAITRA MESSAGE</span>
        {unreadMessagesCount > 0 && (
          <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-extrabold">
            {unreadMessagesCount}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => onSelectSpace('social')}
        className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-bold tracking-tight transition-all duration-150 cursor-pointer min-h-[36px] ${
          activeSpace === 'social'
            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md scale-100'
            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-700/50'
        }`}
        title="Accéder au réseau social communautaire"
      >
        <Compass className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
        <span className="whitespace-nowrap">RAITRA SOCIAL</span>
        {unreadSocialCount > 0 && (
          <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-extrabold">
            {unreadSocialCount}
          </span>
        )}
      </button>
    </div>
  );
};
