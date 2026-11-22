import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkoutTokenSchema, PAYMENT_SITE, paymentSchema, pixInputSchema } from "./checkout";

export const getMercadoPagoConfig = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("mercadopago_credentials").select("is_test,updated_at").eq("user_id", context.userId).maybeSingle();
  if (error) throw new Error("Não foi possível consultar sua configuração.");
  return { configured: !!data, isTest: data?.is_test ?? false, updatedAt: data?.updated_at ?? null };
});

export const saveMercadoPagoConfig = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ key: z.string().trim().min(20).max(4096) }).parse(input))
  .handler(async ({ context, data }) => {
    const { mercadoPago, MercadoPagoError } = await import("./checkout.server");
    let account: { id: string | number; site_id: string; tags: string[] };
    try {
      account = z.object({ id: z.union([z.string(), z.number()]), site_id: z.string(), tags: z.array(z.string()).default([]) }).parse(await mercadoPago(data.key, "users/me"));
    } catch (error) {
      if (error instanceof MercadoPagoError) throw new Error(`Não foi possível validar a chave. Confira o Access Token no Mercado Pago. (${error.status}: ${error.providerCode})`);
      throw new Error("Não foi possível validar a chave no Mercado Pago. Tente novamente.");
    }
    if (account.site_id !== "MLB") throw new Error("Para este checkout Pix, use uma conta Mercado Pago do Brasil.");
    const { encryptCredential } = await import("./checkout-crypto.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("mercadopago_credentials").upsert({
      user_id: context.userId, token_ciphertext: await encryptCredential(data.key, context.userId),
      collector_id: String(account.id), is_test: account.tags.includes("test_user"), updated_at: new Date().toISOString(),
    });
    if (error) throw new Error("Não foi possível salvar sua chave com segurança.");
    return { configured: true };
  });

export const removeMercadoPagoConfig = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("mercadopago_credentials").delete().eq("user_id", context.userId);
  if (error) throw new Error("Não foi possível remover sua chave.");
  return { configured: false };
});

export const createCheckoutLink = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ clientId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: client, error } = await context.supabase.from("clientes").select("id,valor,plano,planos(nome,duracao_dias)").eq("id", data.clientId).eq("user_id", context.userId).maybeSingle();
    if (error || !client) throw new Error("Cliente não encontrado.");
    if (Number(client.valor) <= 0) throw new Error("Cadastre um valor maior que zero para este cliente.");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { credentialsFor } = await import("./checkout.server");
    const credentials = await credentialsFor(context.userId);
    const { createCheckoutToken } = await import("./checkout-crypto.server");
    const { data: previous, error: previousError } = await db.from("checkout_orders").select("id,access_token,link_expires_at").eq("user_id", context.userId).eq("cliente_id", client.id).eq("status", "pending").maybeSingle();
    if (previousError) throw new Error("Não foi possível consultar a cobrança.");
    if (previous && previous.link_expires_at > new Date().toISOString()) return { url: `${PAYMENT_SITE}/pagar/${previous.access_token}` };
    if (previous) {
      const { error: cancelError } = await db.from("checkout_orders").update({ status: "cancelled" }).eq("id", previous.id).eq("user_id", context.userId).eq("status", "pending");
      if (cancelError) throw new Error("Não foi possível substituir a cobrança vencida.");
    }
    const token = createCheckoutToken();
    const { data: order, error: insertError } = await db.from("checkout_orders").insert({
      user_id: context.userId, cliente_id: client.id, access_token: token, amount: Number(client.valor),
      plan_name: client.planos?.nome ?? client.plano ?? "Assinatura IPTV", duration_days: client.planos?.duracao_dias ?? 30,
      collector_id: credentials.collectorId,
    }).select("access_token").single();
    if (insertError || !order) {
      // A second tab may have created the same pending invoice concurrently.
      const { data: concurrent } = await db.from("checkout_orders").select("access_token").eq("user_id", context.userId).eq("cliente_id", client.id).eq("status", "pending").maybeSingle();
      if (concurrent) return { url: `${PAYMENT_SITE}/pagar/${concurrent.access_token}` };
      throw new Error("Não foi possível criar o link de pagamento.");
    }
    return { url: `${PAYMENT_SITE}/pagar/${order.access_token}` };
  });

export const getPublicCheckout = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: checkoutTokenSchema }).parse(input))
  .handler(async ({ data }) => {
    const { orderByToken, publicOrder } = await import("./checkout.server");
    return publicOrder(await orderByToken(data.token));
  });

export const checkPublicPayment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: checkoutTokenSchema }).parse(input))
  .handler(async ({ data }) => {
    const { orderByToken, syncOrder, publicOrder } = await import("./checkout.server");
    const order = await orderByToken(data.token);
    if (!order.mp_payment_id && !order.requesting_at) return publicOrder(order);
    return publicOrder(await syncOrder(order));
  });

export const createPublicPix = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => pixInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { orderByToken, syncOrder, publicOrder, credentialsFor, mercadoPago, MercadoPagoError } = await import("./checkout.server");
    let order = await orderByToken(data.token);
    if (order.status !== "pending") return publicOrder(order);
    if (order.link_expires_at <= new Date().toISOString()) throw new Error("Este link expirou. Peça um novo link ao administrador.");
    const credentials = await credentialsFor(order.user_id);
    if (credentials.collectorId !== order.collector_id) throw new Error("A conta de recebimento mudou. Peça um novo link ao administrador.");
    if (order.mp_payment_id || order.requesting_at) order = await syncOrder(order);
    if (order.status !== "pending") return publicOrder(order);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: attempt, error } = await db.rpc("reserve_pix_attempt", { _order_id: order.id });
    if (error || attempt === null) throw new Error("Pix em preparação. Aguarde um minuto e tente novamente.");
    if (attempt === 0) return publicOrder(await orderByToken(data.token));
    const expiration = new Date(Date.now() + 30 * 60000);
    const expirationBrasilia = new Date(expiration.getTime() - 3 * 3600000).toISOString().replace("Z", "-03:00");
    try {
      const payment = paymentSchema.parse(await mercadoPago(credentials.token, "v1/payments", {
        idempotencyKey: `pix-${order.id}-${attempt}`,
        body: { transaction_amount: order.amount, payment_method_id: "pix", description: order.plan_name,
          external_reference: order.id, payer: { email: data.email }, date_of_expiration: expirationBrasilia,
          notification_url: `https://project--2e634afc-5c22-4d60-a5da-84b3fb075029${import.meta.env.DEV ? "-dev" : ""}.lovable.app/api/public/mercadopago-webhook?order=${order.id}` },
      }));
      const qr = payment.point_of_interaction?.transaction_data;
      if (!qr?.qr_code || !qr.qr_code_base64) throw new Error("Mercado Pago não retornou o código Pix. Tente novamente em um minuto.");
      const { error: saveError } = await db.from("checkout_orders").update({ mp_payment_id: payment.id, qr_code: qr.qr_code,
        qr_base64: qr.qr_code_base64, pix_expires_at: payment.date_of_expiration ?? expiration.toISOString(), requesting_at: null })
        .eq("id", order.id).eq("status", "pending").eq("attempt", attempt);
      if (saveError) throw new Error("Não foi possível salvar o Pix. Aguarde um minuto e tente novamente.");
      const { confirmFetchedPayment } = await import("./checkout.server");
      await confirmFetchedPayment(order, payment);
      return publicOrder(await orderByToken(data.token));
    } catch (error) {
      // Timeout/5xx keep the attempt for an idempotent retry. A corrected 4xx gets a new attempt.
      if (error instanceof MercadoPagoError && error.status >= 400 && error.status < 500 && error.status !== 429) {
        await db.from("checkout_orders").update({ requesting_at: null }).eq("id", order.id).eq("attempt", attempt).eq("status", "pending");
        if (error.providerCode === "13253") throw new Error("O recebedor precisa cadastrar uma chave Pix na conta do Mercado Pago.");
      }
      if (error instanceof Error && error.name === "TimeoutError") throw new Error("Mercado Pago demorou a responder. Aguarde um minuto e tente novamente.");
      throw error;
    }
  });
