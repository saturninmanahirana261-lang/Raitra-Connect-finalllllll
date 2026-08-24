import { uploadToCloudinary } from './cloudinaryService';

export interface SupportedAudioFormat {
  mimeType: string;
  extension: string;
}

/**
 * Détecte intelligemment le meilleur MIME type audio supporté par l'environnement actuel
 * (Chrome desktop, Android WebView, Capacitor, Safari, Firefox).
 */
export function getSupportedAudioMimeType(): SupportedAudioFormat {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return { mimeType: 'audio/webm', extension: '.webm' };
  }

  const candidateFormats: SupportedAudioFormat[] = [
    { mimeType: 'audio/webm;codecs=opus', extension: '.webm' },
    { mimeType: 'audio/webm', extension: '.webm' },
    { mimeType: 'audio/mp4;codecs=aac', extension: '.mp4' },
    { mimeType: 'audio/mp4', extension: '.mp4' },
    { mimeType: 'audio/aac', extension: '.aac' },
    { mimeType: 'audio/ogg;codecs=opus', extension: '.ogg' },
    { mimeType: 'audio/ogg', extension: '.ogg' },
    { mimeType: 'audio/wav', extension: '.wav' }
  ];

  for (const candidate of candidateFormats) {
    try {
      if (MediaRecorder.isTypeSupported(candidate.mimeType)) {
        console.log(`[VOICE] Selected supported audio format: ${candidate.mimeType} (${candidate.extension})`);
        return candidate;
      }
    } catch {
      // Ignorer l'exception et passer au candidat suivant
    }
  }

  console.log('[VOICE] Using default browser audio format fallback');
  return { mimeType: '', extension: '.webm' };
}

/**
 * Récupère le flux audio avec gestion des contraintes et diagnostics précis d'erreurs.
 */
export async function getMicrophoneStream(): Promise<MediaStream> {
  console.log('[VOICE] microphone permission check requested');
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('L\'API d\'enregistrement audio (getUserMedia) n\'est pas supportée sur ce navigateur ou cet appareil.');
  }

  const advancedConstraints: MediaStreamConstraints = {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    },
    video: false
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(advancedConstraints);
    console.log('[VOICE] microphone permission granted (advanced constraints)');
    return stream;
  } catch (err: any) {
    console.warn('[VOICE] getUserMedia avec contraintes avancées a échoué, tentative en mode basique...', err);
    try {
      const fallbackStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      console.log('[VOICE] microphone permission granted (basic constraints)');
      return fallbackStream;
    } catch (fallbackErr: any) {
      console.error('[VOICE] microphone permission denied or failed:', fallbackErr);
      throw new Error(formatMicrophoneErrorMessage(fallbackErr));
    }
  }
}

/**
 * Formate un message d'erreur clair et compréhensible par l'utilisateur.
 */
export function formatMicrophoneErrorMessage(err: any): string {
  const name = err?.name || '';
  const message = err?.message || String(err || '');

  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || message.includes('Permission denied')) {
    return 'Accès au microphone refusé. Veuillez autoriser les permissions microphone dans les paramètres de votre navigateur ou de votre application Android.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || message.includes('not found')) {
    return 'Aucun microphone détecté sur cet appareil. Veuillez brancher ou activer un microphone.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError' || message.includes('in use')) {
    return 'Le microphone est déjà utilisé par une autre application ou est inaccessible. Veuillez fermer les autres applications audio.';
  }
  if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
    return 'Les contraintes audio demandées ne sont pas supportées par votre matériel audio.';
  }
  if (name === 'SecurityError') {
    return 'L\'accès au microphone est bloqué pour des raisons de sécurité (HTTPS requis).';
  }

  return `Impossible d'accéder au microphone : ${message || 'Erreur inconnue'}`;
}

/**
 * Convertit un Blob audio en base64 Data URL (fallback de secours offline ou en cas de quota Storage).
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Échec de la conversion du Blob audio en Data URL.'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('Erreur de lecture du Blob.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Uploade une note vocale dans Cloudinary avec structure de dossier dédiée et progression.
 * Retourne l'URL publique HTTPS du fichier audio ou un DataURL de secours immédiat en cas d'impossibilité réseau.
 */
export async function uploadVoiceNoteToStorage(
  audioBlob: Blob,
  conversationId: string,
  userId: string,
  _durationSec: number,
  mimeType: string,
  onProgress?: (progressPercent: number) => void
): Promise<{ url: string; storagePath: string; isFallback: boolean }> {
  console.log(`[VOICE] Cloudinary upload started - Blob size: ${audioBlob.size} bytes, MIME: ${mimeType || audioBlob.type}`);
  
  if (!audioBlob || audioBlob.size === 0) {
    throw new Error('Le microphone n\'a produit aucun enregistrement (Blob vide).');
  }

  const { extension } = getSupportedAudioMimeType();
  const safeExt = extension || (mimeType.includes('mp4') ? '.mp4' : mimeType.includes('ogg') ? '.ogg' : '.webm');
  const timestamp = Date.now();
  const safeFileName = `${userId}_voice_${timestamp}${safeExt}`;

  try {
    const uploadResult = await uploadToCloudinary(audioBlob, {
      folder: 'raitra-connect/audio_notes',
      fileName: safeFileName,
      userId,
      conversationId,
      onProgress: (pct) => {
        if (onProgress) onProgress(pct);
      }
    });

    console.log('[VOICE] Cloudinary upload completed successfully:', uploadResult.secureUrl);
    return {
      url: uploadResult.secureUrl,
      storagePath: uploadResult.publicId,
      isFallback: Boolean(uploadResult.isFallback)
    };
  } catch (cloudinaryErr: any) {
    console.warn('[VOICE] Erreur Cloudinary, basculement immédiat vers DataURL de secours:', cloudinaryErr?.message || cloudinaryErr);
    if (onProgress) onProgress(100);
    const dataUrl = await blobToDataUrl(audioBlob);
    return { url: dataUrl, storagePath: '', isFallback: true };
  }
}

/**
 * Uploade un fichier joint ou document dans Cloudinary avec progression.
 */
export async function uploadAttachmentToStorage(
  file: File,
  conversationId: string,
  userId: string,
  onProgress?: (progressPercent: number) => void
): Promise<string> {
  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const safeFileName = `${userId}_${timestamp}_${sanitizedName}`;

  try {
    const uploadResult = await uploadToCloudinary(file, {
      folder: 'raitra-connect/chat_attachments',
      fileName: safeFileName,
      userId,
      conversationId,
      onProgress: (pct) => {
        if (onProgress) onProgress(pct);
      }
    });

    return uploadResult.secureUrl;
  } catch (err) {
    console.error('Erreur Cloudinary uploadAttachment:', err);
    throw err;
  }
}

