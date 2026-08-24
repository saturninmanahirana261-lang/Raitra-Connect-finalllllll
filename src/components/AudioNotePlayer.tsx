import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, AlertCircle, RefreshCw } from 'lucide-react';

interface AudioNotePlayerProps {
  url: string;
  duration?: number;
  isMe?: boolean;
}

export const AudioNotePlayer: React.FC<AudioNotePlayerProps> = ({ url, duration = 0, isMe = false }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState<number>(duration || 0);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  // Initialisation et gestion de l'élément Audio
  useEffect(() => {
    setHasError(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setTotalDuration(duration || 0);

    if (!url) {
      setHasError(true);
      return;
    }

    const audio = new Audio();
    audioRef.current = audio;
    audio.preload = 'metadata';

    const handleLoadedMetadata = () => {
      if (audio.duration && isFinite(audio.duration) && !isNaN(audio.duration)) {
        setTotalDuration(Math.round(audio.duration));
      } else if (duration && duration > 0) {
        setTotalDuration(duration);
      }
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      if (audio.currentTime !== undefined) {
        setCurrentTime(Math.round(audio.currentTime));
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleWaiting = () => {
      setIsLoading(true);
    };

    const handlePlaying = () => {
      setIsLoading(false);
      setIsPlaying(true);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleError = (e: any) => {
      console.warn('Audio playback error for url:', url, e);
      setHasError(true);
      setIsLoading(false);
      setIsPlaying(false);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError);

    try {
      audio.src = url;
    } catch {
      setHasError(true);
    }

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleError);
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, [url, duration]);

  const togglePlay = () => {
    if (!audioRef.current || hasError) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      setIsLoading(true);
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          setIsLoading(false);
        })
        .catch((err) => {
          console.warn('Audio play request rejected:', err);
          setIsLoading(false);
          setIsPlaying(false);
        });
    }
  };

  const retryLoading = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    setHasError(false);
    setIsLoading(true);
    try {
      audioRef.current.load();
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          setIsLoading(false);
        })
        .catch(() => {
          setIsLoading(false);
          setHasError(true);
        });
    } catch {
      setHasError(true);
      setIsLoading(false);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !audioRef.current || totalDuration <= 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const seekFraction = Math.max(0, Math.min(1, clickX / width));
    const targetTime = seekFraction * totalDuration;

    audioRef.current.currentTime = targetTime;
    setCurrentTime(Math.round(targetTime));
  };

  const formatTime = (sec: number) => {
    if (!sec || isNaN(sec) || !isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const effectiveDuration = totalDuration > 0 ? totalDuration : (duration > 0 ? duration : 0);
  const progressPercent = effectiveDuration > 0 ? (currentTime / effectiveDuration) * 100 : 0;

  if (hasError) {
    return (
      <div
        className={`flex items-center gap-2.5 p-2 rounded-2xl min-w-[190px] max-w-[280px] text-xs select-none ${
          isMe
            ? 'bg-rose-900/60 text-rose-100 border border-rose-700/50'
            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50'
        }`}
      >
        <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
        <span className="flex-1 truncate text-[11px]">Audio indisponible</span>
        <button
          type="button"
          onClick={retryLoading}
          className="p-1 rounded-lg hover:bg-rose-500/20 text-rose-400 hover:text-rose-200 transition cursor-pointer"
          title="Réessayer de charger"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-3 p-2.5 rounded-2xl min-w-[200px] max-w-[290px] shadow-sm select-none transition-colors ${
        isMe
          ? 'bg-indigo-700/80 text-white'
          : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100'
      }`}
    >
      <button
        type="button"
        onClick={togglePlay}
        disabled={isLoading}
        className={`w-9 h-9 rounded-xl flex items-center justify-center transition active:scale-95 cursor-pointer shadow-sm flex-shrink-0 ${
          isMe
            ? 'bg-white text-[#6264a7] hover:bg-slate-100'
            : 'bg-[#6264a7] text-white hover:bg-indigo-700'
        }`}
      >
        {isLoading ? (
          <RefreshCw className="w-4 h-4 animate-spin text-current" />
        ) : isPlaying ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4 fill-current ml-0.5" />
        )}
      </button>

      <div className="flex-1 flex flex-col justify-center gap-1.5 min-w-0">
        {/* Visualizer Wave Bars avec zone interactive de recherche */}
        <div
          ref={progressBarRef}
          onClick={handleSeek}
          className="flex items-center gap-1 h-5 overflow-hidden cursor-pointer group py-0.5"
          title="Cliquer pour avancer ou reculer"
        >
          {[35, 75, 40, 90, 55, 80, 60, 100, 45, 85, 50, 70, 30, 65, 45, 90].map((height, i) => {
            const barProgress = (i / 16) * 100;
            const isPassed = progressPercent >= barProgress;
            return (
              <div
                key={i}
                className={`w-1 rounded-full transition-all duration-150 group-hover:opacity-90 ${
                  isPassed
                    ? isMe ? 'bg-white' : 'bg-[#6264a7]'
                    : isMe ? 'bg-indigo-400/50' : 'bg-slate-300 dark:bg-slate-600'
                } ${isPlaying && isPassed ? 'animate-pulse' : ''}`}
                style={{ height: `${height}%` }}
              />
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[10px] opacity-80 font-mono">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(effectiveDuration)}</span>
        </div>
      </div>

      <Volume2 className="w-3.5 h-3.5 opacity-60 flex-shrink-0" />
    </div>
  );
};
