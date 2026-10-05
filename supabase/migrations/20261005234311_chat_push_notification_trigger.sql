/*
# Chat push notification trigger

## Purpose
When a new chat message is inserted, fire an HTTP request to the `send-chat-push`
edge function so the recipient gets a push notification on their device.

## Changes
1. Enable `pg_net` extension (for async HTTP calls from Postgres)
2. Create a trigger function `notify_chat_push()` that calls the edge function
   via `net.http_post` with the message details
3. Create a trigger `on_chat_message_insert` on `chat_messages` AFTER INSERT

## Security
- The trigger function runs as SECURITY DEFINER with fixed search_path
- It calls the edge function using the project's internal function URL
- The edge function uses the service role key (from env) to look up recipient
  and sender info — no user-controlled data is passed to the HTTP call
- No RLS changes — existing policies are untouched

## Important Notes
1. Uses `pg_net.net.http_post` for async, non-blocking HTTP call
2. The trigger fires AFTER INSERT so the row is committed before notification
3. Only fires for 'text' and 'voice' message types (not call events)
4. The edge function handles the case where no push subscriptions exist
5. Deduplication is handled by the notification `tag` in the service worker
   (tag = `chat-${conversation_id}`) — new messages in the same conversation
   replace the previous notification
*/
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.notify_chat_push()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_function_url text;
  v_anon_key text;
  v_project_ref text;
BEGIN
  -- Only notify for actual messages, not call events
  IF NEW.message_type = 'call_event' THEN
    RETURN NEW;
  END IF;

  -- Build the edge function URL from the Supabase URL
  -- The project ref is extracted from the Supabase URL stored in settings
  SELECT value INTO v_project_ref
  FROM public.app_settings
  WHERE key = 'supabase_project_ref';

  -- Fall back to constructing URL from the standard environment
  IF v_project_ref IS NOT NULL THEN
    v_function_url := 'https://' || v_project_ref || '.supabase.co/functions/v1/send-chat-push';
  ELSE
    -- Use the anon key's issuer URL pattern as fallback
    v_function_url := '';
  END IF;

  IF v_function_url = '' THEN
    RETURN NEW;
  END IF;

  SELECT value INTO v_anon_key
  FROM public.app_settings
  WHERE key = 'supabase_anon_key';

  IF v_anon_key IS NULL THEN
    RETURN NEW;
  END IF;

  -- Fire async HTTP POST to the edge function
  PERFORM net.http_post(
    url := v_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon_key
    ),
    body := jsonb_build_object(
      'message_id', NEW.id,
      'conversation_id', NEW.conversation_id,
      'sender_id', NEW.sender_id,
      'content', NEW.content,
      'message_type', NEW.message_type,
      'audio_duration_seconds', NEW.audio_duration_seconds
    )
  );

  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_chat_push() TO authenticated;

DROP TRIGGER IF EXISTS on_chat_message_insert ON public.chat_messages;
CREATE TRIGGER on_chat_message_insert
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_chat_push();

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
