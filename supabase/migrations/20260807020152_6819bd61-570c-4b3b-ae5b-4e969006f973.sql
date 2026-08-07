CREATE POLICY "ctir exports own folder select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'ctir-exports' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "ctir exports own folder insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ctir-exports' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "ctir exports own folder update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'ctir-exports' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "ctir exports own folder delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'ctir-exports' AND (storage.foldername(name))[1] = auth.uid()::text);