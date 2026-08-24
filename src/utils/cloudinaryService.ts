/**
 * Service centralisé pour la gestion des uploads multimédias vers Cloudinary.
 * Prend en charge les images, vidéos, fichiers audio (mémos vocaux) et documents (PDF, zip, etc.).
 * 
 * Les clés d'environnement utilisées côté client sont :
 * - VITE_CLOUDINARY_CLOUD_NAME
 * - VITE_CLOUDINARY_UPLOAD_PRESET
 * 
 * Sécurité : Le Cloudinary API Secret n'est JAMAIS présent côté client.
 */

export type CloudinaryFolder =
  | 'raitra-connect/avatars'
  | 'raitra-connect/audio_notes'
  | 'raitra-connect/chat_attachments'
  | 'raitra-connect/shared_files'
  | 'raitra-connect/social_posts'
  | 'raitra-connect/social_stories'
  | 'raitra-connect/social_pages';

export interface CloudinaryUploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  resourceType: 'image' | 'video' | 'raw' | 'auto';
  width?: number;
  height?: number;
  duration?: number;
  format?: string;
  createdAt: number;
  isFallback?: boolean;
}

export interface CloudinaryUploadOptions {
  folder: CloudinaryFolder;
  fileName?: string;
  tags?: string[];
  onProgress?: (percent: number) => void;
  userId?: string;
  conversationId?: string;
}

// Récupération sécurisée des configurations Cloudinary côté frontend
export const getCloudinaryConfig = () => {
  const cloudName = (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string) || '';
  const uploadPreset = (import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string) || '';
  return {
    cloudName: cloudName.trim(),
    uploadPreset: uploadPreset.trim(),
    isConfigured: Boolean(cloudName.trim() && uploadPreset.trim()),
  };
};

/**
 * Détermine le type de ressource Cloudinary approprié selon le type MIME du fichier.
 */
export const getResourceType = (mimeType: string, fileExtension?: string): 'image' | 'video' | 'raw' | 'auto' => {
  const type = mimeType.toLowerCase();
  const ext = (fileExtension || '').toLowerCase().replace('.', '');

  if (type.startsWith('image/')) {
    return 'image';
  }
  if (type.startsWith('video/') || type.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'webm'].includes(ext)) {
    // Cloudinary traite l'audio dans la catégorie 'video' pour la plupart des transformations et du streaming
    return 'video';
  }
  return 'raw';
};

/**
 * Convertit un Blob ou File en DataURL locale (fallback en cas d'erreur réseau / hors-ligne).
 */
export const fileToDataUrl = (file: Blob | File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};

/**
 * Upload universel vers Cloudinary avec gestion de progression et fallback.
 */
export const uploadToCloudinary = async (
  file: File | Blob,
  options: CloudinaryUploadOptions
): Promise<CloudinaryUploadResult> => {
  const { cloudName, uploadPreset, isConfigured } = getCloudinaryConfig();
  
  const originalFileName = (file as File).name || options.fileName || `file_${Date.now()}`;
  const mimeType = file.type || 'application/octet-stream';
  const fileSize = file.size || 0;
  const fileExt = originalFileName.includes('.') ? originalFileName.split('.').pop() : '';
  const resourceType = getResourceType(mimeType, fileExt);

  // Si Cloudinary n'est pas encore configuré dans les variables d'environnement, on utilise un fallback DataURL propre
  if (!isConfigured) {
    console.warn(
      '[Cloudinary] VITE_CLOUDINARY_CLOUD_NAME ou VITE_CLOUDINARY_UPLOAD_PRESET non configuré dans l\'environnement. Basculement sécurisé vers le stockage local/DataURL.'
    );
    const dataUrl = await fileToDataUrl(file);
    return {
      url: dataUrl,
      secureUrl: dataUrl,
      publicId: `fallback_${Date.now()}`,
      fileName: originalFileName,
      fileType: mimeType,
      fileSize,
      resourceType,
      createdAt: Date.now(),
      isFallback: true,
    };
  }

  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

  // Normalisation stricte du nom de dossier cible
  const targetFolder: CloudinaryFolder = options.folder;

  // Déterminer le type d'upload pour les logs
  const uploadType = targetFolder.replace('raitra-connect/', '');

  // Log structuré obligatoire avant upload
  console.log(`[Cloudinary] Upload`);
  console.log(`type: ${uploadType}`);
  console.log(`folder: ${targetFolder}`);
  console.log(`asset_folder: ${targetFolder}`);

  // Génération d'un nom de fichier propre sans extension dans le public_id
  const baseName = originalFileName.includes('.') 
    ? originalFileName.substring(0, originalFileName.lastIndexOf('.'))
    : originalFileName;
  const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const uniquePublicId = `${targetFolder}/${sanitizedBaseName}_${Date.now()}`;

  const formData = new FormData();
  formData.append('file', file, originalFileName);
  formData.append('upload_preset', uploadPreset);
  formData.append('folder', targetFolder);
  formData.append('asset_folder', targetFolder);
  formData.append('public_id', uniquePublicId);

  if (options.tags && options.tags.length > 0) {
    formData.append('tags', options.tags.join(','));
  }

  // Métadonnées contextuelles utiles pour Cloudinary
  const contextData: string[] = [];
  if (options.userId) contextData.push(`user_id=${options.userId}`);
  if (options.conversationId) contextData.push(`conversation_id=${options.conversationId}`);
  if (contextData.length > 0) {
    formData.append('context', contextData.join('|'));
  }

  return new Promise<CloudinaryUploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint, true);

    if (options.onProgress && xhr.upload) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          options.onProgress?.(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          console.log(`[Cloudinary] Succès téléversement: public_id="${response.public_id}" | asset_folder="${response.asset_folder || targetFolder}" | URL="${response.secure_url}"`);
          resolve({
            url: response.url || response.secure_url,
            secureUrl: response.secure_url || response.url,
            publicId: response.public_id,
            fileName: originalFileName,
            fileType: mimeType,
            fileSize: response.bytes || fileSize,
            resourceType: response.resource_type || resourceType,
            width: response.width,
            height: response.height,
            duration: response.duration,
            format: response.format,
            createdAt: Date.now(),
            isFallback: false,
          });
        } catch (parseErr) {
          reject(new Error(`Réponse Cloudinary invalide: ${xhr.responseText}`));
        }
      } else {
        let errorMessage = `Erreur upload Cloudinary (${xhr.status})`;
        try {
          const errResp = JSON.parse(xhr.responseText);
          if (errResp.error && errResp.error.message) {
            errorMessage = `Erreur Cloudinary: ${errResp.error.message}`;
          }
        } catch {
          // ignore
        }
        reject(new Error(errorMessage));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Erreur réseau lors de la communication avec Cloudinary'));
    };

    xhr.send(formData);
  });
};

/**
 * Optimise une URL d'image Cloudinary (redimensionnement automatique, format webp auto, compression qualité).
 */
export const getOptimizedImageUrl = (
  url: string,
  options?: { width?: number; height?: number; crop?: 'fill' | 'scale' | 'thumb'; quality?: 'auto' | number }
): string => {
  if (!url || !url.includes('cloudinary.com')) return url;
  
  const parts = url.split('/upload/');
  if (parts.length !== 2) return url;

  const transformations: string[] = ['f_auto', 'q_auto'];
  if (options?.width) transformations.push(`w_${options.width}`);
  if (options?.height) transformations.push(`h_${options.height}`);
  if (options?.crop) transformations.push(`c_${options.crop}`);

  return `${parts[0]}/upload/${transformations.join(',')}/${parts[1]}`;
};
