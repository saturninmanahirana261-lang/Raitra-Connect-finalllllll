import React, { useState, useEffect } from 'react';
import {
  FolderOpen,
  FileText,
  Download,
  Upload,
  Trash2,
  FileSpreadsheet,
  FileCode,
  Image as ImageIcon,
  Check,
  Search,
  Filter,
  Eye,
  File
} from 'lucide-react';
import { rtdb, ref, push, set, onValue, remove } from '../firebase';
import type { UserProfile, SharedFileItem } from '../types';
import { ImageLightboxModal } from './ImageLightboxModal';
import { uploadToCloudinary } from '../utils/cloudinaryService';

interface FilesViewProps {
  currentUser: UserProfile;
}

export const FilesView: React.FC<FilesViewProps> = ({ currentUser }) => {
  const [files, setFiles] = useState<SharedFileItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'pdf' | 'sheet' | 'image' | 'code'>('all');
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Sync files with Firebase RTDB
  useEffect(() => {
    const filesRef = ref(rtdb, 'shared_files');
    const unsub = onValue(filesRef, (snapshot) => {
      if (!snapshot.exists()) {
        setFiles([]);
        return;
      }

      const list: SharedFileItem[] = [];
      snapshot.forEach((child) => {
        const val = child.val();
        list.push({
          id: child.key as string,
          name: val.name || 'Document',
          size: val.size || '1.0 Mo',
          type: val.type || 'pdf',
          url: val.url,
          authorName: val.authorName || 'Collaborateur',
          authorUid: val.authorUid || '',
          date: val.date || new Date().toLocaleDateString('fr-FR'),
          timestamp: val.timestamp || Date.now()
        });
      });
      list.sort((a, b) => b.timestamp - a.timestamp);
      setFiles(list);
    });

    return () => unsub();
  }, []);

  const handleProcessFile = async (file: File) => {
    let type: 'pdf' | 'sheet' | 'image' | 'code' | 'other' = 'pdf';
    const name = file.name.toLowerCase();

    if (name.endsWith('.xlsx') || name.endsWith('.csv') || name.endsWith('.xls')) {
      type = 'sheet';
    } else if (file.type.startsWith('image/')) {
      type = 'image';
    } else if (name.endsWith('.json') || name.endsWith('.ts') || name.endsWith('.js') || name.endsWith('.html')) {
      type = 'code';
    }

    const sizeStr = file.size > 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} Mo`
      : `${Math.round(file.size / 1024)} Ko`;

    try {
      const uploadResult = await uploadToCloudinary(file, {
        folder: 'raitra-connect/shared_files',
        userId: currentUser.uid,
        fileName: file.name
      });

      const newFileRef = push(ref(rtdb, 'shared_files'));
      const payload: SharedFileItem = {
        id: newFileRef.key as string,
        name: file.name,
        size: sizeStr,
        type,
        url: uploadResult.secureUrl,
        authorName: currentUser.displayName || 'Moi',
        authorUid: currentUser.uid,
        date: new Date().toLocaleDateString('fr-FR'),
        timestamp: Date.now()
      };

      await set(newFileRef, payload);
    } catch (uploadErr) {
      console.warn('Erreur upload Cloudinary, fallback local...', uploadErr);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const url = reader.result as string;
        const newFileRef = push(ref(rtdb, 'shared_files'));
        const payload: SharedFileItem = {
          id: newFileRef.key as string,
          name: file.name,
          size: sizeStr,
          type,
          url,
          authorName: currentUser.displayName || 'Moi',
          authorUid: currentUser.uid,
          date: new Date().toLocaleDateString('fr-FR'),
          timestamp: Date.now()
        };
        await set(newFileRef, payload);
      };
      reader.readAsDataURL(file);
    }
  };


  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    handleProcessFile(e.target.files[0]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleDeleteFile = async (id: string) => {
    await remove(ref(rtdb, `shared_files/${id}`)).catch(console.warn);
  };

  const handleDownload = (file: SharedFileItem) => {
    if (file.url) {
      const link = document.createElement('a');
      link.href = file.url;
      link.download = file.name;
      link.click();
    }
    setDownloadSuccess(file.name);
    setTimeout(() => setDownloadSuccess(null), 2500);
  };

  const filteredFiles = files.filter((f) => {
    const matchSearch =
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.authorName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchType = filterType === 'all' || f.type === filterType;
    return matchSearch && matchType;
  });

  return (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-[#6264a7]" /> Fichiers & Documents partagés
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Espace cloud d'échange documentaire, aperçu haute résolution et téléchargement instantané.
          </p>
        </div>

        <label className="px-4 py-2.5 bg-[#6264a7] hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer shadow-md shadow-indigo-500/20 active:scale-95">
          <Upload className="w-4 h-4" />
          <span>Téléverser un document</span>
          <input type="file" onChange={handleFileInput} className="hidden" />
        </label>
      </div>

      {downloadSuccess && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-900 rounded-2xl text-xs font-medium flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>Fichier <strong>{downloadSuccess}</strong> téléchargé avec succès.</span>
        </div>
      )}

      {/* Drag and drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-3xl p-6 text-center transition ${
          isDragging
            ? 'border-[#6264a7] bg-indigo-50/50 dark:bg-indigo-950/30'
            : 'border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50'
        }`}
      >
        <Upload className="w-8 h-8 mx-auto text-[#6264a7] mb-2 opacity-80" />
        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
          Glissez-déposez vos fichiers ici pour les partager avec l'équipe
        </p>
        <p className="text-[11px] text-slate-400 mt-1">
          PDF, Tableurs Excel, Images, Captures d'écran et Fichiers de code pris en charge.
        </p>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par nom ou auteur..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6264a7]"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1">
          {[
            { id: 'all', label: 'Tous' },
            { id: 'pdf', label: 'PDF' },
            { id: 'sheet', label: 'Tableurs' },
            { id: 'image', label: 'Images' },
            { id: 'code', label: 'Code' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterType(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex-shrink-0 ${
                filterType === tab.id
                  ? 'bg-[#6264a7] text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Files Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase text-[10px] font-bold">
            <tr>
              <th className="p-4">Nom du document</th>
              <th className="p-4">Partagé par</th>
              <th className="p-4">Taille</th>
              <th className="p-4">Date</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredFiles.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-400">
                  Aucun fichier ne correspond à votre recherche.
                </td>
              </tr>
            )}

            {filteredFiles.map((file) => (
              <tr key={file.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                <td className="p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-[#6264a7] dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                    {file.type === 'sheet' ? (
                      <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                    ) : file.type === 'code' ? (
                      <FileCode className="w-5 h-5 text-indigo-600" />
                    ) : file.type === 'image' ? (
                      <ImageIcon className="w-5 h-5 text-purple-600" />
                    ) : (
                      <FileText className="w-5 h-5 text-[#6264a7]" />
                    )}
                  </div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-xs">{file.name}</span>
                </td>
                <td className="p-4 text-slate-600 dark:text-slate-300 font-medium">{file.authorName}</td>
                <td className="p-4 text-slate-500 font-mono text-[11px]">{file.size}</td>
                <td className="p-4 text-slate-500 text-[11px]">{file.date}</td>
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {file.type === 'image' && file.url && (
                      <button
                        type="button"
                        onClick={() => setLightboxImage({ url: file.url!, name: file.name })}
                        className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 hover:text-[#6264a7] text-slate-600 dark:text-slate-300 transition cursor-pointer"
                        title="Aperçu"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDownload(file)}
                      className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer"
                      title="Télécharger"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    {file.authorUid === currentUser.uid && (
                      <button
                        type="button"
                        onClick={() => handleDeleteFile(file.id)}
                        className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Lightbox Modal */}
      <ImageLightboxModal
        isOpen={!!lightboxImage}
        onClose={() => setLightboxImage(null)}
        imageUrl={lightboxImage?.url || ''}
        imageName={lightboxImage?.name}
      />
    </div>
  );
};
