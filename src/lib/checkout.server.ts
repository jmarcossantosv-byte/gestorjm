import { z } from "zod";
import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { decryptCredential } from "./checkout-crypto.server";
import { matchesOrder, paymentSchema, type ProviderPayment } from "./checkout";
import type { Database } from "@/integrations/supabase/types";

export type CheckoutOrder = Database["public"]["Tables"]["checkout_orders"]["Row"];
export class MercadoPagoError extends Error {
  constructor(public status: number, public providerCode: string) {
    super(`Mercado Pago (${status}): ${providerCode}`);
  }
}
export async function mercadoPago(token: string, path: string, options: { body?: unknown; idempotencyKey?: string } = {}) {
  const response = await fetch(`https://api.mercadopago.com/${path}`, {
    method: options.body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.idempotencyKey ? { "X-Idempotency-Key": options.idempotencyKey } : {}) },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    // Do not log response bodies: providers can echo credentials or buyer data.
    const body = await response.json().catch(() => ({})) as { error?: unknown; cause?: { code?: unknown }[] };
    const candidate = body.cause?.[0]?.code ?? body.error;
    const code = typeof candidate === "number" ? String(candidate)
      : typeof candidate === "string" && /^[a-z_]{1,60}$/.test(candidate) ? candidate : "solicitacao_recusada";
    console.error("Mercado Pago request failed", response.status, code);
    throw new MercadoPagoError(response.status, code);
  }
  return response.json() as Promise<unknown>;
}
export async function credentialsFor(userId: string) {
  const { data, error } = await db.from("mercadopago_credentials").select("token_ciphertext,collector_id,is_test").eq("user_id", userId).maybeSingle();
  if (error) throw new Error("Não foi possível consultar a configuração de pagamento.");
  if (!data) throw new Error("O administrador ainda não configurou o Mercado Pago.");
  return { token: await decryptCredential(data.token_ciphertext, userId), collectorId: data.collector_id, isTest: data.is_test };
}
export async function orderByToken(token: string) {
  const { data, error } = await db.from("checkout_orders").select("*").eq("access_token", token).maybeSingle();
  if (error) throw new Error("Não foi possível consultar a cobrança.");
  if (!data) throw new Error("Link de pagamento inválido ou indisponível.");
  return data;
}
export async function confirmFetchedPayment(order: CheckoutOrder, payment: ProviderPayment) {
  if (!matchesOrder(payment, order)) return false;
  if (!["approved", "refunded", "charged_back"].includes(payment.status)) return false;
  if (payment.status === "approved" && !payment.date_approved) return false;
  const { data, error } = await db.rpc("confirm_checkout_payment", {
    _order_id: order.id, _payment_id: payment.id, _amount: payment.transaction_amount,
    _currency: payment.currency_id, _collector_id: payment.collector_id, _status: payment.status,
    _paid_at: payment.date_approved ?? new Date().toISOString(),
  });
  if (error) throw new Error("Não foi possível registrar a confirmação do Pix.");
  return data;
}
export async function syncOrder(order: CheckoutOrder) {
  const credentials = await credentialsFor(order.user_id);
  if (order.mp_payment_id) {
    try {
      const payment = paymentSchema.parse(await mercadoPago(credentials.token, `v1/payments/${order.mp_payment_id}`));
      await confirmFetchedPayment(order, payment);
    } catch (error) { if (!(error instanceof MercadoPagoError && error.status === 404)) throw error; }
  }
  // Search recovers approvals from old/expired attempts and lost callbacks.
  if (order.status === "pending") {
    const result = z.object({ results: z.array(paymentSchema) }).parse(await mercadoPago(credentials.token, `v1/payments/search?external_reference=${encodeURIComponent(order.id)}&sort=date_created&criteria=desc&limit=50`));
    for (const payment of result.results) {
      if (payment.status === "approved") await confirmFetchedPayment(order, payment);
    }
  }
  return orderByToken(order.access_token);
}
export async function publicOrder(order: CheckoutOrder) {
  const { data: client } = await db.from("clientes").select("nome,data_vencimento").eq("id", order.cliente_id).eq("user_id", order.user_id).maybeSingle();
  if (!client) throw new Error("Cobrança indisponível.");
  const { data: brand } = await db.from("brand_settings").select("nome,contato,logo_path").eq("user_id", order.user_id).maybeSingle();
  let logo: string | null = null;
  if (brand?.logo_path) {
    const { data } = await db.storage.from("brand-logos").createSignedUrl(brand.logo_path, 600);
    logo = data?.signedUrl ?? null;
  }
  const { data: credentials } = await db.from("mercadopago_credentials").select("is_test").eq("user_id", order.user_id).maybeSingle();
  return { name: client.nome.split(" ")[0] || "Cliente", plan: order.plan_name, amount: order.amount,
    dueDate: client.data_vencimento, status: order.status, renewedUntil: order.renewed_until,
    expired: order.link_expires_at <= new Date().toISOString(),
    brand: brand?.nome || "JM Play", contact: brand?.contato || "", logo,
    configured: !!credentials, isTest: credentials?.is_test ?? false,
    qrCode: order.status === "pending" ? order.qr_code : null,
    qrBase64: order.status === "pending" ? order.qr_base64 : null,
    pixExpiresAt: order.pix_expires_at };
}
export async function handlePaymentNotification(orderId: string, paymentId: string) {
  const { data: order, error } = await db.from("checkout_orders").select("*").eq("id", orderId).maybeSingle();
  if (error) throw new Error("Falha ao consultar cobrança.");
  if (!order) return;
  const credentials = await credentialsFor(order.user_id);
  try {
    const payment = paymentSchema.parse(await mercadoPago(credentials.token, `v1/payments/${paymentId}`));
    await confirmFetchedPayment(order, payment);
  } catch (error) { if (!(error instanceof MercadoPagoError && error.status === 404)) throw error; }
}