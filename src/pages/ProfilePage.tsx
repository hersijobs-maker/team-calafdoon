import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { Navbar } from '@/components/Navbar';
import { useToast } from '@/components/Toast';
import { supabase } from '@/lib/supabase';
import { usePresence } from '@/lib/usePresence';
import { fetchUserPosts } from '@/lib/social';
import type { Profile, Post } from '@/lib/types';
import {
  User, Mail, Phone, Briefcase, FileText, Lock, Loader2, Check, X,
  Globe, Home, Calendar, Heart, HeartHandshake, Camera, MessageCircle, UserPlus,
  Users, Image as ImageIcon, Film, AtSign, Shield, LogOut, Edit3,
  UserCheck, Clock, MapPin, DollarSign, Flag, Ban,
} from 'lucide-react';
import { ProtectedImage, ProtectedVideo, SecureScreen } from '@/components/ProtectedMedia';
import { ChatPaymentModal } from '@/components/ChatPaymentModal';
import { GENDER_OPTIONS, MARITAL_STATUS_OPTIONS } from '@/lib/constants';
import { useLanguage } from '@/lib/language-context';

type ProfileTab = 'all' | 'mentions' | 'reels' | 'photos';

export function ProfilePage() {
  const { userId } = useParams<{ userId?: string }>();
  const navigate = useNavigate();
  const { profile: myProfile, refreshProfile, signOut } = useAuth();
  const { show } = useToast();
  const onlineIds = usePresence(myProfile?.id);
  const { t } = useLanguage();

  const [viewingProfile, setViewingProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>('all');
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'none' | 'pending' | 'accepted' | 'pending_incoming'>('none');
  const [connActionLoading, setConnActionLoading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [canSend, setCanSend] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string>('none');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [actionBtnLoading, setActionBtnLoading] = useState(false);

  const targetUserId = userId || myProfile?.id;
  const isOwnProfile = !userId || userId === myProfile?.id;

  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    bio: '',
    location: '',
    profession: '',
    age: '',
    gender: '',
    country: '',
    city: '',
    marital_status: '',
    looking_for: '',
    family_info: '',
  });

  const loadProfile = useCallback(async () => {
    if (!targetUserId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', targetUserId)
      .maybeSingle();

    if (error || !data) {
      show('Profiilka lama helin', 'error');
      setLoading(false);
      return;
    }

    const p = data as Profile;
    setViewingProfile(p);

    if (!userId || userId === myProfile?.id) {
      setFormData({
        full_name: p.full_name || '',
        phone: p.phone || '',
        bio: p.bio || '',
        location: p.location || '',
        profession: p.profession || '',
        age: p.age?.toString() || '',
        gender: p.gender || '',
        country: p.country || '',
        city: p.city || '',
        marital_status: p.marital_status || '',
        looking_for: p.looking_for || '',
        family_info: p.family_info || '',
      });
    }
    setLoading(false);
  }, [targetUserId, userId, myProfile?.id, show]);

  const loadConnectionStatus = useCallback(async () => {
    if (!myProfile?.id || !targetUserId || isOwnProfile) return;
    const { data } = await supabase
      .from('member_connections')
      .select('status, requester_id, recipient_id')
      .or(
        `and(requester_id.eq.${myProfile.id},recipient_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},recipient_id.eq.${myProfile.id})`,
      )
      .maybeSingle();

    if (!data) {
      setConnectionStatus('none');
    } else if (data.status === 'accepted') {
      setConnectionStatus('accepted');
    } else if (data.status === 'pending') {
      if (data.requester_id === myProfile.id) {
        setConnectionStatus('pending');
      } else {
        setConnectionStatus('pending_incoming');
      }
    } else {
      setConnectionStatus('none');
    }
  }, [myProfile?.id, targetUserId, isOwnProfile]);

  const loadPosts = useCallback(async () => {
    if (!targetUserId) return;
    setPostsLoading(true);
    const posts = await fetchUserPosts(targetUserId);
    setUserPosts(posts);
    setPostsLoading(false);
  }, [targetUserId]);

  useEffect(() => {
    loadProfile();
    loadConnectionStatus();
    loadPosts();
  }, [loadProfile, loadConnectionStatus, loadPosts]);

  const loadChatAccess = useCallback(async () => {
    if (isOwnProfile) return;
    const [canSendRes, paymentRes] = await Promise.all([
      supabase.rpc('can_send_messages'),
      supabase.rpc('get_my_payment_status'),
    ]);
    setCanSend((canSendRes.data as boolean) || false);
    const pStatus = (paymentRes.data as { status: string }[] | null)?.[0]?.status || 'none';
    setPaymentStatus(pStatus);
  }, [isOwnProfile]);

  useEffect(() => {
    loadChatAccess();
  }, [loadChatAccess]);

  useEffect(() => {
    if (isOwnProfile || !targetUserId) return;
    supabase.rpc('is_blocked_by_me', { p_blocked_id: targetUserId }).then(({ data }) => {
      setIsBlocked((data as boolean) || false);
    });
  }, [isOwnProfile, targetUserId]);

  useEffect(() => {
    if (isOwnProfile && myProfile) {
      setViewingProfile(myProfile);
    }
  }, [isOwnProfile, myProfile]);

  const handleSave = async () => {
    if (!myProfile) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: formData.full_name,
        phone: formData.phone,
        bio: formData.bio || null,
        location: formData.location || null,
        profession: formData.profession || null,
        age: formData.age ? Number(formData.age) : null,
        gender: formData.gender || null,
        country: formData.country || null,
        city: formData.city || null,
        marital_status: formData.marital_status || null,
        looking_for: formData.looking_for || null,
        family_info: formData.family_info || null,
      })
      .eq('id', myProfile.id);

    if (error) {
      show('Lama cusboonaysiin profiilka', 'error');
    } else {
      show('Profiilka waa la cusboonaysiiyay', 'success');
      await refreshProfile();
      await loadProfile();
      setEditing(false);
    }
    setSaving(false);
  };

  const handleAvatarUpload = async (file: File) => {
    if (!myProfile) return;
    if (file.size > 5 * 1024 * 1024) {
      show('Sawirku waa inuu noqdaa in ka yar 5MB', 'error');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      show('Sawirku waa inuu noqdaa JPEG, PNG, WebP ama GIF', 'error');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${myProfile.id}/avatar.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        show('Lama soo geli karo sawirka', 'error');
        setUploadingAvatar(false);
        return;
      }

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', myProfile.id);

      if (updateError) {
        show('Lama cusboonaysiin sawirka', 'error');
      } else {
        show('Sawirka waa la cusboonaysiiyay', 'success');
        await refreshProfile();
        await loadProfile();
      }
    } catch {
      show('Khalad ayaa dhacay', 'error');
    }
    setUploadingAvatar(false);
    setAvatarPreview(null);
  };

  const handleCoverUpload = async (file: File) => {
    if (!myProfile) return;
    if (file.size > 5 * 1024 * 1024) {
      show('Sawirku waa inuu noqdaa in ka yar 5MB', 'error');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      show('Sawirku waa inuu noqdaa JPEG, PNG, WebP ama GIF', 'error');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setCoverPreview(previewUrl);

    setUploadingCover(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${myProfile.id}/cover-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('cover-photos')
        .upload(fileName, file, { upsert: false });

      if (uploadError) {
        show('Lama soo geli karo sawirka cover-ka', 'error');
        setUploadingCover(false);
        return;
      }

      const { data: urlData } = supabase.storage.from('cover-photos').getPublicUrl(fileName);
      const coverUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ cover_photo_url: coverUrl })
        .eq('id', myProfile.id);

      if (updateError) {
        show('Lama cusboonaysiin cover-ka', 'error');
      } else {
        show('Cover-ka waa la cusboonaysiiyay', 'success');
        await refreshProfile();
        await loadProfile();
      }
    } catch {
      show('Khalad ayaa dhacay', 'error');
    }
    setUploadingCover(false);
    setCoverPreview(null);
  };

  const handleSendConnection = async () => {
    if (!myProfile?.id || !targetUserId) return;
    setConnActionLoading(true);
    const { error } = await supabase
      .from('member_connections')
      .insert({ requester_id: myProfile.id, recipient_id: targetUserId });

    if (error) {
      show('Khalad codsiga dherig', 'error');
    } else {
      show('Codsiga dherig waa la diray', 'success');
      setConnectionStatus('pending');
    }
    setConnActionLoading(false);
  };

  const handleAcceptConnection = async () => {
    if (!myProfile?.id || !targetUserId) return;
    setConnActionLoading(true);
    const { data } = await supabase
      .from('member_connections')
      .select('id')
      .eq('requester_id', targetUserId)
      .eq('recipient_id', myProfile.id)
      .maybeSingle();

    if (data) {
      await supabase.rpc('respond_to_connection_request', {
        p_connection_id: (data as { id: string }).id,
        p_accept: true,
      });
      show('Dherig waa la aqbalyay', 'success');
      setConnectionStatus('accepted');
    }
    setConnActionLoading(false);
  };

  const handleMessage = () => {
    if (!viewingProfile) return;
    if (canSend) {
      navigate('/chat', {
        state: {
          newChatUserId: viewingProfile.id,
          newChatName: viewingProfile.full_name,
          newChatAvatar: viewingProfile.avatar_url,
        },
      });
    } else if (paymentStatus === 'pending') {
      return;
    } else {
      setShowPaymentModal(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  if (!viewingProfile) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="flex flex-col items-center justify-center py-20">
          <User className="w-12 h-12 text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">Profiilka lama helin</p>
        </div>
      </div>
    );
  }

  const isOnline = onlineIds.has(viewingProfile.id);
  const photoPosts = userPosts.filter((p) => p.media?.some((m) => m.media_type === 'image'));
  const reelPosts = userPosts.filter((p) => p.media?.some((m) => m.media_type === 'video'));

  const genderLabel = (g: string) => GENDER_OPTIONS.find((o) => o.value === g)?.label_so || null;
  const maritalLabel = (m: string) => MARITAL_STATUS_OPTIONS.find((o) => o.value === m)?.label_so || null;

  return (
    <SecureScreen>
    <div className="min-h-screen bg-slate-100">
      <Navbar />

      <div className="max-w-5xl mx-auto px-0 sm:px-4 sm:py-6">
        {/* Cover + Avatar section */}
        <div className="bg-white sm:rounded-2xl shadow-sm overflow-hidden">
          {/* Cover photo */}
          <div className="relative h-48 sm:h-64 lg:h-72 bg-gradient-to-br from-emerald-400 via-teal-500 to-sky-500 group">
            {coverPreview ? (
              <img src={coverPreview} alt="Cover preview" className="w-full h-full object-cover" />
            ) : viewingProfile.cover_photo_url ? (
              <img src={viewingProfile.cover_photo_url} alt="Cover" className="w-full h-full object-cover" />
            ) : null}

            {/* Cover upload button (own profile only) */}
            {isOwnProfile && (
              <label className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-black/60 text-white text-xs font-medium rounded-lg cursor-pointer hover:bg-black/70 transition-colors backdrop-blur-sm">
                {uploadingCover ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Camera className="w-3.5 h-3.5" />
                )}
                Beddel Cover-ka
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleCoverUpload(e.target.files[0])}
                  disabled={uploadingCover}
                />
              </label>
            )}
          </div>

          {/* Avatar + name + actions */}
          <div className="px-4 sm:px-6 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between -mt-16 sm:-mt-20">
              {/* Avatar */}
              <div className="relative group inline-flex flex-col items-center sm:items-start">
                <div className="relative">
                  <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-full ring-4 ring-white bg-white overflow-hidden shadow-lg">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : viewingProfile.avatar_url ? (
                      <img src={viewingProfile.avatar_url} alt={viewingProfile.full_name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-emerald-100 to-teal-200 flex items-center justify-center text-4xl font-bold text-emerald-700">
                        {viewingProfile.full_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Avatar upload (own profile only) */}
                  {isOwnProfile && (
                    <label className="absolute bottom-1 right-1 w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md cursor-pointer hover:bg-emerald-700 transition-colors ring-2 ring-white">
                      {uploadingAvatar ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Camera className="w-4 h-4" />
                      )}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])}
                        disabled={uploadingAvatar}
                      />
                    </label>
                  )}

                  {/* Online indicator */}
                  {isOnline && (
                    <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-green-500 ring-2 ring-white" />
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 mt-4 sm:mt-0 sm:mb-2">
                {isOwnProfile ? (
                  <>
                    <button
                      onClick={() => setEditing(!editing)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                      Wax beddel profiilka
                    </button>
                    <button
                      onClick={() => setShowPasswordModal(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
                    >
                      <Lock className="w-4 h-4" />
                      <span className="hidden sm:inline">Erayga sirta</span>
                    </button>
                  </>
                ) : (
                  <>
                    {connectionStatus === 'none' && (
                      <button
                        onClick={handleSendConnection}
                        disabled={connActionLoading}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                      >
                        {connActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                        Koodso Dherig
                      </button>
                    )}
                    {connectionStatus === 'pending' && (
                      <button
                        disabled
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-100 text-slate-500 text-sm font-semibold cursor-default"
                      >
                        <Clock className="w-4 h-4" />
                        {t('members.waiting')}
                      </button>
                    )}
                    {connectionStatus === 'pending_incoming' && (
                      <button
                        onClick={handleAcceptConnection}
                        disabled={connActionLoading}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                      >
                        {connActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                        Aqbal Dherig
                      </button>
                    )}
                    {connectionStatus === 'accepted' && (
                      <button
                        disabled
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-semibold cursor-default border border-emerald-200"
                      >
                        <UserCheck className="w-4 h-4" />
                        Dherig
                      </button>
                    )}
                    <button
                      onClick={handleMessage}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        canSend
                          ? 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                          : paymentStatus === 'pending'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                      }`}
                    >
                      {canSend ? (
                        <MessageCircle className="w-4 h-4" />
                      ) : paymentStatus === 'pending' ? (
                        <Clock className="w-4 h-4" />
                      ) : (
                        <DollarSign className="w-4 h-4 text-emerald-600" />
                      )}
                      {canSend
                        ? t('members.message')
                        : paymentStatus === 'pending'
                        ? t('members.waiting')
                        : 'Fariin $1'}
                    </button>
                    <button
                      onClick={() => setShowReportModal(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm font-medium hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                      title="Report"
                    >
                      <Flag className="w-4 h-4" />
                      Report
                    </button>
                    <button
                      onClick={async () => {
                        if (!viewingProfile) return;
                        setActionBtnLoading(true);
                        if (isBlocked) {
                          const { data } = await supabase
                            .from('user_blocks')
                            .delete()
                            .eq('blocked_id', viewingProfile.id);
                          if (!data) setIsBlocked(false);
                        } else {
                          const { error } = await supabase.rpc('block_user', { p_blocked_id: viewingProfile.id });
                          if (!error) setIsBlocked(true);
                        }
                        setActionBtnLoading(false);
                      }}
                      disabled={actionBtnLoading}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 ${
                        isBlocked
                          ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                          : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                      }`}
                      title={isBlocked ? 'Fur xannibka' : 'Xannibi'}
                    >
                      {actionBtnLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                      {isBlocked ? 'Fur Xannibka' : 'Block'}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Name + bio */}
            <div className="mt-3">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900">{viewingProfile.full_name}</h1>
                {isOnline && (
                  <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    {t('profile.online')}
                  </span>
                )}
              </div>
              {viewingProfile.profession && (
                <p className="text-sm text-slate-500 mt-0.5">{viewingProfile.profession}</p>
              )}
              {viewingProfile.bio && (
                <p className="text-sm text-slate-600 mt-2 max-w-2xl leading-relaxed">{viewingProfile.bio}</p>
              )}

              {/* Public info row — always visible to everyone */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-3 text-sm text-slate-600">
                {viewingProfile.gender && (
                  <span className="flex items-center gap-1.5">
                    <User className="w-4 h-4 text-slate-400" />
                    {genderLabel(viewingProfile.gender)}
                  </span>
                )}
                {viewingProfile.city && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    {viewingProfile.city}
                  </span>
                )}
              </div>

              {/* Stats */}
              <div className="flex items-center gap-5 mt-3 text-sm">
                <StatItem icon={Users} label="Dherig" value={0} />
                <StatItem icon={FileText} label={t('profile.posts')} value={userPosts.length} />
                <StatItem icon={ImageIcon} label={t('profile.photos')} value={photoPosts.length} />
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-t border-slate-200 px-4 sm:px-6">
            <div className="flex gap-1 overflow-x-auto">
              {([
                { key: 'all' as const, label: 'Dhamaan', icon: FileText },
                { key: 'mentions' as const, label: 'Mentions', icon: AtSign },
                { key: 'reels' as const, label: 'Reels', icon: Film },
                { key: 'photos' as const, label: t('profile.photos'), icon: ImageIcon },
              ]).map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === tab.key
                        ? 'border-emerald-600 text-emerald-700'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Content area */}
        <div className="grid lg:grid-cols-3 gap-4 mt-4 px-4 sm:px-0">
          {/* Left column — personal details + privacy */}
          <div className="lg:col-span-1 space-y-4">
            {editing ? (
              <EditProfilePanel
                formData={formData}
                setFormData={setFormData}
                saving={saving}
                onSave={handleSave}
                onCancel={() => {
                  setEditing(false);
                  if (myProfile) {
                    setFormData({
                      full_name: myProfile.full_name || '',
                      phone: myProfile.phone || '',
                      bio: myProfile.bio || '',
                      location: myProfile.location || '',
                      profession: myProfile.profession || '',
                      age: myProfile.age?.toString() || '',
                      gender: myProfile.gender || '',
                      country: myProfile.country || '',
                      city: myProfile.city || '',
                      marital_status: myProfile.marital_status || '',
                      looking_for: myProfile.looking_for || '',
                      family_info: myProfile.family_info || '',
                    });
                  }
                }}
              />
            ) : (
              <>
                {/* Personal details card */}
                {isOwnProfile ? (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                    <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <User className="w-4 h-4 text-emerald-600" />
                      {t('profile.details')}
                    </h2>
                    <div className="space-y-3">
                      <DetailRow icon={<Mail className="w-4 h-4" />} label={t('profile.email')} value={viewingProfile.email} />
                      <DetailRow icon={<Phone className="w-4 h-4" />} label={t('profile.phone')} value={viewingProfile.phone} />
                      <DetailRow icon={<Calendar className="w-4 h-4" />} label={t('profile.age')} value={viewingProfile.age?.toString() || null} />
                      <DetailRow icon={<User className="w-4 h-4" />} label={t('profile.gender')} value={genderLabel(viewingProfile.gender || '')} />
                      <DetailRow icon={<Globe className="w-4 h-4" />} label={t('profile.country')} value={viewingProfile.country} />
                      <DetailRow icon={<Home className="w-4 h-4" />} label={t('profile.city')} value={viewingProfile.city} />
                      <DetailRow icon={<Heart className="w-4 h-4" />} label={t('profile.maritalStatus')} value={maritalLabel(viewingProfile.marital_status || '')} />
                      <DetailRow icon={<Briefcase className="w-4 h-4" />} label={t('profile.profession')} value={viewingProfile.profession} />
                      {viewingProfile.family_info && (
                        <DetailRow icon={<HeartHandshake className="w-4 h-4" />} label="Family" value={viewingProfile.family_info} />
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                    <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <User className="w-4 h-4 text-emerald-600" />
                      {t('profile.details')}
                    </h2>
                    <div className="space-y-3">
                      <DetailRow icon={<User className="w-4 h-4" />} label={t('profile.gender')} value={genderLabel(viewingProfile.gender || '')} />
                      <DetailRow icon={<Home className="w-4 h-4" />} label={t('profile.city')} value={viewingProfile.city} />
                    </div>
                  </div>
                )}

                {/* Account actions for own profile */}
                {isOwnProfile && (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-2">
                    <button
                      onClick={() => setShowPasswordModal(true)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors text-left"
                    >
                      <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                        <Lock className="w-4 h-4 text-slate-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">{t('profile.changePassword')}</p>
                        <p className="text-xs text-slate-500">Cusboonaysii erayga sirta</p>
                      </div>
                    </button>
                    <button
                      onClick={async () => { await signOut(); window.location.href = '/login'; }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-50 transition-colors text-left"
                    >
                      <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
                        <LogOut className="w-4 h-4 text-red-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">{t('profile.logout')}</p>
                        <p className="text-xs text-slate-500">Ka bax akoonkaaga</p>
                      </div>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right column — posts grid */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              {postsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                </div>
              ) : activeTab === 'all' ? (
                userPosts.length === 0 ? (
                  <EmptyPosts text="Posto lama helin" />
                ) : (
                  <PostGrid posts={userPosts} />
                )
              ) : activeTab === 'photos' ? (
                photoPosts.length === 0 ? (
                  <EmptyPosts text="Sawirro lama helin" />
                ) : (
                  <PhotoGrid posts={photoPosts} />
                )
              ) : activeTab === 'reels' ? (
                reelPosts.length === 0 ? (
                  <EmptyPosts text="Reels lama helin" />
                ) : (
                  <PostGrid posts={reelPosts} />
                )
              ) : (
                <EmptyPosts text="Mentions lama helin" />
              )}
            </div>
          </div>
        </div>
      </div>

      {showPasswordModal && <PasswordModal onClose={() => setShowPasswordModal(false)} />}
      {showPaymentModal && viewingProfile && (
        <ChatPaymentModal
          onClose={() => setShowPaymentModal(false)}
          onSubmitted={() => {
            setShowPaymentModal(false);
            setPaymentStatus('pending');
          }}
        />
      )}
      {showReportModal && viewingProfile && (
        <ReportModal
          targetName={viewingProfile.full_name}
          onClose={() => setShowReportModal(false)}
          onSubmit={async (reason) => {
            setActionBtnLoading(true);
            const { error } = await supabase.rpc('report_user', {
              p_reported_id: viewingProfile.id,
              p_reason: reason,
            });
            if (error) {
              show(error.message || 'Lama dhaafin report-ka', 'error');
            } else {
              show('Report-ka waa la dhaafiyay. Mahadsanid.', 'success');
              setShowReportModal(false);
            }
            setActionBtnLoading(false);
          }}
          loading={actionBtnLoading}
        />
      )}
    </div>
    </SecureScreen>
  );
}

// ============ Sub-components ============

function StatItem({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="w-4 h-4 text-slate-400" />
      <span className="font-bold text-slate-900">{value}</span>
      <span className="text-slate-500">{label}</span>
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null }) {
  return (
    <div className="flex items-start gap-3">
      <div className="text-slate-400 mt-0.5 flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 font-medium">{label}</p>
        <p className={`text-sm ${value ? 'text-slate-900' : 'text-slate-400 italic'}`}>{value || 'Lama dejiyin'}</p>
      </div>
    </div>
  );
}

function EmptyPosts({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <FileText className="w-10 h-10 text-slate-300 mb-3" />
      <p className="text-slate-500 text-sm">{text}</p>
    </div>
  );
}

function PostGrid({ posts }: { posts: Post[] }) {
  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <div key={post.id} className="rounded-xl border border-slate-200 overflow-hidden">
          {post.caption && (
            <p className="text-sm text-slate-700 p-3">{post.caption}</p>
          )}
          {post.media && post.media.length > 0 && (
            <div className={`grid ${post.media.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} gap-1`}>
              {post.media.slice(0, 4).map((m) => (
                <div key={m.id} className="aspect-square bg-slate-100 overflow-hidden">
                  {m.media_type === 'video' ? (
                    <ProtectedVideo src={m.media_url} className="w-full h-full object-cover media-protected" controls={false} muted />
                  ) : (
                    <ProtectedImage src={m.media_url} alt="" className="w-full h-full object-cover media-protected" />
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-4 px-3 py-2 text-xs text-slate-500">
            <span>{post.like_count ?? 0} likes</span>
            <span>{post.comment_count ?? 0} comments</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function PhotoGrid({ posts }: { posts: Post[] }) {
  const allPhotos = posts.flatMap((p) => p.media?.filter((m) => m.media_type === 'image') || []);
  if (allPhotos.length === 0) return <EmptyPosts text="Sawirro lama helin" />;
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {allPhotos.map((photo) => (
        <div key={photo.id} className="aspect-square rounded-lg overflow-hidden bg-slate-100">
          <ProtectedImage src={photo.media_url} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer media-protected" />
        </div>
      ))}
    </div>
  );
}

interface EditFormData {
  full_name: string;
  phone: string;
  bio: string;
  location: string;
  profession: string;
  age: string;
  gender: string;
  country: string;
  city: string;
  marital_status: string;
  looking_for: string;
  family_info: string;
}

function EditProfilePanel({
  formData,
  setFormData,
  saving,
  onSave,
  onCancel,
}: {
  formData: EditFormData;
  setFormData: React.Dispatch<React.SetStateAction<EditFormData>>;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
      <h2 className="font-bold text-slate-900 flex items-center gap-2">
        <Edit3 className="w-4 h-4 text-emerald-600" />
        Wax beddel profiilka
      </h2>

      <EditField label="Magaca Buuxa">
        <input
          type="text"
          value={formData.full_name}
          onChange={(e) => setFormData((d) => ({ ...d, full_name: e.target.value }))}
          className="form-input"
        />
      </EditField>

      <EditField label="Fahfahinta kooban">
        <textarea
          value={formData.bio}
          onChange={(e) => setFormData((d) => ({ ...d, bio: e.target.value }))}
          className="form-input min-h-[80px] resize-y"
          placeholder="Sheeg wax kasta oo ku saabsan naftaada..."
        />
      </EditField>

      <div className="grid grid-cols-2 gap-3">
        <EditField label={t('profile.age')}>
          <input type="number" value={formData.age} onChange={(e) => setFormData((d) => ({ ...d, age: e.target.value }))} className="form-input" min="18" max="120" />
        </EditField>
        <EditField label={t('profile.gender')}>
          <select value={formData.gender} onChange={(e) => setFormData((d) => ({ ...d, gender: e.target.value }))} className="form-input">
            <option value="">Dooro</option>
            {GENDER_OPTIONS.map((g) => (<option key={g.value} value={g.value}>{g.label_so}</option>))}
          </select>
        </EditField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <EditField label={t('profile.country')}>
          <input type="text" value={formData.country} onChange={(e) => setFormData((d) => ({ ...d, country: e.target.value }))} className="form-input" />
        </EditField>
        <EditField label={t('profile.city')}>
          <input type="text" value={formData.city} onChange={(e) => setFormData((d) => ({ ...d, city: e.target.value }))} className="form-input" />
        </EditField>
      </div>

      <EditField label={t('profile.profession')}>
        <input type="text" value={formData.profession} onChange={(e) => setFormData((d) => ({ ...d, profession: e.target.value }))} className="form-input" />
      </EditField>

      <EditField label={t('profile.maritalStatus')}>
        <select value={formData.marital_status} onChange={(e) => setFormData((d) => ({ ...d, marital_status: e.target.value }))} className="form-input">
          <option value="">Dooro</option>
          {MARITAL_STATUS_OPTIONS.map((m) => (<option key={m.value} value={m.value}>{m.label_so}</option>))}
        </select>
      </EditField>

      <EditField label="Family Information">
        <textarea
          value={formData.family_info}
          onChange={(e) => setFormData((d) => ({ ...d, family_info: e.target.value }))}
          className="form-input min-h-[60px] resize-y"
          placeholder="Macluumaadka qoyska (optional)..."
        />
      </EditField>

      <EditField label="Waxa aad raadinaysay">
        <textarea
          value={formData.looking_for}
          onChange={(e) => setFormData((d) => ({ ...d, looking_for: e.target.value }))}
          className="form-input min-h-[80px] resize-y"
          placeholder="Sheeg waxa aad raadinaysay..."
        />
      </EditField>

      <div className="flex gap-3 pt-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {t('profile.save')}
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
        >
          <X className="w-4 h-4" />
          {t('profile.cancel')}
        </button>
      </div>
    </div>
  );
}

function EditField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function PasswordModal({ onClose }: { onClose: () => void }) {
  const { show } = useToast();
  const { t } = useLanguage();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      show('Erayga sirta ah waa inuu noqdaa ugu yaraan 8 xaraf', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      show('Erayada sirta ah isma waafaqaan', 'error');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      show('Lama cusboonaysiin erayga sirta ah', 'error');
    } else {
      show('Erayga sirta ah waa la cusboonaysiiyay', 'success');
      onClose();
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Beddel Erayga Sirta ah</h2>
        <form onSubmit={handleChange} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Erayga Sirta ah Cusub</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="form-input" placeholder="Ugu yaraan 8 xaraf" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Xaqiiji Erayga Sirta ah</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="form-input" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="flex-1 bg-emerald-600 text-white font-semibold py-2.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Cusboonaysii
            </button>
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-colors">
              {t('common.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ReportModal({
  targetName,
  onClose,
  onSubmit,
  loading,
}: {
  targetName: string;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    onSubmit(reason.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-slate-900 mb-2 flex items-center gap-2">
          <Flag className="w-5 h-5 text-red-600" />
          Report User
        </h2>
        <p className="text-sm text-slate-600 mb-4">
          Waxaad report garaynaysaa <span className="font-semibold">{targetName}</span>.
          Fadlan sheeg sababta.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="form-input min-h-[100px] resize-y"
          placeholder="Sababta report-ka..."
          required
        />
        <div className="flex gap-3 mt-4">
          <button
            type="submit"
            disabled={loading || !reason.trim()}
            className="flex-1 bg-red-600 text-white font-semibold py-2.5 rounded-lg disabled:opacity-50 hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flag className="w-4 h-4" />}
            Report
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
          >
            Jooji
          </button>
        </div>
      </form>
    </div>
  );
}
