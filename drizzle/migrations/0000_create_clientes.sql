CREATE TYPE public.cliente_status AS ENUM ('ativo','vencido','suspenso');
CREATE TABLE public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  nome text NOT NULL,
  whatsapp text,
  email text,
  plano text,
  valor numeric(10,2) NOT NULL DEFAULT 0,
  data_vencimento date,
  status public.cliente_status NOT NULL DEFAULT 'ativo',
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX clientes_user_id_idx ON public.clientes(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select own" ON public.clientes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert own" ON public.clientes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own" ON public.clientes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete own" ON public.clientes FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER clientes_updated_at BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();