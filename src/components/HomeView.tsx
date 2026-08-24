import React from 'react';
import { MessageSquare, Users, FolderOpen, Calendar, Video, Phone, ShieldCheck, Sparkles, ArrowRight, Compass } from 'lucide-react';
import type { UserProfile } from '../types';
import { RaitraLogo } from './RaitraLogo';

interface HomeViewProps {
  currentUser: UserProfile | null;
  onNavigate: (view: string) => void;
  onStartQuickCall: () => void;
  onNavigateToSocial?: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ currentUser, onNavigate, onStartQuickCall, onNavigateToSocial }) => {
  const name = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Collaborateur';

  return (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto space-y-4 sm:space-y-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-[#6264a7] via-[#525494] to-[#404169] text-white p-5 sm:p-7 shadow-lg shadow-[#6264a7]/20">
        <div className="relative z-10 max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-[11px] font-semibold tracking-wide backdrop-blur-xs">
            <RaitraLogo size="xs" variant="icon-only" />
            <span>Plateforme Raitra</span>
          </div>
          <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight">
            Bienvenue, {name} 👋
          </h1>
          <p className="text-slate-200 text-xs sm:text-sm leading-relaxed">
            Basculez facilement entre <strong>RAITRA MESSAGE</strong> pour vos échanges d'équipe et <strong>RAITRA SOCIAL</strong> pour vos publications, stories 24h et pages officielles.
          </p>
          <div className="pt-2 flex flex-wrap gap-2 sm:gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate('chat')}
              className="px-3.5 sm:px-4 py-2 bg-white text-[#6264a7] hover:bg-slate-50 font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer min-h-[40px]"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Ouvrir RAITRA MESSAGE</span>
            </button>
            <button
              type="button"
              onClick={() => (onNavigateToSocial ? onNavigateToSocial() : onNavigate('social'))}
              className="px-3.5 sm:px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer min-h-[40px]"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Explorer RAITRA SOCIAL</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('calls')}
              className="px-3.5 sm:px-4 py-2 bg-white/20 hover:bg-white/30 text-white font-semibold text-xs rounded-xl backdrop-blur-xs transition flex items-center gap-1.5 cursor-pointer min-h-[40px]"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Historique des appels</span>
            </button>
          </div>
        </div>

        {/* Decorative background visual */}
        <div className="absolute -right-6 -bottom-10 opacity-15 pointer-events-none select-none text-[180px]">
          💬
        </div>
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          onClick={() => (onNavigateToSocial ? onNavigateToSocial() : onNavigate('social'))}
          className="group bg-white dark:bg-slate-900 p-5 rounded-2xl border-2 border-indigo-200 dark:border-indigo-900/60 hover:border-indigo-500 hover:shadow-md transition cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 text-white flex items-center justify-center mb-3 group-hover:scale-105 transition shadow-xs">
              <Compass className="w-5 h-5" />
            </div>
            <div className="inline-block px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-[10px] font-extrabold mb-1">
              ESPACE COMMUNAUTAIRE
            </div>
            <h3 className="font-extrabold text-sm text-slate-800 dark:text-white mb-1">RAITRA SOCIAL</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Fil d'actualités, stories 24h avec minuterie, publications photos/vidéos, réactions animées et Pages officielles.
            </p>
          </div>
          <div className="mt-4 flex items-center text-xs font-bold text-indigo-600 dark:text-indigo-400 gap-1 group-hover:gap-2 transition">
            <span>Entrer dans l'espace social</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        <div
          onClick={() => onNavigate('chat')}
          className="group bg-white dark:bg-slate-900 p-5 rounded-2xl border-2 border-slate-200 dark:border-slate-800 hover:border-[#6264a7] dark:hover:border-indigo-500 hover:shadow-md transition cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-[#6264a7]/15 dark:bg-indigo-950/60 text-[#6264a7] dark:text-indigo-400 flex items-center justify-center mb-3 group-hover:scale-105 transition">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="inline-block px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-extrabold mb-1">
              ESPACE COMMUNICATION
            </div>
            <h3 className="font-extrabold text-sm text-slate-800 dark:text-white mb-1">RAITRA MESSAGE</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Messagerie instantanée, conversations chiffrées, messages vocaux, appels WebRTC, équipes et fichiers.
            </p>
          </div>
          <div className="mt-4 flex items-center text-xs font-bold text-[#6264a7] dark:text-indigo-400 gap-1 group-hover:gap-2 transition">
            <span>Accéder à la messagerie</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        <div
          onClick={() => onNavigate('calls')}
          className="group bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-[#6264a7] dark:hover:border-indigo-500 hover:shadow-md transition cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3 group-hover:scale-105 transition">
              <Phone className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-slate-800 dark:text-white mb-1">Historique des Appels</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Journal d'appels récents, manqués, sortants, durée et rappel direct en 1 clic.
            </p>
          </div>
          <div className="mt-4 flex items-center text-xs font-semibold text-emerald-600 dark:text-emerald-400 gap-1 group-hover:gap-2 transition">
            <span>Consulter les appels</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        <div
          onClick={() => onNavigate('teams')}
          className="group bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-[#6264a7] dark:hover:border-indigo-500 hover:shadow-md transition cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3 group-hover:scale-105 transition">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-slate-800 dark:text-white mb-1">Équipes & Canaux</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Canaux thématiques pour organiser les échanges de votre entreprise et projets.
            </p>
          </div>
          <div className="mt-4 flex items-center text-xs font-semibold text-blue-600 dark:text-blue-400 gap-1 group-hover:gap-2 transition">
            <span>Voir les canaux</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        <div
          onClick={() => onNavigate('calendar')}
          className="group bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-[#6264a7] dark:hover:border-indigo-500 hover:shadow-md transition cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3 group-hover:scale-105 transition">
              <Calendar className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-slate-800 dark:text-white mb-1">Calendrier & Réunions</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Planifiez les réunions d'équipe et synchronisez vos disponibilités.
            </p>
          </div>
          <div className="mt-4 flex items-center text-xs font-semibold text-purple-600 dark:text-purple-400 gap-1 group-hover:gap-2 transition">
            <span>Voir le calendrier</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        <div
          onClick={() => onNavigate('files')}
          className="group bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-[#6264a7] dark:hover:border-indigo-500 hover:shadow-md transition cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3 group-hover:scale-105 transition">
              <FolderOpen className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-slate-800 dark:text-white mb-1">Fichiers & Documents</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Centralisez vos documents, rapports et pièces jointes partagées.
            </p>
          </div>
          <div className="mt-4 flex items-center text-xs font-semibold text-amber-600 dark:text-amber-400 gap-1 group-hover:gap-2 transition">
            <span>Ouvrir les fichiers</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* Realtime Architecture Indicator */}
      <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-300">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>
            Connecté au projet Firebase <strong>raitra-42e79</strong> (RTDB, Auth & WebRTC P2P)
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-semibold text-[11px]">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Services opérationnels
        </span>
      </div>
    </div>
  );
};
