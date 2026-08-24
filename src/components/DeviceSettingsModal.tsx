import React, { useState, useEffect } from 'react';
import { Mic, Video, Volume2, Settings, RefreshCw, X, Check } from 'lucide-react';

interface DeviceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply?: (audioDeviceId: string, videoDeviceId: string) => void;
}

export const DeviceSettingsModal: React.FC<DeviceSettingsModalProps> = ({
  isOpen,
  onClose,
  onApply
}) => {
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoInputDevices, setVideoInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('');
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>('');
  const [micLevel, setMicLevel] = useState<number>(0);
  const [isTestingMic, setIsTestingMic] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const loadDevices = async () => {
      try {
        // Request temporary stream to ensure labels are accessible
        const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).catch(() => null);
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        const audioInputs = devices.filter((d) => d.kind === 'audioinput');
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');

        setAudioInputDevices(audioInputs);
        setVideoInputDevices(videoInputs);

        if (audioInputs.length > 0 && !selectedAudioDevice) {
          setSelectedAudioDevice(audioInputs[0].deviceId);
        }
        if (videoInputs.length > 0 && !selectedVideoDevice) {
          setSelectedVideoDevice(videoInputs[0].deviceId);
        }

        // Clean up temp stream
        if (tempStream) {
          tempStream.getTracks().forEach(t => t.stop());
        }
      } catch (err) {
        console.warn('Unable to enumerate audio/video devices:', err);
      }
    };

    loadDevices();
  }, [isOpen]);

  // Mic test VU-meter simulation
  useEffect(() => {
    let interval: number;
    if (isTestingMic) {
      interval = window.setInterval(() => {
        setMicLevel(Math.floor(Math.random() * 70) + 15);
      }, 150);
    } else {
      setMicLevel(0);
    }
    return () => clearInterval(interval);
  }, [isTestingMic]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (onApply) {
      onApply(selectedAudioDevice, selectedVideoDevice);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#24232c] border border-white/10 text-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold">Périphériques Audio & Vidéo</h3>
              <p className="text-xs text-slate-400">Configurez et testez votre matériel pour les réunions</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Microphone Selector */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              <Mic className="w-3.5 h-3.5 text-indigo-400" />
              Microphone
            </label>
            <select
              value={selectedAudioDevice}
              onChange={(e) => setSelectedAudioDevice(e.target.value)}
              className="w-full bg-[#18171d] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
            >
              {audioInputDevices.map((device, idx) => (
                <option key={device.deviceId || idx} value={device.deviceId}>
                  {device.label || `Microphone ${idx + 1}`}
                </option>
              ))}
              {audioInputDevices.length === 0 && (
                <option value="">Microphone par défaut</option>
              )}
            </select>
          </div>

          {/* Mic Test VU-Meter */}
          <div className="bg-[#18171d] border border-white/5 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">Niveau d'entrée sonore</span>
              <button
                type="button"
                onClick={() => setIsTestingMic(!isTestingMic)}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-md transition-colors ${
                  isTestingMic
                    ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
                    : 'bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30'
                }`}
              >
                {isTestingMic ? 'Arrêter le test' : 'Tester le micro'}
              </button>
            </div>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-150"
                style={{ width: `${micLevel}%` }}
              />
            </div>
          </div>

          {/* Camera Selector */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              <Video className="w-3.5 h-3.5 text-indigo-400" />
              Caméra
            </label>
            <select
              value={selectedVideoDevice}
              onChange={(e) => setSelectedVideoDevice(e.target.value)}
              className="w-full bg-[#18171d] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
            >
              {videoInputDevices.map((device, idx) => (
                <option key={device.deviceId || idx} value={device.deviceId}>
                  {device.label || `Caméra ${idx + 1}`}
                </option>
              ))}
              {videoInputDevices.length === 0 && (
                <option value="">Caméra par défaut</option>
              )}
            </select>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-white/10 flex items-center justify-end gap-2.5 bg-[#1f1e26]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-300 hover:bg-white/5 rounded-xl transition-colors"
          >
            Fermer
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-colors flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
          >
            <Check className="w-4 h-4" />
            Enregistrer les préférences
          </button>
        </div>
      </div>
    </div>
  );
};
