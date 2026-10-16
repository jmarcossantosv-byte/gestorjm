CREATE TABLE public.planos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  nome text NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  duracao_dias integer NOT NULL DEFAULT 30 CHECK (duracao_dias > 0),
  numero_telas integer NOT NULL DEFAULT 1 CHECK (numero_telas > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planos TO authenticated;
GRANT ALL ON public.planos TO service_role;
ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "planos select own" ON public.planos FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "planos insert own" ON public.planos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "planos update own" ON public.planos FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "planos delete own" ON public.planos FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER planos_updated_at BEFORE UPDATE ON public.planos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.clientes ADD COLUMN plano_id uuid REFERENCES public.planos(id) ON DELETE SET NULL;

CREATE TYPE public.forma_pagamento AS ENUM ('pix', 'dinheiro', 'cartao', 'outro');

CREATE TABLE public.pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  valor numeric NOT NULL DEFAULT 0,
  data_pagamento date NOT NULL DEFAULT current_date,
  forma public.forma_pagamento NOT NULL DEFAULT 'pix',
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pagamentos_cliente_idx ON public.pagamentos(cliente_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pagamentos TO authenticated;
GRANT ALL ON public.pagamentos TO service_role;
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pagamentos select own" ON public.pagamentos FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "pagamentos insert own" ON public.pagamentos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cliente_id AND c.user_id = auth.uid()));
CREATE POLICY "pagamentos update own" ON public.pagamentos FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pagamentos delete own" ON public.pagamentos FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.registrar_pagamento(
  _cliente_id uuid, _valor numeric, _data_pagamento date, _forma public.forma_pagamento, _observacao text
) RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _dias integer;
  _venc date;
  _novo date;
BEGIN
  SELECT COALESCE(p.duracao_dias, 30), c.data_vencimento INTO _dias, _venc
  FROM public.clientes c LEFT JOIN public.planos p ON p.id = c.plano_id
  WHERE c.id = _cliente_id AND c.user_id = auth.uid()
  FOR UPDATE OF c;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente não encontrado';
  END IF;
  INSERT INTO public.pagamentos (cliente_id, valor, data_pagamento, forma, observacao)
  VALUES (_cliente_id, _valor, COALESCE(_data_pagamento, current_date), _forma, _observacao);
  _novo := COALESCE(_venc, current_date) + _dias;
  UPDATE public.clientes SET data_vencimento = _novo, status = 'ativo' WHERE id = _cliente_id;
  RETURN _novo;
END;
$$;
GRANT EXECUTE ON FUNCTION public.registrar_pagamento(uuid, numeric, date, public.forma_pagamento, text) TO authenticated;