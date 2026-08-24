import React, { useState } from 'react';
import { Shield, UserCheck, UserX, Plus, X, Check, Mail, User } from 'lucide-react';
import type { UserRole, TeamMember } from '../types';

interface MemberRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamName: string;
  members: TeamMember[];
  onUpdateRole: (uid: string, role: UserRole) => void;
  onInviteMember: (email: string, role: UserRole) => void;
  currentUserRole: UserRole;
}

export const MemberRoleModal: React.FC<MemberRoleModalProps> = ({
  isOpen,
  onClose,
  teamName,
  members,
  onUpdateRole,
  onInviteMember,
  currentUserRole
}) => {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('member');
  const [inviteSuccess, setInviteSuccess] = useState(false);

  if (!isOpen) return null;

  const canManage = currentUserRole === 'owner' || currentUserRole === 'admin';

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    onInviteMember(inviteEmail.trim(), inviteRole);
    setInviteEmail('');
    setInviteSuccess(true);
    setTimeout(() => setInviteSuccess(false), 2500);
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'admin':
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
      case 'member':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'guest':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      default:
        return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#24232c] border border-white/10 text-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold">Gestion des Membres & Rôles (RBAC)</h3>
              <p className="text-xs text-slate-400">Espace : {teamName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Invite form */}
          {canManage && (
            <form onSubmit={handleInvite} className="bg-[#19181f] border border-white/10 p-3.5 rounded-xl space-y-3">
              <span className="text-xs font-semibold text-slate-300 block">Inviter un nouveau collaborateur</span>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="collaborateur@entreprise.com"
                    className="w-full bg-[#121116] border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as UserRole)}
                  className="bg-[#121116] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                >
                  <option value="member">Membre</option>
                  <option value="admin">Admin</option>
                  <option value="guest">Invité</option>
                </select>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Inviter
                </button>
              </div>
              {inviteSuccess && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 animate-in fade-in">
                  <Check className="w-3.5 h-3.5" /> Invitation envoyée avec succès !
                </div>
              )}
            </form>
          )}

          {/* Members list */}
          <div>
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
              Membres actuels ({members.length})
            </span>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {members.map((member) => (
                <div
                  key={member.uid}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-[#1a1921] border border-white/5"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-indigo-600/30 text-indigo-300 flex items-center justify-center font-bold text-xs">
                      {member.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="font-semibold text-xs text-white block">{member.displayName}</span>
                      <span className="text-[10px] text-slate-400">{member.email}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {canManage && member.role !== 'owner' ? (
                      <select
                        value={member.role}
                        onChange={(e) => onUpdateRole(member.uid, e.target.value as UserRole)}
                        className="bg-[#121116] border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                      >
                        <option value="admin">Admin</option>
                        <option value="member">Membre</option>
                        <option value="guest">Invité</option>
                      </select>
                    ) : (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${getRoleBadge(member.role)}`}>
                        {member.role.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-white/10 flex items-center justify-end bg-[#1f1e26]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-colors"
          >
            Terminé
          </button>
        </div>
      </div>
    </div>
  );
};
