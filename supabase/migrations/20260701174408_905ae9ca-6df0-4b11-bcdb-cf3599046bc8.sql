
-- Extend messages: link to lead, quick-tag, generic file attachments
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quick_tag TEXT,
  ADD COLUMN IF NOT EXISTS attachment_url TEXT,
  ADD COLUMN IF NOT EXISTS attachment_name TEXT,
  ADD COLUMN IF NOT EXISTS attachment_type TEXT;

CREATE INDEX IF NOT EXISTS idx_messages_lead_id ON public.messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_messages_channel_created ON public.messages(channel_type, created_at DESC);

-- Per-channel read receipts so unread badges clear only for the channel opened
CREATE TABLE IF NOT EXISTS public.chat_reads (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_key TEXT NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, channel_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_reads TO authenticated;
GRANT ALL ON public.chat_reads TO service_role;

ALTER TABLE public.chat_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own read receipts"
  ON public.chat_reads FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
