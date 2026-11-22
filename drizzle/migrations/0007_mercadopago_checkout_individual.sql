CREATE TABLE public.mercadopago_credentials (
 user_id uuid PRIMARY KEY,
 token_ciphertext text NOT NULL,
 collector_id text NOT NULL,
 is_test boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.mercadopago_credentials TO service_role;
ALTER TABLE public.mercadopago_credentials ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.checkout_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
 access_token text NOT NULL UNIQUE,
 amount numeric(12,2) NOT NULL CHECK (amount > 0),
 currency text NOT NULL DEFAULT 'BRL' CHECK (currency = 'BRL'),
 plan_name text NOT NULL,
 duration_days integer NOT NULL CHECK (duration_days > 0),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','refunded','charged_back','cancelled')),
 collector_id text NOT NULL,
 mp_payment_id text UNIQUE,
 qr_code text,
 qr_base64 text,
 pix_expires_at timestamptz,
 link_expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
 attempt integer NOT NULL DEFAULT 0,
 requesting_at timestamptz,
 paid_at timestamptz,
 renewed_until date,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.checkout_orders TO service_role;
ALTER TABLE public.checkout_orders ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX checkout_one_pending_per_client ON public.checkout_orders(cliente_id) WHERE status = 'pending';
CREATE INDEX checkout_owner_index ON public.checkout_orders(user_id, created_at DESC);
ALTER TABLE public.pagamentos ADD COLUMN checkout_order_id uuid UNIQUE REFERENCES public.checkout_orders(id) ON DELETE SET NULL;

CREATE FUNCTION public.reserve_pix_attempt(_order_id uuid) RETURNS integer
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE o public.checkout_orders;
BEGIN
 SELECT * INTO o FROM public.checkout_orders WHERE id = _order_id FOR UPDATE;
 IF NOT FOUND OR o.status <> 'pending' OR o.link_expires_at <= now() THEN RAISE EXCEPTION 'Cobrança indisponível'; END IF;
 IF o.mp_payment_id IS NOT NULL AND o.pix_expires_at > now() THEN RETURN 0; END IF;
 IF o.requesting_at > now() - interval '60 seconds' THEN RAISE EXCEPTION 'Pix em preparação. Aguarde e tente novamente.'; END IF;
 IF o.requesting_at IS NULL THEN o.attempt := o.attempt + 1; END IF;
 UPDATE public.checkout_orders SET attempt = o.attempt, requesting_at = now() WHERE id = o.id;
 RETURN o.attempt;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_pix_attempt(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_pix_attempt(uuid) TO service_role;

CREATE FUNCTION public.confirm_checkout_payment(_order_id uuid, _payment_id text, _amount numeric, _currency text, _collector_id text, _status text, _paid_at timestamptz) RETURNS boolean
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE o public.checkout_orders; c public.clientes; d date; v date;
BEGIN
 SELECT * INTO o FROM public.checkout_orders WHERE id = _order_id FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF o.amount <> _amount OR o.currency <> _currency OR o.collector_id <> _collector_id THEN RETURN false; END IF;
 IF _status IN ('refunded','charged_back') THEN
   IF o.status <> 'paid' OR o.mp_payment_id IS DISTINCT FROM _payment_id THEN RETURN false; END IF;
   UPDATE public.checkout_orders SET status = _status WHERE id = o.id;
   UPDATE public.clientes SET status = 'suspenso' WHERE id = o.cliente_id AND user_id = o.user_id AND data_vencimento = o.renewed_until;
   RETURN true;
 END IF;
 IF _status <> 'approved' OR o.status <> 'pending' OR _paid_at IS NULL THEN RETURN false; END IF;
 SELECT * INTO c FROM public.clientes WHERE id = o.cliente_id AND user_id = o.user_id FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 d := (_paid_at AT TIME ZONE 'America/Sao_Paulo')::date;
 v := GREATEST(COALESCE(c.data_vencimento, d), d) + o.duration_days;
 INSERT INTO public.pagamentos(user_id, cliente_id, valor, data_pagamento, forma, observacao, checkout_order_id)
 VALUES(o.user_id, o.cliente_id, o.amount, d, 'pix', 'Pix confirmado pelo Mercado Pago', o.id);
 UPDATE public.clientes SET data_vencimento = v, status = 'ativo' WHERE id = c.id;
 UPDATE public.checkout_orders SET status = 'paid', mp_payment_id = _payment_id, paid_at = _paid_at, renewed_until = v, requesting_at = NULL WHERE id = o.id;
 RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.confirm_checkout_payment(uuid,text,numeric,text,text,text,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_checkout_payment(uuid,text,numeric,text,text,text,timestamptz) TO service_role;