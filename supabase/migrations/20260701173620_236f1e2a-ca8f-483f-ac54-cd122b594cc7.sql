
DROP POLICY IF EXISTS "chat_read_auth" ON storage.objects;

CREATE POLICY "chat_read_scoped" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.image_url LIKE '%' || storage.objects.name || '%'
        AND (
          m.channel_type = 'team'
          OR m.sender_id = auth.uid()
          OR m.recipient_id = auth.uid()
          OR public.has_role(auth.uid(), 'owner')
        )
    )
  )
);
