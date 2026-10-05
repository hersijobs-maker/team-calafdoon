export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  profession: string | null;
  age: number | null;
  gender: string | null;
  country: string | null;
  city: string | null;
  marital_status: string | null;
  looking_for: string | null;
  cover_photo_url: string | null;
  family_info: string | null;
  show_gender: boolean;
  show_age: boolean;
  show_marital_status: boolean;
  show_phone: boolean;
  show_location: boolean;
  registration_status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'blocked';
  is_admin: boolean;
  created_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  chat_access_status: ChatAccessState;
}

export interface ApprovalHistory {
  id: string;
  user_id: string;
  admin_id: string;
  action: 'approved' | 'rejected' | 'blocked' | 'unblocked';
  reason: string | null;
  notes: string | null;
  created_at: string;
}

export interface AdminStats {
  totalUsers: number;
  pendingApprovals: number;
  approvedUsers: number;
  rejectedUsers: number;
  blockedUsers: number;
}

export interface LoginAccessResult {
  user_id: string;
  registration_status: string;
  can_login: boolean;
  is_admin: boolean;
}

export interface ChatConversation {
  id: string;
  user1_id: string;
  user2_id: string;
  created_at: string;
  other_user?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  latest_message?: {
    content: string;
    created_at: string;
    sender_id: string;
  } | null;
  unread_count?: number;
}

export type ChatMessageType = 'text' | 'call_event' | 'voice';
export type CallEventStatus = 'missed' | 'declined' | 'answered' | 'ended' | 'failed';

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
  message_type: ChatMessageType;
  call_status: CallEventStatus | null;
  call_duration_seconds: number | null;
  call_history_id: string | null;
  audio_url: string | null;
  audio_duration_seconds: number | null;
}

export interface DirectoryMember {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  profession: string | null;
  created_at: string;
  age: number | null;
  gender: string | null;
  country: string | null;
  city: string | null;
  marital_status: string | null;
  looking_for: string | null;
}

export type CommunityVisibilityMode = 'open' | 'private';

export type ConnectionStatus = 'pending' | 'accepted' | 'rejected' | 'removed';

export interface MyConnection {
  connection_id: string;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  profession: string | null;
  country: string | null;
  city: string | null;
  gender: string | null;
  age: number | null;
  created_at: string;
}

export interface PendingConnectionRequest {
  connection_id: string;
  requester_id: string;
  requester_name: string;
  requester_avatar: string | null;
  created_at: string;
}

export interface ConnectionNotification {
  id: string;
  actor_id: string;
  actor_name: string;
  actor_avatar: string | null;
  type: 'connection_request' | 'connection_accepted' | 'connection_rejected' | 'connection_removed';
  connection_id: string;
  read_at: string | null;
  created_at: string;
}

// ========== Social Media Types ==========

export type MediaType = 'image' | 'video';

export interface PostMedia {
  id: string;
  post_id: string;
  media_url: string;
  media_type: MediaType;
  position: number;
  thumbnail_url: string | null;
}

export interface PostAuthor {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  author?: PostAuthor;
}

export interface Post {
  id: string;
  user_id: string;
  caption: string | null;
  created_at: string;
  updated_at: string;
  author?: PostAuthor;
  media?: PostMedia[];
  like_count?: number;
  comment_count?: number;
  liked_by_me?: boolean;
  comments?: PostComment[];
}

export interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: MediaType;
  thumbnail_url: string | null;
  expires_at: string;
  created_at: string;
  author?: PostAuthor;
  view_count?: number;
  viewed_by_me?: boolean;
}

export interface StoryViewerEntry {
  viewer_id: string;
  full_name: string;
  avatar_url: string | null;
  viewed_at: string;
}

export interface StoryGroup {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  stories: Story[];
  has_unviewed: boolean;
}

// ========== Advertisement Types ==========

export type AdMediaType = 'image' | 'video' | 'gif';

export interface Advertisement {
  id: string;
  title: string;
  description: string | null;
  media_url: string;
  media_type: AdMediaType;
  button_text: string | null;
  button_link: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// ========== Chat Unlock Payment Types ==========

export type ChatUnlockPaymentStatus = 'pending' | 'approved' | 'rejected';
export type ChatAccessState = 'locked' | 'pending_payment' | 'active' | 'disabled';
export type ChatAccessStatus = 'locked' | 'pending' | 'unlocked';
export type ChatAccessType = 'requested_only' | 'all_approved' | 'selected_users';

export interface ChatUnlockPayment {
  id: string;
  user_id: string;
  target_user_id: string;
  user_name: string;
  user_avatar_url: string | null;
  target_name: string;
  target_avatar_url: string | null;
  amount: number;
  currency: string;
  transaction_id: string;
  screenshot_url: string | null;
  status: ChatUnlockPaymentStatus;
  admin_id: string | null;
  admin_name: string | null;
  admin_action_at: string | null;
  chat_access_type: ChatAccessType | null;
  access_start_date: string | null;
  access_end_date: string | null;
  access_duration_months: number | null;
  created_at: string;
}

export interface SelectedUserInfo {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
}

export interface ApprovedUserForSelection {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

// ========== Admin Chat Access Management ==========

export interface AdminChatAccessUser {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  email: string;
  chat_access_status: ChatAccessState;
  payment_id: string | null;
  payment_status: ChatUnlockPaymentStatus | null;
  amount: number | null;
  transaction_id: string | null;
  screenshot_url: string | null;
  payment_created_at: string | null;
}
