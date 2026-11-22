import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { paymentNotificationId } from "@/lib/checkout";

export const Route = createFileRoute("/api/public/mercadopago-webhook")({
  server: { handlers: { POST: async ({ request }) => {
    const url = new URL(request.url);
    const paymentId = paymentNotificationId(url);
    const orderId = z.string().uuid().safeParse(url.searchParams.get("order"));
    if (!paymentId || !orderId.success) return new Response("ok", { status: 200 });
    // The notification is only a hint, never authority to mutate data.
    // Read the payment with the order owner's credential and verify its reference, amount, currency and collector.
    try {
      const { handlePaymentNotification } = await import("@/lib/checkout.server");
      await handlePaymentNotification(orderId.data, paymentId);
      return new Response("ok", { status: 200 });
    } catch {
      return new Response("Tente novamente", { status: 500 });
    }
  } } },
});