import { useState, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/Toast';
import { createPost, uploadMedia, validateFile, type UploadResult } from '@/lib/social';
import { X, ImagePlus, Video as VideoIcon, Loader2, Send, Trash2, AlertCircle } from 'lucide-react';

interface CreatePostModalProps {
  onClose: () => void;
  onCreated: () => void;
}

interface PendingFile {
  file: File;
  preview: string;
  type: 'image' | 'video';
  error?: string;
}

export function CreatePostModal({ onClose, onCreated }: CreatePostModalProps) {
  const { profile } = useAuth();
  const { show } = useToast();
  const [caption, setCaption] = useState('');
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const selected = Array.from(e.target.files || []);
    for (const file of selected) {
      const validation = validateFile(file);
      if (!validation.valid) {
        show(validation.error || 'Khalad', 'error');
        continue;
      }
      const isVideo = file.type.startsWith('video/');
      const preview = URL.createObjectURL(file);
      setFiles((prev) => [...prev, { file, preview, type: isVideo ? 'video' : 'image' }]);
    }
    e.target.value = '';
  }, [show]);

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const copy = [...prev];
      URL.revokeObjectURL(copy[index].preview);
      copy.splice(index, 1);
      return copy;
    });
  };

  const handleSubmit = async () => {
    if (!profile || (!caption.trim() && files.length === 0)) return;
    setUploading(true);
    setProgress(0);

    try {
      const uploadedMedia: UploadResult[] = [];
      for (let i = 0; i < files.length; i++) {
        setProgress(Math.round(((i + 1) / (files.length + 1)) * 100));
        const result = await uploadMedia(files[i].file, profile.id);
        if (result) uploadedMedia.push(result);
      }
      setProgress(100);

      await createPost(profile.id, caption.trim(), uploadedMedia);
      show('Post waa la abuuray', 'success');
      files.forEach((f) => URL.revokeObjectURL(f.preview));
      onCreated();
      onClose();
    } catch (err) {
      show((err as Error).message || 'Khalad upload', 'error');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-slate-900">Abuur Post</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Author info */}
          <div className="flex items-center gap-3">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.full_name} className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-sm font-bold text-white">
                {profile?.full_name?.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="font-semibold text-slate-900">{profile?.full_name}</span>
          </div>

          {/* Caption */}
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Maxaad qabaysaa?"
            className="w-full min-h-[80px] resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            maxLength={500}
          />

          {/* Media previews */}
          {files.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {files.map((f, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 group">
                  {f.type === 'image' ? (
                    <img src={f.preview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <video src={f.preview} className="w-full h-full object-cover" muted />
                  )}
                  <button
                    onClick={() => removeFile(i)}
                    className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Upload buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <ImagePlus className="w-4 h-4" />
              Sawir
            </button>
            <button
              onClick={() => videoInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <VideoIcon className="w-4 h-4" />
              Video
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={(e) => handleFileSelect(e, 'image')}
            />
            <input
              ref={videoInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              multiple
              className="hidden"
              onChange={(e) => handleFileSelect(e, 'video')}
            />
          </div>

          {/* Progress bar */}
          {uploading && (
            <div className="space-y-1">
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 text-center">{progress}% - La soo kicinayaa...</p>
            </div>
          )}

          {/* Error display */}
          {files.some((f) => f.error) && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="w-4 h-4" />
              {files.find((f) => f.error)?.error}
            </div>
          )}
        </div>

        <div className="flex gap-3 p-4 border-t border-slate-200 sticky bottom-0 bg-white">
          <button
            onClick={handleSubmit}
            disabled={uploading || (!caption.trim() && files.length === 0)}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white font-semibold py-2.5 rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                La soo kicinayaa...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Daabac
              </>
            )}
          </button>
          <button
            onClick={onClose}
            disabled={uploading}
            className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Jooji
          </button>
        </div>
      </div>
    </div>
  );
}
