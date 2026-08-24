import React, { useState } from 'react';
import { Menu, Search, Bell, Moon, Sun, Shield, Globe, Wifi, WifiOff } from 'lucide-react';
import type { UserProfile, RaitraSpace } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useI18n, Language } from '../utils/i18n';
import { useNetworkStatus } from '../utils/offlineSync';
import { isOfficialAdmin } from '../utils/moderationService';
import { MainSpaceSwitcher } from './MainSpaceSwitcher';

interface TopbarProps {
  currentView: string;
  activeSpace: RaitraSpace;
  onSelectSpace: (space: RaitraSpace) => void;
  currentUser: UserProfile | null;
  unreadMessagesCount?: number;
  unreadSocialCount?: number;
  onOpenMobileSidebar: () => void;
  onSearchClick: () => void;
  onNotificationsClick: () => void;
  onOpenAdminPanel?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  currentView,
  activeSpace,
  onSelectSpace,
  currentUser,
  unreadMessagesCount = 0,
  unreadSocialCount = 0,
  onOpenMobileSidebar,
  onSearchClick,
  onNotificationsClick,
  onOpenAdminPanel
}) => {
  const { theme, toggleTheme } = useTheme();
  const { lang, t, setLanguage } = useI18n();
  const { isOnline } = useNetworkStatus();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const isAdmin = isOfficialAdmin(currentUser);

  const getTitleAndSubtitle = (): [string, string] => {
    if (activeSpace === 'social') {
      return ['RAITRA SOCIAL', 'Réseau social d\'entreprise, stories 24h & pages'];
    }

    switch (currentView) {
      case 'home':
        return ['RAITRA MESSAGE', t.homeSubtitle];
      case 'chat':
        return [t.chat, t.chatSubtitle];
      case 'teams':
        return [t.teams, t.teamsSubtitle];
      case 'calls':
        return [t.calls, t.callsSubtitle];
      case 'calendar':
        return [t.calendar, t.calendarSubtitle];
      case 'files':
        return [t.files, t.filesSubtitle];
      default:
        return ['RAITRA MESSAGE', t.homeSubtitle];
    }
  };

  const [title, subtitle] = getTitleAndSubtitle();

  const handleLanguageChange = (newLang: Language) => {
    setLanguage(newLang);
    setShowLangMenu(false);
  };

  return (
    <header className="h-14 bg-white dark:bg-[#1f1e24] border-b border-slate-200 dark:border-slate-800 px-3 sm:px-4 flex items-center justify-between flex-shrink-0 select-none transition-colors duration-200 gap-2 min-w-0">
      {/* Left: Mobile Menu & Current Section */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-shrink">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center flex-shrink-0"
          title="Ouvrir le menu"
          aria-label="Ouvrir le menu de navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <h2 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white leading-none truncate flex items-center gap-1.5">
            <span>{title}</span>
          </h2>
          <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium hidden md:inline-block mt-0.5 truncate max-w-[200px] xl:max-w-none">
            {subtitle}
          </span>
        </div>
      </div>

      {/* Center: Main Space Switcher (Dual Buttons RAITRA MESSAGE / RAITRA SOCIAL) */}
      <div className="flex items-center justify-center">
        <MainSpaceSwitcher
          activeSpace={activeSpace}
          onSelectSpace={onSelectSpace}
          unreadMessagesCount={unreadMessagesCount}
          unreadSocialCount={unreadSocialCount}
          variant="topbar"
        />
      </div>

      {/* Right: Actions, Language, Theme, Status */}
      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
        {/* Network Status Badge */}
        <div
          className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium border transition flex-shrink-0 ${
            isOnline
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60'
              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/60 animate-pulse'
          }`}
          title={isOnline ? t.networkOnline : t.networkOffline}
        >
          {isOnline ? (
            <>
              <Wifi className="w-3 h-3 text-emerald-500 flex-shrink-0" />
              <span className="hidden lg:inline">{t.networkOnline}</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3 text-amber-500 flex-shrink-0" />
              <span className="hidden lg:inline">Hors-ligne</span>
            </>
          )}
        </div>

        {/* Global quick search trigger */}
        <button
          type="button"
          onClick={onSearchClick}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 rounded-xl text-xs text-slate-600 dark:text-slate-300 transition cursor-pointer border border-transparent dark:border-slate-700/60 min-h-[36px]"
          title="Rechercher partout"
          aria-label="Rechercher"
        >
          <Search className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 flex-shrink-0" />
          <span className="hidden md:inline">{t.searchPlaceholder.slice(0, 10)}...</span>
        </button>

        {/* Language Selector Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowLangMenu(!showLangMenu)}
            className="p-1.5 sm:p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer flex items-center gap-1 border border-slate-200/60 dark:border-slate-700/60 text-xs font-semibold min-h-[36px]"
            title={t.languageSelect}
            aria-label="Choisir la langue"
          >
            <Globe className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="uppercase text-[10px] sm:text-[11px]">{lang}</span>
          </button>

          {showLangMenu && (
            <div className="absolute right-0 mt-1 w-36 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1 z-50 animate-in fade-in">
              <button
                type="button"
                onClick={() => handleLanguageChange('fr')}
                className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer ${
                  lang === 'fr' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                <span>Français</span>
                {lang === 'fr' && <span>✓</span>}
              </button>
              <button
                type="button"
                onClick={() => handleLanguageChange('en')}
                className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer ${
                  lang === 'en' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                <span>English</span>
                {lang === 'en' && <span>✓</span>}
              </button>
              <button
                type="button"
                onClick={() => handleLanguageChange('mg')}
                className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer ${
                  lang === 'mg' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                <span>Malagasy</span>
                {lang === 'mg' && <span>✓</span>}
              </button>
            </div>
          )}
        </div>

        {/* Theme Toggle Button (Light / Dark) */}
        <button
          type="button"
          onClick={toggleTheme}
          className="p-1.5 sm:p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer flex items-center justify-center border border-slate-200/60 dark:border-slate-700/60 min-h-[36px] min-w-[36px]"
          title={theme === 'dark' ? t.themeLight : t.themeDark}
          aria-label="Basculer le thème"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-700" />
          )}
        </button>

        {/* Admin Panel Quick Trigger */}
        {isAdmin && onOpenAdminPanel && (
          <button
            type="button"
            onClick={onOpenAdminPanel}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs min-h-[36px]"
            title="Ouvrir le centre d'administration et de sécurité"
            aria-label="Administration"
          >
            <Shield className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
            <span className="hidden sm:inline">Admin</span>
          </button>
        )}

        {/* Notifications */}
        <button
          type="button"
          onClick={onNotificationsClick}
          className="p-1.5 sm:p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 relative transition cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
          title="Notifications"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full" />
        </button>

        {/* User Email Badge */}
        {currentUser?.email && (
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-[11px] text-slate-600 dark:text-slate-300 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="truncate max-w-[140px]">{currentUser.email}</span>
          </div>
        )}
      </div>
    </header>
  );
};

