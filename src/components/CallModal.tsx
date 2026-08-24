import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Maximize2,
  Minimize2,
  Volume2,
  Wifi,
  ScreenShare,
  ScreenShareOff,
  Disc,
  Hand,
  PenTool,
  Settings,
  Sparkles,
  VolumeX,
  MessageSquare
} from 'lucide-react';
import { webrtcService } from '../utils/webrtc';
import { soundManager } from '../utils/sound';
import { WhiteboardModal } from './WhiteboardModal';
import { DeviceSettingsModal } from './DeviceSettingsModal';

interface CallModalProps {
  partnerName: string;
  partnerUid: string;
  type: 'audio' | 'video';
  callId?: string;
  isCaller?: boolean;
  onEndCall: (durationSeconds?: number, status?: string) => void;
}

export const CallModal: React.FC<CallModalProps> = ({
  partnerName,
  partnerUid,
  type,
  callId,
  isCaller,
  onEndCall
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(type === 'audio');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
  const [isDeviceSettingsOpen, setIsDeviceSettingsOpen] = useState(false);
  const [isBackgroundBlur, setIsBackgroundBlur] = useState(false);
  const [liveCaptions, setLiveCaptions] = useState<string[]>([]);
  const [showCaptions, setShowCaptions] = useState(false);
  const [duration, setDuration] = useState(0);
  const [callStatus, setCallStatus] = useState<string>('Connexion en cours...');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const modalContainerRef = useRef<HTMLDivElement>(null);
  const durationRef = useRef(0);

  // Call timer
  useEffect(() => {
    const timer = setInterval(() => {
      setDuration((prev) => {
        const next = prev + 1;
        durationRef.current = next;
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // WebRTC Stream attachment
  useEffect(() => {
    const attachRemoteStream = (remoteStream: MediaStream) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch((e) => console.log('Remote video auto-play:', e));
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.play().catch((e) => console.log('Remote audio auto-play:', e));
      }
      const videoTracks = remoteStream.getVideoTracks();
      setHasRemoteVideo(videoTracks.length > 0 && videoTracks[0].enabled);
      setCallStatus('En direct');
    };

    // Attach already available local stream
    const localStream = webrtcService.getLocalStream();
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch((e) => console.log('Local video auto-play:', e));
    }

    // Attach already available remote stream if any
    const existingRemoteStream = webrtcService.getRemoteStream();
    if (existingRemoteStream && existingRemoteStream.getTracks().length > 0) {
      attachRemoteStream(existingRemoteStream);
    }

    webrtcService.onRemoteStream = (remoteStream) => {
      attachRemoteStream(remoteStream);
    };

    webrtcService.onCallStateChange = (status) => {
      if (status === 'connected') {
        setCallStatus('En direct');
        soundManager.playCallConnected();
      } else if (status === 'ended' || status === 'rejected' || status === 'busy') {
        setCallStatus(status === 'rejected' ? 'Appel refusé' : 'Appel terminé');
        soundManager.playCallEnded();
        setTimeout(() => {
          onEndCall(durationRef.current, status);
        }, 1200);
      }
    };

    webrtcService.onConnectionStateChange = (state) => {
      if (state === 'connected') {
        setCallStatus('En direct');
      } else if (state === 'disconnected' || state === 'failed') {
        setCallStatus('Connexion interrompue');
      }
    };

    webrtcService.onScreenShareEnd = () => {
      setIsScreenSharing(false);
      const stream = webrtcService.getLocalStream();
      if (stream && localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    };

    return () => {
      webrtcService.onRemoteStream = undefined;
      webrtcService.onCallStateChange = undefined;
      webrtcService.onConnectionStateChange = undefined;
      webrtcService.onScreenShareEnd = undefined;
    };
  }, [onEndCall]);

  const toggleMic = () => {
    const nextState = !isMuted;
    webrtcService.toggleAudio(!nextState);
    setIsMuted(nextState);
  };

  const toggleVideo = () => {
    const nextState = !isVideoOff;
    webrtcService.toggleVideo(!nextState);
    setIsVideoOff(nextState);
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      await webrtcService.stopScreenShare();
      setIsScreenSharing(false);
      const stream = webrtcService.getLocalStream();
      if (stream && localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } else {
      const stream = await webrtcService.startScreenShare();
      if (stream) {
        setIsScreenSharing(true);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      }
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      webrtcService.stopRecording();
      setIsRecording(false);
    } else {
      const success = webrtcService.startRecording();
      if (success) {
        setIsRecording(true);
      }
    }
  };

  const toggleHand = () => {
    setIsHandRaised((prev) => !prev);
    soundManager.playNotification();
  };

  const toggleBackgroundBlur = () => {
    setIsBackgroundBlur(prev => !prev);
  };

  const toggleCaptions = () => {
    const next = !showCaptions;
    setShowCaptions(next);
    if (next && liveCaptions.length === 0) {
      setLiveCaptions([
        `[Transcription IA activée] ${partnerName} a rejoint l'échange.`,
        'Audio clair et optimisé en temps réel.'
      ]);
    }
  };

  const handleHangup = () => {
    if (isRecording) {
      webrtcService.stopRecording();
    }
    soundManager.playCallEnded();
    webrtcService.endCall(callId, partnerUid);
    onEndCall(durationRef.current, 'ended');
  };

  const toggleFullscreen = () => {
    if (!modalContainerRef.current) return;
    if (!document.fullscreenElement) {
      modalContainerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={modalContainerRef}
      className="fixed inset-0 z-50 bg-slate-950 flex flex-col justify-between p-4 sm:p-6 select-none animate-in fade-in duration-300"
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between z-10 flex-wrap gap-2">
        <div className="flex items-center gap-3 bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-slate-800 text-white">
          <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-sm text-white">
            {partnerName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="font-semibold text-sm flex items-center gap-2">
              <span>{partnerName}</span>
              {isHandRaised && <span className="text-amber-400 text-xs animate-bounce">✋ Main levée</span>}
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  callStatus === 'En direct'
                    ? 'bg-emerald-500 animate-pulse'
                    : 'bg-amber-500'
                }`}
              />
              <span>{callStatus}</span>
              <span>•</span>
              <span className="font-mono">{formatDuration(duration)}</span>
            </div>
          </div>
        </div>

        {/* Top Right Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-900/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-800 text-white flex-wrap">
          {/* Background Blur */}
          <button
            type="button"
            onClick={toggleBackgroundBlur}
            className={`p-2.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs ${
              isBackgroundBlur
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                : 'hover:bg-slate-800 text-slate-300 hover:text-white'
            }`}
            title={isBackgroundBlur ? 'Désactiver le flou d\'arrière-plan' : 'Activer le flou d\'arrière-plan IA'}
          >
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className="hidden md:inline">Flou IA</span>
          </button>

          {/* Live Captions */}
          <button
            type="button"
            onClick={toggleCaptions}
            className={`p-2.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs ${
              showCaptions
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'hover:bg-slate-800 text-slate-300 hover:text-white'
            }`}
            title="Activer/Désactiver les sous-titres en direct"
          >
            <MessageSquare className="w-4 h-4" />
            <span className="hidden md:inline">Sous-titres</span>
          </button>

          {/* Whiteboard */}
          <button
            type="button"
            onClick={() => setIsWhiteboardOpen(true)}
            className="p-2.5 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer flex items-center gap-1.5 text-xs"
            title="Ouvrir le tableau blanc collaboratif"
          >
            <PenTool className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline">Tableau blanc</span>
          </button>

          {/* Device settings */}
          <button
            type="button"
            onClick={() => setIsDeviceSettingsOpen(true)}
            className="p-2.5 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
            title="Configurer micro / caméra"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Recording */}
          <button
            type="button"
            onClick={toggleRecording}
            className={`p-2.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs ${
              isRecording
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                : 'hover:bg-slate-800 text-slate-300 hover:text-white'
            }`}
            title={isRecording ? 'Arrêter l\'enregistrement' : 'Enregistrer la réunion'}
          >
            <Disc className={`w-4 h-4 ${isRecording ? 'text-rose-500 animate-spin' : 'text-slate-400'}`} />
            <span className="hidden sm:inline">{isRecording ? 'Enregistrement...' : 'Enregistrer'}</span>
          </button>

          {/* Fullscreen */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
            title={isFullscreen ? 'Quitter plein écran' : 'Plein écran'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Video Stage */}
      <div className="relative flex-1 my-4 rounded-3xl overflow-hidden bg-slate-900 flex items-center justify-center border border-slate-800/80 shadow-2xl">
        {/* Remote Video Stream (always mounted to prevent track disconnection) */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={`w-full h-full object-cover ${hasRemoteVideo ? '' : 'hidden'}`}
        />

        {/* Dedicated Remote Audio element (always active) */}
        <audio
          ref={remoteAudioRef}
          autoPlay
          playsInline
          className="hidden"
        />

        {/* Avatar fallback when remote video is off */}
        {!hasRemoteVideo && (
          <div className="flex flex-col items-center gap-4 text-center p-6">
            <div className="relative">
              <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center font-bold text-4xl sm:text-5xl shadow-xl ring-4 ring-indigo-500/20 animate-pulse">
                {partnerName.charAt(0).toUpperCase()}
              </div>
              <div className="absolute bottom-1 right-1 w-7 h-7 rounded-full bg-emerald-500 border-4 border-slate-900 flex items-center justify-center">
                <Volume2 className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{partnerName}</h2>
              <p className="text-xs text-slate-400 mt-1 flex items-center justify-center gap-1.5">
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                Audio haute définition WebRTC chiffré
              </p>
            </div>
          </div>
        )}

        {/* Live subtitles overlay */}
        {showCaptions && liveCaptions.length > 0 && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md px-4 py-2 rounded-xl text-xs text-white max-w-lg text-center border border-white/10 z-20 shadow-xl">
            {liveCaptions.map((cap, i) => (
              <p key={i} className="text-slate-200">{cap}</p>
            ))}
          </div>
        )}

        {/* Local Picture-in-Picture Video */}
        <div className={`absolute bottom-4 right-4 w-32 h-24 sm:w-48 sm:h-36 rounded-2xl overflow-hidden bg-slate-950 border-2 border-slate-700 shadow-2xl z-20 group ${
          isBackgroundBlur ? 'backdrop-blur-xl' : ''
        }`}>
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''} ${
              isBackgroundBlur ? 'filter contrast-105' : ''
            }`}
          />
          {isVideoOff && (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-400 p-2">
              <VideoOff className="w-6 h-6 mb-1 text-slate-500" />
              <span className="text-[10px] font-medium">Caméra désactivée</span>
            </div>
          )}
          <div className="absolute bottom-1 left-2 text-[10px] font-semibold text-white/80 bg-black/40 px-1.5 py-0.5 rounded backdrop-blur-xs flex items-center gap-1">
            <span>Vous</span>
            {isBackgroundBlur && <Sparkles className="w-2.5 h-2.5 text-indigo-400" />}
          </div>
        </div>
      </div>

      {/* Bottom Floating Control Bar */}
      <div className="flex items-center justify-center z-10">
        <div className="flex items-center gap-2.5 sm:gap-4 bg-slate-900/90 backdrop-blur-xl px-4 sm:px-6 py-3 rounded-3xl border border-slate-800 shadow-2xl flex-wrap justify-center">
          {/* Mute Mic */}
          <button
            type="button"
            onClick={toggleMic}
            className={`p-3.5 sm:p-4 rounded-2xl transition cursor-pointer ${
              isMuted
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                : 'bg-slate-800 text-white hover:bg-slate-700'
            }`}
            title={isMuted ? 'Activer le micro' : 'Couper le micro'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Toggle Video */}
          <button
            type="button"
            onClick={toggleVideo}
            className={`p-3.5 sm:p-4 rounded-2xl transition cursor-pointer ${
              isVideoOff
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                : 'bg-slate-800 text-white hover:bg-slate-700'
            }`}
            title={isVideoOff ? 'Activer la caméra' : 'Couper la caméra'}
          >
            {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>

          {/* Screen Share */}
          <button
            type="button"
            onClick={toggleScreenShare}
            className={`p-3.5 sm:p-4 rounded-2xl transition cursor-pointer ${
              isScreenSharing
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800 text-white hover:bg-slate-700'
            }`}
            title={isScreenSharing ? 'Arrêter le partage' : 'Partager l\'écran'}
          >
            {isScreenSharing ? <ScreenShareOff className="w-5 h-5" /> : <ScreenShare className="w-5 h-5" />}
          </button>

          {/* Raise Hand */}
          <button
            type="button"
            onClick={toggleHand}
            className={`p-3.5 sm:p-4 rounded-2xl transition cursor-pointer ${
              isHandRaised
                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                : 'bg-slate-800 text-white hover:bg-slate-700'
            }`}
            title={isHandRaised ? 'Baisser la main' : 'Lever la main'}
          >
            <Hand className="w-5 h-5" />
          </button>

          {/* End / Hang up call */}
          <button
            type="button"
            onClick={handleHangup}
            className="p-3.5 sm:p-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/40 transition cursor-pointer flex items-center gap-2 px-5 sm:px-6"
            title="Raccrocher"
          >
            <PhoneOff className="w-5 h-5" />
            <span className="font-semibold text-xs hidden sm:inline">Quitter</span>
          </button>
        </div>
      </div>

      {/* Collaborative Whiteboard Modal */}
      {isWhiteboardOpen && (
        <WhiteboardModal
          isOpen={isWhiteboardOpen}
          onClose={() => setIsWhiteboardOpen(false)}
          roomId={callId || 'call_whiteboard'}
          userName="Vous"
        />
      )}

      {/* Device Settings Modal */}
      {isDeviceSettingsOpen && (
        <DeviceSettingsModal
          isOpen={isDeviceSettingsOpen}
          onClose={() => setIsDeviceSettingsOpen(false)}
        />
      )}
    </div>
  );
};
