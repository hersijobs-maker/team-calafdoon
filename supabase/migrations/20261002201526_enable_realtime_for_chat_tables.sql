-- Add chat tables to the supabase_realtime publication so postgres_changes
-- subscriptions (INSERT events) are delivered to the client in real time.
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
