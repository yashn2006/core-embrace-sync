
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS image_url TEXT;

DROP POLICY IF EXISTS "chat_read_auth" ON storage.objects;
CREATE POLICY "chat_read_auth" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-attachments');

DROP POLICY IF EXISTS "chat_upload_own" ON storage.objects;
CREATE POLICY "chat_upload_own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "chat_delete_own" ON storage.objects;
CREATE POLICY "chat_delete_own" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

DO $seed$
DECLARE
  owner_id UUID;
  batch_id UUID;
  new_lead_id UUID;
BEGIN
  SELECT id INTO owner_id FROM public.profiles WHERE email = 'parkarsaad2021@gmail.com' LIMIT 1;
  IF owner_id IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.leads LIMIT 1) THEN RETURN; END IF;

  INSERT INTO public.import_batches (org_id, uploaded_by, assigned_to, filename, row_count)
  VALUES ('00000000-0000-0000-0000-000000000001', owner_id, owner_id, 'seed_demo.csv', 12)
  RETURNING id INTO batch_id;

  INSERT INTO public.leads (org_id, name, email, phone, company, description, source, stage, deal_value, assigned_to, created_by, import_batch_id, next_follow_up)
  VALUES
  ('00000000-0000-0000-0000-000000000001', 'Rohan Mehta', 'rohan@pixelcafe.in', '+91 98200 11122', 'Pixel Gaming Cafe', 'Wants a full website + booking system for their new outlet.', 'website', 'new', 2500, owner_id, owner_id, batch_id, now() + interval '2 days'),
  ('00000000-0000-0000-0000-000000000001', 'Aisha Khan', 'aisha@lumibrew.co', '+971 50 111 2233', 'LumiBrew Coffee', 'Rebrand + Shopify migration for 3 stores in Dubai.', 'referral', 'contacted', 8500, owner_id, owner_id, batch_id, now() + interval '1 day'),
  ('00000000-0000-0000-0000-000000000001', 'Marco Rossi', 'marco@velostudio.it', '+39 340 998 7712', 'Velo Studio', 'Landing page for their new cycling gear line.', 'linkedin', 'interested', 3200, owner_id, owner_id, batch_id, now() + interval '3 days'),
  ('00000000-0000-0000-0000-000000000001', 'Nadia Rahman', 'nadia@bloomivf.com', '+880 1711 223344', 'Bloom IVF', 'Patient portal + booking flow.', 'cold_outreach', 'meeting_scheduled', 12500, owner_id, owner_id, batch_id, now() + interval '5 days'),
  ('00000000-0000-0000-0000-000000000001', 'Kabir Anand', 'kabir@sprintcrm.io', '+91 99870 44556', 'Sprint CRM', 'CRM integration + custom dashboards.', 'website', 'proposal_sent', 15000, owner_id, owner_id, batch_id, now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000001', 'Lena Vogel', 'lena@nordkraft.de', '+49 151 22334455', 'Nordkraft GmbH', 'Full brand + design system.', 'referral', 'proposal_sent', 22000, owner_id, owner_id, batch_id, now() + interval '2 days'),
  ('00000000-0000-0000-0000-000000000001', 'Diego Alvarez', 'diego@surfschool.mx', NULL, 'Baja Surf School', 'Booking widget + Instagram integration.', 'whatsapp', 'contacted', 1800, owner_id, owner_id, batch_id, now() + interval '4 days'),
  ('00000000-0000-0000-0000-000000000001', 'Fatima Noor', 'fatima@atelierno.com', '+92 300 1234567', 'Atelier No.', 'E-commerce for handmade jewelry.', 'linkedin', 'new', 4500, owner_id, owner_id, batch_id, now() + interval '1 day'),
  ('00000000-0000-0000-0000-000000000001', 'Yuki Tanaka', 'yuki@matcharoom.jp', '+81 90 1234 5678', 'Matcha Room', 'Small ordering site + loyalty.', 'website', 'won', 6800, owner_id, owner_id, batch_id, NULL),
  ('00000000-0000-0000-0000-000000000001', 'Samuel Okafor', 'samuel@velaralogistics.com', '+234 803 445 6677', 'Velara Logistics', 'Route tracking dashboard.', 'cold_outreach', 'interested', 9200, owner_id, owner_id, batch_id, now() + interval '6 days'),
  ('00000000-0000-0000-0000-000000000001', 'Priya Sharma', 'priya@luxeorganics.in', '+91 98111 22333', 'Luxe Organics', 'Skincare DTC storefront.', 'referral', 'lost', 3000, owner_id, owner_id, batch_id, NULL),
  ('00000000-0000-0000-0000-000000000001', 'Chen Wei', 'chen@fluxfin.hk', '+852 6123 4567', 'FluxFin', 'Investor portal MVP.', 'linkedin', 'meeting_scheduled', 18000, owner_id, owner_id, batch_id, now() + interval '3 days');

  FOR new_lead_id IN SELECT id FROM public.leads WHERE org_id = '00000000-0000-0000-0000-000000000001' ORDER BY created_at LIMIT 4 LOOP
    INSERT INTO public.activities (lead_id, org_id, type, outcome, response_text, created_by)
    VALUES (new_lead_id, '00000000-0000-0000-0000-000000000001', 'call', 'Interested', 'They liked the initial pitch — sending deck tomorrow.', owner_id);
  END LOOP;

  INSERT INTO public.lost_reasons (lead_id, org_id, reason, note, created_by)
  SELECT id, org_id, 'Price', 'Went with a cheaper freelancer.', owner_id FROM public.leads WHERE stage='lost' LIMIT 1;
END $seed$;
