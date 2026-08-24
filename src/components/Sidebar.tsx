import React, { useState } from 'react';
import {
  Home,
  MessageSquare,
  Compass,
  Users,
  UserCheck,
  Calendar,
  FolderOpen,
  Phone,
  Settings,
  LogOut,
  ChevronDown,
  Plus,
  Hash,
  Sparkles,
  Moon,
  Sun,
  X,
  BookOpen,
  Edit3,
  Building,
  Bell,
  Search
} from 'lucide-react';
import type { UserProfile, RaitraSpace, SocialViewType } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../utils/i18n';
import { isOfficialAdmin } from '../utils/moderationService';
import { Shield } from 'lucide-react';
import { RaitraLogo } from './RaitraLogo';
import { MainSpaceSwitcher } from './MainSpaceSwitcher';

interface SidebarProps {
  currentView: string;
  onSelectView: (view: string) => void;
  activeSpace: RaitraSpace;
  onSelectSpace: (space: RaitraSpace) => void;
  socialSubTab?: SocialViewType;
  onSelectSocialSubTab?: (tab: SocialViewType) => void;
  currentUser: UserProfile | null;
  pendingRequestsCount?: number;
  unreadSocialCount?: number;
  onLogout: () => void;
  onChangeStatus: (status: 'available' | 'away' | 'dnd' | 'invisible') => void;
  onOpenSettings: () => void;
  onOpenAdminPanel?: () => void;
  onCreateTeam: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  activeSpace,
  onSelectSpace,
  socialSubTab = 'feed',
  onSelectSocialSubTab,
  currentUser,
  pendingRequestsCount = 0,
  unreadSocialCount = 0,
  onLogout,
  onChangeStatus,
  onOpenSettings,
  onOpenAdminPanel,
  onCreateTeam,
  isMobileOpen,
  onCloseMobile
}) => {
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { t, lang } = useI18n();
  const isAdmin = isOfficialAdmin(currentUser);

  const statusIcons: Record<string, string> = {
    available: '🟢',
    away: '🟡',
    dnd: '⛔',
    invisible: '⚫'
  };

  const statusLabels: Record<string, string> = {
    available: t.available,
    away: t.away,
    dnd: t.dnd,
    invisible: t.invisible
  };

  // Navigation Items for RAITRA MESSAGE
  const messageNavItems = [
    { id: 'home', label: t.home, icon: Home },
    { id: 'chat', label: t.chat.split(' ')[0], icon: MessageSquare },
    {
      id: 'friends',
      label: lang === 'mg' ? 'Mpinamana' : lang === 'en' ? 'Friends' : 'Amis',
      icon: UserCheck,
      badge: pendingRequestsCount > 0 ? pendingRequestsCount : undefined
    },
    { id: 'teams', label: t.teams, icon: Users },
    { id: 'calls', label: t.calls.split(' ')[0], icon: Phone },
    { id: 'calendar', label: t.calendar, icon: Calendar },
    { id: 'files', label: t.files, icon: FolderOpen }
  ];

  // Navigation Items for RAITRA SOCIAL
  const socialNavItems: { id: SocialViewType; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }[] = [
    { id: 'feed', label: 'Actualités', icon: Compass },
    { id: 'stories', label: 'Stories (24h)', icon: BookOpen },
    { id: 'publications', label: 'Publications', icon: Edit3 },
    { id: 'pages', label: 'Pages', icon: Building },
    { id: 'friends', label: 'Amis & Réseau', icon: Users },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadSocialCount > 0 ? unreadSocialCount : undefined },
    { id: 'search', label: 'Recherche', icon: Search }
  ];

  const displayName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Utilisateur';
  const initial = displayName.charAt(0).toUpperCase() || 'R';
  const currentStatus = currentUser?.userStatus || 'available';

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-xs transition-opacity"
        />
      )}

      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 w-64 bg-[#1f1e24] text-slate-200 flex flex-col z-50 transition-transform duration-200 ease-in-out select-none border-r border-white/5 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <RaitraLogo
              size="sm"
              variant="icon-only"
              showGlow
            />
            <div className="flex flex-col">
              <span className="font-extrabold text-sm tracking-tight text-white leading-tight">
                {activeSpace === 'social' ? 'RAITRA SOCIAL' : 'RAITRA MESSAGE'}
              </span>
              <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
                {activeSpace === 'social' ? 'Réseau Communautaire' : 'Communication Unifiée'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="Fermer le menu"
            aria-label="Fermer le menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Space Switcher inside sidebar */}
        <div className="p-3 border-b border-white/10">
          <MainSpaceSwitcher
            activeSpace={activeSpace}
            onSelectSpace={(space) => {
              onSelectSpace(space);
              onCloseMobile();
            }}
            unreadSocialCount={unreadSocialCount}
            variant="sidebar"
          />
        </div>

        {/* User Profile Card & Status dropdown */}
        <div className="relative p-3 border-b border-white/10">
          <div className="flex items-center justify-between gap-2.5 p-2 rounded-xl hover:bg-white/5 transition">
            <div className="relative flex-shrink-0">
              {currentUser?.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={displayName}
                  className="w-9 h-9 rounded-full object-cover ring-2 ring-[#6264a7]"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#6264a7] to-[#8083d1] text-white flex items-center justify-center font-bold text-sm ring-2 ring-white/10">
                  {initial}
                </div>
              )}
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#1f1e24] ${
                  currentStatus === 'available'
                    ? 'bg-emerald-500'
                    : currentStatus === 'away'
                    ? 'bg-amber-500'
                    : currentStatus === 'dnd'
                    ? 'bg-rose-500'
                    : 'bg-slate-500'
                }`}
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white truncate">{displayName}</div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1">
                <span>{statusIcons[currentStatus]}</span>
                <span className="truncate">{statusLabels[currentStatus]}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setStatusMenuOpen(!statusMenuOpen)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              title="Modifier mon statut"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Status Dropdown Menu */}
          {statusMenuOpen && (
            <div className="absolute top-16 left-3 right-3 bg-[#2b2a33] border border-white/10 rounded-xl shadow-xl z-50 p-1 space-y-1 text-xs">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-white/10">
                Définir le statut de présence
              </div>
              <button
                type="button"
                onClick={() => {
                  onChangeStatus('available');
                  setStatusMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 text-left transition cursor-pointer"
              >
                <span>🟢</span>
                <span className="font-medium text-emerald-400">Disponible</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onChangeStatus('away');
                  setStatusMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 text-left transition cursor-pointer"
              >
                <span>🟡</span>
                <span className="font-medium text-amber-400">Absent</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onChangeStatus('dnd');
                  setStatusMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 text-left transition cursor-pointer"
              >
                <span>⛔</span>
                <span className="font-medium text-rose-400">Ne pas déranger</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onChangeStatus('invisible');
                  setStatusMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 text-left transition cursor-pointer"
              >
                <span>⚫</span>
                <span className="font-medium text-slate-400">Invisible</span>
              </button>
            </div>
          )}
        </div>

        {/* Primary Navigation Rail */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {activeSpace === 'social' ? 'Espace Raitra Social' : 'Espace Raitra Message'}
          </div>

          {activeSpace === 'message' ? (
            messageNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectView(item.id);
                    onCloseMobile();
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer relative group ${
                    isActive
                      ? 'bg-[#6264a7] text-white shadow-sm'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="ml-auto px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })
          ) : (
            socialNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = socialSubTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (onSelectSocialSubTab) onSelectSocialSubTab(item.id);
                    onCloseMobile();
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer relative group ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="ml-auto px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })
          )}

          {/* Quick Channels / Teams Section (Message space only) */}
          {activeSpace === 'message' && (
            <>
              <div className="pt-4 px-3 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Canaux Favoris
                </span>
                <button
                  type="button"
                  onClick={onCreateTeam}
                  className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                  title="Créer une équipe ou un canal"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-0.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onSelectView('chat');
                    onCloseMobile();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-slate-300 hover:bg-white/10 hover:text-white transition cursor-pointer"
                >
                  <Hash className="w-3.5 h-3.5 text-slate-400" />
                  <span className="truncate">Général</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onSelectView('teams');
                    onCloseMobile();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-slate-300 hover:bg-white/10 hover:text-white transition cursor-pointer"
                >
                  <Hash className="w-3.5 h-3.5 text-slate-400" />
                  <span className="truncate">Développement</span>
                </button>
              </div>
            </>
          )}
        </nav>

        {/* Footer Actions */}
        <div className="p-3 border-t border-white/10 space-y-1">
          {isAdmin && onOpenAdminPanel && (
            <button
              type="button"
              onClick={() => {
                onOpenAdminPanel();
                onCloseMobile();
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-rose-400 bg-rose-950/40 border border-rose-800/60 hover:bg-rose-900/50 hover:text-rose-200 transition cursor-pointer mb-1 shadow-sm"
            >
              <div className="flex items-center gap-2.5">
                <Shield className="w-4 h-4 text-rose-400" />
                <span>Centre d'Administration</span>
              </div>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500 text-white font-extrabold tracking-wider">
                ADMIN
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={toggleTheme}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-slate-300 hover:bg-white/10 hover:text-white transition cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-400" />}
              <span>Thème {theme === 'dark' ? 'Sombre' : 'Clair'}</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/10 text-slate-400 font-mono uppercase">
              {theme}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              onOpenSettings();
              onCloseMobile();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-slate-300 hover:bg-white/10 hover:text-white transition cursor-pointer"
          >
            <Settings className="w-4 h-4 text-slate-400" />
            <span>Paramètres du compte</span>
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 transition cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-rose-400" />
            <span>Se déconnecter</span>
          </button>
        </div>
      </aside>
    </>
  );
};
