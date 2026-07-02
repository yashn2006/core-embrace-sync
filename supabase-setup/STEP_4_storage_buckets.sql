-- ============================================================
-- STEP 4 of 6 — Create storage buckets
-- WHERE TO RUN: Supabase Dashboard → SQL Editor → New Query → Paste ALL → Run
-- These buckets are REQUIRED for avatars + chat file attachments.
-- ============================================================

-- Avatars bucket (profile pictures)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  false,
  5242880, -- 5 MB
  ARRAY['image/png','image/jpeg','image/jpg','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Chat attachments bucket (images / files in chat)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments',
  'chat-attachments',
  false,
  10485760, -- 10 MB
  ARRAY['image/png','image/jpeg','image/jpg','image/webp','image/gif','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Done. The RLS policies for storage.objects were already created in STEP 1.
