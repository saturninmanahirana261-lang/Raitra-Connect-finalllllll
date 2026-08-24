import React, { useState } from 'react';
import {
  auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  rtdb,
  ref,
  update
} from '../firebase';
import { LogIn, UserPlus, KeyRound, Sparkles, ShieldCheck } from 'lucide-react';
import { RaitraLogo } from './RaitraLogo';

interface AuthModalProps {
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'error' | 'success' } | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setMessage({ text: 'Veuillez remplir tous les champs.', type: 'error' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = cred.user;
      const userRef = ref(rtdb, `users/${user.uid}`);
      await update(userRef, {
        status: 'online',
        userStatus: 'available',
        lastSeen: Date.now()
      });
      setMessage({ text: 'Connexion réussie !', type: 'success' });
      onSuccess?.();
    } catch (err: any) {
      setMessage({ text: translateError(err?.code || err?.message), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setMessage({ text: 'Veuillez remplir tous les champs.', type: 'error' });
      return;
    }
    if (password.length < 6) {
      setMessage({ text: 'Le mot de passe doit contenir au moins 6 caractères.', type: 'error' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = cred.user;
      await updateProfile(user, { displayName: name.trim() });

      const rtdbRef = ref(rtdb, `users/${user.uid}`);
      await update(rtdbRef, {
        uid: user.uid,
        displayName: name.trim(),
        username: name.trim(),
        email: user.email || '',
        photoURL: '',
        role: 'member',
        status: 'online',
        userStatus: 'available',
        statusLabel: 'Disponible',
        createdAt: Date.now(),
        lastSeen: Date.now()
      });

      setMessage({ text: 'Compte créé avec succès !', type: 'success' });
      onSuccess?.();

    } catch (err: any) {
      setMessage({ text: translateError(err?.code || err?.message), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setMessage({ text: 'Veuillez renseigner votre adresse e-mail.', type: 'error' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setMessage({
        text: 'Un lien de réinitialisation vous a été envoyé par e-mail.',
        type: 'success'
      });
    } catch (err: any) {
      setMessage({ text: translateError(err?.code || err?.message), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const translateError = (code: string) => {
    if (code.includes('user-not-found') || code.includes('wrong-password') || code.includes('invalid-credential')) {
      return 'Adresse e-mail ou mot de passe incorrect.';
    }
    if (code.includes('email-already-in-use')) {
      return 'Un compte existe déjà avec cette adresse e-mail.';
    }
    if (code.includes('invalid-email')) {
      return 'Format d\'adresse e-mail invalide.';
    }
    if (code.includes('weak-password')) {
      return 'Le mot de passe est trop faible.';
    }
    return `Erreur d'authentification : ${code}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
      <div className="w-full max-w-md bg-white dark:bg-[#1f1e24] rounded-3xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
        {/* Brand Top Header */}
        <div className="p-6 bg-gradient-to-r from-[#6264a7] to-[#4e508a] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <RaitraLogo size="lg" variant="icon-only" showGlow />
            <div>
              <h2 className="font-bold text-base tracking-tight">Raitra Connect</h2>
              <p className="text-[11px] text-indigo-100 font-medium">Plateforme d'équipe & Appels WebRTC</p>
            </div>
          </div>
          <ShieldCheck className="w-6 h-6 text-indigo-200" />
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-100 dark:border-white/10 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setMessage(null);
            }}
            className={`flex-1 py-3 text-center transition cursor-pointer ${
              mode === 'login'
                ? 'text-[#6264a7] dark:text-indigo-400 border-b-2 border-[#6264a7] dark:border-indigo-400 font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            Connexion
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setMessage(null);
            }}
            className={`flex-1 py-3 text-center transition cursor-pointer ${
              mode === 'register'
                ? 'text-[#6264a7] dark:text-indigo-400 border-b-2 border-[#6264a7] dark:border-indigo-400 font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            Créer un compte
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('forgot');
              setMessage(null);
            }}
            className={`flex-1 py-3 text-center transition cursor-pointer ${
              mode === 'forgot'
                ? 'text-[#6264a7] dark:text-indigo-400 border-b-2 border-[#6264a7] dark:border-indigo-400 font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            Aide
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4">
          {message && (
            <div
              className={`p-3 rounded-xl text-xs font-medium ${
                message.type === 'error'
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60'
              }`}
            >
              {message.text}
            </div>
          )}

          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Adresse e-mail
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nom@entreprise.com"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white outline-none focus:border-[#6264a7] transition"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Mot de passe
                  </label>
                  <button
                    type="button"
                    onClick={() => setMode('forgot')}
                    className="text-[11px] text-[#6264a7] dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white outline-none focus:border-[#6264a7] transition"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 bg-[#6264a7] hover:bg-[#525494] text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 shadow-md shadow-[#6264a7]/20"
              >
                <LogIn className="w-4 h-4" />
                <span>{loading ? 'Connexion en cours...' : 'Se connecter'}</span>
              </button>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Nom complet / Prénom Nom
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex : Marie Dupont"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white outline-none focus:border-[#6264a7] transition"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Adresse e-mail professionnelle
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="marie@entreprise.com"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white outline-none focus:border-[#6264a7] transition"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Mot de passe (6 caractères min)
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white outline-none focus:border-[#6264a7] transition"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 bg-[#6264a7] hover:bg-[#525494] text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 shadow-md shadow-[#6264a7]/20"
              >
                <UserPlus className="w-4 h-4" />
                <span>{loading ? 'Création en cours...' : 'Créer mon compte'}</span>
              </button>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleForgot} className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Saisissez l'adresse e-mail associée à votre compte Raitra Connect. Nous vous enverrons un lien pour redéfinir votre mot de passe en toute sécurité.
              </p>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Adresse e-mail
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nom@entreprise.com"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white outline-none focus:border-[#6264a7] transition"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 bg-[#6264a7] hover:bg-[#525494] text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 shadow-md shadow-[#6264a7]/20"
              >
                <KeyRound className="w-4 h-4" />
                <span>{loading ? 'Envoi en cours...' : 'Envoyer le lien de réinitialisation'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
