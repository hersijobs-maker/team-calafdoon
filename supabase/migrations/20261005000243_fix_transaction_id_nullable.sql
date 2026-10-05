/*
# Fix: allow NULL transaction_id on chat_unlock_payments

The new payment flow doesn't require a transaction_id from the user (they just
upload a screenshot). The old schema had transaction_id as NOT NULL. Make it
nullable to support the new flow.
*/

ALTER TABLE public.chat_unlock_payments ALTER COLUMN transaction_id DROP NOT NULL;
