import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  recordStoryView, fetchStoryViewers, deleteStory,
} from '@/lib/social';
import type { StoryGroup, StoryViewerEntry } from '@/lib/types';
import { ProtectedImage, ProtectedVideo, SecureScreen } from '@/components/ProtectedMedia';
import {
  X, ChevronLeft, ChevronRight, Eye, Trash2, Loader2, Users,
} from 'lucide-react';

interface StoryViewerProps {
  group: StoryGroup;
  startIndex: number;
  onClose: () => void;
  onRefresh: () => void;
}

const STORY_DURATION_MS = 5000;

export function StoryViewer({ group, startIndex, onClose, onRefresh }: StoryViewerProps) {
  const { profile, accessLevel } = useAuth();
  const [storyIndex, setStoryIndex] = useState(startIndex);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers] = useState<StoryViewerEntry[]>([]);
  const [loadingViewers, setLoadingViewers] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);

  const isOwner = profile?.id === group.user_id;
  const canInteract = accessLevel === 'approved' || accessLevel === 'admin';
  const currentStory = group.stories[storyIndex];

  const goNext = useCallback(() => {
    if (storyIndex < group.stories.length - 1) {
      setStoryIndex((i) => i + 1);
      setProgress(0);
      elapsedRef.current = 0;
    } else {
      onClose();
    }
  }, [storyIndex, group.stories.length, onClose]);

  const goPrev = useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex((i) => i - 1);
      setProgress(0);
      elapsedRef.current = 0;
    }
  }, [storyIndex]);

  // Record view and load viewers
  useEffect(() => {
    if (!currentStory) return;
    if (!isOwner && canInteract) {
      recordStoryView(currentStory.id);
    }
  }, [currentStory, isOwner, canInteract]);

  useEffect(() => {
    if (!currentStory || !isOwner) return;
    setLoadingViewers(true);
    fetchStoryViewers(currentStory.id).then((data) => {
      setViewers(data);
      setLoadingViewers(false);
    });
  }, [currentStory, isOwner]);

  // Progress timer
  useEffect(() => {
    if (!currentStory || paused) return;
    startRef.current = Date.now() - elapsedRef.current;
    const duration = currentStory.media_type === 'image' ? STORY_DURATION_MS : STORY_DURATION_MS * 3;

    progressTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const pct = Math.min(100, (elapsed / duration) * 100);
      setProgress(pct);
      if (pct >= 100) {
        if (progressTimerRef.current) clearInterval(progressTimerRef.current);
        goNext();
      }
    }, 50);

    return () => {
      if (progressTimerRef.current) {
        elapsedRef.current = Date.now() - startRef.current;
        clearInterval(progressTimerRef.current);
      }
    };
  }, [currentStory, paused, storyIndex, goNext]);

  // Reset elapsed on story change
  useEffect(() => {
    elapsedRef.current = 0;
    setProgress(0);
  }, [storyIndex]);

  const handleDelete = async () => {
    if (!currentStory) return;
    try {
      await deleteStory(currentStory.id);
      onRefresh();
      onClose();
    } catch (err) {
      console.error('Error deleting story:', err);
    }
  };

  if (!currentStory) return null;

  return (
    <SecureScreen>
    <div className="fixed inset-0 z-[80] bg-black flex flex-col">
      {/* Progress bars */}
      <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-3 pt-4">
        {group.stories.map((_, i) => (
          <div key={i} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all"
              style={{
                width: i < storyIndex ? '100%' : i === storyIndex ? `${progress}%` : '0%',
              }}
            />
          </div>
        ))}
      </div>

      {/* Top bar: user info + actions */}
      <div className="absolute top-6 left-0 right-0 z-20 flex items-center justify-between px-4 pt-2">
        <div className="flex items-center gap-2">
          {group.avatar_url ? (
            <img src={group.avatar_url} alt={group.full_name} className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-sm font-bold text-white">
              {group.full_name.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-white text-sm font-semibold">{group.full_name}</span>
          <span className="text-white/60 text-xs">
            {new Date(currentStory.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isOwner && (
            <button
              onClick={() => setShowViewers(true)}
              className="flex items-center gap-1 text-white/80 hover:text-white text-sm bg-white/10 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Eye className="w-4 h-4" />
              {viewers.length > 0 ? viewers.length : ''}
            </button>
          )}
          {isOwner && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-2 rounded-lg bg-white/10 text-white/80 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button onClick={onClose} className="p-2 rounded-lg bg-white/10 text-white/80 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Media display */}
      <div
        className="flex-1 flex items-center justify-center relative"
        onMouseDown={() => setPaused(true)}
        onMouseUp={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
      >
        {currentStory.media_type === 'image' ? (
          <ProtectedImage
            src={currentStory.media_url}
            alt="Story"
            className="max-w-full max-h-full object-contain media-protected"
          />
        ) : (
          <ProtectedVideo
            src={currentStory.media_url}
            autoPlay
            playsInline
            controls={false}
            className="max-w-full max-h-full object-contain media-protected"
            onEnded={goNext}
          />
        )}

        {/* Navigation arrows */}
        {storyIndex > 0 && (
          <button
            onClick={goPrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
        )}
        {storyIndex < group.stories.length - 1 && (
          <button
            onClick={goNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
        )}

        {/* Tap zones for mobile */}
        <button onClick={goPrev} className="absolute left-0 top-0 bottom-0 w-1/3" style={{ background: 'transparent' }} />
        <button onClick={goNext} className="absolute right-0 top-0 bottom-0 w-1/3" style={{ background: 'transparent' }} />
      </div>

      {/* Viewers bottom sheet */}
      {showViewers && (
        <div
          className="absolute inset-0 z-30 bg-black/50 flex items-end"
          onClick={() => setShowViewers(false)}
        >
          <div
            className="bg-white w-full rounded-t-2xl max-h-[70vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-slate-400" />
                Daawadayaasha ({viewers.length})
              </h3>
              <button
                onClick={() => setShowViewers(false)}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>
            <div className="p-2">
              {loadingViewers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                </div>
              ) : viewers.length === 0 ? (
                <p className="text-center text-slate-500 text-sm py-8">
                  Wali daawadayaal ma jiraan
                </p>
              ) : (
                viewers.map((v) => (
                  <div key={v.viewer_id} className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl transition-colors">
                    {v.avatar_url ? (
                      <img src={v.avatar_url} alt={v.full_name} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-600">
                        {v.full_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 text-sm truncate">{v.full_name}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(v.viewed_at).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div
          className="absolute inset-0 z-40 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setConfirmDelete(false)}
        >
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-slate-900 mb-2">Tirtir Story?</h3>
            <p className="text-sm text-slate-600 mb-4">
              Story-gan waa la tirtiri doonaa ee qofna ma arki doono.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                className="flex-1 bg-red-600 text-white font-semibold py-2.5 rounded-lg hover:bg-red-700 transition-colors"
              >
                Haa, Tirtir
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
              >
                Jooji
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </SecureScreen>
  );
}
