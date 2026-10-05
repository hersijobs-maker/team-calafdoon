import { useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/Toast';
import { uploadStory, validateFile } from '@/lib/social';
import type { StoryGroup } from '@/lib/types';
import { Plus, Loader2, X, Video as VideoIcon, Camera } from 'lucide-react';

interface StoriesBarProps {
  groups: StoryGroup[];
  currentUserId: string;
  onOpenStory: (group: StoryGroup, storyIndex: number) => void;
  onRefresh: () => void;
}

export function StoriesBar({ groups, currentUserId, onOpenStory, onRefresh }: StoriesBarProps) {
  const { profile, accessLevel } = useAuth();
  const { show } = useToast();
  const [uploading, setUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canInteract = accessLevel === 'approved' || accessLevel === 'admin';

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
      onRefresh();
    } catch (err) {
      show((err as Error).message || 'Khalad story upload', 'error');
    } finally {
      setUploading(false);
    }
  };

  const myGroup = groups.find((g) => g.user_id === currentUserId);
  const otherGroups = groups.filter((g) => g.user_id !== currentUserId);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-4">
      <div className="flex items-center gap-4 overflow-x-auto scrollbar-hide pb-1">
        {/* My story / Upload - only for approved users */}
        {canInteract && (
        <div className="flex-shrink-0 flex flex-col items-center gap-1">
          <button
            onClick={() => (myGroup ? onOpenStory(myGroup, 0) : setShowUploadModal(true))}
            className="relative w-16 h-16 rounded-full flex items-center justify-center"
          >
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name}
                className={`w-16 h-16 rounded-full object-cover ${
                  myGroup ? 'ring-[3px] ring-emerald-500 ring-offset-2' : 'ring-2 ring-slate-200'
                }`}
              />
            ) : (
              <div
                className={`w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-xl font-bold text-white ${
                  myGroup ? 'ring-[3px] ring-emerald-500 ring-offset-2' : 'ring-2 ring-slate-200'
                }`}
              >
                {profile?.full_name?.charAt(0).toUpperCase()}
              </div>
            )}
            {!myGroup && (
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-600 border-2 border-white flex items-center justify-center">
                <Plus className="w-3.5 h-3.5 text-white" />
              </div>
            )}
          </button>
          <span className="text-xs text-slate-600 font-medium max-w-[70px] truncate">
            {myGroup ? 'Story-gaaga' : 'Ku Dar'}
          </span>
        </div>
        )}

        {/* Divider */}
        {otherGroups.length > 0 && <div className="h-12 w-px bg-slate-200 flex-shrink-0" />}

        {/* Other stories */}
        {otherGroups.map((group) => (
          <div key={group.user_id} className="flex-shrink-0 flex flex-col items-center gap-1">
            <button
              onClick={() => {
                const firstUnviewed = group.stories.findIndex((s) => !s.viewed_by_me);
                onOpenStory(group, firstUnviewed >= 0 ? firstUnviewed : 0);
              }}
              className="relative"
            >
              <div
                className={`rounded-full p-[3px] ${
                  group.has_unviewed
                    ? 'bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600'
                    : 'bg-slate-300'
                }`}
              >
                <div className="bg-white rounded-full p-[2px]">
                  {group.avatar_url ? (
                    <img
                      src={group.avatar_url}
                      alt={group.full_name}
                      className="w-14 h-14 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-slate-200 flex items-center justify-center text-lg font-bold text-slate-600">
                      {group.full_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
            </button>
            <span className="text-xs text-slate-600 font-medium max-w-[70px] truncate">
              {group.full_name.split(' ')[0]}
            </span>
          </div>
        ))}

        {otherGroups.length === 0 && !myGroup && (
          <div className="flex items-center justify-center flex-1 text-sm text-slate-400 py-4">
            {canInteract ? 'Wali storyo ma jiraan. Ugu horaad ku dar story!' : 'Wali storyo ma jiraan.'}
          </div>
        )}
      </div>

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
                <X className="w-5 h-5 text-slate-600" />
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
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-slate-200 hover:border-emerald-400 transition-colors"
                >
                  <Camera className="w-8 h-8 text-emerald-500" />
                  <span className="text-sm font-medium text-slate-700">Sawir</span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-slate-200 hover:border-emerald-400 transition-colors"
                >
                  <VideoIcon className="w-8 h-8 text-blue-500" />
                  <span className="text-sm font-medium text-slate-700">Video</span>
                </button>
              </div>
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
    </div>
  );
}
