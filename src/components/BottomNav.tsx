import React from 'react';
import {
  Home,
  MessageSquare,
  Compass,
  Users,
  Phone,
  Menu,
  BookOpen,
  Edit3,
  Building,
  Bell,
  Sparkles
} from 'lucide-react';
import type { RaitraSpace, SocialViewType } from '../types';
import { useI18n } from '../utils/i18n';

interface BottomNavProps {
  currentView: string;
  onSelectView: (view: string) => void;
  activeSpace: RaitraSpace;
  onSelectSpace: (space: RaitraSpace) => void;
  socialSubTab?: SocialViewType;
  onSelectSocialSubTab?: (tab: SocialViewType) => void;
  onOpenMobileMenu: () => void;
  pendingRequestsCount?: number;
  unreadSocialCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentView,
  onSelectView,
  activeSpace,
  onSelectSpace,
  socialSubTab = 'feed',
  onSelectSocialSubTab,
  onOpenMobileMenu,
  pendingRequestsCount = 0,
  unreadSocialCount = 0
}) => {
  const { t } = useI18n();

  const messageNavItems = [
    { id: 'home', label: t.home, icon: Home },
    { id: 'chat', label: t.chat.split(' ')[0] || 'Chats', icon: MessageSquare, badge: pendingRequestsCount },
    { id: 'teams', label: t.teams, icon: Users },
    { id: 'calls', label: t.calls.split(' ')[0] || 'Appels', icon: Phone }
  ];

  const socialNavItems = [
    { id: 'feed' as SocialViewType, label: 'Actualités', icon: Compass },
    { id: 'stories' as SocialViewType, label: 'Stories', icon: BookOpen },
    { id: 'publications' as SocialViewType, label: 'Publier', icon: Edit3 },
    { id: 'pages' as SocialViewType, label: 'Pages', icon: Building }
  ];

  return (
    <nav
      aria-label="Navigation mobile"
      className="md:hidden flex-shrink-0 bg-white/95 dark:bg-[#1b1a20]/95 backdrop-blur-md border-t border-slate-200 dark:border-white/10 px-1 py-1 flex items-center justify-around z-30 select-none pb-[calc(0.375rem+env(safe-area-inset-bottom,0px))]"
    >
      {activeSpace === 'message' ? (
        <>
          {messageNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectView(item.id)}
                className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all duration-150 active:scale-95 cursor-pointer relative min-h-[44px] ${
                  isActive
                    ? 'text-[#6264a7] dark:text-indigo-400 font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                  {item.badge && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1.5 px-1.5 py-0.2 bg-rose-500 text-white text-[9px] font-extrabold rounded-full ring-2 ring-white dark:ring-[#1b1a20]">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] tracking-tight mt-0.5 leading-tight truncate max-w-[56px]">
                  {item.label}
                </span>
              </button>
            );
          })}

          {/* Quick Switch to RAITRA SOCIAL button */}
          <button
            type="button"
            onClick={() => onSelectSpace('social')}
            className="flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl text-indigo-600 dark:text-indigo-400 font-bold transition-all active:scale-95 cursor-pointer relative min-h-[44px]"
            title="Basculer vers Raitra Social"
          >
            <div className="relative p-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/80">
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
              {unreadSocialCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#1b1a20]" />
              )}
            </div>
            <span className="text-[9px] font-extrabold tracking-tight mt-0.5 leading-tight text-indigo-600 dark:text-indigo-300 truncate max-w-[56px]">
              SOCIAL
            </span>
          </button>
        </>
      ) : (
        <>
          {socialNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = socialSubTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (onSelectSocialSubTab) onSelectSocialSubTab(item.id);
                }}
                className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all duration-150 active:scale-95 cursor-pointer relative min-h-[44px] ${
                  isActive
                    ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                </div>
                <span className="text-[10px] tracking-tight mt-0.5 leading-tight truncate max-w-[56px]">
                  {item.label}
                </span>
              </button>
            );
          })}

          {/* Quick Switch to RAITRA MESSAGE button */}
          <button
            type="button"
            onClick={() => onSelectSpace('message')}
            className="flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl text-[#6264a7] dark:text-indigo-300 font-bold transition-all active:scale-95 cursor-pointer relative min-h-[44px]"
            title="Basculer vers Raitra Message"
          >
            <div className="relative p-1 rounded-xl bg-[#6264a7]/10 dark:bg-slate-800 border border-[#6264a7]/30">
              <MessageSquare className="w-4 h-4 text-[#6264a7] dark:text-indigo-300" />
            </div>
            <span className="text-[9px] font-extrabold tracking-tight mt-0.5 leading-tight text-[#6264a7] dark:text-indigo-300 truncate max-w-[56px]">
              MESSAGE
            </span>
          </button>
        </>
      )}

      {/* Menu / Drawer trigger */}
      <button
        type="button"
        onClick={onOpenMobileMenu}
        className="flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all duration-150 active:scale-95 cursor-pointer relative text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium min-h-[44px]"
        title="Ouvrir le menu complet"
      >
        <div className="relative">
          <Menu className="w-5 h-5" />
        </div>
        <span className="text-[10px] tracking-tight mt-0.5 leading-tight truncate max-w-[56px]">
          Menu
        </span>
      </button>
    </nav>
  );
};

