/*
# Create contact_messages and notifications tables

## Purpose
1. `contact_messages` — stores "Contact Us / Nala Soo Xiriir" form submissions from both website and Android app. Admins can view and manage these.
2. `notifications` — general notifications table for user-facing alerts (connection requests, message notifications, payment approvals, etc.). The mobile app already queries this table but it did not exist.

## New Tables

### contact_messages
- `id` (uuid, PK)
- `name` (text, not null) — sender's name
- `email` (text, not null) — sender's email or phone
- `subject` (text, not null) — message subject
- `message` (text, not null) — message body
- `user_id` (uuid, nullable) — authenticated user's ID if logged in
- `status` (text, default 'new') — new/read/replied/archived
- `admin_notes` (text, nullable) — admin's internal notes
- `created_at` (timestamptz, default now())
- `replied_at` (timestamptz, nullable)

### notifications
- `id` (uuid, PK)
- `user_id` (uuid, not null) — recipient user ID
- `type` (text, not null) — notification type (connection_request, connection_accepted, message, payment_approved, payment_rejected, like, etc.)
- `actor_id` (uuid, nullable) — user who triggered the notification
- `actor_name` (text, nullable) — actor's display name
- `actor_avatar` (text, nullable) — actor's avatar URL
- `data` (jsonb, nullable) — additional notification data
- `read_at` (timestamptz, nullable) — when the user read the notification
- `created_at` (timestamptz, default now())

## Security
- `contact_messages`: Anyone (anon + authenticated) can INSERT. Only authenticated users can SELECT (admin will see all). Users can see their own; admins see all.
- `notifications`: Authenticated users can SELECT/UPDATE only their own notifications. System inserts via triggers/functions.

## Important Notes
1. RLS enabled on both tables.
2. Four separate policies per table (SELECT, INSERT, UPDATE, DELETE).
3. contact_messages allows anon INSERT so unauthenticated visitors can contact.
4. notifications is owner-scoped (user_id = auth.uid()).
*/

-- ============================================================
-- contact_messages table
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'new',
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  replied_at timestamptz
);

ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a contact message (anon + authenticated)
DROP POLICY IF EXISTS "contact_messages_insert_any" ON contact_messages;
CREATE POLICY "contact_messages_insert_any"
ON contact_messages FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Users can read their own contact messages
DROP POLICY IF EXISTS "contact_messages_select_own" ON contact_messages;
CREATE POLICY "contact_messages_select_own"
ON contact_messages FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true));

-- Admin can update contact messages (status, notes, replied_at)
DROP POLICY IF EXISTS "contact_messages_update_admin" ON contact_messages;
CREATE POLICY "contact_messages_update_admin"
ON contact_messages FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true));

-- Admin can delete contact messages
DROP POLICY IF EXISTS "contact_messages_delete_admin" ON contact_messages;
CREATE POLICY "contact_messages_delete_admin"
ON contact_messages FOR DELETE
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true));

-- ============================================================
-- notifications table
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  actor_id uuid,
  actor_name text,
  actor_avatar text,
  data jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own"
ON notifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can update (mark as read) their own notifications
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own"
ON notifications FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own notifications
DROP POLICY IF EXISTS "notifications_delete_own" ON notifications;
CREATE POLICY "notifications_delete_own"
ON notifications FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Authenticated users can insert notifications (for connection requests etc.)
DROP POLICY IF EXISTS "notifications_insert_auth" ON notifications;
CREATE POLICY "notifications_insert_auth"
ON notifications FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id OR auth.uid() = actor_id);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON contact_messages(status);
CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages(created_at DESC);
