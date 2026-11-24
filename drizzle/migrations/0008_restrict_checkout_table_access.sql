REVOKE ALL ON public.mercadopago_credentials FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.checkout_orders FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.mercadopago_credentials TO service_role;
GRANT ALL ON public.checkout_orders TO service_role;