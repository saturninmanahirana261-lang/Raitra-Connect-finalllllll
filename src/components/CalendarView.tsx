import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Video,
  Users,
  Check,
  Sparkles,
  Trash2,
  Share2,
  CalendarCheck,
  FileText,
  X
} from 'lucide-react';
import { rtdb, ref, push, set, onValue, remove } from '../firebase';
import type { UserProfile, MeetingEvent } from '../types';

interface CalendarViewProps {
  currentUser: UserProfile;
  onStartMeeting: (meetingId?: string, meetingTitle?: string) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ currentUser, onStartMeeting }) => {
  const [meetings, setMeetings] = useState<MeetingEvent[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTime, setNewTime] = useState('10:00 - 10:45');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newDescription, setNewDescription] = useState('');
  const [isGeneratingAgenda, setIsGeneratingAgenda] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Sync meetings with Firebase RTDB
  useEffect(() => {
    const meetingsRef = ref(rtdb, 'meetings');
    const unsub = onValue(meetingsRef, (snapshot) => {
      if (!snapshot.exists()) {
        setMeetings([]);
        return;
      }

      const list: MeetingEvent[] = [];
      snapshot.forEach((child) => {
        const val = child.val();
        list.push({
          id: child.key as string,
          title: val.title || 'Réunion',
          date: val.date || new Date().toISOString().split('T')[0],
          time: val.time || '10:00 - 11:00',
          organizerName: val.organizerName || currentUser.displayName || 'Organisateur',
          organizerUid: val.organizerUid || currentUser.uid,
          participantsCount: val.participantsCount || 1,
          description: val.description || '',
          isLive: val.isLive || false
        });
      });
      setMeetings(list);
    });

    return () => unsub();
  }, [currentUser.uid, currentUser.displayName]);

  // Generate meeting agenda with Gemini
  const handleGenerateAgenda = async () => {
    if (!newTitle.trim()) return;
    setIsGeneratingAgenda(true);

    try {
      const res = await fetch('/api/gemini/rephrase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `Génère un ordre du jour structuré et concis (3 à 4 points clés) pour une réunion de travail intitulée : "${newTitle}".`,
          mode: 'bullet'
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.rephrased) {
          setNewDescription(data.rephrased);
        }
      }
    } catch {
      setNewDescription('• Tour de table et actualités\n• Validation des priorités\n• Prochaines étapes et calendrier');
    } finally {
      setIsGeneratingAgenda(false);
    }
  };

  // Add new meeting
  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newMeetingRef = push(ref(rtdb, 'meetings'));
    const meetingPayload: MeetingEvent = {
      id: newMeetingRef.key as string,
      title: newTitle.trim(),
      date: newDate,
      time: newTime,
      organizerName: currentUser.displayName || 'Moi',
      organizerUid: currentUser.uid,
      participantsCount: 1,
      description: newDescription.trim() || 'Réunion de travail d\'équipe.',
      isLive: false
    };

    await set(newMeetingRef, meetingPayload);
    setNewTitle('');
    setNewDescription('');
    setShowAddModal(false);
  };

  // Delete meeting
  const handleDeleteMeeting = async (meetingId: string) => {
    await remove(ref(rtdb, `meetings/${meetingId}`)).catch(console.warn);
  };

  // Copy Meeting Link
  const handleCopyMeetingLink = (meetingId: string) => {
    const link = `${window.location.origin}/#meeting=${meetingId}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(meetingId);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  return (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto space-y-4 sm:space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-[#6264a7]" /> Calendrier & Réunions Teams
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Planifiez des réunions, préparez vos ordres du jour avec l'IA et lancez des visioconférences WebRTC.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => onStartMeeting()}
            className="px-4 py-2.5 bg-[#6264a7] hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer shadow-md shadow-indigo-500/20 active:scale-95"
          >
            <Video className="w-4 h-4" />
            <span>Rejoindre maintenant</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Planifier</span>
          </button>
        </div>
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {meetings.map((event) => (
          <div
            key={event.id}
            className={`bg-white dark:bg-slate-900 p-5 rounded-2xl border transition flex flex-col justify-between ${
              event.isLive
                ? 'border-[#6264a7] ring-2 ring-[#6264a7]/20 shadow-lg dark:border-indigo-500'
                : 'border-slate-200 dark:border-slate-800 shadow-xs'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <Clock className="w-3.5 h-3.5 text-[#6264a7]" />
                  <span>{event.time}</span>
                </div>
                {event.isLive ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] uppercase tracking-wider animate-pulse">
                    En direct
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-slate-400">
                    {event.date}
                  </span>
                )}
              </div>

              <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-2 leading-snug">
                {event.title}
              </h3>

              {event.description && (
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 line-clamp-3 leading-relaxed whitespace-pre-line bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                  {event.description}
                </p>
              )}

              <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Organisateur :</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">{event.organizerName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> Participants
                  </span>
                  <span className="font-semibold">{event.participantsCount} invités</span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <button
                type="button"
                onClick={() => onStartMeeting(event.id, event.title)}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  event.isLive
                    ? 'bg-[#6264a7] text-white hover:bg-indigo-700 shadow-md'
                    : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'
                }`}
              >
                <Video className="w-3.5 h-3.5" />
                <span>{event.isLive ? 'Rejoindre la visio' : 'Démarrer'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleCopyMeetingLink(event.id)}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-[#6264a7] transition cursor-pointer"
                title="Copier le lien d'invitation"
              >
                {copiedLink === event.id ? <Check className="w-4 h-4 text-emerald-500" /> : <Share2 className="w-4 h-4" />}
              </button>

              {event.organizerUid === currentUser.uid && (
                <button
                  type="button"
                  onClick={() => handleDeleteMeeting(event.id)}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Meeting Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <form
            onSubmit={handleAddEvent}
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-lg border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-[#6264a7]" /> Planifier une réunion Teams
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Titre de la réunion
              </label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="ex: Revue de Sprint & Validation Produit"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#6264a7]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#6264a7]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Créneau horaire
                </label>
                <input
                  type="text"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#6264a7]"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Ordre du jour & Description
                </label>
                <button
                  type="button"
                  onClick={handleGenerateAgenda}
                  disabled={!newTitle.trim() || isGeneratingAgenda}
                  className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-semibold disabled:opacity-50 cursor-pointer"
                >
                  <Sparkles className={`w-3 h-3 ${isGeneratingAgenda ? 'animate-spin' : ''}`} />
                  <span>Générer l'ordre du jour avec l'IA</span>
                </button>
              </div>
              <textarea
                rows={4}
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Détails, objectifs et ordre du jour de la réunion..."
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#6264a7] resize-none"
              />
            </div>

            <div className="flex gap-2 justify-end pt-3">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-[#6264a7] hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl cursor-pointer shadow-md shadow-indigo-500/20"
              >
                Confirmer la planification
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
