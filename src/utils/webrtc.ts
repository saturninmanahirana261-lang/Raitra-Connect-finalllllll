import { rtdb, ref, set, push, update, onValue, get } from '../firebase';
import type { CallSession } from '../types';

// Configuration STUN / TURN extensible pour WebRTC
export const getIceServers = (): RTCConfiguration => {
  const iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' }
  ];

  // Support dynamique pour serveurs TURN personnalisés (ex: Coturn, Twilio, Metered)
  const turnUrl = (import.meta as any).env?.VITE_TURN_URL;
  const turnUser = (import.meta as any).env?.VITE_TURN_USERNAME;
  const turnPass = (import.meta as any).env?.VITE_TURN_CREDENTIAL;

  if (turnUrl && turnUser && turnPass) {
    iceServers.push({
      urls: turnUrl,
      username: turnUser,
      credential: turnPass
    });
  }

  return {
    iceServers,
    iceCandidatePoolSize: 10
  };
};

export class WebRTCService {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private cameraTrack: MediaStreamTrack | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private currentCallId: string | null = null;
  private unsubCallListener: (() => void) | null = null;
  private unsubCandidatesListener: (() => void) | null = null;
  private pendingRemoteCandidates: RTCIceCandidateInit[] = [];

  public isScreenSharing: boolean = false;
  public isRecording: boolean = false;

  public onRemoteStream?: (stream: MediaStream) => void;
  public onCallStateChange?: (status: CallSession['status']) => void;
  public onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  public onScreenShareEnd?: () => void;

  public getPeerConnection(): RTCPeerConnection | null {
    return this.pc;
  }

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  public getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  public getCurrentCallId(): string | null {
    return this.currentCallId;
  }

  // Drain queued ICE candidates once remoteDescription is set
  private async drainPendingCandidates() {
    if (!this.pc || !this.pc.remoteDescription) return;
    while (this.pendingRemoteCandidates.length > 0) {
      const candidateInit = this.pendingRemoteCandidates.shift();
      if (candidateInit) {
        try {
          await this.pc.addIceCandidate(new RTCIceCandidate(candidateInit));
        } catch (e) {
          console.warn('[WebRTC] Error adding drained candidate:', e);
        }
      }
    }
  }

  // 1. Initialize local media with clean error handling
  public async getMedia(type: 'audio' | 'video'): Promise<MediaStream> {
    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: type === 'video' ? {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user'
      } : false
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.localStream = stream;
      const vTrack = stream.getVideoTracks()[0];
      if (vTrack) {
        this.cameraTrack = vTrack;
      }
      return stream;
    } catch (err: any) {
      console.warn('getUserMedia initial constraint failed:', err?.name || err);
      
      // Fallback for audio only if camera is blocked/unavailable
      if (type === 'video') {
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            },
            video: false
          });
          this.localStream = fallbackStream;
          return fallbackStream;
        } catch (audioErr: any) {
          throw new Error(this.formatMediaErrorMessage(audioErr));
        }
      }

      throw new Error(this.formatMediaErrorMessage(err));
    }
  }

  private formatMediaErrorMessage(err: any): string {
    if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
      return 'Accès au micro ou à la caméra refusé. Veuillez autoriser les permissions dans votre navigateur.';
    }
    if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
      return 'Aucun micro ou caméra détecté sur cet appareil.';
    }
    if (err?.name === 'NotReadableError' || err?.name === 'TrackStartError') {
      return 'Le micro ou la caméra est déjà utilisé par une autre application.';
    }
    return 'Impossible d\'accéder aux périphériques audio/vidéo.';
  }

  // 1.1 Screen Sharing
  public async startScreenShare(): Promise<MediaStream | null> {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
      this.screenStream = screenStream;
      this.isScreenSharing = true;

      const screenVideoTrack = screenStream.getVideoTracks()[0];

      if (this.pc && screenVideoTrack) {
        const sender = this.pc.getSenders().find((s) => s.track && s.track.kind === 'video');
        if (sender) {
          await sender.replaceTrack(screenVideoTrack);
        } else if (this.localStream) {
          this.pc.addTrack(screenVideoTrack, this.localStream);
        }
      }

      screenVideoTrack.onended = () => {
        this.stopScreenShare();
        if (this.onScreenShareEnd) {
          this.onScreenShareEnd();
        }
      };

      return screenStream;
    } catch (err) {
      console.warn('Screen share canceled or failed:', err);
      this.isScreenSharing = false;
      return null;
    }
  }

  public async stopScreenShare(): Promise<void> {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track) => track.stop());
      this.screenStream = null;
    }
    this.isScreenSharing = false;

    if (this.pc && this.cameraTrack && this.cameraTrack.readyState === 'live') {
      const sender = this.pc.getSenders().find((s) => s.track && s.track.kind === 'video');
      if (sender) {
        await sender.replaceTrack(this.cameraTrack);
      }
    }
  }

  // 1.2 Call Recording
  public startRecording(): boolean {
    try {
      const streamToRecord = new MediaStream();

      if (this.localStream) {
        this.localStream.getTracks().forEach((t) => streamToRecord.addTrack(t));
      }
      if (this.remoteStream) {
        this.remoteStream.getTracks().forEach((t) => streamToRecord.addTrack(t));
      }

      this.recordedChunks = [];
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm';

      this.mediaRecorder = new MediaRecorder(streamToRecord, { mimeType: mime });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `appel-raitra-connect-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }, 100);
      };

      this.mediaRecorder.start(1000);
      this.isRecording = true;
      return true;
    } catch (err) {
      console.error('Failed to start recording:', err);
      this.isRecording = false;
      return false;
    }
  }

  public stopRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.isRecording = false;
  }

  // 2. Start outgoing call
  public async startCall(
    callerUid: string,
    callerName: string,
    calleeUid: string,
    calleeName: string,
    type: 'audio' | 'video'
  ): Promise<string> {
    // Vérification stricte anti-contournement du blocage
    const block1Ref = ref(rtdb, `blocks/${callerUid}_${calleeUid}`);
    const block2Ref = ref(rtdb, `blocks/${calleeUid}_${callerUid}`);
    const [b1Snap, b2Snap] = await Promise.all([get(block1Ref), get(block2Ref)]);
    if (b1Snap.exists() || b2Snap.exists()) {
      throw new Error('Impossible d\'initier un appel avec cet utilisateur car une restriction de contact est active.');
    }

    this.cleanup();

    const stream = await this.getMedia(type);
    this.pc = new RTCPeerConnection(getIceServers());
    this.remoteStream = new MediaStream();
    this.pendingRemoteCandidates = [];

    stream.getTracks().forEach((track) => {
      if (this.pc && this.localStream) {
        this.pc.addTrack(track, this.localStream);
      }
    });

    this.pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
      } else {
        if (!this.remoteStream) {
          this.remoteStream = new MediaStream();
        }
        if (!this.remoteStream.getTracks().some((t) => t.id === event.track.id)) {
          this.remoteStream.addTrack(event.track);
        }
      }
      if (this.onRemoteStream && this.remoteStream) {
        this.onRemoteStream(this.remoteStream);
      }
    };

    this.pc.onconnectionstatechange = () => {
      if (this.pc && this.onConnectionStateChange) {
        this.onConnectionStateChange(this.pc.connectionState);
      }
    };

    const callRef = push(ref(rtdb, 'calls'));
    const callId = callRef.key as string;
    this.currentCallId = callId;

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        const candRef = push(ref(rtdb, `calls/${callId}/callerCandidates`));
        set(candRef, event.candidate.toJSON()).catch(console.warn);
      }
    };

    const offer = await this.pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    });
    await this.pc.setLocalDescription(offer);

    const callData = {
      id: callId,
      callerUid,
      callerName,
      calleeUid,
      calleeName,
      type,
      status: 'ringing',
      createdAt: Date.now(),
      offer: {
        type: offer.type,
        sdp: offer.sdp
      }
    };

    await set(callRef, callData);

    await set(ref(rtdb, `userActiveCall/${calleeUid}`), {
      callId,
      callerUid,
      callerName,
      type,
      status: 'ringing',
      createdAt: Date.now()
    });

    const unsubCall = onValue(callRef, async (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      if (data.status && this.onCallStateChange) {
        this.onCallStateChange(data.status);
      }

      if (data.answer && this.pc && !this.pc.currentRemoteDescription) {
        const answerDesc = new RTCSessionDescription(data.answer);
        await this.pc.setRemoteDescription(answerDesc);
        await this.drainPendingCandidates();
      }
    });

    const calleeCandRef = ref(rtdb, `calls/${callId}/calleeCandidates`);
    const unsubCand = onValue(calleeCandRef, async (snapshot) => {
      if (!snapshot.exists()) return;
      const candidates: RTCIceCandidateInit[] = [];
      snapshot.forEach((child) => {
        const candData = child.val();
        if (candData) {
          candidates.push(candData);
        }
      });

      for (const candData of candidates) {
        if (this.pc && this.pc.remoteDescription) {
          try {
            await this.pc.addIceCandidate(new RTCIceCandidate(candData));
          } catch (e) {
            console.warn('[WebRTC] ICE candidate error:', e);
          }
        } else {
          this.pendingRemoteCandidates.push(candData);
        }
      }
    });

    this.unsubCallListener = unsubCall;
    this.unsubCandidatesListener = unsubCand;

    return callId;
  }

  // 3. Answer incoming call
  public async answerCall(callId: string, calleeUid: string, type: 'audio' | 'video'): Promise<void> {
    this.cleanup();
    this.currentCallId = callId;
    this.pendingRemoteCandidates = [];

    const stream = await this.getMedia(type);
    this.pc = new RTCPeerConnection(getIceServers());
    this.remoteStream = new MediaStream();

    stream.getTracks().forEach((track) => {
      if (this.pc && this.localStream) {
        this.pc.addTrack(track, this.localStream);
      }
    });

    this.pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
      } else {
        if (!this.remoteStream) {
          this.remoteStream = new MediaStream();
        }
        if (!this.remoteStream.getTracks().some((t) => t.id === event.track.id)) {
          this.remoteStream.addTrack(event.track);
        }
      }
      if (this.onRemoteStream && this.remoteStream) {
        this.onRemoteStream(this.remoteStream);
      }
    };

    this.pc.onconnectionstatechange = () => {
      if (this.pc && this.onConnectionStateChange) {
        this.onConnectionStateChange(this.pc.connectionState);
      }
    };

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        const candRef = push(ref(rtdb, `calls/${callId}/calleeCandidates`));
        set(candRef, event.candidate.toJSON()).catch(console.warn);
      }
    };

    const callSnap = await get(ref(rtdb, `calls/${callId}`));
    const callData = callSnap.val();
    if (!callData || !callData.offer) {
      throw new Error('Offre d\'appel introuvable ou expirée.');
    }

    await this.pc.setRemoteDescription(new RTCSessionDescription(callData.offer));
    await this.drainPendingCandidates();

    const answer = await this.pc.createAnswer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    });
    await this.pc.setLocalDescription(answer);

    await update(ref(rtdb, `calls/${callId}`), {
      answer: {
        type: answer.type,
        sdp: answer.sdp
      },
      status: 'connected',
      connectedAt: Date.now()
    });

    await set(ref(rtdb, `userActiveCall/${calleeUid}`), null);

    const callerCandRef = ref(rtdb, `calls/${callId}/callerCandidates`);
    const unsubCand = onValue(callerCandRef, async (snapshot) => {
      if (!snapshot.exists()) return;
      const candidates: RTCIceCandidateInit[] = [];
      snapshot.forEach((child) => {
        const candData = child.val();
        if (candData) {
          candidates.push(candData);
        }
      });

      for (const candData of candidates) {
        if (this.pc && this.pc.remoteDescription) {
          try {
            await this.pc.addIceCandidate(new RTCIceCandidate(candData));
          } catch (e) {
            console.warn('[WebRTC] Caller ICE candidate error:', e);
          }
        } else {
          this.pendingRemoteCandidates.push(candData);
        }
      }
    });

    const unsubCall = onValue(ref(rtdb, `calls/${callId}/status`), (snapshot) => {
      const status = snapshot.val();
      if (status && this.onCallStateChange) {
        this.onCallStateChange(status);
      }
    });

    this.unsubCandidatesListener = unsubCand;
    this.unsubCallListener = unsubCall;
  }

  // 4. Reject call
  public async rejectCall(callId: string, calleeUid: string): Promise<void> {
    await update(ref(rtdb, `calls/${callId}`), {
      status: 'rejected',
      endedAt: Date.now()
    }).catch(console.warn);

    await set(ref(rtdb, `userActiveCall/${calleeUid}`), null);
    this.cleanup();
  }

  // 5. Hang up / End call
  public async endCall(callId?: string, otherUid?: string, currentUid?: string): Promise<void> {
    const targetId = callId || this.currentCallId;
    if (targetId) {
      await update(ref(rtdb, `calls/${targetId}`), {
        status: 'ended',
        endedAt: Date.now()
      }).catch(console.warn);
    }

    if (otherUid) {
      await set(ref(rtdb, `userActiveCall/${otherUid}`), null).catch(console.warn);
    }
    if (currentUid) {
      await set(ref(rtdb, `userActiveCall/${currentUid}`), null).catch(console.warn);
    }

    this.cleanup();
  }

  // 6. Toggle Mute / Video
  public toggleAudio(enabled?: boolean): boolean {
    if (!this.localStream) return false;
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = enabled !== undefined ? enabled : !audioTrack.enabled;
      return audioTrack.enabled;
    }
    return false;
  }

  public toggleVideo(enabled?: boolean): boolean {
    if (!this.localStream) return false;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = enabled !== undefined ? enabled : !videoTrack.enabled;
      return videoTrack.enabled;
    }
    return false;
  }

  // Cleanup listeners and streams
  public cleanup() {
    if (this.unsubCallListener) {
      this.unsubCallListener();
      this.unsubCallListener = null;
    }
    if (this.unsubCandidatesListener) {
      this.unsubCandidatesListener();
      this.unsubCandidatesListener = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track) => track.stop());
      this.screenStream = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    this.remoteStream = null;
    this.currentCallId = null;
    this.isScreenSharing = false;
    this.isRecording = false;
  }
}

export const webrtcService = new WebRTCService();
