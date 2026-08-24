import React, { useState, useRef, useEffect } from 'react';
import {
  Settings,
  Shield,
  Bell,
  Database,
  Check,
  X,
  User,
  Mail,
  Lock,
  Camera,
  Moon,
  Sun,
  AlertCircle,
  Loader2,
  Trash2,
  Globe,
  HardDrive,
  ShieldOff,
  UserX,
  Eye,
  EyeOff,
  Unlock
} from 'lucide-react';
import {
  auth,
  rtdb,
  ref,
  onValue,
  update,
  updateProfile,
  updateEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  firebaseConfig
} from '../firebase';
import type { UserProfile, UserBlock, HiddenConversation } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useI18n, Language } from '../utils/i18n';
import { clearOfflineQueue } from '../utils/offlineSync';
import { unblockUser, unhideConversation } from '../utils/moderationService';
import { uploadToCloudinary } from '../utils/cloudinaryService';

interface SettingsModalProps {
  currentUser: UserProfile;
  onClose: () => void;
  onProfileUpdated?: (updated: Partial<UserProfile>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  currentUser,
  onClose,
  onProfileUpdated
}) => {
  const { theme, toggleTheme, setTheme } = useTheme();
  const { lang, t, setLanguage } = useI18n();

  // Active tab
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'privacy' | 'appearance' | 'language' | 'system'>('profile');

  // Blocked users & Hidden conversations state
  const [blockedUsers, setBlockedUsers] = useState<UserBlock[]>([]);
  const [hiddenConvs, setHiddenConvs] = useState<HiddenConversation[]>([]);
  const [unblockingUid, setUnblockingUid] = useState<string | null>(null);
  const [unhidingId, setUnhidingId] = useState<string | null>(null);

  // Profile fields: split full name into prénom & nom de famille
  const initialParts = (currentUser.displayName || '').trim().split(' ');
  const [firstName, setFirstName] = useState(initialParts[0] || '');
  const [lastName, setLastName] = useState(initialParts.slice(1).join(' ') || '');
  const [title, setTitle] = useState(currentUser.title || '');
  const [department, setDepartment] = useState(currentUser.department || '');
  const [photoURL, setPhotoURL] = useState(currentUser.photoURL || '');

  // Security / Email / Password
  const [email, setEmail] = useState(currentUser.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Status & Feedback
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Listen to blocked users and hidden conversations
  useEffect(() => {
    if (!currentUser?.uid) return;

    // Listen to blocks where blockerId === currentUser.uid
    const blocksRef = ref(rtdb, 'blocks');
    const unsubBlocks = onValue(blocksRef, (snapshot) => {
      const list: UserBlock[] = [];
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          const b: UserBlock = child.val();
          if (b.blockerId === currentUser.uid) {
            list.push(b);
          }
        });
      }
      setBlockedUsers(list);
    });

    // Listen to hidden conversations for currentUser
    const hiddenRef = ref(rtdb, `hiddenConversations/${currentUser.uid}`);
    const unsubHidden = onValue(hiddenRef, (snapshot) => {
      const list: HiddenConversation[] = [];
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          list.push(child.val());
        });
      }
      setHiddenConvs(list);
    });

    return () => {
      unsubBlocks();
      unsubHidden();
    };
  }, [currentUser.uid]);

  // Handle Photo selection & Cloudinary upload with preview
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Veuillez sélectionner un fichier image valide (JPG, PNG, WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('L\'image est trop volumineuse (maximum 5 Mo).');
      return;
    }

    // Aperçu immédiat
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoURL(reader.result as string);
    };
    reader.readAsDataURL(file);

    try {
      const uploadResult = await uploadToCloudinary(file, {
        folder: 'raitra-connect/avatars',
        userId: currentUser.uid,
        fileName: `${currentUser.uid}_avatar_${Date.now()}`
      });
      setPhotoURL(uploadResult.secureUrl);
      setErrorMessage(null);
    } catch (uploadErr: any) {
      console.warn('Upload avatar Cloudinary échoué, aperçu local conservé:', uploadErr);
    }
  };


  const handleRemovePhoto = () => {
    setPhotoURL('');
  };

  // Re-authenticate helper if password or email changes require fresh token
  const reauthenticate = async () => {
    if (!auth.currentUser || !currentUser.email) return;
    if (!currentPassword) {
      throw new Error('Votre mot de passe actuel est requis pour confirmer ce changement.');
    }
    const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
    await reauthenticateWithCredential(auth.currentUser, credential);
  };

  // Save Profile (Nom, Prénom, Photo, Titre, Département)
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const fullDisplayName = `${firstName.trim()} ${lastName.trim()}`.trim() || 'Utilisateur';

    try {
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: fullDisplayName,
          photoURL: photoURL || null
        });
      }

      const userRef = ref(rtdb, `users/${currentUser.uid}`);
      const updateData: Partial<UserProfile> = {
        displayName: fullDisplayName,
        photoURL: photoURL || '',
        title: title.trim(),
        department: department.trim()
      };

      await update(userRef, updateData);

      onProfileUpdated?.(updateData);
      setSuccessMessage('Profil mis à jour avec succès !');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Erreur lors de la mise à jour du profil.');
    } finally {
      setLoading(false);
    }
  };

  // Save Security & Credentials (Email & Password)
  const handleSaveSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (!auth.currentUser) {
        throw new Error('Utilisateur non connecté.');
      }

      let emailChanged = false;
      let passwordChanged = false;

      // 1. Update Email
      if (email.trim() && email.trim() !== currentUser.email) {
        await reauthenticate();
        await updateEmail(auth.currentUser, email.trim());
        const userRef = ref(rtdb, `users/${currentUser.uid}`);
        await update(userRef, { email: email.trim() });
        onProfileUpdated?.({ email: email.trim() });
        emailChanged = true;
      }

      // 2. Update Password
      if (newPassword) {
        if (newPassword.length < 6) {
          throw new Error('Le nouveau mot de passe doit contenir au moins 6 caractères.');
        }
        if (newPassword !== confirmPassword) {
          throw new Error('Les nouveaux mots de passe ne correspondent pas.');
        }
        await reauthenticate();
        await updatePassword(auth.currentUser, newPassword);
        passwordChanged = true;
        setNewPassword('');
        setConfirmPassword('');
      }

      if (emailChanged || passwordChanged) {
        setCurrentPassword('');
        setSuccessMessage(
          `Identifiants mis à jour avec succès ! ${
            emailChanged ? 'Nouvel email enregistré.' : ''
          } ${passwordChanged ? 'Nouveau mot de passe actif.' : ''}`
        );
        setTimeout(() => setSuccessMessage(null), 4000);
      } else {
        setSuccessMessage('Aucune modification détectée.');
        setTimeout(() => setSuccessMessage(null), 2000);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setErrorMessage('Le mot de passe actuel saisi est incorrect.');
      } else if (err.code === 'auth/email-already-in-use') {
        setErrorMessage('Cette adresse email est déjà utilisée par un autre compte.');
      } else if (err.code === 'auth/requires-recent-login') {
        setErrorMessage('Veuillez vous reconnecter pour valider cette opération de sécurité sensible.');
      } else {
        setErrorMessage(err.message || 'Erreur lors de la modification des identifiants.');
      }
    } finally {
      setLoading(false);
    }
  };

  const initial = (firstName.charAt(0) || currentUser.displayName?.charAt(0) || 'U').toUpperCase();

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 select-none animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl w-full max-w-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#6264a7] text-white flex items-center justify-center shadow-sm">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-800 dark:text-white">Paramètres & Compte</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Gérez vos informations personnelles, sécurité et apparence
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 px-4 sm:px-6 gap-2 pt-2 overflow-x-auto no-scrollbar">
          {[
            { id: 'profile', label: 'Profil & Identité', icon: User },
            { id: 'security', label: 'Sécurité & Accès', icon: Shield },
            { id: 'privacy', label: 'Confidentialité & Blocage', icon: ShieldOff },
            { id: 'appearance', label: 'Mode Sombre / Clair', icon: theme === 'dark' ? Moon : Sun },
            { id: 'language', label: 'Langue & Région', icon: Globe },
            { id: 'system', label: 'Système & Cache', icon: Database }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-t-xl transition cursor-pointer border-b-2 whitespace-nowrap ${
                  isActive
                    ? 'border-[#6264a7] text-[#6264a7] dark:text-indigo-400 bg-white dark:bg-slate-900 shadow-xs'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Notification banners */}
        <div className="px-6 pt-4">
          {successMessage && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-900 rounded-xl text-xs font-medium flex items-center gap-2 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-900 rounded-xl text-xs font-medium flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Tab Contents */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: PROFIL PERSONNEL */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Photo de profil upload & preview */}
              <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
                <div className="relative group">
                  {photoURL ? (
                    <img
                      src={photoURL}
                      alt="Avatar"
                      className="w-20 h-20 rounded-full object-cover ring-4 ring-[#6264a7]/20 shadow-md"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-[#6264a7] text-white flex items-center justify-center font-bold text-2xl ring-4 ring-[#6264a7]/20 shadow-md">
                      {initial}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer"
                    title="Changer la photo"
                  >
                    <Camera className="w-6 h-6" />
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </div>

                <div className="flex-1 text-center sm:text-left space-y-1">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    Photo de profil & Avatar
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    JPG, PNG ou WebP. Visible par tous les membres dans les chats, appels et canaux.
                  </p>
                  <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 bg-[#6264a7] hover:bg-[#525494] text-white text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1.5"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>{photoURL ? 'Remplacer l\'image' : 'Importer une photo'}</span>
                    </button>
                    {photoURL && (
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-rose-100 dark:hover:bg-rose-950 text-slate-700 dark:text-slate-300 hover:text-rose-600 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Supprimer</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Name & First Name Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Prénom
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="ex: Alexandre"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-[#6264a7] focus:ring-2 focus:ring-[#6264a7]/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nom de famille
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="ex: Dupont"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-[#6264a7] focus:ring-2 focus:ring-[#6264a7]/20"
                  />
                </div>
              </div>

              {/* Professional Title & Department */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Poste / Fonction
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="ex: Développeur Full Stack"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-[#6264a7] focus:ring-2 focus:ring-[#6264a7]/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Département / Équipe
                  </label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="ex: Ingénierie & R&D"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-[#6264a7] focus:ring-2 focus:ring-[#6264a7]/20"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-[#6264a7] hover:bg-[#525494] text-white text-xs font-semibold rounded-xl cursor-pointer shadow-md transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Enregistrer le profil</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: SECURITE & IDENTIFIANTS */}
          {activeTab === 'security' && (
            <form onSubmit={handleSaveSecurity} className="space-y-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                <Shield className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>
                  Pour modifier votre <strong>adresse email</strong> ou votre <strong>mot de passe</strong>, veuillez saisir votre <strong>mot de passe actuel</strong> afin de confirmer votre identité.
                </span>
              </div>

              {/* Current Password Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mot de passe actuel (Requis pour confirmation)
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Saisissez votre mot de passe actuel"
                    className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-[#6264a7] focus:ring-2 focus:ring-[#6264a7]/20"
                  />
                </div>
              </div>

              {/* Email Address */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nouvelle adresse email
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nom@entreprise.com"
                    className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-[#6264a7] focus:ring-2 focus:ring-[#6264a7]/20"
                  />
                </div>
              </div>

              {/* New Password Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nouveau mot de passe (min. 6 car.)
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Laisser vide si inchangé"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-[#6264a7] focus:ring-2 focus:ring-[#6264a7]/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Confirmer le nouveau mot de passe
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Répétez le nouveau mot de passe"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-[#6264a7] focus:ring-2 focus:ring-[#6264a7]/20"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-[#6264a7] hover:bg-[#525494] text-white text-xs font-semibold rounded-xl cursor-pointer shadow-md transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Mettre à jour mes accès</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB: CONFIDENTIALITÉ, BLOCAGE ET MASQUAGE */}
          {activeTab === 'privacy' && (
            <div className="space-y-6">
              {/* Section 1: Utilisateurs Bloqués */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                      <UserX className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                        Utilisateurs bloqués ({blockedUsers.length})
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Liste strictement privée. Les personnes bloquées ne peuvent plus vous contacter ni vous trouver.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl text-[11px] text-slate-600 dark:text-slate-300">
                  <span className="font-semibold text-slate-800 dark:text-slate-100">Principe de sécurité : </span>
                  Le déblocage permet à nouveau la visibilité réciproque, mais ne rétablit <strong>JAMAIS</strong> l'amitié automatiquement. Vous resterez non-amis tant qu'une nouvelle demande d'ami n'est pas envoyée et acceptée.
                </div>

                {blockedUsers.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">
                    Vous n'avez actuellement aucun utilisateur bloqué.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200 dark:divide-slate-700/60 max-h-56 overflow-y-auto">
                    {blockedUsers.map((b) => (
                      <div key={b.id} className="py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-800 dark:text-white truncate">
                            {b.blockedUserName || 'Utilisateur bloqué'}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                            {b.blockedUserEmail || `ID: ${b.blockedUserId}`} • Bloqué le {new Date(b.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={unblockingUid === b.blockedUserId}
                          onClick={async () => {
                            setUnblockingUid(b.blockedUserId);
                            try {
                              await unblockUser(currentUser.uid, b.blockedUserId);
                              setSuccessMessage(`Utilisateur débloqué avec succès. Vous restez non-amis.`);
                              setTimeout(() => setSuccessMessage(null), 3000);
                            } catch (err: any) {
                              setErrorMessage(err.message || 'Erreur lors du déblocage.');
                            } finally {
                              setUnblockingUid(null);
                            }
                          }}
                          className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition cursor-pointer flex items-center gap-1.5 flex-shrink-0"
                        >
                          {unblockingUid === b.blockedUserId ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Unlock className="w-3.5 h-3.5" />
                          )}
                          <span>Débloquer</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 2: Conversations Masquées */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-2xl space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <EyeOff className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                      Conversations masquées ({hiddenConvs.length})
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Ces conversations sont cachées de votre liste principale mais restent accessibles et non bloquées.
                    </p>
                  </div>
                </div>

                {hiddenConvs.length === 0 ? (
                  <div className="py-4 text-center text-xs text-slate-400 dark:text-slate-500">
                    Aucune conversation n'est masquée.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200 dark:divide-slate-700/60 max-h-48 overflow-y-auto">
                    {hiddenConvs.map((hc) => (
                      <div key={hc.id} className="py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-800 dark:text-white truncate">
                            Conversation : {hc.conversationId}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            Masquée le {new Date(hc.hiddenAt).toLocaleDateString()}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={unhidingId === hc.conversationId}
                          onClick={async () => {
                            setUnhidingId(hc.conversationId);
                            try {
                              await unhideConversation(currentUser.uid, hc.conversationId);
                              setSuccessMessage('Conversation réaffichée dans votre liste.');
                              setTimeout(() => setSuccessMessage(null), 3000);
                            } catch (err: any) {
                              setErrorMessage(err.message || 'Erreur lors de la réactivation.');
                            } finally {
                              setUnhidingId(null);
                            }
                          }}
                          className="px-3 py-1.5 bg-[#6264a7] hover:bg-[#525494] text-white text-xs font-semibold rounded-xl transition cursor-pointer flex items-center gap-1.5 flex-shrink-0"
                        >
                          {unhidingId === hc.conversationId ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                          <span>Réafficher</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: APPARENCE & MODE SOMBRE / CLAIR */}
          {activeTab === 'appearance' && (
            <div className="space-y-4">
              <div className="text-xs text-slate-600 dark:text-slate-300">
                Personnalisez le thème graphique de votre interface Teams Free selon vos préférences ou votre environnement de travail.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Light Mode Card */}
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`p-4 rounded-2xl border-2 text-left transition cursor-pointer flex flex-col justify-between h-36 ${
                    theme === 'light'
                      ? 'border-[#6264a7] bg-indigo-50/40 dark:bg-indigo-950/20 shadow-md ring-2 ring-[#6264a7]/20'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shadow-xs">
                      <Sun className="w-5 h-5" />
                    </div>
                    {theme === 'light' && (
                      <span className="px-2 py-0.5 rounded-full bg-[#6264a7] text-white text-[10px] font-bold">
                        Actif
                      </span>
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-800 dark:text-white">Mode Clair</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Palette claire haute lisibilité adaptée aux environnements lumineux.
                    </p>
                  </div>
                </button>

                {/* Dark Mode Card */}
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`p-4 rounded-2xl border-2 text-left transition cursor-pointer flex flex-col justify-between h-36 ${
                    theme === 'dark'
                      ? 'border-[#6264a7] bg-indigo-50/40 dark:bg-indigo-950/20 shadow-md ring-2 ring-[#6264a7]/20'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-indigo-900/60 text-indigo-400 flex items-center justify-center shadow-xs">
                      <Moon className="w-5 h-5" />
                    </div>
                    {theme === 'dark' && (
                      <span className="px-2 py-0.5 rounded-full bg-[#6264a7] text-white text-[10px] font-bold">
                        Actif
                      </span>
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-800 dark:text-white">Mode Sombre</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Confort visuel supérieur et contraste optimisé pour le travail prolongé.
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: LANGUE & REGION */}
          {activeTab === 'language' && (
            <div className="space-y-4">
              <div className="text-xs text-slate-600 dark:text-slate-300">
                Sélectionnez la langue d'affichage de l'interface et des notifications.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { id: 'fr', name: 'Français', region: 'France / International', flag: '🇫🇷' },
                  { id: 'en', name: 'English', region: 'United States / Global', flag: '🇺🇸' },
                  { id: 'mg', name: 'Malagasy', region: 'Madagasikara', flag: '🇲🇬' }
                ].map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setLanguage(l.id as Language)}
                    className={`p-3.5 rounded-2xl border-2 text-left transition cursor-pointer flex flex-col justify-between h-28 ${
                      lang === l.id
                        ? 'border-[#6264a7] bg-indigo-50/40 dark:bg-indigo-950/20 shadow-md ring-2 ring-[#6264a7]/20'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">{l.flag}</span>
                      {lang === l.id && (
                        <span className="px-2 py-0.5 rounded-full bg-[#6264a7] text-white text-[10px] font-bold">
                          Actif
                        </span>
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-800 dark:text-white">{l.name}</h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">{l.region}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: SYSTEME & CACHE HORS LIGNE */}
          {activeTab === 'system' && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-white">
                  <Database className="w-4 h-4 text-[#6264a7]" />
                  <span>Projet & Services Cloud Connectés</span>
                </div>
                <div className="space-y-1 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                  <div><strong>ID de Projet :</strong> {firebaseConfig.projectId}</div>
                  <div><strong>Domaine Auth :</strong> {firebaseConfig.authDomain}</div>
                  <div><strong>Realtime Database :</strong> {firebaseConfig.databaseURL}</div>
                  <div><strong>UID Utilisateur :</strong> {currentUser.uid}</div>
                </div>
              </div>

              {/* Offline Cache Management */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs space-y-3">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-white">
                  <HardDrive className="w-4 h-4 text-indigo-500" />
                  <span>Stockage & Cache Local (Offline-First)</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Les messages récents et les profils sont mis en mémoire tampon locale pour vous permettre de consulter vos conversations même en l'absence de réseau.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    clearOfflineQueue();
                    localStorage.removeItem('raitra_cached_chats');
                    setSuccessMessage('Cache local nettoyé avec succès.');
                    setTimeout(() => setSuccessMessage(null), 2500);
                  }}
                  className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Vider le cache local</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
