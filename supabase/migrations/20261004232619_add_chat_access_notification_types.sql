/*
# Add chat access notification types to the check constraint

The connection_notifications table has a CHECK constraint on the type column
that only allows connection-related types. The new chat access admin functions
insert notifications with types 'chat_access_approved' and 'chat_access_disabled',
which were rejected by the constraint.
*/

ALTER TABLE public.connection_notifications
  DROP CONSTRAINT IF EXISTS connection_notifications_type_check;

ALTER TABLE public.connection_notifications
  ADD CONSTRAINT connection_notifications_type_check
  CHECK (type = ANY (ARRAY[
    'connection_request',
    'connection_accepted',
    'connection_rejected',
    'connection_removed',
    'chat_access_approved',
    'chat_access_disabled'
  ]));
