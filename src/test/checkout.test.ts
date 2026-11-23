import { describe, it, expect } from "vitest";
import { matchesOrder, paymentNotificationId, paymentSchema, pixInputSchema } from "@/lib/checkout";

const order = { id: "e4e3a6b1-f1d1-4ae8-9612-6be13f3e27c2", amount: 35, currency: "BRL", collector_id: "123" };
const payment = paymentSchema.parse({ id: 1000, external_reference: order.id, status: "approved", transaction_amount: 35, currency_id: "BRL", collector_id: 123 });
describe("Checkout Pix por administrador", () => {
  it("aceita o valor armazenado da cobrança: R$ 35,00", () => expect(matchesOrder(payment, order)).toBe(true));
  it("recusa valor diferente, mesmo com pagamento aprovado", () => expect(matchesOrder({ ...payment, transaction_amount: 34.99 }, order)).toBe(false));
  it("não confirma pagamento na conta de outro administrador", () => expect(matchesOrder({ ...payment, collector_id: "456" }, order)).toBe(false));
  it("não associa por e-mail ou por outra referência", () => expect(matchesOrder({ ...payment, external_reference: "outra-cobranca" }, order)).toBe(false));
  it("não aceita outra moeda", () => expect(matchesOrder({ ...payment, currency_id: "USD" }, order)).toBe(false));
  it("exige e-mail válido do pagador", () => expect(pixInputSchema.safeParse({ token: "a".repeat(64), email: "invalido" }).success).toBe(false));
  it("ignora id malicioso em uma notificação não assinada", () => expect(paymentNotificationId(new URL("https://example.com?type=payment&data.id=../users/me"))).toBeNull());
  it("aceita os dois formatos de notificação de pagamento", () => {
    expect(paymentNotificationId(new URL("https://example.com?type=payment&data.id=1000"))).toBe("1000");
    expect(paymentNotificationId(new URL("https://example.com?topic=payment&id=1000"))).toBe("1000");
  });
  it("ignora outros assuntos", () => expect(paymentNotificationId(new URL("https://example.com?topic=merchant_order&id=1000"))).toBeNull());
});
