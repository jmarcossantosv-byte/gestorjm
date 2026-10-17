ALTER TABLE public.clientes ADD COLUMN nao_enviar_avisos boolean NOT NULL DEFAULT false;

CREATE TABLE public.cobranca_config (
  user_id uuid PRIMARY KEY DEFAULT auth.uid(),
  ativo boolean NOT NULL DEFAULT false,
  mensagem text NOT NULL DEFAULT 'Olá {nome}, seu plano {plano} vence em {data_vencimento}. Valor: R$ {valor}. Para renovar, é só responder esta mensagem. Se não quiser mais receber avisos, responda SAIR.',
  dias_antes integer NOT NULL DEFAULT 2,
  avisar_no_dia boolean NOT NULL DEFAULT true,
  avisar_vencidos boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cobranca_config TO authenticated;
GRANT ALL ON public.cobranca_config TO service_role;
ALTER TABLE public.cobranca_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "config select own" ON public.cobranca_config FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "config insert own" ON public.cobranca_config FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "config update own" ON public.cobranca_config FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "config delete own" ON public.cobranca_config FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER cobranca_config_updated BEFORE UPDATE ON public.cobranca_config FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.avisos_enviados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  data date NOT NULL DEFAULT current_date,
  mensagem text NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, data)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.avisos_enviados TO authenticated;
GRANT ALL ON public.avisos_enviados TO service_role;
ALTER TABLE public.avisos_enviados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "avisos select own" ON public.avisos_enviados FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "avisos insert own" ON public.avisos_enviados FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cliente_id AND c.user_id = auth.uid()));
CREATE POLICY "avisos update own" ON public.avisos_enviados FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "avisos delete own" ON public.avisos_enviados FOR DELETE TO authenticated USING (auth.uid() = user_id);