import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/Toast';
import {
  toggleLike, addComment, deletePost, updatePost, fetchComments, deleteComment,
} from '@/lib/social';
import type { Post, PostComment } from '@/lib/types';
import { ProtectedImage, ProtectedVideo } from '@/components/ProtectedMedia';
import {
  Heart, MessageCircle, Share2, MoreVertical, Trash2, Pencil,
  ChevronLeft, ChevronRight, X, Send, Loader2, Clock, Lock,
} from 'lucide-react';

interface PostCardProps {
  post: Post;
  onDeleted: () => void;
  onUpdated: () => void;
}

export function PostCard({ post, onDeleted, onUpdated }: PostCardProps) {
  const { profile, accessLevel } = useAuth();
  const navigate = useNavigate();
  const { show } = useToast();
  const [liked, setLiked] = useState(post.liked_by_me || false);
  const [likeCount, setLikeCount] = useState(post.like_count || 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<PostComment[]>(post.comments || []);
  const [commentText, setCommentText] = useState('');
  const [mediaIndex, setMediaIndex] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editCaption, setEditCaption] = useState(post.caption || '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [commentLoading, setCommentLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const canInteract = accessLevel === 'approved' || accessLevel === 'admin';
  const isOwner = profile?.id === post.user_id;
  const media = post.media || [];

  const showGuestMessage = () => {
    if (accessLevel === 'guest') {
      show('Fadlan isdiiwaangeli ama gal akoonkaaga si aad Comment uga bixiso.', 'info');
    } else if (accessLevel === 'pending') {
      show('Akownkaaga wali lama ansixin. Fadlan sug inta maamulka uu ansixinayo.', 'info');
    }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLike = async () => {
    if (!canInteract) {
      showGuestMessage();
      return;
    }
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((c) => (wasLiked ? c - 1 : c + 1));
    try {
      await toggleLike(post.id, wasLiked);
    } catch {
      setLiked(wasLiked);
      setLikeCount((c) => (wasLiked ? c + 1 : c - 1));
    }
  };

  const handleComment = async () => {
    if (!canInteract) {
      showGuestMessage();
      return;
    }
    if (!commentText.trim()) return;
    setCommentLoading(true);
    const newComment = await addComment(post.id, commentText.trim());
    if (newComment) {
      setComments((prev) => [newComment, ...prev]);
      setCommentText('');
    }
    setCommentLoading(false);
  };

  const handleLoadComments = async () => {
    if (showComments) {
      setShowComments(false);
      return;
    }
    const all = await fetchComments(post.id);
    setComments(all);
    setShowComments(true);
  };

  const handleDelete = async () => {
    setActionLoading(true);
    try {
      await deletePost(post.id);
      show('Post waa la tirtiray', 'success');
      onDeleted();
    } catch (err) {
      show((err as Error).message || 'Khalad', 'error');
    }
    setActionLoading(false);
    setConfirmDelete(false);
  };

  const handleEdit = async () => {
    setActionLoading(true);
    try {
      await updatePost(post.id, editCaption);
      show('Post waa la cusbooneysiiyay', 'success');
      setEditing(false);
      onUpdated();
    } catch (err) {
      show((err as Error).message || 'Khalad', 'error');
    }
    setActionLoading(false);
  };

  const handleShare = async () => {
    const url = window.location.origin + '/social';
    try {
      if (navigator.share) {
        await navigator.share({ text: post.caption || 'Eeg post-gan', url });
      } else {
        await navigator.clipboard.writeText(url);
        show('Link waa la koobiyeeyay', 'success');
      }
    } catch {
      // user cancelled share
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      show((err as Error).message || 'Khalad', 'error');
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);
    if (diffMin < 1) return 'hadda';
    if (diffMin < 60) return `${diffMin} daqiiqo`;
    if (diffHr < 24) return `${diffHr} saac`;
    if (diffDay < 7) return `${diffDay} maalin`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const author = post.author;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => author?.id && navigate(`/profile/${author.id}`)}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            {author?.avatar_url ? (
              <img src={author.avatar_url} alt={author.full_name} className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-sm font-bold text-white">
                {author?.full_name?.charAt(0).toUpperCase() || '?'}
              </div>
            )}
            <div className="text-left">
              <p className="font-semibold text-slate-900 text-sm hover:underline">{author?.full_name || 'Isticmaalaha'}</p>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTime(post.created_at)}
              </p>
            </div>
          </button>
        </div>

        {isOwner && canInteract && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <MoreVertical className="w-5 h-5 text-slate-500" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-20 min-w-[140px]">
                <button
                  onClick={() => { setEditing(true); setShowMenu(false); }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                  Wax ka beddel
                </button>
                <button
                  onClick={() => { setConfirmDelete(true); setShowMenu(false); }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Tirtiri
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Media carousel */}
      {media.length > 0 && (
        <div className="relative bg-slate-100">
          <div className="aspect-square max-h-[500px] overflow-hidden">
            {media[mediaIndex]?.media_type === 'image' ? (
              <ProtectedImage
                src={media[mediaIndex]?.media_url}
                alt="Post"
                className="w-full h-full object-cover media-protected"
              />
            ) : (
              <ProtectedVideo
                src={media[mediaIndex]?.media_url}
                controls
                className="w-full h-full object-cover media-protected"
              />
            )}
          </div>

          {media.length > 1 && (
            <>
              {mediaIndex > 0 && (
                <button
                  onClick={() => setMediaIndex((i) => i - 1)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              {mediaIndex < media.length - 1 && (
                <button
                  onClick={() => setMediaIndex((i) => i + 1)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                {media.map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${
                      i === mediaIndex ? 'bg-white' : 'bg-white/40'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 px-4 py-3">
        <button
          onClick={handleLike}
          className="flex items-center gap-1.5 group"
        >
          <Heart
            className={`w-6 h-6 transition-all group-hover:scale-110 ${
              liked ? 'text-red-500 fill-red-500' : 'text-slate-600'
            }`}
          />
          <span className={`text-sm font-medium ${liked ? 'text-red-500' : 'text-slate-600'}`}>
            {likeCount > 0 ? likeCount : ''}
          </span>
        </button>
        <button
          onClick={canInteract ? handleLoadComments : showGuestMessage}
          className="flex items-center gap-1.5 group"
        >
          <MessageCircle className="w-6 h-6 text-slate-600 group-hover:scale-110 transition-transform" />
          <span className="text-sm font-medium text-slate-600">
            {comments.length > 0 ? comments.length : ''}
          </span>
        </button>
        <button onClick={handleShare} className="flex items-center gap-1.5 ml-auto group">
          <Share2 className="w-6 h-6 text-slate-600 group-hover:scale-110 transition-transform" />
        </button>
      </div>

      {/* Caption */}
      {post.caption && !editing && (
        <div className="px-4 pb-3">
          <p className="text-sm text-slate-800">
            <button
              onClick={() => author?.id && navigate(`/profile/${author.id}`)}
              className="font-semibold mr-2 hover:underline"
            >
              {author?.full_name}
            </button>
            {post.caption}
          </p>
        </div>
      )}

      {/* Edit mode */}
      {editing && (
        <div className="px-4 pb-3 space-y-2">
          <textarea
            value={editCaption}
            onChange={(e) => setEditCaption(e.target.value)}
            className="w-full min-h-[60px] resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            maxLength={500}
          />
          <div className="flex gap-2">
            <button
              onClick={handleEdit}
              disabled={actionLoading}
              className="flex items-center gap-1.5 bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Kaydi
            </button>
            <button
              onClick={() => { setEditing(false); setEditCaption(post.caption || ''); }}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              Jooji
            </button>
          </div>
        </div>
      )}

      {/* Comments */}
      {showComments && (
        <div className="px-4 pb-3 space-y-2 border-t border-slate-100 pt-3">
          {comments.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-2">Faallo lama helin</p>
          )}
          {comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2 group">
              <button
                onClick={() => c.author?.id && navigate(`/profile/${c.author.id}`)}
                className="flex-shrink-0 mt-0.5"
              >
                {c.author?.avatar_url ? (
                  <img src={c.author.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                    {c.author?.full_name?.charAt(0).toUpperCase() || '?'}
                  </div>
                )}
              </button>
              <div className="flex-1 min-w-0">
                <div className="bg-slate-50 rounded-xl px-3 py-2">
                  <button
                    onClick={() => c.author?.id && navigate(`/profile/${c.author.id}`)}
                    className="text-xs font-semibold text-slate-900 hover:underline"
                  >
                    {c.author?.full_name}
                  </button>
                  <p className="text-sm text-slate-700">{c.content}</p>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 ml-1">{formatTime(c.created_at)}</p>
              </div>
              {profile?.id === c.user_id && canInteract && (
                <button
                  onClick={() => handleDeleteComment(c.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded text-red-500 hover:bg-red-50 transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Comment input - only for approved users */}
      {canInteract ? (
        <div className="flex items-center gap-2 px-4 py-3 border-t border-slate-100">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">
              {profile?.full_name?.charAt(0).toUpperCase()}
            </div>
          )}
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleComment()}
            placeholder="Faallo qor..."
            className="flex-1 bg-slate-50 rounded-full px-4 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
          <button
            onClick={handleComment}
            disabled={!commentText.trim() || commentLoading}
            className="text-emerald-600 font-semibold text-sm px-2 disabled:opacity-30 transition-opacity"
          >
            {commentLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      ) : (
        <div className="px-4 py-3 border-t border-slate-100">
          <button
            onClick={showGuestMessage}
            className="w-full flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-slate-600 transition-colors py-1"
          >
            <Lock className="w-3.5 h-3.5" />
            {accessLevel === 'guest'
              ? 'Fadlan isdiiwaangeli ama gal akoonkaaga si aad Comment uga bixiso'
              : 'Akownkaaga wali lama ansixin. Fadlan sug inta maamulka uu ansixinayo.'}
          </button>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[75] bg-black/50 flex items-center justify-center p-4" onClick={() => setConfirmDelete(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-slate-900 mb-2">Tirtiri Post?</h3>
            <p className="text-sm text-slate-600 mb-4">Post-gan waa la tirtiri doonaa ee dib looma soo celin karo.</p>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white font-semibold py-2.5 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
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
  );
}
