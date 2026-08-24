import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Users,
  UserX,
  X,
  CheckCircle,
  AlertTriangle,
  Clock,
  Trash2,
  RefreshCw,
  Search,
  Filter,
  Check,
  Mail,
  Shield,
  FileText,
  AlertOctagon,
  Eye,
  Sliders
} from 'lucide-react';
import {
  rtdb,
  ref,
  onValue,
  remove,
  update,
  set
} from '../firebase';
import type { UserReport, UserProfile, UserBlock } from '../types';
import {
  updateReportStatus,
  deleteReportAsAdmin,
  purgeAllDataForProduction,
  OFFICIAL_ADMIN_EMAIL,
  OFFICIAL_ADMIN_NAME
} from '../utils/moderationService';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  onFeedback?: (msg: string, type: 'success' | 'error') => void;
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onFeedback
}) => {
  const [activeTab, setActiveTab] = useState<'reports' | 'users' | 'blocks' | 'maintenance'>('reports');
  const [reports, setReports] = useState<UserReport[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [blocks, setBlocks] = useState<UserBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedReport, setSelectedReport] = useState<UserReport | null>(null);

  // État de réinitialisation de production
  const [isResetting, setIsResetting] = useState(false);
  const [confirmResetText, setConfirmResetText] = useState('');
  const [showConfirmResetModal, setShowConfirmResetModal] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);

    // 1. Écoute des signalements
    const reportsRef = ref(rtdb, 'reports');
    const unsubReports = onValue(reportsRef, (snap) => {
      const list: UserReport[] = [];
      if (snap.exists()) {
        snap.forEach((child) => {
          list.push({ id: child.key || '', ...child.val() });
        });
      }
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setReports(list);
    });

    // 2. Écoute des utilisateurs
    const usersRef = ref(rtdb, 'users');
    const unsubUsers = onValue(usersRef, (snap) => {
      const list: UserProfile[] = [];
      if (snap.exists()) {
        snap.forEach((child) => {
          const val = child.val();
          list.push({
            uid: child.key || '',
            displayName: val.displayName || 'Utilisateur',
            email: val.email || '',
            photoURL: val.photoURL || '',
            role: val.role || 'member',
            status: val.status || 'offline',
            userStatus: val.userStatus || 'offline',
            statusLabel: val.statusLabel || '',
            createdAt: val.createdAt || 0,
            lastSeen: val.lastSeen || 0
          });
        });
      }
      setUsers(list);
    });

    // 3. Écoute des blocages
    const blocksRef = ref(rtdb, 'blocks');
    const unsubBlocks = onValue(blocksRef, (snap) => {
      const list: UserBlock[] = [];
      if (snap.exists()) {
        snap.forEach((child) => {
          list.push(child.val());
        });
      }
      setBlocks(list);
      setLoading(false);
    });

    return () => {
      unsubReports();
      unsubUsers();
      unsubBlocks();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Filtrage des signalements
  const filteredReports = reports.filter((r) => {
    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    const matchesQuery =
      (r.reportedUserName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.reporterName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.category || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesQuery;
  });

  // Filtrage des utilisateurs
  const filteredUsers = users.filter(
    (u) =>
      u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.role || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleUpdateStatus = async (reportId: string, newStatus: UserReport['status']) => {
    if (!currentUser) return;
    try {
      await updateReportStatus(reportId, newStatus, currentUser.uid);
      if (selectedReport?.id === reportId) {
        setSelectedReport((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
      onFeedback?.(`Statut du signalement mis à jour : ${newStatus}`, 'success');
    } catch (e: any) {
      onFeedback?.(`Erreur lors de la mise à jour : ${e.message}`, 'error');
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!window.confirm('Supprimer définitivement ce signalement ?')) return;
    try {
      await deleteReportAsAdmin(reportId);
      if (selectedReport?.id === reportId) setSelectedReport(null);
      onFeedback?.('Signalement supprimé avec succès.', 'success');
    } catch (e: any) {
      onFeedback?.(`Erreur de suppression : ${e.message}`, 'error');
    }
  };

  const handleDeleteUserAccount = async (targetUid: string, targetName: string) => {
    if (targetUid === currentUser?.uid) {
      alert('Vous ne pouvez pas supprimer votre propre compte administrateur.');
      return;
    }
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer le profil et les données de "${targetName}" ?`)) {
      return;
    }

    try {
      await remove(ref(rtdb, `users/${targetUid}`));
      onFeedback?.(`Utilisateur "${targetName}" supprimé avec succès.`, 'success');
    } catch (e: any) {
      onFeedback?.(`Erreur : ${e.message}`, 'error');
    }
  };

  const handleExecuteFullReset = async () => {
    if (confirmResetText !== 'RESET-PRODUCTION') {
      alert('Veuillez saisir exactement "RESET-PRODUCTION" pour confirmer.');
      return;
    }

    setIsResetting(true);
    try {
      const res = await purgeAllDataForProduction(currentUser);
      setIsResetting(false);
      setShowConfirmResetModal(false);
      setConfirmResetText('');
      onFeedback?.(res.message, 'success');
    } catch (err: any) {
      setIsResetting(false);
      onFeedback?.(`Erreur : ${err.message}`, 'error');
    }
  };

  const pendingReportsCount = reports.filter((r) => r.status === 'PENDING').length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-5xl h-[92vh] max-h-[850px] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-md flex-shrink-0">
              <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                  Centre d'Administration & Sécurité
                </h2>
                <span className="hidden sm:inline px-2 py-0.5 bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-[10px] font-extrabold uppercase rounded-md tracking-wider">
                  Super Admin
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
                Connecté en tant que <span className="font-semibold text-slate-700 dark:text-slate-200">{OFFICIAL_ADMIN_NAME}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-4 sm:px-6 pt-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-white dark:bg-slate-900 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => {
              setActiveTab('reports');
              setSelectedReport(null);
            }}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'reports'
                ? 'border-rose-600 text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/20'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Signalements & Modération</span>
            {pendingReportsCount > 0 && (
              <span className="px-1.5 py-0.5 bg-rose-600 text-white text-[10px] font-bold rounded-full">
                {pendingReportsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('users');
              setSelectedReport(null);
            }}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'users'
                ? 'border-rose-600 text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/20'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Utilisateurs enregistrés ({users.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('blocks');
              setSelectedReport(null);
            }}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'blocks'
                ? 'border-rose-600 text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/20'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <UserX className="w-4 h-4" />
            <span>Blocages actifs ({blocks.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('maintenance');
              setSelectedReport(null);
            }}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'maintenance'
                ? 'border-rose-600 text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/20'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Maintenance & Reset Production</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-slate-950/50">
          {/* TAB 1: SIGNALEMENTS */}
          {activeTab === 'reports' && (
            <div className="space-y-4">
              {/* Controls bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filtrer par utilisateur, motif ou description..."
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs text-slate-500 font-medium">Statut :</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 rounded-lg border-0 outline-none cursor-pointer"
                  >
                    <option value="ALL">Tous ({reports.length})</option>
                    <option value="PENDING">En attente ({reports.filter((r) => r.status === 'PENDING').length})</option>
                    <option value="REVIEWED">En cours ({reports.filter((r) => r.status === 'REVIEWED').length})</option>
                    <option value="RESOLVED">Résolus ({reports.filter((r) => r.status === 'RESOLVED').length})</option>
                    <option value="DISMISSED">Rejetés ({reports.filter((r) => r.status === 'DISMISSED').length})</option>
                  </select>
                </div>
              </div>

              {filteredReports.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Aucun signalement en attente</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Tous les signalements ont été traités ou aucun abus n'a été répertorié.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  {/* List */}
                  <div className={`space-y-2.5 ${selectedReport ? 'lg:col-span-6' : 'lg:col-span-12'}`}>
                    {filteredReports.map((report) => {
                      const isPending = report.status === 'PENDING';
                      const isSelected = selectedReport?.id === report.id;

                      return (
                        <div
                          key={report.id}
                          onClick={() => setSelectedReport(report)}
                          className={`p-4 rounded-xl border transition cursor-pointer ${
                            isSelected
                              ? 'bg-rose-50/70 dark:bg-rose-950/40 border-rose-400 dark:border-rose-600 shadow-sm'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2.5">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                                isPending
                                  ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                              }`}>
                                <AlertOctagon className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                                    {report.reportedUserName}
                                  </span>
                                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                                    {report.category}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                  Signalé par <span className="font-semibold">{report.reporterName}</span> • {new Date(report.createdAt).toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>

                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                                report.status === 'PENDING'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 animate-pulse'
                                  : report.status === 'RESOLVED'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : report.status === 'DISMISSED'
                                  ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                              }`}
                            >
                              {report.status}
                            </span>
                          </div>

                          <p className="text-xs text-slate-700 dark:text-slate-300 mt-2 line-clamp-2 italic bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                            "{report.description}"
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Detail Panel */}
                  {selectedReport && (
                    <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-md flex flex-col space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-rose-600" />
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                            Détails du Signalement #{selectedReport.id.slice(-6)}
                          </h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedReport(null)}
                          className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-3 text-xs">
                        <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg">
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase block">Plaignant (Signalant)</span>
                            <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{selectedReport.reporterName}</p>
                            <p className="text-[11px] text-slate-500">{selectedReport.reporterEmail || 'Email masqué'}</p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">UID: {selectedReport.reporterId}</p>
                          </div>
                          <div>
                            <span className="text-[10px] text-rose-500 font-bold uppercase block">Utilisateur Signalé</span>
                            <p className="font-semibold text-rose-600 dark:text-rose-400 mt-0.5">{selectedReport.reportedUserName}</p>
                            <p className="text-[11px] text-slate-500">{selectedReport.reportedUserEmail || 'Email masqué'}</p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">UID: {selectedReport.reportedUserId}</p>
                          </div>
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Motif du signalement</span>
                          <span className="inline-block px-2.5 py-1 bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-bold rounded-lg border border-rose-200 dark:border-rose-900">
                            {selectedReport.category}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Explication fournie</span>
                          <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                            {selectedReport.description}
                          </div>
                        </div>

                        {selectedReport.messageSnippet && (
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Message associé</span>
                            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-lg text-amber-900 dark:text-amber-200">
                              "{selectedReport.messageSnippet}"
                            </div>
                          </div>
                        )}

                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block mb-2">Actions Administrateur</span>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(selectedReport.id, 'RESOLVED')}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Marquer Résolu</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(selectedReport.id, 'REVIEWED')}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer"
                            >
                              <Clock className="w-3.5 h-3.5" />
                              <span>En cours d'examen</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(selectedReport.id, 'DISMISSED')}
                              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Rejeter (Sans suite)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteReport(selectedReport.id)}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer ml-auto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Supprimer</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: UTILISATEURS */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un utilisateur par nom, email ou rôle..."
                  className="w-full bg-transparent text-xs text-slate-800 dark:text-slate-200 outline-none"
                />
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800/70 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-3.5">Utilisateur</th>
                        <th className="p-3.5">Email</th>
                        <th className="p-3.5">Rôle</th>
                        <th className="p-3.5">Présence</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {filteredUsers.map((user) => {
                        const isAdminUser = user.email.toLowerCase() === OFFICIAL_ADMIN_EMAIL.toLowerCase() || user.role === 'admin';

                        return (
                          <tr key={user.uid} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                            <td className="p-3.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-[#6264a7] text-white flex items-center justify-center font-bold text-xs">
                                  {user.displayName.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                    <span>{user.displayName}</span>
                                    {isAdminUser && (
                                      <span className="px-1.5 py-0.2 bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 text-[9px] font-extrabold rounded">
                                        ADMIN
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-[10px] text-slate-400 font-mono">UID: {user.uid}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-3.5 text-slate-700 dark:text-slate-300">{user.email}</td>
                            <td className="p-3.5">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                                isAdminUser
                                  ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                              }`}>
                                {user.role || 'member'}
                              </span>
                            </td>
                            <td className="p-3.5">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                user.status === 'online'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'online' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                {user.status === 'online' ? 'En ligne' : 'Hors ligne'}
                              </span>
                            </td>
                            <td className="p-3.5 text-right">
                              {!isAdminUser && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUserAccount(user.uid, user.displayName)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                                  title="Supprimer ce compte de test"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: BLOCAGES */}
          {activeTab === 'blocks' && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3">
                  Registre des restrictions actives ({blocks.length})
                </h4>

                {blocks.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">Aucun blocage d'utilisateur enregistré.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {blocks.map((block) => (
                      <div
                        key={block.id}
                        className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-xl text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-rose-600">
                            <UserX className="w-3.5 h-3.5" />
                            <span>Blocage #{block.id.slice(-6)}</span>
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(block.createdAt).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300">
                          Bloquant : <span className="font-mono text-[11px] font-semibold">{block.blockerId}</span>
                        </p>
                        <p className="text-slate-600 dark:text-slate-300">
                          Cible : <span className="font-semibold text-slate-800 dark:text-slate-200">{block.blockedUserName || block.blockedUserId}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: MAINTENANCE & RESET PRODUCTION */}
          {activeTab === 'maintenance' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Remise à zéro pour passage en production
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                      Cette commande effectue un nettoyage complet de la base de données : suppression de toutes les conversations, messages, relations d'amitiés, blocages, et comptes utilisateurs de test.
                      Le compte Super Administrateur <strong>{OFFICIAL_ADMIN_NAME}</strong> (<span className="text-rose-600">{OFFICIAL_ADMIN_EMAIL}</span>) sera le seul compte préservé et configuré avec les droits d'administration.
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="text-xs text-slate-500">
                    Projet ciblé : <span className="font-mono font-bold text-slate-700 dark:text-slate-300">raitra-42e79</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowConfirmResetModal(true)}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition cursor-pointer shadow-md"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Lancer la remise à zéro de production</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE CONFIRMATION DE RESET DESTRUCTIF */}
      {showConfirmResetModal && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-900 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Confirmation de Remise à Zéro
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cette opération va purger l'intégralité des messages, relations et comptes de test. Seul le compte administrateur sera conservé.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                Tapez <span className="text-rose-600 font-mono">RESET-PRODUCTION</span> pour confirmer :
              </label>
              <input
                type="text"
                value={confirmResetText}
                onChange={(e) => setConfirmResetText(e.target.value)}
                placeholder="RESET-PRODUCTION"
                className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-center rounded-xl outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowConfirmResetModal(false);
                  setConfirmResetText('');
                }}
                disabled={isResetting}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleExecuteFullReset}
                disabled={confirmResetText !== 'RESET-PRODUCTION' || isResetting}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-2"
              >
                {isResetting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>Exécuter la purge</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
