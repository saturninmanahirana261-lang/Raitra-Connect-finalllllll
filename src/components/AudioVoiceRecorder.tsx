import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Trash2, Send, Play, Pause, AlertCircle, RefreshCw } from 'lucide-react';
import { getSupportedAudioMimeType, getMicrophoneStream, formatMicrophoneErrorMessage } from '../utils/audioService';

interface AudioVoiceRecorderProps {
  onSendAudio: (audioBlob: Blob, mimeType: string, durationSec: number) => void;
  onCancel: () => void;
}

export const AudioVoiceRecorder: React.FC<AudioVoiceRecorderProps> = ({
  onSendAudio,
  onCancel
}) => {
  const [status, setStatus] = useState<'requesting' | 'recording' | 'preview' | 'error'>('requesting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedMimeType, setRecordedMimeType] = useState<string>('audio/webm');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewCurrentTime, setPreviewCurrentTime] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Initialisation et démarrage de l'enregistrement
  const startRecordingSession = async () => {
    console.log('[VOICE] startRecordingSession initiated');
    setStatus('requesting');
    setErrorMessage(null);
    setDuration(0);
    setRecordedBlob(null);
    setPreviewUrl(null);
    audioChunksRef.current = [];

    try {
      console.log('[VOICE] requesting microphone stream...');
      const stream = await getMicrophoneStream();
      streamRef.current = stream;

      const { mimeType } = getSupportedAudioMimeType();
      console.log(`[VOICE] target MIME type: "${mimeType || 'default'}"`);
      setRecordedMimeType(mimeType || 'audio/webm');

      const options: MediaRecorderOptions = {};
      if (mimeType) {
        options.mimeType = mimeType;
      }

      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, options);
      } catch (mimeErr) {
        console.warn('[VOICE] MediaRecorder init with options failed, fallback to default:', mimeErr);
        recorder = new MediaRecorder(stream);
      }

      console.log(`[VOICE] MediaRecorder initialized, actual mimeType: "${recorder.mimeType}"`);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log(`[VOICE] data available: chunk size = ${event.data.size} bytes`);
        }
      };

      recorder.onerror = (e: any) => {
        console.error('[VOICE] MediaRecorder runtime error:', e);
        setErrorMessage('Une erreur est survenue pendant l\'enregistrement vocal.');
        setStatus('error');
      };

      recorder.onstop = () => {
        console.log('[VOICE] recording stopped, building final Blob...');
        const finalMime = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: finalMime });
        console.log(`[VOICE] blob created: size = ${blob.size} bytes, type = "${blob.type}"`);

        if (blob.size === 0) {
          console.warn('[VOICE] Empty blob detected (0 bytes)');
          setErrorMessage('Le microphone n\'a produit aucun enregistrement.');
          setStatus('error');
          return;
        }

        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setStatus('preview');
      };

      // Collecter les morceaux toutes les 250ms
      recorder.start(250);
      console.log('[VOICE] recording started');
      setStatus('recording');

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = window.setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('[VOICE] initialization error:', err);
      const friendlyMsg = formatMicrophoneErrorMessage(err);
      setErrorMessage(friendlyMsg);
      setStatus('error');
    }
  };

  useEffect(() => {
    startRecordingSession();

    return () => {
      console.log('[VOICE] cleanup completed');
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current.src = '';
      }
    };
  }, []);

  // Arrêt manuel de l'enregistrement
  const handleStopRecording = () => {
    console.log('[VOICE] user triggered stop recording');
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.requestData();
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.warn('[VOICE] MediaRecorder stop warning:', e);
      }
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  // Lecture / Pause de la prévisualisation
  const togglePreviewPlay = () => {
    if (!previewUrl) return;

    if (!previewAudioRef.current) {
      const audio = new Audio(previewUrl);
      previewAudioRef.current = audio;

      audio.ontimeupdate = () => {
        setPreviewCurrentTime(Math.round(audio.currentTime));
      };

      audio.onended = () => {
        setIsPreviewPlaying(false);
        setPreviewCurrentTime(0);
      };

      audio.onerror = (e) => {
        console.warn('[VOICE] Erreur lecture prévisualisation audio:', e);
        setIsPreviewPlaying(false);
      };
    }

    if (isPreviewPlaying) {
      previewAudioRef.current.pause();
      setIsPreviewPlaying(false);
    } else {
      previewAudioRef.current.play()
        .then(() => setIsPreviewPlaying(true))
        .catch((e) => console.warn('[VOICE] Play preview blocked:', e));
    }
  };

  // Envoi final avec validation stricte
  const handleSend = () => {
    if (!recordedBlob || recordedBlob.size === 0) {
      console.warn('[VOICE] Attempted to send invalid or empty blob');
      setErrorMessage('Le microphone n\'a produit aucun enregistrement.');
      setStatus('error');
      return;
    }

    console.log(`[VOICE] handleSend executing with blob size: ${recordedBlob.size} bytes`);
    onSendAudio(recordedBlob, recordedMimeType, Math.max(1, duration));
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Vue d'erreur
  if (status === 'error') {
    return (
      <div className="flex-1 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 p-3 rounded-2xl animate-in slide-in-from-bottom duration-150">
        <div className="flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800 dark:text-amber-200 leading-tight">
            <p className="font-semibold">Microphone indisponible</p>
            <p className="mt-0.5 opacity-90">{errorMessage || 'Impossible d\'enregistrer le message vocal.'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            type="button"
            onClick={startRecordingSession}
            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Réessayer</span>
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition cursor-pointer"
            title="Fermer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-between gap-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 px-4 py-2 rounded-2xl animate-in slide-in-from-bottom duration-150">
      <div className="flex items-center gap-3">
        {status === 'recording' ? (
          <div className="relative flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-rose-500 text-white flex items-center justify-center animate-pulse shadow-md">
              <Mic className="w-4 h-4" />
            </div>
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-600 animate-ping" />
          </div>
        ) : (
          <button
            type="button"
            onClick={togglePreviewPlay}
            className="w-8 h-8 rounded-full bg-[#6264a7] text-white flex items-center justify-center hover:bg-indigo-700 shadow-md transition cursor-pointer"
            title={isPreviewPlaying ? 'Mettre en pause' : 'Écouter'}
          >
            {isPreviewPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>
        )}

        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-rose-700 dark:text-rose-300">
              {status === 'recording'
                ? 'Enregistrement vocal...'
                : status === 'preview'
                ? 'Message prêt à être envoyé'
                : 'Initialisation du micro...'}
            </span>
            <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-rose-200/70 dark:bg-rose-900 text-rose-800 dark:text-rose-200">
              {status === 'preview' && previewAudioRef.current
                ? `${formatDuration(previewCurrentTime)} / ${formatDuration(duration)}`
                : formatDuration(duration)}
            </span>
          </div>

          {status === 'recording' && (
            <div className="flex items-center gap-1 mt-1">
              {[25, 60, 85, 45, 95, 70, 35, 80, 50, 100, 40, 65, 30].map((h, idx) => (
                <div
                  key={idx}
                  className="w-1 bg-rose-400 dark:bg-rose-500 rounded-full animate-bounce"
                  style={{
                    height: `${h * 0.16}px`,
                    animationDelay: `${idx * 0.08}s`,
                    animationDuration: '0.75s'
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition cursor-pointer"
          title="Annuler et supprimer"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        {status === 'recording' ? (
          <button
            type="button"
            onClick={handleStopRecording}
            className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs flex items-center gap-1.5 shadow-md transition cursor-pointer"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Arrêter</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSend}
            disabled={!recordedBlob || recordedBlob.size === 0}
            className="px-4 py-1.5 rounded-xl bg-[#6264a7] hover:bg-indigo-700 text-white font-medium text-xs flex items-center gap-1.5 shadow-md transition cursor-pointer disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Envoyer</span>
          </button>
        )}
      </div>
    </div>
  );
};
