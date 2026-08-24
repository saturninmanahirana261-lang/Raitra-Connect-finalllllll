// Système d'internationalisation unifié pour Raitra Connect
// Langues supportées : Français (fr), English (en), Malagasy (mg)

export type Language = 'fr' | 'en' | 'mg';

export interface Translations {
  // Navigation & Views
  home: string;
  homeSubtitle: string;
  chat: string;
  chatSubtitle: string;
  teams: string;
  teamsSubtitle: string;
  calls: string;
  callsSubtitle: string;
  calendar: string;
  calendarSubtitle: string;
  files: string;
  filesSubtitle: string;
  settings: string;
  logout: string;
  
  // Statuses
  online: string;
  offline: string;
  available: string;
  away: string;
  dnd: string;
  invisible: string;

  // Actions & Controls
  searchPlaceholder: string;
  sendMessage: string;
  startCall: string;
  startVideoCall: string;
  startAudioCall: string;
  createTeam: string;
  createPoll: string;
  vote: string;
  save: string;
  cancel: string;
  delete: string;
  edit: string;
  reply: string;
  translate: string;
  rephrase: string;
  summarize: string;
  recordVoice: string;
  
  // Network & Sync
  networkOnline: string;
  networkOffline: string;
  offlineModeNotice: string;
  syncSuccess: string;

  // Settings & Roles
  themeLight: string;
  themeDark: string;
  roleOwner: string;
  roleAdmin: string;
  roleMember: string;
  roleGuest: string;
  languageSelect: string;
}

export const translations: Record<Language, Translations> = {
  fr: {
    home: 'Accueil',
    homeSubtitle: 'Votre espace de travail et collaboration centralisé',
    chat: 'Chat & Messagerie',
    chatSubtitle: 'Conversations en direct, audio et fichiers',
    teams: 'Équipes',
    teamsSubtitle: 'Groupes, publications et canaux thématiques',
    calls: 'Appels & Historique',
    callsSubtitle: 'Historique des appels récents, manqués et sortants',
    calendar: 'Calendrier',
    calendarSubtitle: 'Planification des réunions et synchronisation',
    files: 'Fichiers',
    filesSubtitle: 'Documents et pièces jointes partagés',
    settings: 'Paramètres & Compte',
    logout: 'Déconnexion',

    online: 'En ligne',
    offline: 'Hors ligne',
    available: 'Disponible',
    away: 'Absent',
    dnd: 'Ne pas déranger',
    invisible: 'Invisible',

    searchPlaceholder: 'Rechercher des contacts, canaux...',
    sendMessage: 'Écrivez un message...',
    startCall: 'Démarrer un appel',
    startVideoCall: 'Appel Vidéo',
    startAudioCall: 'Appel Audio',
    createTeam: 'Créer une équipe',
    createPoll: 'Sondage instantané',
    vote: 'Voter',
    save: 'Enregistrer',
    cancel: 'Annuler',
    delete: 'Supprimer',
    edit: 'Modifier',
    reply: 'Répondre',
    translate: 'Traduire',
    rephrase: 'Améliorer par IA',
    summarize: 'Synthèse IA',
    recordVoice: 'Message vocal',

    networkOnline: 'Connecté',
    networkOffline: 'Mode hors ligne (données locales synchronisées)',
    offlineModeNotice: 'Vous êtes hors-ligne. Les messages seront envoyés dès le rétablissement de la connexion.',
    syncSuccess: 'Données synchronisées avec succès',

    themeLight: 'Mode Clair',
    themeDark: 'Mode Sombre',
    roleOwner: 'Propriétaire',
    roleAdmin: 'Administrateur',
    roleMember: 'Membre',
    roleGuest: 'Invité',
    languageSelect: 'Langue de l\'application'
  },
  en: {
    home: 'Home',
    homeSubtitle: 'Your centralized workspace and team platform',
    chat: 'Chat & Messages',
    chatSubtitle: 'Direct conversations, voice notes and files',
    teams: 'Teams',
    teamsSubtitle: 'Groups, posts and topic-based channels',
    calls: 'Calls & Logs',
    callsSubtitle: 'Recent, outgoing and missed calls history',
    calendar: 'Calendar',
    calendarSubtitle: 'Meeting scheduling and team synchronization',
    files: 'Files',
    filesSubtitle: 'Shared documents, attachments and media',
    settings: 'Settings & Account',
    logout: 'Log Out',

    online: 'Online',
    offline: 'Offline',
    available: 'Available',
    away: 'Away',
    dnd: 'Do Not Disturb',
    invisible: 'Invisible',

    searchPlaceholder: 'Search contacts, channels...',
    sendMessage: 'Type a message...',
    startCall: 'Start Call',
    startVideoCall: 'Video Call',
    startAudioCall: 'Audio Call',
    createTeam: 'Create Team',
    createPoll: 'Instant Poll',
    vote: 'Vote',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    reply: 'Reply',
    translate: 'Translate',
    rephrase: 'AI Rephrase',
    summarize: 'AI Summary',
    recordVoice: 'Voice Note',

    networkOnline: 'Online',
    networkOffline: 'Offline mode (cached data available)',
    offlineModeNotice: 'You are offline. Outbox messages will sync as soon as connectivity restores.',
    syncSuccess: 'Data successfully synchronized',

    themeLight: 'Light Mode',
    themeDark: 'Dark Mode',
    roleOwner: 'Owner',
    roleAdmin: 'Admin',
    roleMember: 'Member',
    roleGuest: 'Guest',
    languageSelect: 'App Language'
  },
  mg: {
    home: 'Fandraisana',
    homeSubtitle: 'Toerana fiasana sy fiaraha-miasa ivotoerana',
    chat: 'Hafatra & Resaka',
    chatSubtitle: 'Resaka mivantana, feo ary tahirin-kevitra',
    teams: 'Ekipa',
    teamsSubtitle: 'Vondrona, fizarana ary fantsona manokana',
    calls: 'Antso & Tantara',
    callsSubtitle: 'Tantaran\'ny antso vao haingana sy tsy voaray',
    calendar: 'Kalandrie',
    calendarSubtitle: 'Fandaharam-potoana fivoriana sy fiaraha-miasa',
    files: 'Tahirin-kevitra',
    filesSubtitle: 'Tahirin-kevitra sy rakitra nozaraina',
    settings: 'Fikirana & Kaonty',
    logout: 'Hivoaka',

    online: 'Mifandray',
    offline: 'Tsy mifandray',
    available: 'Afaka mandray',
    away: 'Tsy eo an-toerana',
    dnd: 'Aza elingelenina',
    invisible: 'Tsy hita maso',

    searchPlaceholder: 'Hikaroka mpiara-miasa, fantsona...',
    sendMessage: 'Manorata hafatra...',
    startCall: 'Hanomboka antso',
    startVideoCall: 'Antso Video',
    startAudioCall: 'Antso Feo',
    createTeam: 'Hamorona Ekipa',
    createPoll: 'Fanadihadiana haingana',
    vote: 'Handatsa-bato',
    save: 'Hitehirizana',
    cancel: 'Hanafoana',
    delete: 'Fafana',
    edit: 'Hanova',
    reply: 'Hamaly',
    translate: 'Handika teny',
    rephrase: 'Fanatsarana amin\'ny AI',
    summarize: 'Famintinana AI',
    recordVoice: 'Hafatra feo',

    networkOnline: 'Mifandray amin\'ny aterineto',
    networkOffline: 'Tsy misy aterineto (misy tahiry an-toerana)',
    offlineModeNotice: 'Tsy mifandray ianao. Halefa ho azy ny hafatra rehefa tafaverina ny aterineto.',
    syncSuccess: 'Voatahiry soa aman-tsara ny angona',

    themeLight: 'Mora hazavana',
    themeDark: 'Maizina (Dark Mode)',
    roleOwner: 'Tompony',
    roleAdmin: 'Mpitantana',
    roleMember: 'Mpikambana',
    roleGuest: 'Vahiny',
    languageSelect: 'Safidy fiteny'
  }
};

let currentLang: Language = (localStorage.getItem('raitra_lang') as Language) || 'fr';
const listeners = new Set<(lang: Language) => void>();

export function getLanguage(): Language {
  return currentLang;
}

export function setLanguage(lang: Language) {
  currentLang = lang;
  localStorage.setItem('raitra_lang', lang);
  listeners.forEach((cb) => cb(lang));
}

export function useI18n() {
  const [lang, setLangState] = React.useState<Language>(getLanguage());

  React.useEffect(() => {
    const handleUpdate = (newLang: Language) => setLangState(newLang);
    listeners.add(handleUpdate);
    return () => {
      listeners.delete(handleUpdate);
    };
  }, []);

  return {
    lang,
    t: translations[lang] || translations.fr,
    setLanguage
  };
}

import React from 'react';
