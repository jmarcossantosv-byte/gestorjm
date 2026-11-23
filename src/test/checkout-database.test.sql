-- Transactional regression test. Run with the database query tool; all rows roll back.
BEGIN;
DO $$
DECLARE
  owner_id uuid := gen_random_uuid();
  client_id uuid := gen_random_uuid();
  other_client_id uuid := gen_random_uuid();
  invoice_id uuid := gen_random_uuid();
  other_invoice_id uuid := gen_random_uuid();
  changed boolean;
BEGIN
  IF has_table_privilege('authenticated', 'public.mercadopago_credentials', 'SELECT')
    OR has_table_privilege('anon', 'public.mercadopago_credentials', 'SELECT') THEN
    RAISE EXCEPTION 'Credentials must be server-only';
  END IF;
  IF has_table_privilege('authenticated', 'public.checkout_orders', 'UPDATE')
    OR has_function_privilege('authenticated', 'public.confirm_checkout_payment(uuid,text,numeric,text,text,text,timestamptz)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Browsers must not confirm invoices';
  END IF;
  INSERT INTO public.clientes(id,user_id,nome,valor,data_vencimento,status)
    VALUES(client_id,owner_id,'Teste SQL Pix',35,'2026-11-01','vencido'),
          (other_client_id,owner_id,'Teste SQL em dia',35,'2026-12-01','ativo');
  INSERT INTO public.checkout_orders(id,user_id,cliente_id,access_token,amount,plan_name,duration_days,collector_id)
    VALUES(invoice_id,owner_id,client_id,replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-',''),35,'Mensal',30,'123'),
          (other_invoice_id,owner_id,other_client_id,replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-',''),35,'Mensal',30,'123');
  changed := public.confirm_checkout_payment(invoice_id,'sql-test-' || invoice_id,34.99,'BRL','123','approved','2026-11-22T15:00:00Z');
  IF changed THEN RAISE EXCEPTION 'Wrong amount accepted'; END IF;
  changed := public.confirm_checkout_payment(invoice_id,'sql-test-' || invoice_id,35,'BRL','456','approved','2026-11-22T15:00:00Z');
  IF changed THEN RAISE EXCEPTION 'Other administrator collector accepted'; END IF;
  changed := public.confirm_checkout_payment(invoice_id,'sql-test-' || invoice_id,35,'BRL','123','pending','2026-11-22T15:00:00Z');
  IF changed THEN RAISE EXCEPTION 'Unapproved payment accepted'; END IF;
  changed := public.confirm_checkout_payment(invoice_id,'sql-test-' || invoice_id,35,'BRL','123','approved','2026-11-22T15:00:00Z');
  IF NOT changed THEN RAISE EXCEPTION 'Approved payment was not registered'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.clientes WHERE id=client_id AND status='ativo' AND data_vencimento='2026-12-22') THEN
    RAISE EXCEPTION 'Expired customer must renew 30 days from payment date';
  END IF;
  changed := public.confirm_checkout_payment(invoice_id,'sql-test-' || invoice_id,35,'BRL','123','approved','2026-11-22T15:00:00Z');
  IF changed OR (SELECT count(*) FROM public.pagamentos WHERE checkout_order_id=invoice_id) <> 1 THEN
    RAISE EXCEPTION 'Repeated notification renewed twice';
  END IF;
  PERFORM public.confirm_checkout_payment(other_invoice_id,'sql-test-' || other_invoice_id,35,'BRL','123','approved','2026-11-22T15:00:00Z');
  IF NOT EXISTS(SELECT 1 FROM public.clientes WHERE id=other_client_id AND data_vencimento='2026-12-31') THEN
    RAISE EXCEPTION 'Current customer must renew from current due date';
  END IF;
  changed := public.confirm_checkout_payment(invoice_id,'other-attempt',35,'BRL','123','refunded','2026-11-22T15:00:00Z');
  IF changed THEN RAISE EXCEPTION 'Refund of unrelated attempt altered access'; END IF;
END;
$$;
ROLLBACK;