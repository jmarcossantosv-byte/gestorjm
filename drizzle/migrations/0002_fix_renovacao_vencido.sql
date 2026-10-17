CREATE OR REPLACE FUNCTION public.registrar_pagamento(_cliente_id uuid, _valor numeric, _data_pagamento date, _forma forma_pagamento, _observacao text)
 RETURNS date LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE _dias integer; _venc date; _novo date; _data date := COALESCE(_data_pagamento, current_date);
BEGIN
  SELECT COALESCE(p.duracao_dias, 30), c.data_vencimento INTO _dias, _venc
  FROM public.clientes c LEFT JOIN public.planos p ON p.id = c.plano_id
  WHERE c.id = _cliente_id AND c.user_id = auth.uid()
  FOR UPDATE OF c;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cliente não encontrado'; END IF;
  INSERT INTO public.pagamentos (cliente_id, valor, data_pagamento, forma, observacao)
  VALUES (_cliente_id, _valor, _data, _forma, _observacao);
  -- Se já venceu, renova a partir da data do pagamento; senão, soma ao vencimento atual
  _novo := GREATEST(COALESCE(_venc, _data), _data) + _dias;
  UPDATE public.clientes SET data_vencimento = _novo, status = 'ativo' WHERE id = _cliente_id;
  RETURN _novo;
END;
$function$;