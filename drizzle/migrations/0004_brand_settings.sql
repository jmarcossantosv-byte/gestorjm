CREATE TABLE public.brand_settings (
 user_id uuid PRIMARY KEY DEFAULT auth.uid(),
 nome text NOT NULL DEFAULT '',
 logo_path text,
 contato text NOT NULL DEFAULT '',
 instagram text NOT NULL DEFAULT '',
 site text NOT NULL DEFAULT '',
 rodape text NOT NULL DEFAULT '',
 cor_principal text NOT NULL DEFAULT '#148c85' CHECK (cor_principal ~ '^#[0-9A-Fa-f]{6}$'),
 cor_secundaria text NOT NULL DEFAULT '#246b83' CHECK (cor_secundaria ~ '^#[0-9A-Fa-f]{6}$'),
 visual_personalizado boolean NOT NULL DEFAULT true,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT brand_logo_owner CHECK (logo_path IS NULL OR split_part(logo_path, '/', 1) = user_id::text)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_settings TO authenticated;
GRANT ALL ON public.brand_settings TO service_role;
ALTER TABLE public.brand_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "brand select own" ON public.brand_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "brand insert own" ON public.brand_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "brand update own" ON public.brand_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "brand delete own" ON public.brand_settings FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER brand_updated_at BEFORE UPDATE ON public.brand_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "brand logos select own" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'brand-logos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "brand logos insert own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'brand-logos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "brand logos update own" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'brand-logos' AND (storage.foldername(name))[1] = auth.uid()::text) WITH CHECK (bucket_id = 'brand-logos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "brand logos delete own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'brand-logos' AND (storage.foldername(name))[1] = auth.uid()::text);