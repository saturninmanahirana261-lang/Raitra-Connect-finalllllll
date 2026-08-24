import React, { useEffect } from 'react';
import { Phone, Video, PhoneOff, Volume2 } from 'lucide-react';
import { soundManager } from '../utils/sound';

interface IncomingCallModalProps {
  callerName: string;
  type: 'audio' | 'video';
  onAccept: () => void;
  onReject: () => void;
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  callerName,
  type,
  onAccept,
  onReject
}) => {
  useEffect(() => {
    soundManager.startIncomingRingtone();
    return () => {
      soundManager.stopIncomingRingtone();
    };
  }, []);

  const handleAccept = () => {
    soundManager.stopIncomingRingtone();
    soundManager.playCallConnected();
    onAccept();
  };

  const handleReject = () => {
    soundManager.stopIncomingRingtone();
    soundManager.playCallEnded();
    onReject();
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl p-7 max-w-sm w-full text-center shadow-2xl shadow-indigo-950/50 flex flex-col items-center">
        {/* Pulsing ring animation */}
        <div className="relative mb-5">
          <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#6264a7] to-indigo-500 text-white flex items-center justify-center text-3xl font-extrabold shadow-lg">
            {callerName.charAt(0).toUpperCase()}
          </div>
          <div className="absolute -inset-2 rounded-full border-2 border-indigo-400 animate-ping opacity-50" />
          <div className="absolute -inset-4 rounded-full border border-indigo-500/30 animate-pulse" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold mb-2">
          {type === 'video' ? <Video className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          <span>Appel {type === 'video' ? 'vidéo' : 'audio'} entrant</span>
        </div>

        <h3 className="text-xl font-bold text-white mb-1 tracking-tight">{callerName}</h3>
        <p className="text-xs text-slate-400 mb-7">vous appelle via Raitra Connect...</p>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-6 w-full">
          {/* Reject */}
          <button
            type="button"
            onClick={handleReject}
            className="flex flex-col items-center gap-2 group cursor-pointer"
          >
            <div className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg shadow-rose-600/40 transition group-hover:scale-105 active:scale-95">
              <PhoneOff className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-semibold text-rose-400">Refuser</span>
          </button>

          {/* Accept */}
          <button
            type="button"
            onClick={handleAccept}
            className="flex flex-col items-center gap-2 group cursor-pointer"
          >
            <div className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-lg shadow-emerald-600/40 transition group-hover:scale-105 active:scale-95 animate-bounce">
              {type === 'video' ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
            </div>
            <span className="text-[11px] font-semibold text-emerald-400">Accepter</span>
          </button>
        </div>
      </div>
    </div>
  );
};
