import { z } from "zod";

export const checkoutTokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const pixInputSchema = z.object({ token: checkoutTokenSchema, email: z.string().trim().email().max(254) });
export const paymentSchema = z.object({
  id: z.union([z.number(), z.string()]).transform(String),
  external_reference: z.string().nullable(),
  status: z.string(),
  transaction_amount: z.number(),
  currency_id: z.string(),
  collector_id: z.union([z.number(), z.string()]).transform(String),
  date_approved: z.string().nullable().optional(),
  date_of_expiration: z.string().nullable().optional(),
  point_of_interaction: z.object({ transaction_data: z.object({ qr_code: z.string().optional(), qr_code_base64: z.string().optional() }).optional() }).optional(),
});
export type ProviderPayment = z.infer<typeof paymentSchema>;
export function matchesOrder(payment: ProviderPayment, order: { id: string; amount: number; currency: string; collector_id: string }) {
  return payment.external_reference === order.id && Math.round(payment.transaction_amount * 100) === Math.round(order.amount * 100)
    && payment.currency_id === order.currency && payment.collector_id === order.collector_id;
}
export function paymentNotificationId(url: URL) {
  const id = url.searchParams.get("type") === "payment" ? url.searchParams.get("data.id")
    : url.searchParams.get("topic") === "payment" ? url.searchParams.get("id") : null;
  return id && /^\d{1,30}$/.test(id) ? id : null;
}
export const PAYMENT_SITE = "https://gestorjm.lovable.app";
export const brlCheckout = (amount: number) => amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
