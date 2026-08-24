import React, { useState, useEffect } from 'react';
import {
  Plus,
  Users,
  Hash,
  Lock,
  MessageSquare,
  Send,
  Sparkles,
  Heart,
  CornerDownRight,
  Trash2,
  Share2,
  FolderPlus,
  Check,
  Shield
} from 'lucide-react';
import { rtdb, ref, push, set, update, onValue, remove } from '../firebase';
import type { UserProfile, UserRole, TeamMember } from '../types';
import { MemberRoleModal } from './MemberRoleModal';

interface TeamsViewProps {
  currentUser: UserProfile;
}

interface TeamItem {
  id: string;
  name: string;
  desc: string;
  channels: string[];
  membersCount: number;
  creatorUid?: string;
  createdAt: number;
}

interface TeamPost {
  id: string;
  teamId: string;
  channel: string;
  authorName: string;
  authorUid: string;
  text: string;
  timestamp: number;
  likes: Record<string, boolean>;
  replies?: Array<{
    id: string;
    authorName: string;
    authorUid: string;
    text: string;
    timestamp: number;
  }>;
}

const DEFAULT_TEAMS: TeamItem[] = [
  {
    id: 't_engineering',
    name: 'Ingénierie & Développement',
    desc: 'Architecture logicielle, revues de code, infrastructure Cloud et déploiements.',
    channels: ['général', 'releases', 'infrastructure', 'qa-tests'],
    membersCount: 14,
    createdAt: Date.now() - 86400000 * 5
  },
  {
    id: 't_product',
    name: 'Design & Produit',
    desc: 'Maquettes Figma, parcours utilisateur, spécifications et retours clients.',
    channels: ['général', 'ux-recherche', 'design-system'],
    membersCount: 8,
    createdAt: Date.now() - 86400000 * 3
  },
  {
    id: 't_growth',
    name: 'Marketing & Ventes',
    desc: 'Campagnes de communication, acquisition et partenariats stratégiques.',
    channels: ['général', 'contenu', 'leads'],
    membersCount: 11,
    createdAt: Date.now() - 86400000 * 2
  }
];

export const TeamsView: React.FC<TeamsViewProps> = ({ currentUser }) => {
  const [teams, setTeams] = useState<TeamItem[]>(DEFAULT_TEAMS);
  const [activeTeamId, setActiveTeamId] = useState<string>('t_engineering');
  const [activeChannel, setActiveChannel] = useState<string>('général');
  const [postText, setPostText] = useState<string>('');
  const [posts, setPosts] = useState<TeamPost[]>([]);
  const [replyInputMap, setReplyInputMap] = useState<Record<string, string>>({});
  const [openReplyFor, setOpenReplyFor] = useState<string | null>(null);

  // Modal create team
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');

  // Modal create channel
  const [showAddChannelModal, setShowAddChannelModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');

  // Modal RBAC members
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([
    {
      uid: currentUser.uid,
      displayName: currentUser.displayName || 'Vous',
      email: currentUser.email,
      role: 'owner',
      joinedAt: Date.now()
    }
  ]);

  // 1. Sync Teams from Firebase Realtime Database
  useEffect(() => {
    const teamsRef = ref(rtdb, 'teams');
    const unsub = onValue(teamsRef, (snapshot) => {
      if (!snapshot.exists()) {
        // Initialize default teams if empty
        DEFAULT_TEAMS.forEach((team) => {
          set(ref(rtdb, `teams/${team.id}`), team).catch(() => {});
        });
        setTeams(DEFAULT_TEAMS);
        return;
      }

      const list: TeamItem[] = [];
      snapshot.forEach((child) => {
        const val = child.val();
        list.push({
          id: child.key as string,
          name: val.name || 'Équipe',
          desc: val.desc || '',
          channels: Array.isArray(val.channels) ? val.channels : ['général'],
          membersCount: val.membersCount || 1,
          creatorUid: val.creatorUid,
          createdAt: val.createdAt || Date.now()
        });
      });
      setTeams(list);
    });

    return () => unsub();
  }, []);

  // 2. Sync Posts from Firebase Realtime Database
  useEffect(() => {
    const postsRef = ref(rtdb, 'teams_posts');
    const unsub = onValue(postsRef, (snapshot) => {
      if (!snapshot.exists()) {
        setPosts([]);
        return;
      }

      const list: TeamPost[] = [];
      snapshot.forEach((child) => {
        const val = child.val();
        list.push({
          id: child.key as string,
          teamId: val.teamId || '',
          channel: val.channel || 'général',
          authorName: val.authorName || 'Collaborateur',
          authorUid: val.authorUid || '',
          text: val.text || '',
          timestamp: val.timestamp || Date.now(),
          likes: val.likes || {},
          replies: val.replies ? Object.values(val.replies) : []
        });
      });
      list.sort((a, b) => b.timestamp - a.timestamp);
      setPosts(list);
    });

    return () => unsub();
  }, []);

  const currentTeamObj = teams.find((t) => t.id === activeTeamId) || teams[0] || DEFAULT_TEAMS[0];

  // Create post
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postText.trim()) return;

    const newPostRef = push(ref(rtdb, 'teams_posts'));
    const payload: TeamPost = {
      id: newPostRef.key as string,
      teamId: currentTeamObj.id,
      channel: activeChannel,
      authorName: currentUser.displayName || currentUser.email.split('@')[0] || 'Utilisateur',
      authorUid: currentUser.uid,
      text: postText.trim(),
      timestamp: Date.now(),
      likes: {}
    };

    await set(newPostRef, payload);
    setPostText('');
  };

  // Toggle like on post
  const handleToggleLike = async (post: TeamPost) => {
    const isLiked = post.likes?.[currentUser.uid] || false;
    const postLikesRef = ref(rtdb, `teams_posts/${post.id}/likes/${currentUser.uid}`);
    if (isLiked) {
      await remove(postLikesRef);
    } else {
      await set(postLikesRef, true);
    }
  };

  // Add reply to post
  const handleAddReply = async (postId: string) => {
    const replyText = (replyInputMap[postId] || '').trim();
    if (!replyText) return;

    const replyRef = push(ref(rtdb, `teams_posts/${postId}/replies`));
    await set(replyRef, {
      id: replyRef.key as string,
      authorName: currentUser.displayName || currentUser.email.split('@')[0] || 'Utilisateur',
      authorUid: currentUser.uid,
      text: replyText,
      timestamp: Date.now()
    });

    setReplyInputMap((prev) => ({ ...prev, [postId]: '' }));
    setOpenReplyFor(null);
  };

  // Create new team
  const handleCreateTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    const newTeamRef = push(ref(rtdb, 'teams'));
    const payload: TeamItem = {
      id: newTeamRef.key as string,
      name: newTeamName.trim(),
      desc: newTeamDesc.trim() || 'Équipe de collaboration.',
      channels: ['général'],
      membersCount: 1,
      creatorUid: currentUser.uid,
      createdAt: Date.now()
    };

    await set(newTeamRef, payload);
    setActiveTeamId(payload.id);
    setActiveChannel('général');
    setNewTeamName('');
    setNewTeamDesc('');
    setShowCreateTeamModal(false);
  };

  // Add channel to active team
  const handleAddChannelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newChannelName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    if (!cleanName || currentTeamObj.channels.includes(cleanName)) return;

    const updatedChannels = [...currentTeamObj.channels, cleanName];
    await update(ref(rtdb, `teams/${currentTeamObj.id}`), {
      channels: updatedChannels
    });

    setActiveChannel(cleanName);
    setNewChannelName('');
    setShowAddChannelModal(false);
  };

  // Update role for member
  const handleUpdateRole = (uid: string, newRole: UserRole) => {
    setTeamMembers((prev) =>
      prev.map((m) => (m.uid === uid ? { ...m, role: newRole } : m))
    );
  };

  // Invite member
  const handleInviteMember = (email: string, role: UserRole) => {
    const newMember: TeamMember = {
      uid: `user_${Date.now()}`,
      displayName: email.split('@')[0],
      email,
      role,
      joinedAt: Date.now()
    };
    setTeamMembers((prev) => [...prev, newMember]);
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">Équipes & Canaux de projet</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Organisez les discussions thématiques, publications et annonces de votre organisation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowMembersModal(true)}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <Shield className="w-4 h-4 text-indigo-500" />
            <span>Membres & Rôles</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCreateTeamModal(true)}
            className="px-3.5 py-2 bg-[#6264a7] hover:bg-[#525494] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Créer une équipe</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Team list column */}
        <div className="space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
            Vos espaces d'équipe ({teams.length})
          </div>

          {teams.map((team) => {
            const isActive = team.id === activeTeamId;
            return (
              <div
                key={team.id}
                onClick={() => {
                  setActiveTeamId(team.id);
                  setActiveChannel('général');
                }}
                className={`p-4 rounded-2xl border transition cursor-pointer ${
                  isActive
                    ? 'bg-white dark:bg-slate-900 border-[#6264a7] dark:border-indigo-500 shadow-md ring-1 ring-[#6264a7]/20'
                    : 'bg-white dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700/60'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <h3 className="font-bold text-sm text-slate-800 dark:text-white">{team.name}</h3>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {team.membersCount} membres
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 line-clamp-2">{team.desc}</p>

                {/* Channels inside this team */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {team.channels.map((chan) => (
                    <button
                      key={chan}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTeamId(team.id);
                        setActiveChannel(chan);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 transition cursor-pointer ${
                        isActive && activeChannel === chan
                          ? 'bg-[#6264a7] text-white shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      <Hash className="w-3 h-3" />
                      <span>{chan}</span>
                    </button>
                  ))}

                  {isActive && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowAddChannelModal(true);
                      }}
                      className="px-2 py-1 rounded-lg text-[11px] font-medium text-[#6264a7] dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 transition flex items-center gap-0.5 cursor-pointer"
                      title="Ajouter un canal"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Canal</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Channel feed */}
        <div className="lg:col-span-2 space-y-4">
          {/* Channel Header */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-[#6264a7] dark:text-indigo-400 flex items-center justify-center font-bold">
                <Hash className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800 dark:text-white">
                  {currentTeamObj.name} &rsaquo; #{activeChannel}
                </h2>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Fil d'actualité et annonces partagées
                </span>
              </div>
            </div>
          </div>

          {/* New Post Creator */}
          <form onSubmit={handleCreatePost} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
            <textarea
              rows={3}
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
              placeholder={`Partagez une information ou annonce avec l'équipe dans #${activeChannel}...`}
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-white outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-[#6264a7] transition resize-none placeholder-slate-400"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!postText.trim()}
                className="px-4 py-2 bg-[#6264a7] hover:bg-[#525494] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40 shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Publier le message</span>
              </button>
            </div>
          </form>

          {/* Posts list */}
          <div className="space-y-3">
            {posts
              .filter((p) => p.teamId === currentTeamObj.id && (p.channel === activeChannel || activeChannel === 'général'))
              .map((post) => {
                const likeCount = Object.keys(post.likes || {}).length;
                const isLikedByMe = !!post.likes?.[currentUser.uid];

                return (
                  <div key={post.id} className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#6264a7] to-[#7f81cf] text-white font-bold flex items-center justify-center text-xs shadow-xs">
                          {post.authorName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-bold text-slate-800 dark:text-white block">{post.authorName}</span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(post.timestamp).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                        #{post.channel}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap pl-10">
                      {post.text}
                    </p>

                    {/* Actions: Likes and Replies */}
                    <div className="pl-10 pt-1 flex items-center gap-4 text-xs">
                      <button
                        type="button"
                        onClick={() => handleToggleLike(post)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition cursor-pointer ${
                          isLikedByMe
                            ? 'text-rose-500 bg-rose-50 dark:bg-rose-950/40 font-semibold'
                            : 'text-slate-500 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${isLikedByMe ? 'fill-rose-500' : ''}`} />
                        <span>{likeCount > 0 ? likeCount : 'J\'aime'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setOpenReplyFor(openReplyFor === post.id ? null : post.id)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-slate-500 hover:text-[#6264a7] hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Répondre {post.replies?.length ? `(${post.replies.length})` : ''}</span>
                      </button>
                    </div>

                    {/* Replies list */}
                    {post.replies && post.replies.length > 0 && (
                      <div className="pl-10 space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        {post.replies.map((reply) => (
                          <div key={reply.id} className="flex items-start gap-2 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl text-xs">
                            <CornerDownRight className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-800 dark:text-white">{reply.authorName}</span>
                                <span className="text-[10px] text-slate-400">
                                  {new Date(reply.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-slate-600 dark:text-slate-300 mt-0.5">{reply.text}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reply input box */}
                    {openReplyFor === post.id && (
                      <div className="pl-10 pt-2 flex items-center gap-2">
                        <input
                          type="text"
                          value={replyInputMap[post.id] || ''}
                          onChange={(e) => setReplyInputMap({ ...replyInputMap, [post.id]: e.target.value })}
                          placeholder="Écrivez une réponse..."
                          className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white outline-none focus:border-[#6264a7]"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddReply(post.id);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleAddReply(post.id)}
                          className="px-3 py-1.5 bg-[#6264a7] text-white rounded-xl text-xs font-semibold cursor-pointer"
                        >
                          Envoyer
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

            {posts.filter((p) => p.teamId === currentTeamObj.id && (p.channel === activeChannel || activeChannel === 'général')).length === 0 && (
              <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-2">
                <MessageSquare className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                <p className="text-xs font-medium text-slate-400">Aucune publication dans ce canal pour l'instant.</p>
                <p className="text-[11px] text-slate-400">Soyez le premier à partager une annonce avec l'équipe !</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Créer une Équipe */}
      {showCreateTeamModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <h3 className="font-bold text-sm text-slate-800 dark:text-white">Créer une nouvelle équipe</h3>
            <form onSubmit={handleCreateTeamSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">Nom de l'équipe</label>
                <input
                  type="text"
                  required
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="Ex : Équipe Finance & Stratégie"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white outline-none focus:border-[#6264a7]"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">Description</label>
                <textarea
                  rows={2}
                  value={newTeamDesc}
                  onChange={(e) => setNewTeamDesc(e.target.value)}
                  placeholder="Objectifs et périmètre de l'équipe..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white outline-none focus:border-[#6264a7] resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateTeamModal(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#6264a7] text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Créer l'équipe
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ajouter un Canal */}
      {showAddChannelModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
            <h3 className="font-bold text-sm text-slate-800 dark:text-white">Nouveau canal dans {currentTeamObj.name}</h3>
            <form onSubmit={handleAddChannelSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">Nom du canal</label>
                <input
                  type="text"
                  required
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder="Ex : veille-tech, sprint-actuel"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white outline-none focus:border-[#6264a7]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddChannelModal(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#6264a7] text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Ajouter le canal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Membres & Rôles RBAC */}
      <MemberRoleModal
        isOpen={showMembersModal}
        onClose={() => setShowMembersModal(false)}
        teamName={currentTeamObj.name}
        members={teamMembers}
        onUpdateRole={handleUpdateRole}
        onInviteMember={handleInviteMember}
        currentUserRole={(teamMembers.find(m => m.uid === currentUser.uid)?.role || 'owner') as UserRole}
      />
    </div>
  );
};
