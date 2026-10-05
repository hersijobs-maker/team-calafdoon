import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { fetchStoryGroups, uploadStory, validateFile } from '@/lib/social';
import { useToast } from '@/components/Toast';
import { StoryViewer } from '@/components/StoryViewer';
import type { StoryGroup } from '@/lib/types';
import { Plus, ChevronLeft, ChevronRight, Camera, Loader2 } from 'lucide-react';
import { ProtectedImage, ProtectedVideo } from '@/components/ProtectedMedia';

export function PublicStoriesCarousel() {
  const { profile, accessLevel } = useAuth();
  const { show } = useToast();
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingStory, setViewingStory] = useState<{ group: StoryGroup; index: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const canInteract = accessLevel === 'approved' || accessLevel === 'admin';

  const loadStories = useCallback(async () => {
    const data = await fetchStoryGroups();
    setGroups(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadStories();
  }, [loadStories]);

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateScrollButtons();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollButtons);
    window.addEventListener('resize', updateScrollButtons);
    return () => {
      el.removeEventListener('scroll', updateScrollButtons);
      window.removeEventListener('resize', updateScrollButtons);
    };
  }, [updateScrollButtons, groups, loading]);

  const scrollBy = (dir: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 300, behavior: 'smooth' });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = (e.target.files || [])[0];
    e.target.value = '';
    if (!file || !profile) return;

    const validation = validateFile(file);
    if (!validation.valid) {
      show(validation.error || 'Khalad', 'error');
      return;
    }

    setUploading(true);
    try {
      await uploadStory(file, profile.id);
      show('Story waa la soo kicmay', 'success');
      loadStories();
      setShowUploadModal(false);
    } catch (err) {
      show((err as Error).message || 'Khalad story upload', 'error');
    } finally {
      setUploading(false);
    }
  };

  const myGroup = groups.find((g) => g.user_id === profile?.id);
  const otherGroups = groups.filter((g) => g.user_id !== profile?.id);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 pb-1">
        <div className="flex gap-2.5 overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="flex-shrink-0 w-20 h-32 sm:w-24 sm:h-36 rounded-xl bg-slate-200/70 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  const hasContent = groups.length > 0;

  return (
    <>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 pb-1">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Camera className="w-5 h-5 text-emerald-600" />
            Storyo Bulshada
          </h2>
          {!canInteract && hasContent && (
            <Link
              to="/login"
              className="text-xs font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              Soo gal si aad uga qayb qaadato
            </Link>
          )}
        </div>

        {!hasContent && !canInteract ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
            <Camera className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Wali storyo ma jiraan.</p>
            <p className="text-xs text-slate-400 mt-1">
              Xubnaha ansaxay ayaa storyo soo kici doona.
            </p>
          </div>
        ) : (
          <div className="relative group">
            {/* Scroll left button */}
            {canScrollLeft && (
              <button
                onClick={() => scrollBy(-1)}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white shadow-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors opacity-0 group-hover:opacity-100"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            {/* Scroll right button */}
            {canScrollRight && (
              <button
                onClick={() => scrollBy(1)}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white shadow-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors opacity-0 group-hover:opacity-100"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}

            <div
              ref={scrollRef}
              className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-1"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {/* Create story card — only for approved users */}
              {canInteract && (
                <button
                  onClick={() => (myGroup ? setViewingStory({ group: myGroup, index: 0 }) : setShowUploadModal(true))}
                  className="flex-shrink-0 w-20 h-32 sm:w-24 sm:h-36 rounded-xl overflow-hidden relative bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md hover:shadow-lg transition-all hover:scale-[1.02] active:scale-95"
                >
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-2">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={profile.full_name}
                        className="w-10 h-10 rounded-full object-cover border-2 border-white/80 mb-1.5"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-base font-bold text-white mb-1.5">
                        {profile?.full_name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center mb-1 shadow">
                      <Plus className="w-4 h-4 text-emerald-600" />
                    </div>
                    <span className="text-white text-[11px] font-semibold text-center leading-tight">
                      {myGroup ? 'Story-gaaga' : 'Ku Dar Story'}
                    </span>
                  </div>
                </button>
              )}

              {/* Story cards */}
              {otherGroups.map((group) => {
                const firstStory = group.stories[0];
                const mediaUrl = firstStory?.thumbnail_url || firstStory?.media_url;
                const isVideo = firstStory?.media_type === 'video';

                return (
                  <button
                    key={group.user_id}
                    onClick={() => {
                      const firstUnviewed = group.stories.findIndex((s) => !s.viewed_by_me);
                      setViewingStory({
                        group,
                        index: firstUnviewed >= 0 ? firstUnviewed : 0,
                      });
                    }}
                    className="flex-shrink-0 w-20 h-32 sm:w-24 sm:h-36 rounded-xl overflow-hidden relative shadow-md hover:shadow-lg transition-all hover:scale-[1.02] active:scale-95 group/card"
                  >
                    {/* Background media */}
                    {mediaUrl ? (
                      isVideo && firstStory?.media_type === 'video' ? (
                        <ProtectedVideo
                          src={firstStory.media_url}
                          muted
                          playsInline
                          controls={false}
                          className="absolute inset-0 w-full h-full object-cover media-protected"
                        />
                      ) : (
                        <ProtectedImage
                          src={mediaUrl}
                          alt={group.full_name}
                          className="absolute inset-0 w-full h-full object-cover media-protected"
                        />
                      )
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-slate-300 to-slate-400" />
                    )}

                    {/* Gradient overlay for readability */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />

                    {/* Unviewed indicator ring */}
                    {group.has_unviewed && (
                      <div className="absolute top-2 left-2 w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow" />
                    )}

                    {/* Avatar + name */}
                    <div className="absolute bottom-0 left-0 right-0 p-2 flex flex-col items-start gap-1">
                      {group.avatar_url ? (
                        <img
                          src={group.avatar_url}
                          alt={group.full_name}
                          className="w-7 h-7 rounded-full object-cover border-2 border-white shadow"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-slate-300 border-2 border-white shadow flex items-center justify-center text-[10px] font-bold text-slate-700">
                          {group.full_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-white text-[11px] font-semibold leading-tight line-clamp-1 drop-shadow-md">
                        {group.full_name.split(' ')[0]}
                      </span>
                    </div>
                  </button>
                );
              })}

              {/* Empty state for approved users with no stories */}
              {!hasContent && canInteract && (
                <div className="flex-shrink-0 w-20 h-32 sm:w-24 sm:h-36 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center p-2 text-center">
                  <Camera className="w-5 h-5 text-slate-300 mb-1" />
                  <p className="text-[11px] text-slate-400 leading-tight">
                    Wali storyo ma jiraan. Ugu horaad ku dar!
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Upload modal */}
      {showUploadModal && (
        <div
          className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4"
          onClick={() => setShowUploadModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Ku Dar Story</h2>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <span className="text-slate-600 text-lg leading-none">x</span>
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              Story-ga wuu dhammaan doonaa 24 saacadood kadib.
            </p>
            {uploading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex flex-col items-center gap-2 p-8 rounded-xl border-2 border-slate-200 hover:border-emerald-400 transition-colors"
              >
                <Camera className="w-10 h-10 text-emerald-500" />
                <span className="text-sm font-medium text-slate-700">Sawir ama Video Kaliya</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
              className="hidden"
              onChange={handleUpload}
            />
          </div>
        </div>
      )}

      {/* Story viewer */}
      {viewingStory && (
        <StoryViewer
          group={viewingStory.group}
          startIndex={viewingStory.index}
          onClose={() => setViewingStory(null)}
          onRefresh={loadStories}
        />
      )}
    </>
  );
}
